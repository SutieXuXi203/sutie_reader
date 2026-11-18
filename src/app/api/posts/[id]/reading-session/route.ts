import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { Post } from '@/models/Post';
import { getAuthUser } from '@/lib/auth';
import { canViewPost, type PostContext } from '@/lib/permissions';
import { logApiError, logApiAction } from '@/lib/telegramLogger';
import { recordReadingSession, formatReadingDuration } from '@/lib/trackAccess';

const readingSessionSchema = z.object({
  durationSeconds: z.number().int().min(1).max(86400),
  chapters: z.array(z.string().max(100)).max(50).optional(),
  lastChapter: z.string().max(100).optional(),
  page: z.number().int().min(0).max(1000).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ success: true, message: 'Khách vãng lai, không lưu phiên đọc.' });
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ID bài viết không hợp lệ' }, { status: 400 });
    }

    const rawBody = await request.json().catch(() => null);
    if (!rawBody) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }

    const parsed = readingSessionSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dữ liệu phiên đọc không hợp lệ', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { durationSeconds, chapters, lastChapter, page } = parsed.data;

    // Bỏ qua nếu thời gian đọc dưới 10 giây (tránh click nhầm/lướt qua làm loãng dữ liệu và spam bot Telegram)
    if (durationSeconds < 10) {
      return NextResponse.json({
        success: true,
        message: 'Thời lượng phiên đọc quá ngắn (< 10s), bỏ qua ghi nhận.',
      });
    }

    await connectDB();

    const postForCheck = await Post.findById(id)
      .select('title accessType sharedWith accessedUsers chapters')
      .lean();

    if (!postForCheck) {
      return NextResponse.json({ error: 'Không tìm thấy bài viết' }, { status: 404 });
    }

    const decision = canViewPost(user, postForCheck as unknown as PostContext);
    if (!decision.allowed) {
      return NextResponse.json(
        { error: decision.reason, message: decision.message },
        { status: decision.reason === 'REQUIRE_LOGIN' ? 401 : 403 }
      );
    }

    const { totalReadingTime } = await recordReadingSession(id, user, durationSeconds);

    // Gửi báo cáo kết thúc phiên đọc về Telegram
    void logApiAction({
      module: 'Đọc truyện (Reader)',
      action: 'Kết thúc phiên đọc truyện',
      request,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      details: {
        'Truyện': postForCheck.title,
        'Thời gian đọc phiên này': formatReadingDuration(durationSeconds),
        'Chương đã xem':
          chapters && chapters.length > 0
            ? chapters.join(', ')
            : lastChapter || 'Chương 1',
        ...(typeof page === 'number' ? { 'Trang dừng lại': `Trang ${page + 1}` } : {}),
        'Tổng thời gian đọc tích lũy': formatReadingDuration(totalReadingTime),
      },
      level: 'info',
    });

    return NextResponse.json({
      success: true,
      durationSeconds,
      totalReadingTime,
    });
  } catch (error) {
    console.error('Lỗi khi ghi nhận phiên đọc truyện:', error);
    void logApiError({
      module: '[POST] /api/posts/[id]/reading-session',
      error,
      request,
      statusCode: 500,
    });
    return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
  }
}

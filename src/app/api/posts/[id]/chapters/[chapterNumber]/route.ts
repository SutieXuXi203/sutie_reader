import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectDB } from '@/lib/db';
import { Post } from '@/models/Post';
import { getAuthUser } from '@/lib/auth';
import { canViewChapter, canViewPost, type ChapterContext, type PostContext } from '@/lib/permissions';
import { ensureScrambledImageUrl } from '@/lib/utils';
import { signImageUrls } from '@/lib/image-signing';
import { logApiError } from '@/lib/telegramLogger';

type ChapterRow = ChapterContext & { images?: unknown };

type ChapterLookup = PostContext & {
  chapters?: ChapterContext[];
  target?: ChapterRow | null;
};

/**
 * Danh sách ảnh của MỘT chương (đọc theo từng chương, thay vì gửi ảnh của mọi chương trong một phản hồi).
 * Quyền kiểm tra y hệt `GET /api/posts/[id]`: quyền xem truyện rồi tới quyền xem đúng chương này; URL ảnh vẫn là `/api/image/...`
 * (đi qua route kiểm quyền + xáo trộn), không bao giờ là URL Worker.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; chapterNumber: string }> }
) {
  try {
    const { id, chapterNumber: rawNumber } = await params;
    const chapterNumber = Number(rawNumber);
    if (!ObjectId.isValid(id) || !Number.isInteger(chapterNumber) || chapterNumber < 1) {
      return NextResponse.json({ error: 'Tham số không hợp lệ' }, { status: 400 });
    }

    await connectDB();

    // Chỉ lấy ảnh của đúng chương được hỏi; các chương còn lại chỉ giữ trường cần cho kiểm tra quyền (không tải ảnh/nội dung)
    const [post] = (await Post.aggregate([
      { $match: { _id: new ObjectId(id) } },
      {
        $project: {
          accessType: 1,
          sharedWith: 1,
          translator: 1,
          chapters: {
            $map: {
              input: { $ifNull: ['$chapters', []] },
              as: 'c',
              in: {
                chapterNumber: '$$c.chapterNumber',
                title: '$$c.title',
                translator: '$$c.translator',
                accessType: '$$c.accessType',
                sharedWith: '$$c.sharedWith',
              },
            },
          },
          target: {
            $arrayElemAt: [
              {
                $filter: {
                  input: { $ifNull: ['$chapters', []] },
                  as: 'c',
                  cond: { $eq: ['$$c.chapterNumber', chapterNumber] },
                },
              },
              0,
            ],
          },
        },
      },
    ])) as ChapterLookup[];

    if (!post) {
      return NextResponse.json({ error: 'Không tìm thấy bài viết' }, { status: 404 });
    }

    const user = await getAuthUser(request);
    const postDecision = canViewPost(user, post);
    if (!postDecision.allowed) {
      return NextResponse.json(
        {
          error: postDecision.reason === 'REQUIRE_LOGIN' ? 'unauthorized' : 'forbidden',
          code: postDecision.reason,
          message: postDecision.message,
        },
        { status: postDecision.reason === 'REQUIRE_LOGIN' ? 401 : 403 }
      );
    }

    const target = post.target;
    if (!target) {
      return NextResponse.json({ error: 'Không tìm thấy chương' }, { status: 404 });
    }

    const chapterDecision = canViewChapter(user, post, target);
    if (!chapterDecision.allowed) {
      return NextResponse.json(
        {
          error: chapterDecision.reason === 'REQUIRE_LOGIN' ? 'unauthorized' : 'forbidden',
          code: chapterDecision.reason,
          message: chapterDecision.message,
        },
        { status: chapterDecision.reason === 'REQUIRE_LOGIN' ? 401 : 403 }
      );
    }

    const rawImages = (Array.isArray(target.images) ? target.images : [])
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
    const images = user ? signImageUrls(rawImages, user.id, id) : rawImages.map(ensureScrambledImageUrl);

    return NextResponse.json(
      { chapterNumber, imageCount: images.length, images },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    console.error('Lỗi khi tải ảnh của chương:', error);
    void logApiError({
      module: '[GET] /api/posts/[id]/chapters/[chapterNumber]',
      error,
      request,
      statusCode: 500,
    });
    return NextResponse.json({ error: 'Tải chương không thành công' }, { status: 500 });
  }
}

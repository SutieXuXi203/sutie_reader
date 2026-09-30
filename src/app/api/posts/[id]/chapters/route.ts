import { connectDB } from '@/lib/db';
import { Post } from '@/models/Post';
import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { isAdmin, getAuthUser } from '@/lib/auth';
import { canViewPost, canViewChapter } from '@/lib/permissions';
import { getPostChapters, ensureScrambledImageUrl, type NormalizedPostChapter } from '@/lib/utils';
import { invalidateApiCache } from '@/lib/api-cache';
import { signImageUrls } from '@/lib/image-signing';
import { logApiError, logApiAction } from '@/lib/telegramLogger';

const normalizeImages = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((img): img is string => typeof img === 'string')
    .map((img) => img.trim())
    .filter(Boolean);
};

const toPlainPost = (postDoc: unknown): Record<string, unknown> => {
  if (postDoc && typeof postDoc === 'object') {
    const maybeDocument = postDoc as { toObject?: unknown };
    if (typeof maybeDocument.toObject === 'function') {
      return (maybeDocument.toObject as () => Record<string, unknown>)();
    }
    return postDoc as Record<string, unknown>;
  }
  return {};
};

const serializePost = (postDoc: unknown) => {
  const post = toPlainPost(postDoc);
  const chapters = getPostChapters(post);
  const firstChapter = chapters[0];

  return {
    ...post,
    chapters,
    chapterCount: chapters.length,
    content: firstChapter?.content || '',
    images: firstChapter?.images || [],
  };
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ID bài viết không hợp lệ' }, { status: 400 });
    }

    const post = await Post.findById(id).lean();
    if (!post) {
      return NextResponse.json({ error: 'Không tìm thấy bài viết' }, { status: 404 });
    }

    const user = await getAuthUser(request);
    const serialized: any = serializePost(post);
    const decision = canViewPost(user, serialized);

    if (!decision.allowed) {
      return NextResponse.json(
        {
          error: decision.reason === 'REQUIRE_LOGIN' ? 'unauthorized' : 'forbidden',
          code: decision.reason,
          message: decision.message,
        },
        { status: decision.reason === 'REQUIRE_LOGIN' ? 401 : 403 }
      );
    }

    const userEmail = user?.email?.toLowerCase().trim();
    const chapters = getPostChapters(post);
    
    // Kiểm tra quyền từng chương và lọc dữ liệu nhạy cảm
    const safeChapters = chapters.map((chapter) => {
      const chDecision = canViewChapter(user, serialized, chapter as any);
      const isAllowed = chDecision.allowed;
      const sanitizedSharedWith = user?.role === 'admin'
        ? chapter.sharedWith
        : (Array.isArray(chapter.sharedWith) && userEmail
            ? chapter.sharedWith.filter((s: any) => (s.email || '').toLowerCase().trim() === userEmail)
            : []);

      return {
        ...chapter,
        isLocked: !isAllowed,
        lockReason: isAllowed ? undefined : chDecision.reason,
        lockMessage: isAllowed ? undefined : chDecision.message,
        content: isAllowed ? chapter.content : '',
        images: isAllowed
          ? (user ? signImageUrls(chapter.images || [], user.id) : (chapter.images || []).map(ensureScrambledImageUrl))
          : [],
        sharedWith: sanitizedSharedWith,
      };
    });

    return NextResponse.json({
      chapters: safeChapters,
      chapterCount: safeChapters.length,
    });
  } catch (error) {
    console.error('Lỗi khi tải danh sách chương:', error);
    void logApiError({
      module: '[GET] /api/posts/[id]/chapters',
      error,
      request,
      statusCode: 500,
    });
    return NextResponse.json({ error: 'Tải danh sách chương không thành công' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json({ error: 'Bạn không có quyền thực hiện hành động này' }, { status: 403 });
    }

    await connectDB();
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ID bài viết không hợp lệ' }, { status: 400 });
    }

    const post = await Post.findById(id);
    if (!post) {
      return NextResponse.json({ error: 'Không tìm thấy bài viết' }, { status: 404 });
    }

    const payload = await request.json();
    const content = typeof payload?.content === 'string' ? payload.content.trim() : '';
    const images = normalizeImages(payload?.images);

    if (!content && images.length === 0) {
      return NextResponse.json(
        { error: 'Nội dung chương hoặc ít nhất 1 ảnh là bắt buộc' },
        { status: 400 }
      );
    }

    const currentChapters = getPostChapters(post.toObject());
    const existingNumbers = new Set(currentChapters.map((chapter) => chapter.chapterNumber));
    const maxChapterNumber = currentChapters.reduce(
      (max, chapter) => Math.max(max, chapter.chapterNumber),
      0
    );

    const payloadNumber =
      typeof payload?.chapterNumber === 'number' && Number.isFinite(payload.chapterNumber)
        ? Math.floor(payload.chapterNumber)
        : maxChapterNumber + 1;
    const chapterNumber = payloadNumber > 0 ? payloadNumber : maxChapterNumber + 1;

    if (existingNumbers.has(chapterNumber)) {
      return NextResponse.json(
        { error: `Chương ${chapterNumber} đã tồn tại` },
        { status: 409 }
      );
    }

    const title =
      typeof payload?.title === 'string' && payload.title.trim()
        ? payload.title.trim().slice(0, 120)
        : `Chuong ${chapterNumber}`;

    const translator =
      typeof payload?.translator === 'string' && payload.translator.trim()
        ? payload.translator.trim().slice(0, 100)
        : post.translator || '';

    const accessType =
      payload?.accessType && ['inherit', 'restricted', 'public'].includes(payload.accessType)
        ? payload.accessType
        : 'inherit';

    const newChapter: NormalizedPostChapter = {
      title,
      chapterNumber,
      content,
      images,
      translator,
      accessType,
      sharedWith: [],
    };

    const updatedPost = await Post.findByIdAndUpdate(
      id,
      {
        $push: { chapters: newChapter },
      },
      { returnDocument: 'after', runValidators: true }
    );

    if (!updatedPost) {
      return NextResponse.json({ error: 'Không tìm thấy bài viết' }, { status: 404 });
    }

    const sortedChapters = [...updatedPost.chapters].sort((a, b) => a.chapterNumber - b.chapterNumber);
    const firstChapter = sortedChapters[0];

    const finalPost = await Post.findByIdAndUpdate(
      id,
      {
        chapters: sortedChapters,
        content: firstChapter?.content || '',
        images: firstChapter?.images || [],
      },
      { returnDocument: 'after' }
    ) || updatedPost;

    invalidateApiCache('posts:');

    // Ghi nhận log thêm chương mới lên Telegram
    const authUser = await getAuthUser(request);
    void logApiAction({
      module: 'Quản lý chương (Chapters)',
      action: 'Thêm chương mới',
      request,
      user: authUser,
      details: {
        'Bộ truyện': post.title,
        'Số chương': newChapter.chapterNumber,
        'Tiêu đề chương': newChapter.title,
        'Số lượng ảnh': newChapter.images?.length || 0,
      },
      level: 'success',
    });

    return NextResponse.json({
      chapter: newChapter,
      post: serializePost(finalPost),
    });
  } catch (error) {
    console.error('Lỗi khi thêm chương:', error);
    void logApiError({
      module: '[POST] /api/posts/[id]/chapters',
      error,
      request,
      statusCode: 500,
    });
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Thêm chương không thành công', details: message },
      { status: 500 }
    );
  }
}

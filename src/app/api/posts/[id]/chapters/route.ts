import { connectDB } from '@/lib/db';
import { Post } from '@/models/Post';
import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { isAdmin, getAuthUser } from '@/lib/auth';
import { canViewPost, canViewChapter, type PostContext } from '@/lib/permissions';
import { getPostChapters, ensureScrambledImageUrl, type NormalizedPostChapter } from '@/lib/utils';
import { invalidateApiCache } from '@/lib/api-cache';
import { signImageUrls } from '@/lib/image-signing';
import { normalizeImages } from '@/lib/imageUrls';
import { logApiError, logApiAction } from '@/lib/telegramLogger';

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

type SerializedPost = PostContext & {
  chapters: NormalizedPostChapter[];
  chapterCount: number;
  content: string;
  images: string[];
  accessedUsers?: unknown;
};

const serializePost = (postDoc: unknown): SerializedPost => {
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
    const serialized = serializePost(post);
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
      const chDecision = canViewChapter(user, serialized, chapter);
      const isAllowed = chDecision.allowed;
      const sanitizedSharedWith = user?.role === 'admin'
        ? chapter.sharedWith
        : (Array.isArray(chapter.sharedWith) && userEmail
            ? chapter.sharedWith.filter((s) => (s.email || '').toLowerCase().trim() === userEmail)
            : []);

      return {
        ...chapter,
        isLocked: !isAllowed,
        lockReason: isAllowed ? undefined : chDecision.reason,
        lockMessage: isAllowed ? undefined : chDecision.message,
        content: isAllowed ? chapter.content : '',
        images: isAllowed
          ? (user ? signImageUrls(chapter.images || [], user.id, id) : (chapter.images || []).map(ensureScrambledImageUrl))
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

    const payload = await request.json();
    const content = typeof payload?.content === 'string' ? payload.content.trim() : '';
    const images = normalizeImages(payload?.images);

    if (!content && images.length === 0) {
      return NextResponse.json(
        { error: 'Nội dung chương hoặc ít nhất 1 ảnh là bắt buộc' },
        { status: 400 }
      );
    }

    const requestedNumber =
      typeof payload?.chapterNumber === 'number' && Number.isFinite(payload.chapterNumber) && payload.chapterNumber > 0
        ? Math.floor(payload.chapterNumber)
        : null;

    const title =
      typeof payload?.title === 'string' && payload.title.trim()
        ? payload.title.trim().slice(0, 120)
        : '';

    const accessType =
      payload?.accessType && ['inherit', 'restricted', 'public'].includes(payload.accessType)
        ? payload.accessType
        : 'inherit';

    // Thêm chương bằng thao tác nguyên tử có điều kiện "chưa có chương mang số này": hai request song song
    // không thể cùng chèn một số chương. Nếu số chương do server tự cấp thì tính lại và thử lại khi bị tranh chấp.
    let newChapter: NormalizedPostChapter | null = null;
    let postTitle = '';

    for (let attempt = 0; attempt < 20 && !newChapter; attempt++) {
      if (attempt > 0) {
        // Lùi ngẫu nhiên ngắn để các request tranh chấp cùng số chương không va chạm lại ngay
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 25));
      }

      const post = await Post.findById(id).select('title translator chapters.chapterNumber').lean();
      if (!post) {
        return NextResponse.json({ error: 'Không tìm thấy bài viết' }, { status: 404 });
      }
      postTitle = post.title;

      const existingNumbers = (post.chapters || []).map((chapter) => chapter.chapterNumber);
      const maxChapterNumber = existingNumbers.reduce((max, number) => Math.max(max, number), 0);
      const chapterNumber = requestedNumber ?? maxChapterNumber + 1;

      if (existingNumbers.includes(chapterNumber)) {
        if (requestedNumber !== null) {
          return NextResponse.json(
            { error: `Chương ${chapterNumber} đã tồn tại` },
            { status: 409 }
          );
        }
        continue;
      }

      const candidate: NormalizedPostChapter = {
        title: title || `Chuong ${chapterNumber}`,
        chapterNumber,
        content,
        images,
        translator:
          typeof payload?.translator === 'string' && payload.translator.trim()
            ? payload.translator.trim().slice(0, 100)
            : post.translator || '',
        accessType,
        sharedWith: [],
      };

      const pushed = await Post.updateOne(
        { _id: id, 'chapters.chapterNumber': { $ne: chapterNumber } },
        {
          $push: {
            chapters: { $each: [candidate], $sort: { chapterNumber: 1 } },
          },
        },
        { runValidators: true }
      );

      if (pushed.matchedCount > 0) {
        newChapter = candidate;
      } else if (requestedNumber !== null) {
        return NextResponse.json(
          { error: `Chương ${chapterNumber} đã tồn tại` },
          { status: 409 }
        );
      }
    }

    if (!newChapter) {
      return NextResponse.json(
        { error: 'Không thể cấp số chương do có nhiều thao tác đồng thời. Vui lòng thử lại.' },
        { status: 409 }
      );
    }

    // Đồng bộ nội dung/ảnh "chương đầu" (trường cũ) theo chương có số nhỏ nhất; thao tác này idempotent
    const updatedPost = await Post.findById(id);
    if (!updatedPost) {
      return NextResponse.json({ error: 'Không tìm thấy bài viết' }, { status: 404 });
    }
    const firstChapter = [...updatedPost.chapters].sort((a, b) => a.chapterNumber - b.chapterNumber)[0];
    const finalPost =
      (await Post.findByIdAndUpdate(
        id,
        {
          content: firstChapter?.content || '',
          images: firstChapter?.images || [],
        },
        { returnDocument: 'after' }
      )) || updatedPost;

    invalidateApiCache('posts:');

    // Ghi nhận log thêm chương mới lên Telegram
    const authUser = await getAuthUser(request);
    void logApiAction({
      module: 'Quản lý chương (Chapters)',
      action: 'Thêm chương mới',
      request,
      user: authUser,
      details: {
        'Bộ truyện': postTitle,
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
    return NextResponse.json({ error: 'Thêm chương không thành công' }, { status: 500 });
  }
}

import { connectDB } from '@/lib/db';
import { Post } from '@/models/Post';
import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { isAdmin } from '@/lib/auth';
import { getPostChapters, type NormalizedPostChapter } from '@/lib/utils';

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

    const chapters = getPostChapters(post);
    return NextResponse.json({
      chapters,
      chapterCount: chapters.length,
    });
  } catch (error) {
    console.error('Lỗi khi tải danh sách chương:', error);
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

    if (!content || images.length === 0) {
      return NextResponse.json(
        { error: 'Nội dung chương và ít nhất 1 ảnh là bắt buộc' },
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

    const newChapter: NormalizedPostChapter = {
      title,
      chapterNumber,
      content,
      images,
    };

    const nextChapters = [...currentChapters, newChapter].sort(
      (a, b) => a.chapterNumber - b.chapterNumber
    );

    const updatedPost = await Post.findByIdAndUpdate(
      id,
      {
        chapters: nextChapters,
        content: nextChapters[0]?.content || '',
        images: nextChapters[0]?.images || [],
      },
      { new: true, runValidators: true }
    );

    if (!updatedPost) {
      return NextResponse.json({ error: 'Không tìm thấy bài viết' }, { status: 404 });
    }

    return NextResponse.json({
      chapter: newChapter,
      post: serializePost(updatedPost),
    });
  } catch (error) {
    console.error('Lỗi khi thêm chương:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Thêm chương không thành công', details: message },
      { status: 500 }
    );
  }
}


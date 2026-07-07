import { connectDB } from '@/lib/db';
import { Post } from '@/models/Post';
import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { getPostChapters, type NormalizedPostChapter } from '@/lib/utils';

export const maxDuration = 60;

type IncomingChapter = {
  title?: unknown;
  chapterNumber?: unknown;
  content?: unknown;
  images?: unknown;
};

const normalizeTags = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const rawTag of value) {
    if (typeof rawTag !== 'string') continue;
    const tag = rawTag.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!tag || tag.length > 30) continue;
    if (seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= 20) break;
  }
  return tags;
};

const normalizeImages = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((img): img is string => typeof img === 'string')
    .map((img) => img.trim())
    .filter(Boolean);
};

const normalizeChapter = (
  raw: IncomingChapter,
  index: number
): NormalizedPostChapter | null => {
  const content = typeof raw.content === 'string' ? raw.content.trim() : '';
  const images = normalizeImages(raw.images);

  if (!content && images.length === 0) {
    return null;
  }

  const rawNumber =
    typeof raw.chapterNumber === 'number' && Number.isFinite(raw.chapterNumber)
      ? Math.floor(raw.chapterNumber)
      : index + 1;
  const chapterNumber = rawNumber > 0 ? rawNumber : index + 1;
  const fallbackTitle = `Chuong ${chapterNumber}`;
  const title =
    typeof raw.title === 'string' && raw.title.trim()
      ? raw.title.trim().slice(0, 120)
      : fallbackTitle;

  return {
    title,
    chapterNumber,
    content,
    images,
  };
};

const dedupeAndSortChapters = (
  chapters: NormalizedPostChapter[]
): NormalizedPostChapter[] => {
  const sorted = [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber);
  const usedNumbers = new Set<number>();
  return sorted.map((chapter) => {
    let chapterNumber = chapter.chapterNumber;
    while (usedNumbers.has(chapterNumber)) {
      chapterNumber += 1;
    }
    usedNumbers.add(chapterNumber);
    return {
      ...chapter,
      chapterNumber,
    };
  });
};

const normalizeIncomingChapters = (
  chaptersValue: unknown,
  legacyContent: unknown,
  legacyImages: unknown
): NormalizedPostChapter[] => {
  const chapters = Array.isArray(chaptersValue)
    ? (chaptersValue as IncomingChapter[])
        .map((chapter, index) => normalizeChapter(chapter, index))
        .filter((chapter): chapter is NormalizedPostChapter => chapter !== null)
    : [];

  if (chapters.length > 0) {
    return dedupeAndSortChapters(chapters);
  }

  const fallback = normalizeChapter(
    {
      title: 'Chuong 1',
      chapterNumber: 1,
      content: legacyContent,
      images: legacyImages,
    },
    0
  );

  return fallback ? [fallback] : [];
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

export async function GET() {
  try {
    await connectDB();
    const posts = await Post.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $project: {
          title: 1,
          description: 1,
          tags: 1,
          author: 1,
          createdAt: 1,
          updatedAt: 1,
          firstChapter: { $arrayElemAt: ['$chapters', 0] },
          chapterCount: { $size: { $ifNull: ['$chapters', []] } },
          content: 1,
          images: 1,
        },
      },
    ]);

    const serialized = posts.map((post) => {
      const previewContent = post.firstChapter?.content || post.content || '';
      const previewImages = post.firstChapter?.images || post.images || [];

      return {
        _id: post._id.toString(),
        title: post.title,
        description: post.description || '',
        tags: post.tags || [],
        author: post.author || 'Ẩn danh',
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        chapterCount: post.chapterCount,
        content: previewContent,
        images: previewImages,
      };
    });

    return NextResponse.json(serialized);
  } catch (error) {
    console.error('Lỗi khi tải bài viết:', error);
    return NextResponse.json({ error: 'Tải bài viết không thành công' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json({ error: 'Bạn không có quyền thực hiện hành động này' }, { status: 403 });
    }

    await connectDB();

    const payload = await request.json();
    const rawTitle = typeof payload?.title === 'string' ? payload.title.trim() : '';
    const title = rawTitle.slice(0, 100);

    if (!title) {
      return NextResponse.json({ error: 'Tiêu đề là bắt buộc' }, { status: 400 });
    }

    const normalizedDescription =
      typeof payload?.description === 'string'
        ? payload.description.trim().slice(0, 300)
        : '';
    const normalizedTags = normalizeTags(payload?.tags);
    const normalizedAuthor =
      typeof payload?.author === 'string' && payload.author.trim()
        ? payload.author.trim()
        : 'Ẩn danh';
    const normalizedChapters = normalizeIncomingChapters(
      payload?.chapters,
      payload?.content,
      payload?.images
    );
    const firstChapter = normalizedChapters[0];

    const post = new Post({
      title,
      description: normalizedDescription,
      tags: normalizedTags,
      author: normalizedAuthor,
      chapters: normalizedChapters,
      content: firstChapter?.content || '',
      images: firstChapter?.images || [],
    });

    const savedPost = await post.save();
    return NextResponse.json(serializePost(savedPost), { status: 201 });
  } catch (error) {
    console.error('Lỗi khi tạo bài viết:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Tạo bài viết không thành công', details: message }, { status: 500 });
  }
}


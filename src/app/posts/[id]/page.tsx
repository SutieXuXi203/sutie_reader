import type { Metadata } from 'next';
import { connectDB } from '@/lib/db';
import { Post } from '@/models/Post';
import { ObjectId } from 'mongodb';
import { getPostChapters, protectedImageUrl, getOptimizedImageUrl } from '@/lib/utils';
import PostDetailClient from './PostDetailClient';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/server-auth';
import { canViewChapter, canViewPost, type PostContext } from '@/lib/permissions';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const SITE_NAME = 'Lubu Corp';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return { title: SITE_NAME };
  }

  await connectDB();
  const post = await Post.findById(id)
    .select('title description accessType sharedWith chapters.accessType chapters.sharedWith')
    .lean();

  if (!post) {
    return { title: SITE_NAME };
  }

  // Không lộ tiêu đề/mô tả của truyện hạn chế cho người chưa có quyền xem (thẻ <title>, OG, Twitter)
  const viewer = await getCurrentUser();
  if (!canViewPost(viewer, post as unknown as PostContext).allowed) {
    return { title: SITE_NAME, robots: { index: false, follow: false } };
  }

  const title = post.title || SITE_NAME;
  const description =
    post.description ||
    `Đọc ${title} trên ${SITE_NAME}`;

  // Dùng route /api/og-image/[postId] — public, không cần auth
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const ogImage = `${baseUrl}/api/og-image/${id}`;

  return {
    title: `${title} – ${SITE_NAME}`,
    description,
    openGraph: {
      type: 'article',
      siteName: SITE_NAME,
      title,
      description,
      images: [
        {
          url: ogImage,
          width: 600,
          height: 600,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}


type PostShareLike = {
  email: string;
  userId?: { toString: () => string };
  role?: string;
};

type PostAccessedLike = {
  userId?: { toString: () => string };
  email: string;
  name?: string;
  avatar?: string;
  role?: string;
  lastAccessedAt?: Date | string;
};

type PostDocLike = {
  _id?: { toString: () => string } | string;
  title?: string;
  description?: string;
  author?: string;
  translator?: string;
  tags?: string[];
  accessType?: 'restricted' | 'public';
  sharedWith?: PostShareLike[];
  accessedUsers?: PostAccessedLike[];
  chapters?: unknown;
  content?: unknown;
  images?: unknown;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  toObject?: () => PostDocLike;
  [key: string]: unknown;
};

function toPlainPost(postDoc: unknown): PostDocLike {
  if (postDoc && typeof postDoc === 'object') {
    const doc = postDoc as PostDocLike;
    if (typeof doc.toObject === 'function') {
      return doc.toObject();
    }
    return doc;
  }
  return {};
}

function serializePost(postDoc: unknown) {
  const post = toPlainPost(postDoc);
  const chapters = getPostChapters(post);
  const firstChapter = chapters[0];

  return {
    ...post,
    _id: post._id?.toString() || '',
    title: post.title || '',
    description: post.description || '',
    author: post.author || '',
    translator: post.translator || '',
    tags: post.tags || [],
    accessType: post.accessType || 'restricted',
    sharedWith: Array.isArray(post.sharedWith)
      ? post.sharedWith.map((s) => ({
          email: s.email,
          userId: s.userId ? s.userId.toString() : undefined,
          role: s.role || 'viewer',
        }))
      : [],
    accessedUsers: Array.isArray(post.accessedUsers)
      ? post.accessedUsers.map((u) => ({
          userId: u.userId ? u.userId.toString() : undefined,
          email: u.email,
          name: u.name || u.email.split('@')[0],
          avatar: u.avatar || '',
          role: u.role || 'guest',
          lastAccessedAt: u.lastAccessedAt instanceof Date ? u.lastAccessedAt.toISOString() : u.lastAccessedAt,
        }))
      : [],
    chapters,
    chapterCount: chapters.length,
    content: firstChapter?.content || '',
    images: firstChapter?.images || [],
    createdAt: post.createdAt instanceof Date ? post.createdAt.toISOString() : post.createdAt || '',
    updatedAt: post.updatedAt instanceof Date ? post.updatedAt.toISOString() : post.updatedAt || '',
  };
}

export default async function PostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ chapter?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedChapterNum = resolvedSearchParams?.chapter ? parseInt(resolvedSearchParams.chapter, 10) : undefined;
  
  if (!ObjectId.isValid(id)) {
    return notFound();
  }

  await connectDB();
  const post = await Post.findById(id).lean();
  if (!post) {
    return notFound();
  }

  const serialized = serializePost(post);

  if (serialized.images) {
    serialized.images = serialized.images.map(getOptimizedImageUrl);
  }
  if (Array.isArray(serialized.chapters)) {
    serialized.chapters = serialized.chapters.map((chapter) => ({
      ...chapter,
      images: (chapter.images || []).map((img: string) => protectedImageUrl(img, id)),
    }));
  }


  const user = await getCurrentUser();

  // Khớp với GET /api/posts/[id]: người chưa có quyền xem truyện không nhận bất kỳ thông tin nào về truyện
  // (tiêu đề, mô tả, thẻ, dịch giả, danh sách chương). Chỉ trả khung "bị khóa" để giao diện hiện màn hình đăng nhập/xin quyền.
  const postDecision = canViewPost(user, serialized as unknown as PostContext);
  if (!postDecision.allowed) {
    const lockedPost = {
      _id: id,
      title: 'Nội dung bị hạn chế',
      description: '',
      tags: [],
      author: '',
      translator: '',
      accessType: 'restricted' as const,
      sharedWith: [],
      accessedUsers: [],
      content: '',
      images: [],
      createdAt: '',
      updatedAt: '',
      chapterCount: 1,
      chapters: [
        {
          chapterNumber: 1,
          title: 'Nội dung bị hạn chế',
          translator: '',
          accessType: 'restricted' as const,
          isLocked: true,
          lockReason: postDecision.reason,
          lockMessage: postDecision.message,
          sharedWith: [],
          content: '',
          images: [],
        },
      ],
    };
    return <PostDetailClient initialPost={lockedPost} initialChapterNumber={undefined} />;
  }

  const userEmail = user?.email?.toLowerCase().trim();
  const userId = user?.id ? String(user.id) : '';

  const isSharedInPost = Boolean(
    user &&
    Array.isArray(serialized.sharedWith) &&
    serialized.sharedWith.some(
      (s) =>
        s.email?.toLowerCase().trim() === userEmail ||
        (s.userId && String(s.userId) === userId)
    )
  );

  const isSharedInAnyChapter = Boolean(
    user &&
    Array.isArray(serialized.chapters) &&
    serialized.chapters.some(
      (ch) =>
        Array.isArray(ch.sharedWith) &&
        ch.sharedWith.some(
          (s) =>
            s.email?.toLowerCase().trim() === userEmail ||
            (s.userId && String(s.userId) === userId)
        )
    )
  );

  const isShared = isSharedInPost || isSharedInAnyChapter;

  // Chỉ chương đang mở đầu tiên được gửi kèm danh sách ảnh; các chương khác được client tải theo từng chương
  // (/api/posts/[id]/chapters/[n]) để payload không phình theo tổng số ảnh của cả bộ truyện. Quy tắc chọn chương khớp với client.
  const allChapters = serialized.chapters || [];
  const requestedIndex =
    typeof requestedChapterNum === 'number' && !isNaN(requestedChapterNum)
      ? allChapters.findIndex((c, i) => (c.chapterNumber ?? i + 1) === requestedChapterNum)
      : -1;
  const firstUnlockedIndex = allChapters.findIndex((c) => canViewChapter(user, serialized, c).allowed);
  const initialChapterIdx = requestedIndex >= 0 ? requestedIndex : Math.max(firstUnlockedIndex, 0);

  // Lọc dữ liệu chương an toàn theo từng chương (Phương án 2)
  const safeChapters = allChapters.map((ch, idx) => {
    const chDecision = canViewChapter(user, serialized, ch);
    const translator = ch.translator || serialized.translator || '';

    if (!chDecision.allowed) {
      return {
        _id: ch._id ? String(ch._id) : undefined,
        chapterNumber: ch.chapterNumber ?? idx + 1,
        title: ch.title || `Chương ${ch.chapterNumber ?? idx + 1}`,
        translator,
        accessType: ch.accessType || 'inherit',
        isLocked: true,
        lockReason: chDecision.reason,
        lockMessage: chDecision.message,
        sharedWith: [],
        content: '',
        images: [],
        imageCount: 0,
        imagesLoaded: true,
      };
    }

    const sanitizedSharedWith = Array.isArray(ch.sharedWith)
      ? ch.sharedWith
          .filter((s) => user?.role === 'admin' || s.email?.toLowerCase().trim() === userEmail)
          .map((s) => ({
            email: String(s.email || ''),
            userId: s.userId ? String(s.userId) : undefined,
            role: String(s.role || 'viewer'),
            addedAt: s.addedAt instanceof Date
              ? s.addedAt.toISOString()
              : (typeof s.addedAt === 'string' ? s.addedAt : undefined),
          }))
      : [];

    return {
      _id: ch._id ? String(ch._id) : undefined,
      chapterNumber: ch.chapterNumber ?? idx + 1,
      title: ch.title || `Chương ${ch.chapterNumber ?? idx + 1}`,
      translator,
      accessType: ch.accessType || 'inherit',
      isLocked: false,
      sharedWith: sanitizedSharedWith,
      content: ch.content || '',
      ...(idx === initialChapterIdx
        ? {
            images: (ch.images || []).map((img: string) => protectedImageUrl(img, id)),
            imageCount: (ch.images || []).length,
            imagesLoaded: true,
          }
        : {
            images: [] as string[],
            imageCount: (ch.images || []).length,
            imagesLoaded: (ch.images || []).length === 0,
          }),
    };
  });

  const firstUnlocked = safeChapters.find((c) => !c.isLocked);

  const postForClient = {
    ...serialized,
    chapters: safeChapters,
    content: firstUnlocked?.content || '',
    images: firstUnlocked?.images || [],
    sharedWith: user?.role === 'admin'
      ? serialized.sharedWith
      : (isShared && Array.isArray(serialized.sharedWith)
          ? serialized.sharedWith.filter((s) => s.email?.toLowerCase().trim() === userEmail)
          : []),
    accessedUsers: user?.role === 'admin' ? serialized.accessedUsers : [],
  };

  const plainPostForClient = JSON.parse(JSON.stringify(postForClient));

  return (
    <PostDetailClient
      initialPost={plainPostForClient}
      initialChapterNumber={typeof requestedChapterNum === 'number' && !isNaN(requestedChapterNum) ? requestedChapterNum : undefined}
    />
  );
}

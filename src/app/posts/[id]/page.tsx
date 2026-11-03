import type { Metadata } from 'next';
import { connectDB } from '@/lib/db';
import { Post } from '@/models/Post';
import { ObjectId } from 'mongodb';
import { getPostChapters, protectedImageUrl, getOptimizedImageUrl } from '@/lib/utils';
import PostDetailClient from './PostDetailClient';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/server-auth';
import { canViewChapter } from '@/lib/permissions';

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
    .select('title description')
    .lean();

  if (!post) {
    return { title: SITE_NAME };
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

  // Lọc dữ liệu chương an toàn theo từng chương (Phương án 2)
  const safeChapters = (serialized.chapters || []).map((ch, idx) => {
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
      images: (ch.images || []).map((img: string) => protectedImageUrl(img, id)),
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

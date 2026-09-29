import { connectDB } from '@/lib/db';
import { Post } from '@/models/Post';
import { ObjectId } from 'mongodb';
import { getPostChapters, ensureScrambledImageUrl, getOptimizedImageUrl } from '@/lib/utils';
import { getApiCache, setApiCache } from '@/lib/api-cache';
import PostDetailClient from './PostDetailClient';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/server-auth';
import { canViewPost, canViewChapter } from '@/lib/permissions';

export const maxDuration = 60;
export const revalidate = 60;

function toPlainPost(postDoc: any) {
  if (postDoc && typeof postDoc === 'object') {
    if (typeof postDoc.toObject === 'function') {
      return postDoc.toObject();
    }
    return postDoc;
  }
  return {};
}

function serializePost(postDoc: any) {
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
      ? post.sharedWith.map((s: any) => ({
          email: s.email,
          userId: s.userId ? s.userId.toString() : undefined,
          role: s.role || 'viewer',
        }))
      : [],
    accessedUsers: Array.isArray(post.accessedUsers)
      ? post.accessedUsers.map((u: any) => ({
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

  const cacheKey = `posts:detail:${id}`;
  let serialized = getApiCache<any>(cacheKey);

  if (!serialized) {
    await connectDB();
    const post = await Post.findById(id).lean();
    if (!post) {
      return notFound();
    }

    serialized = serializePost(post);

    if (serialized.images) {
      serialized.images = serialized.images.map(getOptimizedImageUrl);
    }
    if (Array.isArray(serialized.chapters)) {
      serialized.chapters = serialized.chapters.map((chapter: any) => ({
        ...chapter,
        images: (chapter.images || []).map(ensureScrambledImageUrl),
      }));
    }

    setApiCache(cacheKey, serialized, 300_000);
  }

  const user = await getCurrentUser();
  const userEmail = user?.email?.toLowerCase().trim();
  const userId = user?.id ? String(user.id) : '';

  const isSharedInPost = Boolean(
    user &&
    Array.isArray(serialized.sharedWith) &&
    serialized.sharedWith.some(
      (s: any) =>
        s.email?.toLowerCase().trim() === userEmail ||
        (s.userId && String(s.userId) === userId)
    )
  );

  const isSharedInAnyChapter = Boolean(
    user &&
    Array.isArray(serialized.chapters) &&
    serialized.chapters.some(
      (ch: any) =>
        Array.isArray(ch.sharedWith) &&
        ch.sharedWith.some(
          (s: any) =>
            s.email?.toLowerCase().trim() === userEmail ||
            (s.userId && String(s.userId) === userId)
        )
    )
  );

  const isShared = isSharedInPost || isSharedInAnyChapter;

  // Lọc dữ liệu chương an toàn theo từng chương (Phương án 2)
  const safeChapters = (serialized.chapters || []).map((ch: any, idx: number) => {
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
          .filter((s: any) => user?.role === 'admin' || s.email?.toLowerCase().trim() === userEmail)
          .map((s: any) => ({
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
      images: (ch.images || []).map(ensureScrambledImageUrl),
    };
  });

  const firstUnlocked = safeChapters.find((c: any) => !c.isLocked);

  let postForClient = {
    ...serialized,
    chapters: safeChapters,
    content: firstUnlocked?.content || '',
    images: firstUnlocked?.images || [],
    sharedWith: user?.role === 'admin'
      ? serialized.sharedWith
      : (isShared && Array.isArray(serialized.sharedWith)
          ? serialized.sharedWith.filter((s: any) => s.email?.toLowerCase().trim() === userEmail)
          : []),
    accessedUsers: user?.role === 'admin' ? serialized.accessedUsers : [],
  };

  const plainPostForClient = JSON.parse(JSON.stringify(postForClient));

  return (
    <PostDetailClient
      initialPost={plainPostForClient as any}
      initialChapterNumber={typeof requestedChapterNum === 'number' && !isNaN(requestedChapterNum) ? requestedChapterNum : undefined}
    />
  );
}

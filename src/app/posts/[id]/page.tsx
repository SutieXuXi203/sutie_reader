import { connectDB } from '@/lib/db';
import { Post } from '@/models/Post';
import { ObjectId } from 'mongodb';
import { getPostChapters, ensureScrambledImageUrl } from '@/lib/utils';
import { getApiCache, setApiCache } from '@/lib/api-cache';
import PostDetailClient from './PostDetailClient';
import { notFound } from 'next/navigation';

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
    chapters,
    chapterCount: chapters.length,
    content: firstChapter?.content || '',
    images: firstChapter?.images || [],
    createdAt: post.createdAt instanceof Date ? post.createdAt.toISOString() : post.createdAt || '',
    updatedAt: post.updatedAt instanceof Date ? post.updatedAt.toISOString() : post.updatedAt || '',
  };
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
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
      serialized.images = serialized.images.map(ensureScrambledImageUrl);
    }
    if (Array.isArray(serialized.chapters)) {
      serialized.chapters = serialized.chapters.map((chapter: any) => ({
        ...chapter,
        images: (chapter.images || []).map(ensureScrambledImageUrl),
      }));
    }

    setApiCache(cacheKey, serialized, 300_000);
  }

  return <PostDetailClient initialPost={serialized as any} />;
}

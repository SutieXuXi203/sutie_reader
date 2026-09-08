import { connectDB } from '@/lib/db';
import { Post } from '@/models/Post';
import { ObjectId } from 'mongodb';
import { getPostChapters } from '@/lib/utils';
import { signImageUrls } from '@/lib/image-signing';
import { cookies } from 'next/headers';
import { getCurrentUserFromToken } from '@/lib/server-auth';
import PostDetailClient from './PostDetailClient';
import { notFound } from 'next/navigation';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

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
  await connectDB();
  const { id } = await params;
  
  if (!ObjectId.isValid(id)) {
    return notFound();
  }
  
  const post = await Post.findById(id);
  if (!post) {
    return notFound();
  }

  const serialized = serializePost(post);
  
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  let user = null;
  if (token) {
    user = await getCurrentUserFromToken(token);
  }

  if (user) {
    if (serialized.images) {
      serialized.images = signImageUrls(serialized.images, user.id);
    }
    if (Array.isArray(serialized.chapters)) {
      serialized.chapters = serialized.chapters.map((chapter: any) => ({
        ...chapter,
        images: signImageUrls(chapter.images || [], user.id),
      }));
    }
  }

  return <PostDetailClient initialPost={serialized as any} />;
}

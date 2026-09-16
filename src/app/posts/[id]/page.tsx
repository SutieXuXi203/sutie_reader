import { connectDB } from '@/lib/db';
import { Post } from '@/models/Post';
import { ObjectId } from 'mongodb';
import { getPostChapters, ensureScrambledImageUrl } from '@/lib/utils';
import { getApiCache, setApiCache } from '@/lib/api-cache';
import PostDetailClient from './PostDetailClient';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/server-auth';
import { canViewPost } from '@/lib/permissions';

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

  const user = await getCurrentUser();
  const decision = canViewPost(user, serialized);
  const hasAccess = decision.allowed;
  const userEmail = user?.email?.toLowerCase();
  const isShared = Boolean(
    user &&
    Array.isArray(serialized.sharedWith) &&
    serialized.sharedWith.some(
      (s: any) =>
        s.email?.toLowerCase() === userEmail ||
        (s.userId && s.userId.toString() === user.id)
    )
  );

  // Lọc dữ liệu an toàn trước khi gửi xuống client:
  // Nếu không có quyền truy cập, tuyệt đối không gửi chapters, images, content hay emails
  let postForClient = { ...serialized };

  if (!hasAccess) {
    postForClient = {
      ...postForClient,
      chapters: [],
      images: [],
      content: '',
      sharedWith: [],
      accessedUsers: [],
    };
  } else {
    // Bảo vệ quyền riêng tư email của những người dùng khác:
    // - Admin: Xem đầy đủ danh sách sharedWith và accessedUsers để quản lý
    // - Khách được chia sẻ: Chỉ nhận mục chia sẻ của chính mình (để client xác thực isAllowed)
    // - Thành viên chính thức (role: user): Không cần danh sách sharedWith của người khác
    postForClient = {
      ...postForClient,
      sharedWith: user?.role === 'admin'
        ? serialized.sharedWith
        : (isShared ? serialized.sharedWith.filter((s: any) => s.email?.toLowerCase() === userEmail) : []),
      accessedUsers: user?.role === 'admin' ? serialized.accessedUsers : [],
    };
  }

  return <PostDetailClient initialPost={postForClient as any} />;
}

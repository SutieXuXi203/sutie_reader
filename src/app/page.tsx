import HomeClient from './HomeClient';
import { connectDB } from '@/lib/db';
import { Post } from '@/models/Post';
import { Tag } from '@/models/Tag';
import { cookies } from 'next/headers';
import { getSessionUserFromToken, type AuthUser } from '@/lib/server-auth';
import { getApiCache, setApiCache } from '@/lib/api-cache';

export const maxDuration = 60;

const POSTS_CATALOG_CACHE_KEY = 'posts:catalog';
const POSTS_CATALOG_TTL_MS = 60_000;

type InitialPost = {
  _id: string;
  title: string;
  description: string;
  tags: string[];
  author: string;
  translator?: string;
  createdAt: string;
  updatedAt: string;
  chapterCount: number;
  images: string[];
};

type InitialTag = {
  _id: string;
  name: string;
};

type CatalogPostAggregate = {
  _id: { toString: () => string };
  title?: string;
  description?: string;
  tags?: string[];
  author?: string;
  translator?: string;
  accessType?: 'restricted' | 'public';
  sharedWith?: Array<{ email: string; userId?: string | any }>;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  chapterCount?: number;
  coverImage?: string;
};

type TagLean = {
  _id: { toString: () => string };
  name?: string;
};

function serializeDate(value: Date | string | undefined): string {
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'string' ? value : '';
}

async function getInitialCatalog(user: AuthUser | null): Promise<{
  initialPosts: InitialPost[];
  initialTags: InitialTag[];
}> {
  let cached = getApiCache<{ posts: CatalogPostAggregate[]; tags: TagLean[] }>(POSTS_CATALOG_CACHE_KEY);
  let posts: CatalogPostAggregate[];
  let tags: TagLean[];

  if (cached) {
    posts = cached.posts;
    tags = cached.tags;
  } else {
    await connectDB();
    [posts, tags] = await Promise.all([
      Post.aggregate<CatalogPostAggregate>([
        { $sort: { createdAt: -1 } },
        {
          $project: {
            title: 1,
            description: 1,
            tags: 1,
            author: 1,
            translator: 1,
            accessType: 1,
            sharedWith: 1,
            createdAt: 1,
            updatedAt: 1,
            coverImage: {
              $ifNull: [
                { $arrayElemAt: [{ $arrayElemAt: ['$chapters.images', 0] }, 0] },
                { $arrayElemAt: ['$images', 0] },
              ],
            },
            chapterCount: { $size: { $ifNull: ['$chapters', []] } },
          },
        },
      ]),
      Tag.find({}).sort({ name: 1 }).lean<TagLean[]>(),
    ]);

    setApiCache(POSTS_CATALOG_CACHE_KEY, { posts, tags }, POSTS_CATALOG_TTL_MS);
  }

  let visiblePosts = posts;
  if (user?.role !== 'admin' && user?.role !== 'user') {
    if (user?.role === 'guest') {
      const userEmail = user.email.toLowerCase();
      visiblePosts = posts.filter((post) => {
        if (post.accessType === 'public') return true;
        return (post.sharedWith || []).some(
          (s) => s.email?.toLowerCase() === userEmail || (s.userId && s.userId.toString() === user.id)
        );
      });
    } else {
      visiblePosts = posts.filter((post) => post.accessType === 'public');
    }
  }

  return {
    initialPosts: visiblePosts.map((post) => {
      const coverImage =
        typeof post.coverImage === 'string' && post.coverImage.trim()
          ? post.coverImage
          : '';

      return {
        _id: post._id.toString(),
        title: post.title || '',
        description: post.description || '',
        tags: post.tags || [],
        author: post.author || 'Không rõ tác giả',
        translator: post.translator || '',
        createdAt: serializeDate(post.createdAt),
        updatedAt: serializeDate(post.updatedAt),
        chapterCount: post.chapterCount || 0,
        images: coverImage ? [coverImage] : [],
      };
    }),
    initialTags: tags
      .filter((tag) => typeof tag.name === 'string' && tag.name.trim())
      .map((tag) => ({
        _id: tag._id.toString(),
        name: tag.name || '',
      })),
  };
}

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  const user = token ? await getSessionUserFromToken(token) : null;
  const catalog = await getInitialCatalog(user);

  return <HomeClient {...catalog} />;
}

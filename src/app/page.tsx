import HomeClient from './HomeClient';
import { connectDB } from '@/lib/db';
import { Post } from '@/models/Post';
import { Tag } from '@/models/Tag';
import { getCurrentUser, type AuthUser } from '@/lib/server-auth';
import { getApiCache, setApiCache } from '@/lib/api-cache';
import { filterPostsForUser, getAccessibleChapterInfo } from '@/lib/permissions';

export const maxDuration = 60;

const POSTS_CATALOG_CACHE_KEY = 'posts:catalog';
const POSTS_CATALOG_TTL_MS = 300_000;

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
  accessibleChapterNumbers?: number[];
  accessibleChapterLabel?: string;
  isPartialAccess?: boolean;
};

type InitialTag = {
  _id: string;
  name: string;
};

type CatalogPostAggregate = {
  _id: string | { toString: () => string };
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
  chapters?: Array<{
    chapterNumber?: number;
    title?: string;
    translator?: string;
    accessType?: 'inherit' | 'restricted' | 'public';
    sharedWith?: Array<{ email?: string; userId?: string | any }>;
  }>;
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
                { $arrayElemAt: ['$images', 0] },
                { $arrayElemAt: [{ $arrayElemAt: ['$chapters.images', 0] }, 0] },
              ],
            },
            chapterCount: { $size: { $ifNull: ['$chapters', []] } },
            chapters: {
              $map: {
                input: { $ifNull: ['$chapters', []] },
                as: 'c',
                in: {
                  chapterNumber: '$$c.chapterNumber',
                  title: '$$c.title',
                  translator: '$$c.translator',
                  accessType: '$$c.accessType',
                  sharedWith: '$$c.sharedWith',
                },
              },
            },
          },
        },
      ]),
      Tag.find({}).sort({ name: 1 }).lean<TagLean[]>(),
    ]);

    setApiCache(POSTS_CATALOG_CACHE_KEY, { posts, tags }, POSTS_CATALOG_TTL_MS);
  }

  const visiblePosts = filterPostsForUser(posts as any, user) as CatalogPostAggregate[];

  return {
    initialPosts: visiblePosts.map((post) => {
      const coverImage =
        typeof post.coverImage === 'string' && post.coverImage.trim()
          ? post.coverImage
          : '';

      const chapterInfo = getAccessibleChapterInfo(post as any, user);

      return {
        _id: typeof post._id === 'string' ? post._id : post._id?.toString?.() || '',
        title: post.title || '',
        description: post.description || '',
        tags: post.tags || [],
        author: post.author || 'Không rõ tác giả',
        translator: post.translator || '',
        createdAt: serializeDate(post.createdAt),
        updatedAt: serializeDate(post.updatedAt),
        chapterCount: post.chapterCount || 0,
        images: coverImage ? [coverImage] : [],
        accessibleChapterNumbers: chapterInfo.accessibleChapterNumbers,
        accessibleChapterLabel: chapterInfo.accessibleChapterLabel,
        isPartialAccess: chapterInfo.isPartialAccess,
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
  const user = await getCurrentUser();
  const catalog = await getInitialCatalog(user);

  return <HomeClient {...catalog} />;
}

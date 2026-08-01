import HomeClient from './HomeClient';
import { connectDB } from '@/lib/db';
import { getCurrentUser } from '@/lib/server-auth';
import { Post } from '@/models/Post';
import { Tag } from '@/models/Tag';

export const maxDuration = 60;

type InitialPost = {
  _id: string;
  title: string;
  description: string;
  tags: string[];
  author: string;
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

async function getInitialCatalog(): Promise<{
  initialPosts: InitialPost[];
  initialTags: InitialTag[];
}> {
  const user = await getCurrentUser();
  if (!user) {
    return { initialPosts: [], initialTags: [] };
  }

  await connectDB();

  const [posts, tags] = await Promise.all([
    Post.aggregate<CatalogPostAggregate>([
      { $sort: { createdAt: -1 } },
      {
        $project: {
          title: 1,
          description: 1,
          tags: 1,
          author: 1,
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

  return {
    initialPosts: posts.map((post) => {
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
  const catalog = await getInitialCatalog();

  return <HomeClient {...catalog} />;
}

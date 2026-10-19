import type { MetadataRoute } from 'next';
import { connectDB } from '@/lib/db';
import { Post } from '@/models/Post';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  const defaultRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  try {
    await connectDB();
    // Only index publicly accessible posts
    const publicPosts = await Post.find({ accessType: 'public' })
      .select('_id updatedAt createdAt')
      .lean();

    const postRoutes: MetadataRoute.Sitemap = publicPosts.map((post: any) => ({
      url: `${baseUrl}/posts/${post._id?.toString() || post._id}`,
      lastModified: post.updatedAt ? new Date(post.updatedAt) : new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    }));

    return [...defaultRoutes, ...postRoutes];
  } catch (err) {
    console.error('Error generating dynamic sitemap:', err);
    return defaultRoutes;
  }
}

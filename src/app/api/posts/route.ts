import { connectDB } from '@/lib/db';
import { Post } from '@/models/Post';
import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';

// Limit body size for Next.js 15+ App Router
export const maxDuration = 60; // Optional, set to your max duration needed

const normalizeTags = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const tags: string[] = [];

  for (const rawTag of value) {
    if (typeof rawTag !== 'string') continue;
    const tag = rawTag.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!tag || tag.length > 30) continue;

    const key = tag.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    tags.push(tag);
    if (tags.length >= 20) break;
  }

  return tags;
};



export async function GET() {
  try {
    await connectDB();
    const posts = await Post.find().sort({ createdAt: -1 });
    return NextResponse.json(posts);
  } catch (error) {
    console.error('Lỗi khi tải bài viết:', error);
    return NextResponse.json({ error: 'Tải bài viết không thành công' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json({ error: 'Bạn không có quyền thực hiện hành động này' }, { status: 403 });
    }
    await connectDB();
    const { title, description, tags, content, images, author } = await request.json();
    const normalizedDescription = typeof description === 'string' ? description.trim().slice(0, 300) : '';
    const normalizedTags = normalizeTags(tags);

    if (!title || !content || !images?.length) {
      return NextResponse.json(
        { error: 'Các trường bắt buộc bị thiếu' },
        { status: 400 }
      );
    }

    const post = new Post({
      title,
      description: normalizedDescription,
      tags: normalizedTags,
      content,
      images,
      author: author || 'Ẩn danh',
    });

    const savedPost = await post.save();
    return NextResponse.json(savedPost);
  } catch (error) {
    console.error('Lỗi khi tạo bài viết:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Tạo bài viết không thành công', details: message }, { status: 500 });
  }
}

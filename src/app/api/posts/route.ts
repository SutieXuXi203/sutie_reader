import { connectDB } from '@/lib/db';
import { Post } from '@/models/Post';
import { NextRequest, NextResponse } from 'next/server';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
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
    await connectDB();
    const { title, description, content, images, author } = await request.json();

    if (!title || !description || !content || !images?.length) {
      return NextResponse.json(
        { error: 'Các trường bắt buộc bị thiếu' },
        { status: 400 }
      );
    }

    const post = new Post({
      title,
      description,
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

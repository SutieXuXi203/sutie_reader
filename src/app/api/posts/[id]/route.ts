import { connectDB } from '@/lib/db';
import { Post } from '@/models/Post';
import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { isAdmin } from '@/lib/auth';

// Limit body size for Next.js 15+ App Router
export const maxDuration = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ID bài viết không hợp lệ' }, { status: 400 });
    }

    const post = await Post.findById(id);

    if (!post) {
      return NextResponse.json({ error: 'Không tìm thấy bài viết' }, { status: 404 });
    }

    return NextResponse.json(post);
  } catch (error) {
    console.error('Lỗi khi tải bài viết:', error);
    return NextResponse.json({ error: 'Tải bài viết không thành công' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json({ error: 'Bạn không có quyền thực hiện hành động này' }, { status: 403 });
    }
    await connectDB();
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ID bài viết không hợp lệ' }, { status: 400 });
    }

    const { title, description, content, author, images } = await request.json();

    if (!title || !description || !content) {
      return NextResponse.json({ error: 'Các trường bắt buộc bị thiếu' }, { status: 400 });
    }

    if (!Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: 'Cần có ít nhất một hình ảnh' }, { status: 400 });
    }

    const updated = await Post.findByIdAndUpdate(
      id,
      { title, description, content, author: author || 'Không rõ tác giả', images },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return NextResponse.json({ error: 'Không tìm thấy bài viết' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Lỗi khi cập nhật bài viết:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Cập nhật bài viết không thành công', details: message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ID bài viết không hợp lệ' }, { status: 400 });
    }

    const deletedPost = await Post.findByIdAndDelete(id);

    if (!deletedPost) {
      return NextResponse.json({ error: 'Không tìm thấy bài viết' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Bài viết đã được xóa thành công' });
  } catch (error) {
    console.error('Lỗi khi xóa bài viết:', error);
    return NextResponse.json({ error: 'Xóa bài viết không thành công' }, { status: 500 });
  }
}

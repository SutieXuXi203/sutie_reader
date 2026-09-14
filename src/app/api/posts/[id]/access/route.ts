import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectDB } from '@/lib/db';
import { Post } from '@/models/Post';
import { getAuthUser } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ message: 'Khách vãng lai truy cập' });
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ID bài viết không hợp lệ' }, { status: 400 });
    }

    await connectDB();
    const post = await Post.findById(id).select('accessedUsers');
    if (!post) {
      return NextResponse.json({ error: 'Không tìm thấy bài viết' }, { status: 404 });
    }

    if (!Array.isArray(post.accessedUsers)) {
      post.accessedUsers = [];
    }

    const normalizedEmail = user.email.toLowerCase().trim();
    const existingIndex = post.accessedUsers.findIndex(
      (u) => u.email.toLowerCase() === normalizedEmail
    );

    const now = new Date();
    const displayName = user.name || normalizedEmail.split('@')[0];
    const avatar = user.avatar || '';
    const role = user.role || 'guest';

    if (existingIndex >= 0) {
      post.accessedUsers[existingIndex].lastAccessedAt = now;
      post.accessedUsers[existingIndex].name = displayName;
      post.accessedUsers[existingIndex].avatar = avatar;
      post.accessedUsers[existingIndex].role = role;
      if (user.id && ObjectId.isValid(user.id)) {
        post.accessedUsers[existingIndex].userId = new ObjectId(user.id) as any;
      }
    } else {
      post.accessedUsers.push({
        userId: user.id && ObjectId.isValid(user.id) ? (new ObjectId(user.id) as any) : undefined,
        email: normalizedEmail,
        name: displayName,
        avatar,
        role,
        lastAccessedAt: now,
      });
    }

    // Sort by lastAccessedAt descending and limit to latest 50 entries
    post.accessedUsers.sort((a, b) => {
      const timeA = a.lastAccessedAt instanceof Date ? a.lastAccessedAt.getTime() : new Date(a.lastAccessedAt).getTime();
      const timeB = b.lastAccessedAt instanceof Date ? b.lastAccessedAt.getTime() : new Date(b.lastAccessedAt).getTime();
      return timeB - timeA;
    });

    if (post.accessedUsers.length > 50) {
      post.accessedUsers = post.accessedUsers.slice(0, 50);
    }

    await post.save();

    const mappedAccessedUsers = post.accessedUsers.map((u) => ({
      userId: u.userId ? u.userId.toString() : undefined,
      email: u.email,
      name: u.name || u.email.split('@')[0],
      avatar: u.avatar || '',
      role: u.role || 'guest',
      lastAccessedAt: u.lastAccessedAt instanceof Date ? u.lastAccessedAt.toISOString() : u.lastAccessedAt,
    }));

    return NextResponse.json({
      success: true,
      accessedUsers: mappedAccessedUsers,
    });
  } catch (error) {
    console.error('Lỗi khi ghi nhận truy cập link truyện:', error);
    return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ID bài viết không hợp lệ' }, { status: 400 });
    }

    await connectDB();
    const post = await Post.findById(id).select('accessedUsers').lean();
    if (!post) {
      return NextResponse.json({ error: 'Không tìm thấy bài viết' }, { status: 404 });
    }

    const mappedAccessedUsers = (post.accessedUsers || []).map((u: any) => ({
      userId: u.userId ? u.userId.toString() : undefined,
      email: u.email,
      name: u.name || u.email.split('@')[0],
      avatar: u.avatar || '',
      role: u.role || 'guest',
      lastAccessedAt: u.lastAccessedAt instanceof Date ? u.lastAccessedAt.toISOString() : u.lastAccessedAt,
    }));

    return NextResponse.json({
      accessedUsers: mappedAccessedUsers,
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách truy cập:', error);
    return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
  }
}

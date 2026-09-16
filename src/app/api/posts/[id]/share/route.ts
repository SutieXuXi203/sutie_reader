import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectDB } from '@/lib/db';
import { Post } from '@/models/Post';
import { User } from '@/models/User';
import { getAuthUser, isAdmin } from '@/lib/auth';
import { invalidateApiCache } from '@/lib/api-cache';
import { z } from 'zod';

const emailSchema = z.string().trim().toLowerCase().email('Email không hợp lệ');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Vui lòng đăng nhập' }, { status: 401 });
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ID truyện không hợp lệ' }, { status: 400 });
    }

    await connectDB();
    const post = await Post.findById(id).select('title accessType sharedWith accessedUsers author').lean();
    if (!post) {
      return NextResponse.json({ error: 'Không tìm thấy truyện' }, { status: 404 });
    }

    const isUserAdmin = user.role === 'admin';
    const normalizedUserEmail = user.email.toLowerCase();
    const isShared = (post.sharedWith || []).some(
      (s: any) => s.email === normalizedUserEmail || (s.userId && s.userId.toString() === user.id)
    );

    if (!isUserAdmin && post.accessType === 'restricted' && !isShared) {
      return NextResponse.json({ error: 'Bạn không có quyền truy cập thông tin chia sẻ truyện này' }, { status: 403 });
    }

    // Populate user profile info for shared users
    const sharedEmails = (post.sharedWith || []).map((s: any) => s.email);
    const existingUsers = await User.find({ email: { $in: sharedEmails } })
      .select('name email avatar')
      .lean();

    const userMap = new Map<string, { name: string; avatar?: string }>();
    for (const u of existingUsers) {
      userMap.set(u.email.toLowerCase(), { name: u.name, avatar: u.avatar || '' });
    }

    const mappedSharedWith = (post.sharedWith || []).map((s: any) => {
      const uInfo = userMap.get(s.email.toLowerCase());
      return {
        email: s.email,
        role: s.role || 'viewer',
        addedAt: s.addedAt instanceof Date ? s.addedAt.toISOString() : s.addedAt,
        name: uInfo?.name || s.email.split('@')[0],
        avatar: uInfo?.avatar || '',
        isRegistered: Boolean(uInfo),
      };
    });

    const mappedAccessedUsers = (post.accessedUsers || []).map((u: any) => ({
      userId: u.userId ? u.userId.toString() : undefined,
      email: u.email,
      role: u.role || 'guest',
      lastAccessedAt: u.lastAccessedAt instanceof Date ? u.lastAccessedAt.toISOString() : u.lastAccessedAt,
      name: u.name || u.email.split('@')[0],
      avatar: u.avatar || '',
    }));

    let ownerInfo = {
      name: user.name || 'Quản trị viên',
      email: user.email,
      avatar: user.avatar || '',
      isCurrent: true,
    };

    if (!isUserAdmin) {
      const adminUser = await User.findOne({ role: 'admin' })
        .select('name avatar')
        .lean();
      ownerInfo = {
        name: adminUser?.name || 'Quản trị viên',
        email: '', // Bảo vệ quyền riêng tư: không làm lộ email của Admin
        avatar: adminUser?.avatar || '',
        isCurrent: false,
      };
    }

    return NextResponse.json({
      postId: post._id.toString(),
      title: post.title,
      accessType: post.accessType || 'restricted',
      isOwner: isUserAdmin,
      owner: ownerInfo,
      sharedWith: isUserAdmin
        ? mappedSharedWith
        : mappedSharedWith.filter((s: any) => s.email.toLowerCase() === normalizedUserEmail),
      accessedUsers: isUserAdmin ? mappedAccessedUsers : [],
    });
  } catch (error) {
    console.error('Lỗi khi lấy thông tin chia sẻ:', error);
    return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json({ error: 'Chỉ Quản trị viên mới có quyền quản lý chia sẻ truyện' }, { status: 403 });
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ID truyện không hợp lệ' }, { status: 400 });
    }

    const body = await request.json();
    const { action } = body;

    await connectDB();

    if (action === 'update_access') {
      const accessType = body.accessType;
      if (accessType !== 'restricted' && accessType !== 'public') {
        return NextResponse.json({ error: 'Quyền truy cập không hợp lệ' }, { status: 400 });
      }

      const updated = await Post.findByIdAndUpdate(id, { accessType }, { new: true }).select('accessType');
      if (!updated) {
        return NextResponse.json({ error: 'Không tìm thấy truyện' }, { status: 404 });
      }
      invalidateApiCache('posts:');

      return NextResponse.json({
        message: 'Đã cập nhật quyền truy cập chung',
        accessType: updated.accessType,
      });
    }

    if (action === 'add_user') {
      const emailParse = emailSchema.safeParse(body.email);
      if (!emailParse.success) {
        return NextResponse.json({ error: 'Địa chỉ email không đúng định dạng' }, { status: 400 });
      }
      const targetEmail = emailParse.data;

      const post = await Post.findById(id).select('sharedWith');
      if (!post) {
        return NextResponse.json({ error: 'Không tìm thấy truyện' }, { status: 404 });
      }

      if (!Array.isArray(post.sharedWith)) {
        post.sharedWith = [];
      }

      const alreadyExists = post.sharedWith.some((s) => s.email === targetEmail);
      if (alreadyExists) {
        return NextResponse.json({ error: 'Email này đã có trong danh sách được cấp quyền' }, { status: 400 });
      }

      const existingUser = await User.findOne({ email: targetEmail }).select('_id name avatar').lean();

      post.sharedWith.push({
        userId: existingUser?._id,
        email: targetEmail,
        role: 'viewer',
        addedAt: new Date(),
      });

      await post.save();
      invalidateApiCache('posts:');

      return NextResponse.json({
        message: 'Đã thêm quyền truy cập thành công',
        user: {
          email: targetEmail,
          role: 'viewer',
          name: existingUser?.name || targetEmail.split('@')[0],
          avatar: existingUser?.avatar || '',
          isRegistered: Boolean(existingUser),
          addedAt: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json({ error: 'Hành động không được hỗ trợ' }, { status: 400 });
  } catch (error) {
    console.error('Lỗi khi cập nhật chia sẻ:', error);
    return NextResponse.json({ error: 'Không thể cập nhật quyền chia sẻ' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json({ error: 'Chỉ Quản trị viên mới có quyền quản lý chia sẻ truyện' }, { status: 403 });
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ID truyện không hợp lệ' }, { status: 400 });
    }

    const searchEmail = request.nextUrl.searchParams.get('email');
    let targetEmail = searchEmail;

    if (!targetEmail) {
      try {
        const body = await request.json();
        targetEmail = body?.email;
      } catch {
        // ignore
      }
    }

    if (!targetEmail || typeof targetEmail !== 'string') {
      return NextResponse.json({ error: 'Email cần xóa là bắt buộc' }, { status: 400 });
    }

    const normalizedEmail = targetEmail.trim().toLowerCase();

    await connectDB();
    const result = await Post.findByIdAndUpdate(
      id,
      {
        $pull: {
          sharedWith: { email: normalizedEmail },
          accessedUsers: { email: normalizedEmail },
        },
      },
      { new: true }
    ).select('_id');

    if (!result) {
      return NextResponse.json({ error: 'Không tìm thấy truyện' }, { status: 404 });
    }

    invalidateApiCache('posts:');

    return NextResponse.json({
      message: 'Đã xóa quyền truy cập của tài khoản',
      email: normalizedEmail,
    });
  } catch (error) {
    console.error('Lỗi khi xóa quyền chia sẻ:', error);
    return NextResponse.json({ error: 'Không thể xóa quyền truy cập' }, { status: 500 });
  }
}

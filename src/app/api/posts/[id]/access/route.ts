import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectDB } from '@/lib/db';
import { Post } from '@/models/Post';
import { getAuthUser, isAdmin } from '@/lib/auth';
import { canViewPost } from '@/lib/permissions';
import { logApiError } from '@/lib/telegramLogger';

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

    // Kiểm tra quyền cửa user đối với post (chỉ cần select các field cần thiết)
    const postForCheck = await Post.findById(id)
      .select('accessType sharedWith accessedUsers chapters')
      .lean();
    if (!postForCheck) {
      return NextResponse.json({ error: 'Không tìm thấy bài viết' }, { status: 404 });
    }

    const decision = canViewPost(user, postForCheck as any);
    if (!decision.allowed) {
      return NextResponse.json(
        { error: decision.reason, message: decision.message },
        { status: decision.reason === 'REQUIRE_LOGIN' ? 401 : 403 }
      );
    }

    const normalizedEmail = user.email.toLowerCase().trim();
    const now = new Date();
    const displayName = user.name || normalizedEmail.split('@')[0];
    const avatar = user.avatar || '';
    const role = user.role || 'guest';
    const userId = user.id && ObjectId.isValid(user.id) ? new ObjectId(user.id) : undefined;

    // Kiểm tra xem user đã có trong accessedUsers chưa
    const existingEntry = (postForCheck.accessedUsers || []).find(
      (u: any) => u.email?.toLowerCase() === normalizedEmail
    );

    if (existingEntry !== undefined) {
      // Cập nhật atomic bằng positional operator — chỉ ghi đúng record cần update
      await Post.updateOne(
        { _id: new ObjectId(id), 'accessedUsers.email': normalizedEmail },
        {
          $set: {
            'accessedUsers.$.lastAccessedAt': now,
            'accessedUsers.$.name': displayName,
            'accessedUsers.$.avatar': avatar,
            'accessedUsers.$.role': role,
            ...(userId ? { 'accessedUsers.$.userId': userId } : {}),
          },
        }
      );
    } else {
      // Thêm mới vào mảng — giữ tối đa 50 entries, sắp xếp giảm dần theo lastAccessedAt
      const newEntry = {
        ...(userId ? { userId } : {}),
        email: normalizedEmail,
        name: displayName,
        avatar,
        role,
        lastAccessedAt: now,
      };
      await Post.updateOne(
        { _id: new ObjectId(id) },
        {
          $push: {
            accessedUsers: {
              $each: [newEntry],
              $sort: { lastAccessedAt: -1 },
              $slice: 50,
            },
          },
        }
      );
    }

    // Chỉ admin mới nhận danh sách đầy đủ — query lại sau khi update để dữ liệu chính xác
    let mappedAccessedUsers: object[] = [];
    if (user.role === 'admin') {
      const updated = await Post.findById(id).select('accessedUsers').lean();
      mappedAccessedUsers = ((updated?.accessedUsers as any[]) || []).map((u: any) => ({
        userId: u.userId ? u.userId.toString() : undefined,
        email: u.email,
        name: u.name || u.email.split('@')[0],
        avatar: u.avatar || '',
        role: u.role || 'guest',
        lastAccessedAt:
          u.lastAccessedAt instanceof Date
            ? u.lastAccessedAt.toISOString()
            : u.lastAccessedAt,
      }));
    }

    return NextResponse.json({
      success: true,
      // Bảo vệ quyền riêng tư: Chỉ quản trị viên mới được nhận danh sách độc giả khác
      accessedUsers: mappedAccessedUsers,
    });
  } catch (error) {
    console.error('Lỗi khi ghi nhận truy cập link truyện:', error);
    void logApiError({
      module: '[POST] /api/posts/[id]/access',
      error,
      request,
      statusCode: 500,
    });
    return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json(
        { error: 'Chỉ Quản trị viên mới có quyền xem danh sách này' },
        { status: 403 }
      );
    }

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
    void logApiError({
      module: '[GET] /api/posts/[id]/access',
      error,
      request,
      statusCode: 500,
    });
    return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 });
  }
}

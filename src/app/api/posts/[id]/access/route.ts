import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectDB } from '@/lib/db';
import { Post, type IPostAccessedUser } from '@/models/Post';
import { getAuthUser, isAdmin } from '@/lib/auth';
import { canViewPost, type PostContext } from '@/lib/permissions';
import { logApiError } from '@/lib/telegramLogger';
import { recordPostAccess } from '@/lib/trackAccess';

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

    const decision = canViewPost(user, postForCheck as PostContext);
    if (!decision.allowed) {
      return NextResponse.json(
        { error: decision.reason, message: decision.message },
        { status: decision.reason === 'REQUIRE_LOGIN' ? 401 : 403 }
      );
    }

    await recordPostAccess(id, user);

    // Chỉ admin mới nhận danh sách đầy đủ — query lại sau khi update để dữ liệu chính xác
    let mappedAccessedUsers: object[] = [];
    if (user.role === 'admin') {
      const updated = await Post.findById(id).select('accessedUsers').lean();
      mappedAccessedUsers = ((updated?.accessedUsers as IPostAccessedUser[]) || []).map((u: IPostAccessedUser) => ({
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

    const mappedAccessedUsers = (post.accessedUsers || []).map((u: IPostAccessedUser) => ({
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

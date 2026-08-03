import { jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';

import { connectDB } from '@/lib/db';
import { cleanupExpiredUnverifiedUsers } from '@/lib/unverifiedUserCleanup';
import { User } from '@/models/User';

import { getJwtSecret } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Chưa xác thực' }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, getJwtSecret());
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    await connectDB();

    // Cleanup should never block admin from viewing the current user list.
    try {
      await cleanupExpiredUnverifiedUsers('login');
    } catch (cleanupError) {
      console.error('Lỗi dọn tài khoản chưa xác thực quá hạn:', cleanupError);
    }

    const users = await User.find().select('-password').sort({ createdAt: -1 });
    return NextResponse.json(users);
  } catch (error) {
    console.error('Lỗi lấy danh sách người dùng:', error);
    return NextResponse.json(
      { error: 'Không thể lấy dữ liệu người dùng' },
      { status: 500 }
    );
  }
}

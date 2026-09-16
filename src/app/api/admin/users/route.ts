import { isAdmin } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

import { connectDB } from '@/lib/db';
import { cleanupExpiredUnverifiedUsers } from '@/lib/unverifiedUserCleanup';
import { User } from '@/models/User';

export async function GET(request: NextRequest) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    await connectDB();

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

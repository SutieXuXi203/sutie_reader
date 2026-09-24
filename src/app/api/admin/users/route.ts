import { isAdmin } from '@/lib/auth';
import { NextRequest, NextResponse, after } from 'next/server';

import { connectDB } from '@/lib/db';
import { cleanupExpiredUnverifiedUsers } from '@/lib/unverifiedUserCleanup';
import { User } from '@/models/User';
import { getApiCache, setApiCache } from '@/lib/api-cache';
import { logApiError } from '@/lib/telegramLogger';

export const dynamic = 'force-dynamic';

const ADMIN_USERS_CACHE_KEY = 'admin:users';
const ADMIN_USERS_CACHE_TTL = 30_000;

export async function GET(request: NextRequest) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const cached = getApiCache<any[]>(ADMIN_USERS_CACHE_KEY);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'private, no-cache, stale-while-revalidate=30',
          'X-Sutie-Cache': 'HIT',
        },
      });
    }

    await connectDB();

    // Chạy dọn dẹp tài khoản rác trong background qua after(), không làm chậm phản hồi cho client
    after(async () => {
      try {
        await cleanupExpiredUnverifiedUsers('login');
      } catch (cleanupError) {
        console.error('Lỗi dọn tài khoản chưa xác thực quá hạn:', cleanupError);
      }
    });

    const users = await User.find()
      .select('-password -verificationCode')
      .sort({ createdAt: -1 })
      .lean();

    setApiCache(ADMIN_USERS_CACHE_KEY, users, ADMIN_USERS_CACHE_TTL);

    return NextResponse.json(users, {
      headers: {
        'Cache-Control': 'private, no-cache, stale-while-revalidate=30',
        'X-Sutie-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách người dùng:', error);
    void logApiError({
      module: '[GET] /api/admin/users',
      error,
      request,
      statusCode: 500,
    });
    return NextResponse.json(
      { error: 'Không thể lấy dữ liệu người dùng' },
      { status: 500 }
    );
  }
}

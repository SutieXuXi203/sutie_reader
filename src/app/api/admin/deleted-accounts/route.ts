import { connectDB } from '@/lib/db';
import { DeletedAccount } from '@/models/DeletedAccount';
import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { getApiCache, setApiCache } from '@/lib/api-cache';
import { logApiError } from '@/lib/telegramLogger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const requestedLimit = Number(searchParams.get('limit') ?? '200');
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.floor(requestedLimit), 1), 1000)
      : 200;

    const cacheKey = `admin:deleted-accounts:${limit}`;
    const cached = getApiCache<any[]>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'private, no-cache, stale-while-revalidate=60',
          'X-Sutie-Cache': 'HIT',
        },
      });
    }

    await connectDB();

    const deletedAccounts = await DeletedAccount.find()
      .sort({ deletedAt: -1 })
      .limit(limit)
      .lean();

    setApiCache(cacheKey, deletedAccounts, 60_000);

    return NextResponse.json(deletedAccounts, {
      headers: {
        'Cache-Control': 'private, no-cache, stale-while-revalidate=60',
        'X-Sutie-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('Lỗi lấy lịch sử tài khoản đã xóa tự động:', error);
    void logApiError({
      module: '[GET] /api/admin/deleted-accounts',
      error,
      request,
      statusCode: 500,
    });
    return NextResponse.json(
      { error: 'Không thể lấy dữ liệu tài khoản đã xóa tự động' },
      { status: 500 }
    );
  }
}

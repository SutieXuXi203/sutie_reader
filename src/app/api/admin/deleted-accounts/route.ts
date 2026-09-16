import { connectDB } from '@/lib/db';
import { DeletedAccount } from '@/models/DeletedAccount';
import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    await connectDB();

    const searchParams = request.nextUrl.searchParams;
    const requestedLimit = Number(searchParams.get('limit') ?? '200');
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.floor(requestedLimit), 1), 1000)
      : 200;

    const deletedAccounts = await DeletedAccount.find()
      .sort({ deletedAt: -1 })
      .limit(limit);

    return NextResponse.json(deletedAccounts);
  } catch (error) {
    console.error('Lỗi lấy lịch sử tài khoản đã xóa tự động:', error);
    return NextResponse.json(
      { error: 'Không thể lấy dữ liệu tài khoản đã xóa tự động' },
      { status: 500 }
    );
  }
}

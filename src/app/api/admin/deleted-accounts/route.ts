import { connectDB } from '@/lib/db';
import { DeletedAccount } from '@/models/DeletedAccount';
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-fallback-secret-key-at-least-32-characters'
);

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Chưa xác thực' }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload || payload.role !== 'admin') {
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

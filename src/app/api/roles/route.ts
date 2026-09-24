import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Role } from '@/models/Role';
import { logApiError } from '@/lib/telegramLogger';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const roles = await Role.find().sort({ createdAt: 1 }).lean();
    return NextResponse.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    void logApiError({
      module: '[GET] /api/roles',
      error,
      request,
      statusCode: 500,
    });
    return NextResponse.json({ error: 'Không thể tải danh sách vai trò' }, { status: 500 });
  }
}

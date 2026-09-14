import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Role } from '@/models/Role';

export async function GET() {
  try {
    await connectDB();
    const roles = await Role.find().sort({ createdAt: 1 }).lean();
    return NextResponse.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json({ error: 'Không thể tải danh sách vai trò' }, { status: 500 });
  }
}

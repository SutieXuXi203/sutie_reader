import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-fallback-secret-key-at-least-32-characters');
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
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        return NextResponse.json(users);
    } catch (error) {
        console.error('Lỗi lấy danh sách người dùng:', error);
        return NextResponse.json({ error: 'Không thể lấy dữ liệu người dùng' }, { status: 500 });
    }
}

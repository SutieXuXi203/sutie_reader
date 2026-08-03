import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getJwtSecret } from '@/lib/server-auth';
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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
        const { id } = await params;
        const userToDelete = await User.findById(id);
        if (!userToDelete) {
            return NextResponse.json({ error: 'Không tìm thấy người dùng' }, { status: 404 });
        }
        if (userToDelete.email === process.env.ADMIN_USERNAME) {
            return NextResponse.json({ error: 'Không thể xóa tài khoản quản trị viên gốc' }, { status: 403 });
        }
        await User.findByIdAndDelete(id);
        return NextResponse.json({ message: 'Đã xóa người dùng thành công' });
    } catch (error) {
        console.error('Lỗi xóa người dùng:', error);
        return NextResponse.json({ error: 'Không thể xóa người dùng' }, { status: 500 });
    }
}

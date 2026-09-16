import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        if (!(await isAdmin(request))) {
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

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        if (!(await isAdmin(request))) {
            return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
        }
        await connectDB();
        const { id } = await params;
        const body = await request.json();
        const { role } = body;

        if (!['guest', 'user', 'admin'].includes(role)) {
            return NextResponse.json({ error: 'Vai trò không hợp lệ' }, { status: 400 });
        }

        const targetUser = await User.findById(id).select('email role name avatar');
        if (!targetUser) {
            return NextResponse.json({ error: 'Không tìm thấy người dùng' }, { status: 404 });
        }
        if (targetUser.email === process.env.ADMIN_USERNAME && role !== 'admin') {
            return NextResponse.json({ error: 'Không thể hạ quyền tài khoản quản trị viên gốc' }, { status: 403 });
        }

        targetUser.role = role;
        await targetUser.save();

        return NextResponse.json({
            message: 'Đã cập nhật vai trò thành công',
            user: {
                _id: targetUser._id,
                email: targetUser.email,
                name: targetUser.name,
                role: targetUser.role,
                avatar: targetUser.avatar,
            },
        });
    } catch (error) {
        console.error('Lỗi cập nhật vai trò:', error);
        return NextResponse.json({ error: 'Không thể cập nhật vai trò' }, { status: 500 });
    }
}

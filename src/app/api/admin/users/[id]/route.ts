import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { NextRequest, NextResponse } from 'next/server';
import { isAdmin, getAuthUser } from '@/lib/auth';
import { ObjectId } from 'mongodb';
import { invalidateApiCache } from '@/lib/api-cache';
import { clearUserCache } from '@/lib/server-auth';
import { logApiError, logApiAction } from '@/lib/telegramLogger';

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
        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ error: 'ID người dùng không hợp lệ' }, { status: 400 });
        }
        const currentUser = await getAuthUser(request);
        if (currentUser && currentUser.id === id) {
            return NextResponse.json({ error: 'Không thể tự xóa tài khoản của chính mình' }, { status: 400 });
        }

        const userToDelete = await User.findById(id);
        if (!userToDelete) {
            return NextResponse.json({ error: 'Không tìm thấy người dùng' }, { status: 404 });
        }
        const rootAdminEmail = (process.env.ADMIN_USERNAME || '').toLowerCase().trim();
        if (rootAdminEmail && userToDelete.email.toLowerCase().trim() === rootAdminEmail) {
            return NextResponse.json({ error: 'Không thể xóa tài khoản quản trị viên gốc' }, { status: 403 });
        }
        await User.findByIdAndDelete(id);
        clearUserCache(id);
        invalidateApiCache('admin:users');

        // Ghi nhận log xóa tài khoản người dùng
        void logApiAction({
            module: 'Quản trị người dùng (Admin)',
            action: 'Xóa tài khoản người dùng',
            request,
            user: currentUser,
            details: {
                'ID người dùng bị xóa': id,
                'Email': userToDelete.email,
                'Tên': userToDelete.name,
                'Vai trò trước khi xóa': userToDelete.role,
            },
            level: 'warn',
        });

        return NextResponse.json({ message: 'Đã xóa người dùng thành công' });
    } catch (error) {
        console.error('Lỗi xóa người dùng:', error);
        void logApiError({
            module: '[DELETE] /api/admin/users/[id]',
            error,
            request,
            statusCode: 500,
        });
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
        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ error: 'ID người dùng không hợp lệ' }, { status: 400 });
        }
        const body = await request.json();
        const { role } = body;

        if (!['guest', 'user', 'admin'].includes(role)) {
            return NextResponse.json({ error: 'Vai trò không hợp lệ' }, { status: 400 });
        }

        const targetUser = await User.findById(id).select('email role name avatar');
        if (!targetUser) {
            return NextResponse.json({ error: 'Không tìm thấy người dùng' }, { status: 404 });
        }
        const rootAdminEmail = (process.env.ADMIN_USERNAME || '').toLowerCase().trim();
        if (rootAdminEmail && targetUser.email.toLowerCase().trim() === rootAdminEmail && role !== 'admin') {
            return NextResponse.json({ error: 'Không thể hạ quyền tài khoản quản trị viên gốc' }, { status: 403 });
        }

        const oldRole = targetUser.role;
        targetUser.role = role;
        await targetUser.save();
        clearUserCache(id);
        invalidateApiCache('admin:users');

        // Ghi nhận log thay đổi vai trò người dùng
        const adminUser = await getAuthUser(request);
        void logApiAction({
            module: 'Quản trị người dùng (Admin)',
            action: 'Cập nhật phân quyền / vai trò',
            request,
            user: adminUser,
            details: {
                'Tài khoản thay đổi': targetUser.email,
                'Vai trò cũ': oldRole,
                'Vai trò mới': role,
            },
            level: 'info',
        });

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
        void logApiError({
            module: '[PATCH] /api/admin/users/[id]',
            error,
            request,
            statusCode: 500,
        });
        return NextResponse.json({ error: 'Không thể cập nhật vai trò' }, { status: 500 });
    }
}

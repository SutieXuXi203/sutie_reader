import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-fallback-secret-key-at-least-32-characters');
export async function GET(request: NextRequest) {
    try {
        const token = request.cookies.get('token')?.value;
        console.log('Session Check - Token present:', !!token);
        if (!token) {
            return NextResponse.json({ user: null });
        }
        const { payload } = await jwtVerify(token, JWT_SECRET);
        console.log('Session Check - Payload verified:', payload.id);
        const userId = payload.id as string;
        await connectDB();
        const user = await User.findById(userId);
        console.log('Session Check - User found:', !!user);
        if (!user) {
            return NextResponse.json({ user: null });
        }
        return NextResponse.json({
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                avatar: user.avatar,
                role: user.role,
            },
        });
    } catch (error) {
        console.error('Lỗi kiểm tra phiên đăng nhập:', error);
        return NextResponse.json({ user: null });
    }
}
export async function PUT(request: NextRequest) {
    try {
        const token = request.cookies.get('token')?.value;
        if (!token) {
            return NextResponse.json({ error: 'Chưa xác thực' }, { status: 401 });
        }
        const { payload } = await jwtVerify(token, JWT_SECRET);
        if (!payload || !payload.id) {
            return NextResponse.json({ error: 'Token không hợp lệ' }, { status: 401 });
        }
        await connectDB();
        const { name, avatar } = await request.json();
        if (!name) {
            return NextResponse.json({ error: 'Tên không được để trống' }, { status: 400 });
        }
        const user = await User.findById(payload.id);
        if (!user) {
            return NextResponse.json({ error: 'Không tìm thấy người dùng' }, { status: 404 });
        }
        user.name = name;
        if (avatar !== undefined) {
            user.avatar = avatar;
        }
        await user.save();
        return NextResponse.json({
            message: 'Cập nhật thành công',
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                avatar: user.avatar,
                role: user.role,
            },
        });
    } catch (error) {
        console.error('Lỗi cập nhật hồ sơ:', error);
        return NextResponse.json({ error: 'Cập nhật không thành công' }, { status: 500 });
    }
}

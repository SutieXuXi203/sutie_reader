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
            },
        });
    } catch (error) {
        console.error('Lỗi kiểm tra phiên đăng nhập:', error);
        return NextResponse.json({ user: null });
    }
}

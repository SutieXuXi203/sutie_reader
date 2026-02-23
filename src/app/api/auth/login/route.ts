import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-fallback-secret-key-at-least-32-characters');

export async function POST(request: NextRequest) {
    try {
        await connectDB();
        const { email, password, rememberMe } = await request.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Vui lòng nhập email và mật khẩu' }, { status: 400 });
        }

        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return NextResponse.json({ error: 'Email hoặc mật khẩu không đúng' }, { status: 401 });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return NextResponse.json({ error: 'Email hoặc mật khẩu không đúng' }, { status: 401 });
        }

        const token = await new SignJWT({ id: user._id.toString(), email: user.email })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime(rememberMe ? '7d' : '24h')
            .sign(JWT_SECRET);

        const response = NextResponse.json({
            message: 'Đăng nhập thành công',
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                avatar: user.avatar,
            },
        });

        // Set cookie
        const cookieOptions: any = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
        };

        if (rememberMe) {
            cookieOptions.maxAge = 60 * 60 * 24 * 7; // 7 days
        }

        response.cookies.set('token', token, cookieOptions);

        return response;
    } catch (error) {
        console.error('Lỗi đăng nhập:', error);
        return NextResponse.json({ error: 'Đăng nhập không thành công' }, { status: 500 });
    }
}

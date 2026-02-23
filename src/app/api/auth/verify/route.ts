import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        await connectDB();
        const { email, code } = await request.json();

        if (!email || !code) {
            return NextResponse.json({ error: 'Thiếu email hoặc mã xác thực' }, { status: 400 });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return NextResponse.json({ error: 'Tài khoản không tồn tại' }, { status: 404 });
        }

        if (user.isVerified) {
            return NextResponse.json({ error: 'Tài khoản đã được xác thực trước đó' }, { status: 400 });
        }

        if (user.verificationCode !== code) {
            return NextResponse.json({ error: 'Mã xác thực không chính xác' }, { status: 400 });
        }

        // Activate user account
        user.isVerified = true;
        user.verificationCode = undefined;
        await user.save();

        return NextResponse.json({
            message: 'Xác thực thành công. Bạn có thể đăng nhập.',
        });
    } catch (error) {
        console.error('Lỗi xác thực:', error);
        return NextResponse.json({ error: 'Xác thực không thành công' }, { status: 500 });
    }
}

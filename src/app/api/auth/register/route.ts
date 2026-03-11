import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sendVerificationEmail } from '@/lib/mail';
export async function POST(request: NextRequest) {
    try {
        await connectDB();
        const { email, password, name, avatar } = await request.json();
        if (!email || !password || !name) {
            return NextResponse.json({ error: 'Thiếu thông tin đăng ký' }, { status: 400 });
        }
        const isAdminEmail = email === process.env.ADMIN_USERNAME;
        if (!isAdminEmail && !email.toLowerCase().endsWith('@gmail.com')) {
            return NextResponse.json({ error: 'Vui lòng sử dụng tài khoản Gmail hợp lệ' }, { status: 400 });
        }
        let user = await User.findOne({ email });
        if (user) {
            if (user.isVerified) {
                return NextResponse.json({ error: 'Email đã được sử dụng' }, { status: 400 });
            }
        }
        const hashedPassword = await bcrypt.hash(password, 12);
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        if (user) {
            user.password = hashedPassword;
            user.name = name;
            user.isVerified = false;
            user.verificationCode = verificationCode;
            user.verificationExpiresAt = verificationExpiresAt;
            if (avatar) user.avatar = avatar;
            await user.save();
        } else {
            user = await User.create({
                email,
                password: hashedPassword,
                name,
                avatar: avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
                isVerified: false,
                verificationCode,
                verificationExpiresAt,
            });
        }
        try {
            await sendVerificationEmail(email, verificationCode);
        } catch (mailError) {
            console.error('Lỗi gửi email:', mailError);
            return NextResponse.json({ error: 'Không thể gửi email xác thực. Vui lòng thử lại.' }, { status: 500 });
        }
        return NextResponse.json({
            message: 'Vui lòng kiểm tra email để nhận mã xác thực',
            requireVerification: true,
            email: user.email
        });
    } catch (error) {
        console.error('Lỗi đăng ký:', error);
        return NextResponse.json({ error: 'Đăng ký không thành công' }, { status: 500 });
    }
}

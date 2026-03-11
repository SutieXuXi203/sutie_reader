import { connectDB } from '@/lib/db';
import { archiveAndDeleteExpiredUnverifiedUser } from '@/lib/archiveDeletedAccount';
import { User } from '@/models/User';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-fallback-secret-key-at-least-32-characters'
);

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { email, password, rememberMe } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Vui lòng nhập email và mật khẩu' }, { status: 400 });
    }

    const isAdminInput =
      email === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD;

    if (!isAdminInput && !email.toLowerCase().endsWith('@gmail.com')) {
      return NextResponse.json({ error: 'Vui lòng sử dụng tài khoản Gmail hợp lệ' }, { status: 400 });
    }

    let user = await User.findOne({ email }).select('+password');
    let isMatch = false;

    if (isAdminInput) {
      isMatch = true;

      if (!user) {
        const hashedPassword = await bcrypt.hash(password, 10);
        user = new User({
          email,
          password: hashedPassword,
          name: 'Administrator',
          role: 'admin',
          isVerified: true,
        });
        await user.save();
      } else if (user.role !== 'admin' || !user.isVerified) {
        user.role = 'admin';
        user.isVerified = true;
        await user.save();
      }
    } else {
      if (!user) {
        return NextResponse.json({ error: 'Email hoặc mật khẩu không đúng' }, { status: 401 });
      }

      isMatch = await bcrypt.compare(password, user.password);

      if (isMatch && user.role !== 'admin' && !user.isVerified) {
        if (user.verificationExpiresAt && user.verificationExpiresAt.getTime() <= Date.now()) {
          await archiveAndDeleteExpiredUnverifiedUser(user, 'login');
          return NextResponse.json(
            {
              error:
                'Tài khoản chưa xác thực đã hết hạn sau 24 giờ và đã bị xóa. Vui lòng đăng ký lại.',
            },
            { status: 410 }
          );
        }

        return NextResponse.json(
          { error: 'Tài khoản chưa được xác thực. Vui lòng kiểm tra email.' },
          { status: 403 }
        );
      }
    }

    if (!isMatch) {
      return NextResponse.json({ error: 'Email hoặc mật khẩu không đúng' }, { status: 401 });
    }

    const token = await new SignJWT({ id: user._id.toString(), email: user.email, role: user.role })
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
        role: user.role,
      },
    });

    const cookieOptions: {
      httpOnly: true;
      secure: boolean;
      sameSite: 'lax';
      path: '/';
      maxAge?: number;
    } = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    };

    if (rememberMe) {
      cookieOptions.maxAge = 60 * 60 * 24 * 7;
    }

    response.cookies.set('token', token, cookieOptions);
    return response;
  } catch (error) {
    console.error('Lỗi đăng nhập:', error);
    return NextResponse.json({ error: 'Đăng nhập không thành công' }, { status: 500 });
  }
}

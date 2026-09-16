import { connectDB } from '@/lib/db';
import { handleExpiredUnverifiedUser } from '@/lib/unverifiedUserCleanup';
import { User } from '@/models/User';
import { RateLimit } from '@/models/RateLimit';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { loginSchema } from '@/lib/validations';
import { getJwtSecret } from '@/lib/server-auth';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const parseResult = loginSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: JSON.parse(parseResult.error.message)[0].message }, { status: 400 });
    }
    const { email, password, rememberMe, pin } = parseResult.data;

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
        const hashedPassword = await bcrypt.hash(password, 12);
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
        const isExpiredAccountDeleted = await handleExpiredUnverifiedUser(user, 'login');

        if (isExpiredAccountDeleted.deleted) {
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

    // Kiểm tra yêu cầu mã PIN đối với role admin và user
    const SECRET_PIN = process.env.UNLOCK_PIN;
    const isFullAccessRole = user.role === 'admin' || user.role === 'user';

    if (isFullAccessRole && SECRET_PIN) {
      const forwardedFor = request.headers.get('x-forwarded-for');
      const realIp = request.headers.get('x-real-ip');
      const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : (realIp || 'unknown');
      const rateLimitKey = `pin:login:${ip}:${user.email.toLowerCase().trim()}`;

      let rateLimit = await RateLimit.findOne({ ip: rateLimitKey });

      if (rateLimit && rateLimit.lockUntil && rateLimit.lockUntil > new Date()) {
        const waitMinutes = Math.ceil((rateLimit.lockUntil.getTime() - Date.now()) / 60000);
        return NextResponse.json(
          { error: `Bạn đã nhập sai mã PIN quá nhiều lần. Vui lòng thử lại sau ${waitMinutes} phút.` },
          { status: 429 }
        );
      }

      if (!pin) {
        return NextResponse.json({
          requirePin: true,
          message: 'Tài khoản của bạn yêu cầu mã PIN bảo mật để hoàn tất đăng nhập',
        });
      }

      if (pin !== SECRET_PIN) {
        if (!rateLimit) {
          rateLimit = new RateLimit({ ip: rateLimitKey, attempts: 1 });
        } else {
          rateLimit.attempts += 1;
          if (rateLimit.attempts >= 5) {
            rateLimit.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
          }
        }
        await rateLimit.save();

        if (rateLimit.attempts >= 5) {
          return NextResponse.json(
            { error: 'Bạn đã nhập sai mã PIN quá 5 lần. Vui lòng thử lại sau 15 phút.' },
            { status: 429 }
          );
        }

        return NextResponse.json(
          { error: `Mã PIN bảo mật không chính xác (còn ${5 - rateLimit.attempts} lần thử)` },
          { status: 401 }
        );
      }

      if (rateLimit) {
        await RateLimit.deleteOne({ ip: rateLimitKey });
      }
    }

    const token = await new SignJWT({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(rememberMe ? '7d' : '24h')
      .sign(getJwtSecret());

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

    // Cấp quyền mở khóa site toàn diện nếu là admin/user đã nhập đúng PIN
    if (isFullAccessRole && SECRET_PIN) {
      response.cookies.set('site_access_token', SECRET_PIN, cookieOptions);
    }

    return response;
  } catch (error) {
    console.error('Lỗi đăng nhập:', error);
    return NextResponse.json({ error: 'Đăng nhập không thành công' }, { status: 500 });
  }
}

import { connectDB } from '@/lib/db';
import { handleExpiredUnverifiedUser } from '@/lib/unverifiedUserCleanup';
import { User } from '@/models/User';
import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { loginSchema } from '@/lib/validations';
import { getJwtSecret, createSiteAccessToken } from '@/lib/server-auth';
import { logApiError, logApiAction } from '@/lib/telegramLogger';
import { getClientIp } from '@/lib/clientIp';
import { consumeAttempt, resetAttempts } from '@/lib/rateLimit';
import { hashPassword, verifyPassword, safeEqual } from '@/lib/password';

// Hash giả để thời gian phản hồi của email không tồn tại gần bằng email tồn tại (chống dò tài khoản qua timing)
const DUMMY_PASSWORD_HASH = '$2b$12$op7CDRh7QFJbwSmypJEMIOAsxUv6vUotgp0/ZbVpYJx5g9TALHTTe';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const parseResult = loginSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: JSON.parse(parseResult.error.message)[0].message }, { status: 400 });
    }
    const { email, password, rememberMe, pin } = parseResult.data;

    const ip = getClientIp(request.headers);
    const normalizedEmail = email.toLowerCase().trim();
    const pwdRateLimitKey = `pwd:login:${ip}:${normalizedEmail}`;

    // Lượt thử được tính nguyên tử TRƯỚC khi kiểm tra mật khẩu: N request song song chỉ có tối đa 5 request được xử lý
    const pwdAttempt = await consumeAttempt(pwdRateLimitKey);
    if (!pwdAttempt.allowed) {
      return NextResponse.json(
        { error: `Bạn đã nhập sai mật khẩu quá nhiều lần. Vui lòng thử lại sau ${pwdAttempt.retryAfterMinutes} phút.` },
        { status: 429 }
      );
    }

    const failedPasswordResponse = () => {
      if (pwdAttempt.locked) {
        void logApiAction({
          module: 'Bảo mật tài khoản (Auth)',
          action: 'Khóa đăng nhập do nhập sai mật khẩu 5 lần',
          request,
          details: {
            'Email': normalizedEmail,
            'IP': ip,
            'Thời gian khóa': '15 phút',
          },
          level: 'warn',
        });

        return NextResponse.json(
          { error: 'Bạn đã nhập sai mật khẩu quá 5 lần. Vui lòng thử lại sau 15 phút.' },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: `Email hoặc mật khẩu không đúng (còn ${pwdAttempt.remaining} lần thử)` },
        { status: 401 }
      );
    };

    const adminUsername = (process.env.ADMIN_USERNAME || '').toLowerCase().trim();
    const adminPassword = process.env.ADMIN_PASSWORD || '';
    const testUsername = (process.env.TEST_USERNAME || '').toLowerCase().trim();
    const testPassword = process.env.TEST_PASSWORD || '';

    const isAdminAccount = Boolean(adminUsername && normalizedEmail === adminUsername);
    const isTestAccount = Boolean(testUsername && normalizedEmail === testUsername);

    const isAdminInput = isAdminAccount && Boolean(adminPassword) && safeEqual(password, adminPassword);
    const isTestInput = isTestAccount && Boolean(testPassword) && safeEqual(password, testPassword);

    if (!isAdminAccount && !isTestAccount && !normalizedEmail.endsWith('@gmail.com')) {
      return NextResponse.json({ error: 'Vui lòng sử dụng tài khoản Gmail hợp lệ' }, { status: 400 });
    }

    let user = await User.findOne({ email: normalizedEmail }).select('+password');
    let isMatch = false;

    if (isAdminInput) {
      isMatch = true;

      if (!user) {
        const hashedPassword = await hashPassword(password, 12);
        user = new User({
          email: normalizedEmail,
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
    } else if (isTestInput) {
      isMatch = true;

      if (!user) {
        const hashedPassword = await hashPassword(password, 12);
        user = new User({
          email: normalizedEmail,
          password: hashedPassword,
          name: 'Tài khoản Test',
          role: 'guest',
          isVerified: true,
        });
        await user.save();
      } else {
        let shouldSave = false;
        if (user.role !== 'guest') {
          user.role = 'guest';
          shouldSave = true;
        }
        if (!user.isVerified) {
          user.isVerified = true;
          shouldSave = true;
        }
        const isDbPasswordMatch = await verifyPassword(password, user.password);
        if (!isDbPasswordMatch) {
          user.password = await hashPassword(password, 12);
          shouldSave = true;
        }
        if (shouldSave) {
          await user.save();
        }
      }
    } else {
      if (!user) {
        await verifyPassword(password, DUMMY_PASSWORD_HASH);
        return failedPasswordResponse();
      }

      isMatch = await verifyPassword(password, user.password);

      if (isMatch && user.role !== 'admin' && !user.isVerified) {
        const isExpiredAccountDeleted = await handleExpiredUnverifiedUser(user, 'login');

        if (isExpiredAccountDeleted.deleted) {
          return NextResponse.json(
            {
              error:
                'Tài khoản chưa xác thực đã hết hạn và đã được dọn dẹp. Vui lòng đăng ký lại.',
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
      return failedPasswordResponse();
    }

    // Đăng nhập thành công mật khẩu -> xóa bộ đếm sai mật khẩu
    await resetAttempts(pwdRateLimitKey);

    // Kiểm tra yêu cầu mã PIN đối với role admin và user, hoặc tài khoản test
    const SECRET_PIN = process.env.UNLOCK_PIN?.trim();
    const isFullAccessRole = user.role === 'admin' || user.role === 'user';
    const shouldRequirePin = (isFullAccessRole || isTestAccount) && Boolean(SECRET_PIN);

    if (shouldRequirePin && SECRET_PIN) {
      if (!pin) {
        return NextResponse.json({
          requirePin: true,
          message: 'Tài khoản của bạn yêu cầu mã PIN bảo mật để hoàn tất đăng nhập',
        });
      }

      const pinRateLimitKey = `pin:login:${ip}:${normalizedEmail}`;
      const pinAttempt = await consumeAttempt(pinRateLimitKey);

      if (!pinAttempt.allowed) {
        return NextResponse.json(
          { error: `Bạn đã nhập sai mã PIN quá nhiều lần. Vui lòng thử lại sau ${pinAttempt.retryAfterMinutes} phút.` },
          { status: 429 }
        );
      }

      if (!safeEqual(pin.trim(), SECRET_PIN)) {
        if (pinAttempt.locked) {
          void logApiAction({
            module: 'Bảo mật tài khoản (Auth)',
            action: 'Khóa đăng nhập do nhập sai mã PIN 5 lần',
            request,
            details: {
              'Email': normalizedEmail,
              'IP': ip,
              'Thời gian khóa': '15 phút',
            },
            level: 'warn',
          });

          return NextResponse.json(
            { error: 'Bạn đã nhập sai mã PIN quá 5 lần. Vui lòng thử lại sau 15 phút.' },
            { status: 429 }
          );
        }

        return NextResponse.json(
          { error: `Mã PIN bảo mật không chính xác (còn ${pinAttempt.remaining} lần thử)` },
          { status: 401 }
        );
      }

      await resetAttempts(pinRateLimitKey);
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

    // Cấp quyền mở khóa site toàn diện nếu là admin/user hoặc tài khoản test đã nhập đúng PIN
    if ((isFullAccessRole || isTestAccount) && SECRET_PIN) {
      const siteToken = await createSiteAccessToken();
      response.cookies.set('site_access_token', siteToken, cookieOptions);
    }

    // Ghi nhận log đăng nhập thành công về Telegram
    void logApiAction({
      module: 'Xác thực (Auth)',
      action: 'Đăng nhập thành công',
      request,
      user: { email: user.email, id: user._id.toString(), role: user.role, name: user.name },
      details: {
        'Tài khoản': user.email,
        'Tên': user.name,
        'Vai trò': user.role,
        'Ghi nhớ': rememberMe ? 'Có (7 ngày)' : 'Không (24 giờ)',
      },
      level: 'success',
    });

    return response;
  } catch (error) {
    console.error('Lỗi đăng nhập:', error);
    void logApiError({
      module: '[POST] /api/auth/login',
      error,
      request,
      statusCode: 500,
    });
    return NextResponse.json({ error: 'Đăng nhập không thành công' }, { status: 500 });
  }
}

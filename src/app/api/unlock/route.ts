import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { RateLimit } from '@/models/RateLimit';
import { createSiteAccessToken } from '@/lib/server-auth';
import { logApiError, logApiAction } from '@/lib/telegramLogger';
import crypto from 'node:crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { pin } = body;

    const SECRET_PIN = process.env.UNLOCK_PIN?.trim();
    const ACCESS_COOKIE_NAME = 'site_access_token';

    if (!SECRET_PIN) {
      return NextResponse.json({ success: true });
    }

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Vui lòng cung cấp mã PIN hợp lệ' },
        { status: 400 }
      );
    }

    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : (realIp || 'unknown');

    await connectDB();
    let rateLimit = await RateLimit.findOne({ ip });

    if (rateLimit && rateLimit.lockUntil && rateLimit.lockUntil > new Date()) {
      const waitMinutes = Math.ceil((rateLimit.lockUntil.getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { success: false, error: `Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau ${waitMinutes} phút.` },
        { status: 429 }
      );
    }

    const pinBuffer = Buffer.from(pin.trim());
    const secretBuffer = Buffer.from(SECRET_PIN);
    const isMatch =
      pinBuffer.length === secretBuffer.length &&
      crypto.timingSafeEqual(pinBuffer, secretBuffer);

    if (isMatch) {
      if (rateLimit) {
        await RateLimit.deleteOne({ ip });
      }

      const siteToken = await createSiteAccessToken();
      const response = NextResponse.json({ success: true });
      
      response.cookies.set(ACCESS_COOKIE_NAME, siteToken, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 ngày
      });

      // Ghi nhận log mở khóa site thành công
      void logApiAction({
        module: 'Mở khóa trang (Unlock PIN)',
        action: 'Mở khóa bảo vệ toàn site thành công',
        request,
        details: {
          'Client IP': ip,
          'Thời hạn cookie': '30 ngày',
        },
        level: 'info',
      });

      return response;
    }

    if (!rateLimit) {
      rateLimit = new RateLimit({ ip, attempts: 1 });
    } else {
      rateLimit.attempts += 1;
      if (rateLimit.attempts >= 5) {
        rateLimit.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
    }
    await rateLimit.save();

    if (rateLimit.attempts >= 5) {
      void logApiAction({
        module: 'Bảo mật site (Unlock PIN)',
        action: 'Khóa mở trang do nhập sai mã PIN quá 5 lần',
        request,
        details: {
          'Client IP': ip,
          'Thời gian khóa': '15 phút',
        },
        level: 'warn',
      });

      return NextResponse.json(
        { success: false, error: 'Bạn đã nhập sai quá 5 lần. Vui lòng thử lại sau 15 phút.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { success: false, error: `Mã PIN không chính xác (còn ${5 - rateLimit.attempts} lần thử)` },
      { status: 401 }
    );
  } catch (error) {
    console.error('Unlock error:', error);
    void logApiError({
      module: '[POST] /api/unlock',
      error,
      request,
      statusCode: 500,
    });
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi' },
      { status: 500 }
    );
  }
}

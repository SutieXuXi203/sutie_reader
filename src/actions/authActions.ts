'use server';

import { cookies, headers } from 'next/headers';
import crypto from 'node:crypto';
import { connectDB } from '@/lib/db';
import { RateLimit } from '@/models/RateLimit';
import { createSiteAccessToken, getCurrentUser } from '@/lib/server-auth';
import { logApiError, logApiAction } from '@/lib/telegramLogger';

export async function unlockSiteAction(pin: string): Promise<{ success: boolean; error?: string }> {
  try {
    const SECRET_PIN = process.env.UNLOCK_PIN?.trim();
    const ACCESS_COOKIE_NAME = 'site_access_token';

    if (!SECRET_PIN) {
      return { success: true };
    }

    if (!pin || typeof pin !== 'string') {
      return { success: false, error: 'Vui lòng cung cấp mã PIN hợp lệ' };
    }

    const headerStore = await headers();
    const forwardedFor = headerStore.get('x-forwarded-for');
    const realIp = headerStore.get('x-real-ip');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : (realIp || 'unknown');

    await connectDB();
    let rateLimit = await RateLimit.findOne({ ip });

    if (rateLimit && rateLimit.lockUntil && rateLimit.lockUntil > new Date()) {
      const waitMinutes = Math.ceil((rateLimit.lockUntil.getTime() - Date.now()) / 60000);
      return {
        success: false,
        error: `Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau ${waitMinutes} phút.`,
      };
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
      const cookieStore = await cookies();
      cookieStore.set(ACCESS_COOKIE_NAME, siteToken, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 ngày
      });

      void logApiAction({
        module: 'Mở khóa trang (Server Action)',
        action: 'Mở khóa bảo vệ toàn site thành công',
        details: {
          'Client IP': ip,
          'Thời hạn cookie': '30 ngày',
        },
        level: 'info',
      });

      return { success: true };
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
        module: 'Bảo mật site (Server Action)',
        action: 'Khóa mở trang do nhập sai mã PIN quá 5 lần',
        details: {
          'Client IP': ip,
          'Thời gian khóa': '15 phút',
        },
        level: 'warn',
      });

      return {
        success: false,
        error: 'Bạn đã nhập sai quá 5 lần. Vui lòng thử lại sau 15 phút.',
      };
    }

    return {
      success: false,
      error: `Mã PIN không chính xác (còn ${5 - rateLimit.attempts} lần thử)`,
    };
  } catch (error) {
    console.error('Lỗi khi mở khóa trang qua Server Action:', error);
    void logApiError({
      module: 'unlockSiteAction',
      error,
      statusCode: 500,
    });
    return { success: false, error: 'Đã xảy ra lỗi' };
  }
}

export async function getCurrentUserAction() {
  return getCurrentUser();
}

export async function logoutAction(): Promise<{ success: boolean }> {
  try {
    const cookieStore = await cookies();
    const clearOptions = {
      path: '/',
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
    };
    cookieStore.set('token', '', clearOptions);
    cookieStore.set('site_access_token', '', clearOptions);
    return { success: true };
  } catch (error) {
    console.error('Lỗi khi đăng xuất qua Server Action:', error);
    return { success: false };
  }
}

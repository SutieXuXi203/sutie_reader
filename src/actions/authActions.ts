'use server';

import { cookies, headers } from 'next/headers';
import { createSiteAccessToken, getCurrentUser } from '@/lib/server-auth';
import { logApiError, logApiAction } from '@/lib/telegramLogger';
import { getClientIp } from '@/lib/clientIp';
import { verifySitePin } from '@/lib/sitePin';

export async function unlockSiteAction(pin: string): Promise<{ success: boolean; error?: string }> {
  try {
    const headerStore = await headers();
    const ip = getClientIp(headerStore);

    const result = await verifySitePin(pin, ip);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    if (process.env.UNLOCK_PIN?.trim()) {
      const siteToken = await createSiteAccessToken();
      const cookieStore = await cookies();
      cookieStore.set('site_access_token', siteToken, {
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
    }

    return { success: true };
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

import { NextResponse } from 'next/server';
import { createSiteAccessToken } from '@/lib/server-auth';
import { logApiError, logApiAction } from '@/lib/telegramLogger';
import { getClientIp } from '@/lib/clientIp';
import { verifySitePin } from '@/lib/sitePin';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const ip = getClientIp(request.headers);

    const result = await verifySitePin(body?.pin, ip);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const response = NextResponse.json({ success: true });

    if (process.env.UNLOCK_PIN?.trim()) {
      const siteToken = await createSiteAccessToken();
      response.cookies.set('site_access_token', siteToken, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 ngày
      });

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
    }

    return response;
  } catch (error) {
    console.error('Unlock error:', error);
    void logApiError({
      module: '[POST] /api/unlock',
      error,
      request,
      statusCode: 500,
    });
    return NextResponse.json({ success: false, error: 'Đã xảy ra lỗi' }, { status: 500 });
  }
}

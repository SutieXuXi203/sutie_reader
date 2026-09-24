import { NextRequest, NextResponse } from 'next/server';
import { logApiError } from '@/lib/telegramLogger';

export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.json({ message: 'Đăng xuất thành công' });
    const clearOptions = {
      path: '/',
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
    };
    response.cookies.set('token', '', clearOptions);
    response.cookies.set('site_access_token', '', clearOptions);
    return response;
  } catch (error) {
    console.error('Lỗi khi đăng xuất:', error);
    void logApiError({
      module: '[POST] /api/auth/logout',
      error,
      request,
      statusCode: 500,
    });
    return NextResponse.json({ error: 'Đăng xuất không thành công' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pin } = body;

    const SECRET_TOKEN = process.env.UNLOCK_PIN || '123456';
    const ACCESS_COOKIE_NAME = 'site_access_token';

    if (pin === SECRET_TOKEN) {
      const response = NextResponse.json({ success: true });
      
      // Set the session cookie (expires when browser closes)
      response.cookies.set(ACCESS_COOKIE_NAME, SECRET_TOKEN, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });

      return response;
    }

    return NextResponse.json(
      { success: false, error: 'Mã PIN không chính xác' },
      { status: 401 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi' },
      { status: 500 }
    );
  }
}

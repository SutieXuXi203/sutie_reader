import { NextResponse } from 'next/server';

export async function POST() {
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
}

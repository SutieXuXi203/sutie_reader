import { NextResponse } from 'next/server';

export async function POST() {
    const response = NextResponse.json({ message: 'Đăng xuất thành công' });
    response.cookies.set('token', '', { path: '/', maxAge: 0 });
    response.cookies.set('site_access_token', '', { path: '/', maxAge: 0 });
    return response;
}

import { NextResponse } from 'next/server';

export async function POST() {
    const response = NextResponse.json({ message: 'Đăng xuất thành công' });
    response.cookies.delete('token');
    return response;
}

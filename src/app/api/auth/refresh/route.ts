import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { getJwtSecret, createSiteAccessToken, clearUserCache } from '@/lib/server-auth';

function getSafeCallbackUrl(callbackUrl: string | null | undefined): string {
  if (!callbackUrl) return '/admin';
  const clean = callbackUrl.trim();
  if (
    clean.startsWith('/') &&
    !clean.startsWith('//') &&
    !clean.includes('\\') &&
    !clean.includes('://')
  ) {
    return clean;
  }
  return '/admin';
}

export async function GET(request: NextRequest) {
  const rawCallbackUrl = request.nextUrl.searchParams.get('callbackUrl');
  const callbackUrl = getSafeCallbackUrl(rawCallbackUrl);
  const fallbackUrl = new URL('/', request.url);

  try {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.redirect(fallbackUrl);
    }

    const { payload } = await jwtVerify(token, getJwtSecret());
    if (!payload || !payload.id) {
      return NextResponse.redirect(fallbackUrl);
    }

    await connectDB();
    const user = await User.findById(payload.id).select('email name avatar role isVerified');
    if (!user || (user.role !== 'admin' && !user.isVerified)) {
      return NextResponse.redirect(fallbackUrl);
    }

    // Nếu người dùng thực sự có vai trò 'admin' trong Database:
    if (user.role === 'admin') {
      const newToken = await new SignJWT({
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(getJwtSecret());

      clearUserCache(user._id.toString());

      const destination = new URL(callbackUrl, request.url);
      const response = NextResponse.redirect(destination);

      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: '/' as const,
        maxAge: 60 * 60 * 24 * 7,
      };

      response.cookies.set('token', newToken, cookieOptions);

      // Cấp quyền mở khóa site toàn diện nếu hệ thống có cấu hình UNLOCK_PIN
      if (process.env.UNLOCK_PIN) {
        const siteToken = await createSiteAccessToken();
        response.cookies.set('site_access_token', siteToken, cookieOptions);
      }

      return response;
    }

    // Nếu trong Database người này không phải là admin, đưa về trang chủ
    return NextResponse.redirect(fallbackUrl);
  } catch (error) {
    console.error('Lỗi khi tự động làm mới token phiên quản trị:', error);
    return NextResponse.redirect(fallbackUrl);
  }
}

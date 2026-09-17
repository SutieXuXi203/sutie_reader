import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Bỏ qua các tệp tĩnh, tài nguyên hệ thống Next.js và API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname.startsWith('/unlock') ||
    pathname.startsWith('/posts') ||
    pathname === '/' ||
    pathname.startsWith('/contact')
  ) {
    return NextResponse.next();
  }

  // Chặn truy cập trang quản trị nếu không có vai trò Quản trị viên (admin)
  if (pathname.startsWith('/admin')) {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || '');
      const { payload } = await jwtVerify(token, secret);
      if (payload.role !== 'admin') {
        return NextResponse.redirect(new URL('/', request.url));
      }
    } catch {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Chặn truy cập các trang nội bộ nếu chưa đăng nhập
  if (pathname.startsWith('/products')) {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Kiểm tra mã PIN bảo vệ toàn trang (nếu có cấu hình UNLOCK_PIN)
  const ACCESS_COOKIE_NAME = 'site_access_token';
  const SECRET_TOKEN = process.env.UNLOCK_PIN?.trim();

  if (!SECRET_TOKEN) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(ACCESS_COOKIE_NAME);
  
  if (cookie?.value) {
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || '');
      const { payload } = await jwtVerify(cookie.value, secret);
      if (payload.scope === 'site_unlock') {
        return NextResponse.next();
      }
    } catch {
      // Fallback cho cookie plaintext cũ trong thời gian chuyển tiếp
      if (cookie.value === SECRET_TOKEN) {
        return NextResponse.next();
      }
    }
  }

  const unlockUrl = new URL('/unlock', request.url);
  unlockUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);
  
  return NextResponse.redirect(unlockUrl);
}

export const config = {
  matcher: [
    /*
     * Khớp tất cả các đường dẫn trừ:
     * - api (API routes)
     * - _next/static (tệp tĩnh)
     * - _next/image (tối ưu hóa ảnh)
     * - favicon.ico (icon trình duyệt)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

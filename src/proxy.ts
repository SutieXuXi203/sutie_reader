import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
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

  // Chặn truy cập các trang quản trị nếu chưa có token đăng nhập
  if (pathname.startsWith('/admin') || pathname.startsWith('/products')) {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Kiểm tra mã PIN bảo vệ toàn trang (nếu có cấu hình UNLOCK_PIN)
  const ACCESS_COOKIE_NAME = 'site_access_token';
  const SECRET_TOKEN = process.env.UNLOCK_PIN;

  if (!SECRET_TOKEN) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(ACCESS_COOKIE_NAME);
  
  if (cookie?.value === SECRET_TOKEN) {
    return NextResponse.next();
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

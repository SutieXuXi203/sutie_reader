import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const STATIC_FILE_PATTERN =
  /\.(?:png|jpe?g|gif|webp|avif|svg|ico|css|js|mjs|map|txt|xml|json|webmanifest|woff2?|ttf|otf|eot|mp4|webm|mp3)$/i;

/**
 * Các trang CÔNG KHAI có chủ đích, không bị chặn bởi mã PIN toàn site:
 * trang chủ, trang đọc truyện (/posts, cần để chia sẻ link và xem trước OG), trang liên hệ và trang nhập PIN.
 * Quyền đọc từng truyện/chương vẫn được kiểm tra ở tầng server (permissions.ts).
 */
function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname.startsWith('/unlock') ||
    pathname.startsWith('/posts') ||
    pathname.startsWith('/contact')
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Bỏ qua tài nguyên hệ thống Next.js, API routes và các tệp tĩnh thật sự (không bỏ qua mọi đường dẫn có dấu chấm)
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || STATIC_FILE_PATTERN.test(pathname)) {
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
        // Token trong cookie có thể bị cũ (vừa được cấp quyền admin trong DB nhưng cookie chưa cập nhật).
        // Điều hướng qua /api/auth/refresh để đồng bộ token từ DB trong tích tắc, tránh bị kẹt hoặc đá ra trang chủ.
        const refreshUrl = new URL('/api/auth/refresh', request.url);
        refreshUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);
        return NextResponse.redirect(refreshUrl);
      }
    } catch {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
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

  // Chỉ chấp nhận JWT có chữ ký hợp lệ, scope `site_unlock`. Tuyệt đối không so sánh cookie với chính mã PIN:
  // cách đó cho phép dò PIN không giới hạn số lần (không đi qua bộ đếm khóa brute-force).
  const cookie = request.cookies.get(ACCESS_COOKIE_NAME);
  if (cookie?.value) {
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || '');
      const { payload } = await jwtVerify(cookie.value, secret);
      if (payload.scope === 'site_unlock') {
        return NextResponse.next();
      }
    } catch {
      // Cookie không hợp lệ -> chuyển sang trang nhập PIN
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

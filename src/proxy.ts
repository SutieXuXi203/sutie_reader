import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname.startsWith('/unlock')
  ) {
    return NextResponse.next();
  }

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
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

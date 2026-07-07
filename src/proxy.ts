import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // 1. Bỏ qua các đường dẫn tĩnh, favicon, api hoặc tệp tài nguyên
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const ACCESS_COOKIE_NAME = 'site_access_token';
  const SECRET_TOKEN = 'dinhmanh2003';

  // 2. Kiểm tra nếu URL có chứa query param token=dinhmanh2003
  const token = searchParams.get('token');

  if (token === SECRET_TOKEN) {
    // Clone URL để xoá token đi (giúp URL sạch đẹp khi người dùng xem trang)
    const url = request.nextUrl.clone();
    url.searchParams.delete('token');

    const response = NextResponse.redirect(url);

    // Lưu cookie xác thực dưới dạng Session Cookie (hết hạn khi đóng trình duyệt)
    response.cookies.set(ACCESS_COOKIE_NAME, SECRET_TOKEN, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });

    return response;
  }

  // 3. Kiểm tra xem trình duyệt đã lưu cookie hợp lệ chưa
  const cookie = request.cookies.get(ACCESS_COOKIE_NAME);
  if (cookie?.value === SECRET_TOKEN) {
    return NextResponse.next();
  }

  // 4. Nếu không có quyền truy cập, hiển thị giao diện khóa cao cấp (Premium Lock Screen)
  const lockScreenHtml = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Quyền truy cập bị hạn chế</title>
      <style>
        :root {
          --primary: #6366f1;
          --primary-glow: rgba(99, 102, 241, 0.15);
          --background: #090d16;
          --card-bg: rgba(17, 25, 40, 0.75);
          --card-border: rgba(255, 255, 255, 0.08);
          --text: #f8fafc;
          --text-muted: #94a3b8;
        }

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          background-color: var(--background);
          color: var(--text);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          position: relative;
        }

        /* Ambient glow background */
        body::before {
          content: '';
          position: absolute;
          width: 500px;
          height: 500px;
          border-radius: 50%;
          background: radial-gradient(circle, var(--primary-glow) 0%, transparent 70%);
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 0;
          pointer-events: none;
        }

        .container {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 440px;
          padding: 24px;
        }

        .card {
          background: var(--card-bg);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid var(--card-border);
          border-radius: 24px;
          padding: 40px 32px;
          text-align: center;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
          animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .icon-wrapper {
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(99, 102, 241, 0.05));
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 28px;
          position: relative;
          animation: pulse 2s infinite ease-in-out;
        }

        .icon-wrapper svg {
          width: 36px;
          height: 36px;
          stroke: var(--primary);
          stroke-width: 2;
          fill: none;
        }

        h1 {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 12px;
          letter-spacing: -0.02em;
          background: linear-gradient(to right, #f8fafc, #cbd5e1);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        p {
          font-size: 15px;
          line-height: 1.6;
          color: var(--text-muted);
          margin-bottom: 24px;
        }

        .badge {
          display: inline-block;
          padding: 6px 12px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #f87171;
          font-size: 13px;
          font-weight: 500;
          border-radius: 100px;
          margin-bottom: 24px;
        }

        .footer {
          margin-top: 12px;
          font-size: 12px;
          color: #64748b;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 0 12px rgba(99, 102, 241, 0);
            transform: scale(1.02);
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="icon-wrapper">
            <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <div class="badge">403 Restricted</div>
          <h1>Truy cập bị giới hạn</h1>
          <p>Trang web này đã bị khóa.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return new Response(lockScreenHtml, {
    status: 403,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
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

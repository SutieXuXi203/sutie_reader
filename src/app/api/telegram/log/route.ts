import { NextRequest, NextResponse } from 'next/server';
import { logApiError, logApiAction } from '@/lib/telegramLogger';
import { getAuthUser } from '@/lib/auth';
import { checkRateLimit } from '@/lib/memoryRateLimit';
import { getClientIp } from '@/lib/clientIp';

const MAX_BODY_BYTES = 8 * 1024;

function clean(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, maxLength);
}

function cleanMetadata(value: unknown): Record<string, string | number | boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const result: Record<string, string | number | boolean> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>).slice(0, 10)) {
    if (typeof entry === 'string') result[clean(key, 40)] = clean(entry, 200);
    else if (typeof entry === 'number' || typeof entry === 'boolean') result[clean(key, 40)] = entry;
  }
  return result;
}

/**
 * Nhận báo cáo lỗi từ trình duyệt (error.tsx / global-error.tsx) rồi chuyển về Telegram.
 * Endpoint này công khai (trang lỗi có thể xảy ra khi chưa đăng nhập) nên bắt buộc có giới hạn tần suất
 * và giới hạn kích thước/ký tự để không bị lợi dụng spam hoặc giả mạo cảnh báo của quản trị viên.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    const ip = getClientIp(request.headers);

    const limit = await checkRateLimit(`tglog:${user?.id ?? ip}`, user ? 20 : 5, 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
      );
    }

    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return NextResponse.json({ success: false }, { status: 413 });
    }

    let body: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(rawBody);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    const type = body.type === 'error' || body.type === undefined ? 'error' : 'info';
    const message = clean(body.message, 300);
    const moduleName = clean(body.module, 60) || 'Client-Side';
    const stack = clean(body.stack, 1500);
    const metadata = cleanMetadata(body.metadata);

    if (type === 'error') {
      const err = new Error(message || 'Lỗi phía Client (Frontend)');
      if (stack) {
        err.stack = stack;
      }
      void logApiError({
        module: `[CLIENT] ${moduleName}`,
        error: err,
        request,
        user,
        metadata: {
          ...metadata,
          userAgent: clean(request.headers.get('user-agent'), 200),
        },
        statusCode: 500,
      });
    } else {
      void logApiAction({
        module: `[CLIENT] ${moduleName}`,
        action: message || 'Sự kiện người dùng',
        request,
        user,
        details: metadata,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error handling /api/telegram/log:', err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

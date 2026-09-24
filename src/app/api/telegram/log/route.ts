import { NextRequest, NextResponse } from 'next/server';
import { logApiError, logApiAction } from '@/lib/telegramLogger';
import { getAuthUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { type = 'error', message, module = 'Client-Side', stack, metadata } = body;
    const user = await getAuthUser(request);

    if (type === 'error') {
      const err = new Error(message || 'Lỗi phía Client (Frontend)');
      if (stack) {
        err.stack = stack;
      }
      await logApiError({
        module: `[CLIENT] ${module}`,
        error: err,
        request,
        user,
        metadata: {
          ...metadata,
          userAgent: request.headers.get('user-agent'),
        },
        statusCode: 500,
      });
    } else {
      await logApiAction({
        module: `[CLIENT] ${module}`,
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

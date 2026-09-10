import { NextRequest, NextResponse } from 'next/server';
import {
  isTelegramConfigured,
  sendTelegramMessage,
  editTelegramMessage,
  formatters,
} from '@/lib/telegram';

export const dynamic = 'force-dynamic';

interface ProgressPayload {
  action: 'start' | 'progress' | 'success' | 'error';
  messageId?: number;
  title: string;
  completed?: number;
  total?: number;
  status?: 'uploading' | 'saving' | 'success' | 'error';
  errorMessage?: string;
}

export async function POST(req: NextRequest) {
  try {
    if (!isTelegramConfigured()) {
      return NextResponse.json({
        success: false,
        skipped: true,
        message: 'Telegram is not configured in .env',
      });
    }

    const body: ProgressPayload = await req.json();
    const { action, messageId, title, completed = 0, total = 0, status = 'uploading', errorMessage } = body;

    const safeTitle = (title || 'Chương truyện').trim();

    if (action === 'start') {
      const text = formatters.start(safeTitle, total);
      const res = await sendTelegramMessage(text);
      return NextResponse.json({
        success: res.success,
        messageId: res.messageId,
        error: res.error,
      });
    }

    if (action === 'progress') {
      if (!messageId) {
        return NextResponse.json({ success: false, message: 'Missing messageId for progress edit' });
      }

      const text = formatters.progress(
        safeTitle,
        completed,
        total,
        status === 'saving' ? 'saving' : 'uploading'
      );
      const res = await editTelegramMessage(messageId, text);
      return NextResponse.json({ success: res.success, error: res.error });
    }

    if (action === 'success') {
      const text = formatters.success(safeTitle, total || completed);
      if (messageId) {
        const res = await editTelegramMessage(messageId, text);
        return NextResponse.json({ success: res.success, error: res.error });
      } else {
        const res = await sendTelegramMessage(text);
        return NextResponse.json({ success: res.success, messageId: res.messageId, error: res.error });
      }
    }

    if (action === 'error') {
      const text = formatters.error(safeTitle, errorMessage);
      if (messageId) {
        const res = await editTelegramMessage(messageId, text);
        return NextResponse.json({ success: res.success, error: res.error });
      } else {
        const res = await sendTelegramMessage(text);
        return NextResponse.json({ success: res.success, messageId: res.messageId, error: res.error });
      }
    }

    return NextResponse.json({ success: false, message: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error in /api/telegram/progress:', errorMsg);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 200 });
  }
}

'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Tự động báo cáo lỗi render/client về Telegram Bot
    try {
      fetch('/api/telegram/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'error',
          module: 'React App Error Boundary',
          message: error?.message || 'Lỗi giao diện không xác định',
          stack: error?.stack,
          metadata: {
            digest: error?.digest,
            url: typeof window !== 'undefined' ? window.location.href : '',
          },
        }),
      }).catch(() => {});
    } catch {
      // ignore
    }
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" x2="12" y1="8" y2="12" />
          <line x1="12" x2="12.01" y1="16" y2="16" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold tracking-tight mb-2">Đã xảy ra lỗi không mong muốn</h2>
      <p className="text-muted-foreground text-sm max-w-md mb-6 leading-relaxed">
        Hệ thống đã tự động ghi nhận và gửi báo cáo chi tiết đến Quản trị viên qua Telegram Bot để xử lý ngay lập tức.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:opacity-90 transition-opacity shadow-sm cursor-pointer"
        >
          Thử lại
        </button>
        <Link
          href="/"
          className="px-4 py-2 border border-border text-foreground text-sm font-medium rounded-xl hover:bg-muted/50 transition-colors"
        >
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}

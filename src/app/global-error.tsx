'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      fetch('/api/telegram/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'error',
          module: 'Global Root Layout Crash',
          message: error?.message || 'Lỗi nghiêm trọng tại Root Layout',
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
    <html lang="vi">
      <body className="min-h-screen flex items-center justify-center p-6 bg-neutral-900 text-white font-sans text-center">
        <div className="max-w-md flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" x2="12" y1="8" y2="12" />
              <line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-2">Đã xảy ra sự cố hệ thống</h1>
          <p className="text-neutral-400 text-sm mb-6">
            Lỗi nghiêm trọng đã được báo trực tiếp về Telegram Bot của Quản trị viên.
          </p>
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
          >
            Tải lại trang
          </button>
        </div>
      </body>
    </html>
  );
}

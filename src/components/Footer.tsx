'use client';

import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-12 py-8 px-4 sm:px-6 lg:px-8 border-t border-border bg-card/30 w-full">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div className="flex items-center gap-2 text-primary justify-center sm:justify-start">
          <span className="text-sm font-bold text-foreground">Lubu</span>
        </div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Lubu. All rights reserved.
        </p>
        <div className="flex gap-6 text-xs text-muted-foreground justify-center sm:justify-end">
          <Link href="/" className="hover:text-primary transition-colors font-semibold">
            Trang chủ
          </Link>
          <Link href="/contact" className="hover:text-primary transition-colors font-semibold">
            Liên hệ
          </Link>
        </div>
      </div>
    </footer>
  );
}

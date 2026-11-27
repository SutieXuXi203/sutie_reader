'use client';

import { useEffect } from 'react';

/**
 * Cuộn trang dùng cơ chế gốc của trình duyệt (native scroll).
 *
 * Trước đây desktop dùng Lenis: mỗi nấc lăn chuột bị kéo dài 0.8s và có một vòng
 * requestAnimationFrame chạy liên tục, khiến trang có cảm giác ì/lag và buộc các lớp
 * backdrop-blur cố định vẽ lại mỗi khung hình. Native scroll được trình duyệt cuộn
 * trên compositor thread nên mượt và phản hồi tức thì.
 *
 * Provider chỉ còn giữ việc cuộn mượt khi bấm liên kết neo (#id).
 */
export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.('a[href^="#"]');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.length <= 1) return;
      const el = document.getElementById(href.slice(1));
      if (!el) return;
      e.preventDefault();
      // Trừ chiều cao header cố định (h-14 = 56px) + 16px khoảng thở
      const top = el.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return <>{children}</>;
}

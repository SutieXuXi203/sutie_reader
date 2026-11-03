'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import type Lenis from 'lenis';

export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    if (lenisRef.current) {
      lenisRef.current.destroy();
      lenisRef.current = null;
    }

    const html = document.documentElement;
    html.className = html.className.replace(/lenis(-\w+)?/g, '').trim();
    html.style.removeProperty('overflow');

    if (pathname.startsWith('/posts/')) return;

    // Detect touch / mobile devices or reduced motion preference
    const isTouchDevice =
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches);

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let cancelled = false;

    // Smooth scroll for anchor clicks (works on both mobile and desktop)
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href^="#"]');
      if (anchor) {
        const href = anchor.getAttribute('href');
        if (href && href.startsWith('#') && href.length > 1) {
          const el = document.getElementById(href.slice(1));
          if (el) {
            e.preventDefault();
            if (lenisRef.current) {
              lenisRef.current.scrollTo(el, { offset: -20 });
            } else {
              el.scrollIntoView({ behavior: 'smooth' });
            }
          }
        }
      }
    };

    document.addEventListener('click', handleClick);

    // On mobile or if reduced motion is requested, use native high-performance scrolling
    if (isTouchDevice || prefersReducedMotion) {
      return () => {
        document.removeEventListener('click', handleClick);
      };
    }

    const setupSmoothScroll = async () => {
      const { default: LenisCtor } = await import('lenis');
      if (cancelled) return;

      const lenis = new LenisCtor({
        duration: 0.8,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        syncTouch: false,
        touchMultiplier: 0,
        infinite: false,
      });

      lenisRef.current = lenis;

      function raf(time: number) {
        lenis.raf(time);
        rafIdRef.current = requestAnimationFrame(raf);
      }

      rafIdRef.current = requestAnimationFrame(raf);
    };

    void setupSmoothScroll();

    return () => {
      cancelled = true;
      document.removeEventListener('click', handleClick);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (lenisRef.current) {
        lenisRef.current.destroy();
        lenisRef.current = null;
      }
      html.style.removeProperty('overflow');
    };
  }, [pathname]);

  return <>{children}</>;
}


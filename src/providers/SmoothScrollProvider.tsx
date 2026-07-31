'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import type Lenis from 'lenis';
import type Snap from 'lenis/snap';

export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);
  const snapRef = useRef<Snap | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    if (snapRef.current) {
      snapRef.current.destroy();
      snapRef.current = null;
    }

    if (lenisRef.current) {
      lenisRef.current.destroy();
      lenisRef.current = null;
    }

    const html = document.documentElement;
    html.className = html.className.replace(/lenis(-\w+)?/g, '').trim();
    html.style.removeProperty('overflow');

    if (pathname.startsWith('/posts/')) return;

    let cancelled = false;
    let snapTimer: ReturnType<typeof setTimeout> | null = null;
    let handleClick: ((e: MouseEvent) => void) | null = null;

    const setupSmoothScroll = async () => {
      const { default: LenisCtor } = await import('lenis');
      if (cancelled) return;

      const lenis = new LenisCtor({
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        touchMultiplier: 1.5,
        infinite: false,
      });

      lenisRef.current = lenis;

      function raf(time: number) {
        lenis.raf(time);
        rafIdRef.current = requestAnimationFrame(raf);
      }

      rafIdRef.current = requestAnimationFrame(raf);

      handleClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const anchor = target.closest('a[href^="#"]');
        if (anchor) {
          const href = anchor.getAttribute('href');
          if (href && href.startsWith('#')) {
            const el = document.getElementById(href.slice(1));
            if (el) {
              e.preventDefault();
              lenis.scrollTo(el, { offset: 0 });
            }
          }
        }
      };

      document.addEventListener('click', handleClick);

      if (pathname === '/') {
        snapTimer = setTimeout(() => {
          void import('lenis/snap').then(({ default: SnapCtor }) => {
            if (cancelled || lenisRef.current !== lenis) return;

            const snap = new SnapCtor(lenis, {
              type: 'proximity',
              lerp: 0.08,
              duration: 1.2,
              easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            });

            const sections = document.querySelectorAll('[data-section]');
            sections.forEach((section) => {
              snap.addElement(section as HTMLElement, {
                align: ['start'],
              });
            });

            snapRef.current = snap;
          });
        }, 300);
      }
    };

    void setupSmoothScroll();

    return () => {
      cancelled = true;
      if (handleClick) {
        document.removeEventListener('click', handleClick);
      }
      if (snapTimer) {
        clearTimeout(snapTimer);
      }
      if (snapRef.current) {
        snapRef.current.destroy();
        snapRef.current = null;
      }
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

'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Lenis from 'lenis';
import Snap from 'lenis/snap';

export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);
  const snapRef = useRef<Snap | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      touchMultiplier: 1.5,
      infinite: false,
    });

    lenisRef.current = lenis;

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    // Sync Lenis with anchor clicks that use scrollIntoView
    const handleClick = (e: MouseEvent) => {
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

    return () => {
      document.removeEventListener('click', handleClick);
      lenis.destroy();
    };
  }, []);

  // Setup snap only on home page
  useEffect(() => {
    const lenis = lenisRef.current;
    if (!lenis) return;

    // Destroy previous snap instance
    if (snapRef.current) {
      snapRef.current.destroy();
      snapRef.current = null;
    }

    const isHomePage = pathname === '/';
    if (!isHomePage) return;

    // Small delay to ensure DOM sections are rendered
    const timer = setTimeout(() => {
      const snap = new Snap(lenis, {
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
    }, 300);

    return () => {
      clearTimeout(timer);
      if (snapRef.current) {
        snapRef.current.destroy();
        snapRef.current = null;
      }
    };
  }, [pathname]);

  return <>{children}</>;
}

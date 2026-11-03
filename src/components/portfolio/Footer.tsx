'use client';

import Link from 'next/link';
import { PORTFOLIO_DATA } from '@/data/portfolioData';
import { ArrowUp, Heart } from 'lucide-react';

export function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="border-t border-border/50 py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full select-none">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
        {/* Brand & Monogram */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center font-bold text-xs tracking-tighter">
            AN
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-foreground">
              {PORTFOLIO_DATA.profile.name}
            </p>
            <p className="text-xs text-muted-foreground font-mono">
              {PORTFOLIO_DATA.profile.role}
            </p>
          </div>
        </div>

        {/* Tech Credits */}
        <p className="text-xs text-muted-foreground text-center">
          Engineered with <span className="text-foreground font-medium">Next.js 16</span>,{' '}
          <span className="text-foreground font-medium">React 19</span>,{' '}
          <span className="text-foreground font-medium">GSAP 3</span> &amp;{' '}
          <span className="text-foreground font-medium">Lenis</span>.
        </p>

        {/* Back to top button */}
        <button
          onClick={scrollToTop}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border/70 bg-card/60 hover:bg-foreground/5 text-xs font-medium text-foreground transition-all active:scale-95 shadow-sm"
          data-cursor-pointer
        >
          <span>Top</span>
          <ArrowUp className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="mt-8 pt-6 border-t border-border/30 flex flex-col sm:flex-row items-center justify-between text-[11px] text-muted-foreground gap-2">
        <span>&copy; {new Date().getFullYear()} {PORTFOLIO_DATA.profile.name}. All rights reserved.</span>
        <span>Designed for high-impact visual craft &amp; zero compromises.</span>
      </div>
    </footer>
  );
}


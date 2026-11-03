'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PORTFOLIO_DATA } from '@/data/portfolioData';
import { Menu, X, ArrowUpRight } from 'lucide-react';

export function PortfolioNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Overview', href: '#hero' },
    { label: 'Works', href: '#projects' },
    { label: 'Skills & Stack', href: '#skills' },
    { label: 'Journey', href: '#experience' },
    { label: 'Contact', href: '#contact' },
  ];

  return (
    <header className="fixed top-4 inset-x-0 z-50 flex justify-center px-4 pointer-events-none transition-all duration-300">
      <nav
        className={`pointer-events-auto flex items-center justify-between gap-3 sm:gap-6 px-4 py-2.5 rounded-full border transition-all duration-500 backdrop-blur-xl ${
          scrolled
            ? 'bg-background/80 border-border/80 shadow-2xl shadow-black/10 dark:shadow-white/5 py-2'
            : 'bg-background/40 border-border/40 shadow-sm'
        }`}
      >
        {/* Brand / Name badge */}
        <Link
          href="#hero"
          className="flex items-center gap-2.5 group text-sm font-semibold tracking-tight text-foreground transition-opacity hover:opacity-80"
          data-cursor-pointer
        >
          <div className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center font-bold text-xs tracking-tighter shadow-inner">
            AN
          </div>
          <span className="hidden sm:inline-block font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors">
            {PORTFOLIO_DATA.profile.nickname}
          </span>
          <div className="flex items-center gap-1.5 pl-2 border-l border-border/60">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="hidden md:inline-block text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              Available
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <div className="hidden md:flex items-center gap-1 text-xs font-medium text-muted-foreground">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-1.5 rounded-full hover:text-foreground hover:bg-foreground/5 transition-all duration-200"
              data-cursor-pointer
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right Actions: Theme Toggle & Contact Button */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

          <Link
            href="#contact"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-4 py-1.5 rounded-full bg-foreground text-background hover:opacity-90 active:scale-95 transition-all shadow-sm"
            data-cursor-pointer
          >
            <span>Let&apos;s Talk</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>

          {/* Mobile hamburger toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-1.5 rounded-full hover:bg-foreground/10 text-foreground transition-colors"
            aria-label="Toggle menu"
            data-cursor-pointer
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer Menu */}
      {mobileOpen && (
        <div className="pointer-events-auto md:hidden fixed inset-x-4 top-20 bg-background/95 border border-border backdrop-blur-2xl rounded-2xl p-5 shadow-2xl flex flex-col gap-3 animate-in fade-in slide-in-from-top-4 duration-200">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="px-4 py-2 text-sm font-medium text-foreground hover:bg-foreground/5 rounded-lg transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="#contact"
            onClick={() => setMobileOpen(false)}
            className="mt-2 flex items-center justify-center gap-1.5 text-sm font-medium py-2.5 rounded-xl bg-foreground text-background"
          >
            <span>Let&apos;s Talk</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </header>
  );
}


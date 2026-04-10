'use client';
import { useState, useEffect, useRef } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  Home as HomeIcon, LogOut, User as UserIcon, LogIn,
  LayoutDashboard, Mail, Newspaper, X
} from 'lucide-react';
import { useAuth } from '@/providers/AuthContext';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';

const AuthDialog = dynamic(() => import('@/components/AuthDialog').then(m => ({ default: m.AuthDialog })), { ssr: false });
const ProfileDialog = dynamic(() => import('@/components/ProfileDialog').then(m => ({ default: m.ProfileDialog })), { ssr: false });

const SECTION_IDS = ['home', 'posts', 'contact'] as const;

export function SiteNav() {
  const { user, logout, isAdmin } = useAuth();
  const pathname = usePathname();
  const [activeSection, setActiveSection] = useState('home');
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const profileButtonRef = useRef<HTMLButtonElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  // Only show section dots on the home page
  const isHomePage = pathname === '/';

  // Hide nav entirely on the post reader page
  const isPostReaderPage = pathname.startsWith('/posts/');

  useEffect(() => {
    if (!isHomePage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let maxRatio = 0;
        let activeId = '';
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            activeId = entry.target.id || entry.target.getAttribute('data-section') || '';
          }
        });
        if (activeId) setActiveSection(activeId);
      },
      { root: null, rootMargin: '-30% 0px -50% 0px', threshold: [0, 0.1, 0.25, 0.5] }
    );
    SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id) || document.querySelector(`[data-section="${id}"]`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [isHomePage]);

  useEffect(() => {
    if (!user) setIsProfileMenuOpen(false);
  }, [user]);

  useEffect(() => {
    if (!isProfileMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (profileButtonRef.current?.contains(target) || profileMenuRef.current?.contains(target)) return;
      setIsProfileMenuOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isProfileMenuOpen]);

  if (isPostReaderPage) return null;

  const scrollTo = (id: string) => {
    if (id === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      <nav className="fixed md:top-0 md:left-0 bottom-0 left-0 right-0 z-50 md:w-16 md:h-screen w-full flex md:flex-col flex-row items-center justify-around md:justify-start md:py-8 py-3 px-4 md:px-0 bg-card/70 backdrop-blur-xl border-t border-white/20 shadow-[0_-8px_20px_rgba(0,0,0,0.12)] md:bg-transparent md:backdrop-blur-none md:border-0 md:shadow-none transition-all duration-300">
        {/* Desktop: section dots — only on home page */}
        <div className="hidden md:flex md:flex-col md:items-center md:gap-16 md:absolute md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2">
          {isHomePage ? (
            <>
              {[
                { id: 'home', label: 'Trang chủ' },
                { id: 'posts', label: 'Bài viết' },
                { id: 'contact', label: 'Liên hệ' },
              ].map((section) => (
                <button
                  key={section.id}
                  onClick={() => scrollTo(section.id)}
                  className="group relative flex items-center justify-center cursor-pointer w-4 h-4"
                  title={section.label}
                >
                  <div className={`w-1.5 h-1.5 rounded-full border-[1.5px] transition-all duration-300 ${activeSection === section.id
                    ? 'bg-primary border-primary scale-150 shadow-[0_0_6px_var(--color-primary)]'
                    : 'bg-transparent border-primary/50 hover:border-primary hover:scale-125'
                    }`} />
                  <span className={`absolute left-full ml-3 text-xs font-semibold whitespace-nowrap px-2.5 py-1 rounded-[8px] transition-all duration-300 ${activeSection === section.id
                    ? 'opacity-100 translate-x-0 text-primary'
                    : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 text-muted-foreground'
                    }`}>
                    {section.label}
                  </span>
                </button>
              ))}
              <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1px] bg-border -z-10" />
            </>
          ) : (
            /* Non-home pages: show nav links instead */
            <>
              {[
                { href: '/', label: 'Trang chủ', icon: <HomeIcon className="w-4 h-4" /> },
                { href: '/products', label: 'Bài viết', icon: <Newspaper className="w-4 h-4" /> },
                { href: '/#contact', label: 'Liên hệ', icon: <Mail className="w-4 h-4" /> },
              ].map((item) => {
                const isActive = item.href === pathname || (item.href === '/products' && pathname === '/products');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group relative flex items-center justify-center w-4 h-4"
                    title={item.label}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full border-[1.5px] transition-all duration-300 ${isActive
                      ? 'bg-primary border-primary scale-150 shadow-[0_0_6px_var(--color-primary)]'
                      : 'bg-transparent border-primary/50 hover:border-primary hover:scale-125'
                      }`} />
                    <span className={`absolute left-full ml-3 text-xs font-semibold whitespace-nowrap px-2.5 py-1 rounded-[8px] transition-all duration-300 ${isActive
                      ? 'opacity-100 translate-x-0 text-primary'
                      : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 text-muted-foreground'
                      }`}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
              <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1px] bg-border -z-10" />
            </>
          )}
        </div>

        {/* Mobile bottom nav */}
        <div className="flex md:hidden flex-row items-center justify-center gap-6 flex-1">
          {isHomePage ? (
            <>
              <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                title="Trang chủ"
                className="relative flex flex-col items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-primary/70 hover:text-primary transition-all hover:scale-110 active:scale-95 cursor-pointer">
                <HomeIcon className="w-6 h-6" />
                <span className={`absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-px rounded-full bg-primary transition-all duration-300 ${activeSection === 'home' ? 'opacity-100 w-4' : 'opacity-0 w-0'}`} />
              </button>
              <a href="#posts"
                title="Bài viết"
                className="relative flex flex-col items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-primary/70 hover:text-primary transition-all hover:scale-110 active:scale-95 group">
                <Newspaper className="w-6 h-6" />
                <span className={`absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-px rounded-full bg-primary transition-all duration-300 ${activeSection === 'posts' ? 'opacity-100 w-4' : 'opacity-0 w-0'}`} />
              </a>
              <button onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
                title="Liên hệ"
                className="relative flex flex-col items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-primary/70 hover:text-primary transition-all hover:scale-110 active:scale-95">
                <Mail className="w-6 h-6" />
                <span className={`absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-px rounded-full bg-primary transition-all duration-300 ${activeSection === 'contact' ? 'opacity-100 w-4' : 'opacity-0 w-0'}`} />
              </button>
            </>
          ) : (
            <>
              <Link href="/" title="Trang chủ"
                className={`relative flex flex-col items-center gap-2 text-[10px] uppercase font-bold tracking-widest transition-all hover:scale-110 active:scale-95 ${pathname === '/' ? 'text-primary' : 'text-primary/70 hover:text-primary'}`}>
                <HomeIcon className="w-6 h-6" />
              </Link>
              <Link href="/products" title="Bài viết"
                className={`relative flex flex-col items-center gap-2 text-[10px] uppercase font-bold tracking-widest transition-all hover:scale-110 active:scale-95 ${pathname === '/products' ? 'text-primary' : 'text-primary/70 hover:text-primary'}`}>
                <Newspaper className="w-6 h-6" />
              </Link>
              <Link href="/#contact" title="Liên hệ"
                className="relative flex flex-col items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-primary/70 hover:text-primary transition-all hover:scale-110 active:scale-95">
                <Mail className="w-6 h-6" />
              </Link>
            </>
          )}
        </div>

        {/* Auth & theme controls */}
        <div className="flex flex-row md:flex-col items-center gap-4 md:gap-6 md:mt-auto">
          {user ? (
            <>
              <div className="group relative">
                <button
                  ref={profileButtonRef}
                  onClick={() => {
                    if (window.matchMedia('(max-width: 767px)').matches) {
                      setIsProfileMenuOpen((prev) => !prev);
                    }
                  }}
                  aria-expanded={isProfileMenuOpen}
                  aria-haspopup="menu"
                  className="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden border-2 border-border dark:border-white/25 hover:border-primary dark:hover:border-primary-foreground/75 transition-all shadow-md shadow-primary/10"
                >
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-secondary dark:bg-primary/20 flex items-center justify-center">
                      <UserIcon className="w-6 h-6 text-primary/75" />
                    </div>
                  )}
                </button>
                <div
                  ref={profileMenuRef}
                  className={`absolute right-0 md:right-auto md:left-full md:translate-x-0 md:ml-4 bottom-[calc(100%+8px)] md:bottom-0 bg-[#FFF6E7] dark:bg-[#6E2530] md:bg-card border border-border backdrop-blur-none md:backdrop-blur-md rounded-[8px] shadow-2xl p-2 min-w-[240px] z-50 transform transition-all duration-300 ${isProfileMenuOpen ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible translate-y-[10px]'} md:opacity-0 md:invisible md:translate-y-0 md:translate-x-[-10px] md:group-hover:opacity-100 md:group-hover:visible md:group-hover:translate-y-0 md:group-hover:translate-x-0`}
                >
                  <div className="px-3 py-2 border-b border-border mb-2">
                    <p className="text-sm font-black text-foreground truncate tracking-tight">{user.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate font-medium">{user.email}</p>
                  </div>
                  <button
                    onClick={() => { setIsProfileMenuOpen(false); setIsProfileDialogOpen(true); }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-[8px] text-sm font-bold text-foreground hover:bg-muted transition-all mb-1 cursor-pointer"
                  >
                    <UserIcon className="w-5 h-5" />
                    <span>Hồ sơ cá nhân</span>
                  </button>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-[8px] text-sm font-bold text-foreground hover:bg-muted transition-all mb-1"
                    >
                      <LayoutDashboard className="w-5 h-5" />
                      <span>Quản trị</span>
                    </Link>
                  )}
                  <button
                    onClick={() => { setIsProfileMenuOpen(false); logout(); }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-[8px] text-sm font-bold text-destructive hover:bg-destructive/10 transition-all mt-1 border-t border-border cursor-pointer"
                  >
                    <LogOut className="w-5 h-5 text-destructive" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <button
              onClick={() => setIsAuthDialogOpen(true)}
              className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-dashed border-primary/50 flex items-center justify-center text-primary/80 hover:text-primary hover:border-primary transition-all active:scale-95"
              title="Đăng nhập"
            >
              <LogIn className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          )}
          <div className="hidden md:block w-8 h-px bg-border" />
          <ThemeToggle />
        </div>
      </nav>

      <AuthDialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen} />
      {user && (
        <ProfileDialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen} />
      )}
    </>
  );
}

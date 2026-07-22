'use client';

import { useState, useEffect, useRef } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  AnimatedUser,
  AnimatedLogIn,
  AnimatedLogOut,
  AnimatedDashboard,
  AnimatedMail,
  AnimatedNewspaper,
  AnimatedHome,
  AnimateIcon,
} from '@/components/animate-ui/icons/AnimateIcon';
import { X, Menu } from 'lucide-react';
import { useAuth } from '@/providers/AuthContext';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ScrollProgressProvider, ScrollProgress } from '@/components/animate-ui/primitives/animate/scroll-progress';

const AuthDialog = dynamic(() => import('@/components/AuthDialog').then(m => ({ default: m.AuthDialog })), { ssr: false });
const ProfileDialog = dynamic(() => import('@/components/ProfileDialog').then(m => ({ default: m.ProfileDialog })), { ssr: false });

export function SiteNav() {
  const { user, logout, isAdmin } = useAuth();
  const pathname = usePathname();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  
  const profileButtonRef = useRef<HTMLButtonElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const isPostReaderPage = pathname.startsWith('/posts/');
  const showProfileMenu = Boolean(user && isProfileMenuOpen);

  // Handle clicking outside the profile dropdown
  useEffect(() => {
    if (!showProfileMenu) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (profileButtonRef.current?.contains(target) || profileMenuRef.current?.contains(target)) return;
      setIsProfileMenuOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [showProfileMenu]);

  // Prevent background scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    return () => document.body.classList.remove('overflow-hidden');
  }, [isMobileMenuOpen]);

  // Close mobile menu on path changes
  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsMobileMenuOpen(false));
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  if (isPostReaderPage) return null;

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 w-full h-14 bg-card/80 backdrop-blur-md border-b border-border shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-4 sm:px-6 lg:px-8">
          
          {/* Logo / Brand */}
          <Link href="/" className="flex items-center gap-2 text-primary hover:opacity-90 transition-opacity">
            <span className="font-extrabold text-sm sm:text-base tracking-tight text-foreground">
              LuBu
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6">
            <Link 
              href="/" 
              className={`text-xs font-bold tracking-wide uppercase transition-colors hover:text-primary ${pathname === '/' ? 'text-primary' : 'text-muted-foreground'}`}
            >
              Trang chủ
            </Link>
            {isAdmin && (
              <Link 
                href="/products" 
                className={`text-xs font-bold tracking-wide uppercase transition-colors hover:text-primary ${pathname === '/products' ? 'text-primary' : 'text-muted-foreground'}`}
              >
                Quản lý danh sách
              </Link>
            )}
            <Link 
              href="/contact" 
              className={`text-xs font-bold tracking-wide uppercase transition-colors hover:text-primary ${pathname === '/contact' ? 'text-primary' : 'text-muted-foreground'}`}
            >
              Liên hệ
            </Link>
          </nav>

          {/* Action Area (Auth, Theme, Mobile Toggle) */}
          <div className="flex items-center gap-2 sm:gap-4">
            
            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Profile / Auth Controls */}
            {user ? (
              <div className="relative">
                <button
                  ref={profileButtonRef}
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  aria-expanded={showProfileMenu}
                  aria-haspopup="menu"
                  className="w-8 h-8 rounded-full overflow-hidden border border-border hover:border-primary transition-all flex items-center justify-center cursor-pointer bg-secondary"
                >
                  {user.avatar ? (
                    <Image src={user.avatar} alt={user.name} width={32} height={32} className="w-full h-full object-cover" unoptimized />
                  ) : (
                    <AnimatedUser className="w-4 h-4 text-primary" />
                  )}
                </button>

                {/* Profile Dropdown Menu */}
                {showProfileMenu && (
                  <div
                    ref={profileMenuRef}
                    className="absolute right-0 mt-2 bg-background border border-border rounded-[8px] shadow-2xl p-2 min-w-[240px] z-50 animate-popup-preview"
                  >
                    <div className="px-3 py-2 border-b border-border mb-2">
                      <p className="text-xs font-black text-foreground truncate tracking-tight">{user.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate font-medium">{user.email}</p>
                    </div>
                    <button
                      onClick={() => { setIsProfileMenuOpen(false); setIsProfileDialogOpen(true); }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-[8px] text-xs font-bold text-foreground hover:bg-muted transition-all mb-1 cursor-pointer bg-transparent border-0 outline-none text-left"
                    >
                      <AnimatedUser className="w-4 h-4" />
                      <span>Hồ sơ cá nhân</span>
                    </button>
                    {isAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setIsProfileMenuOpen(false)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-[8px] text-xs font-bold text-foreground hover:bg-muted transition-all mb-1"
                      >
                        <AnimatedDashboard className="w-4 h-4" />
                        <span>Quản trị</span>
                      </Link>
                    )}
                    <button
                      onClick={() => { setIsProfileMenuOpen(false); logout(); }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-[8px] text-xs font-bold text-destructive hover:bg-destructive/10 transition-all mt-1 border-t border-border cursor-pointer bg-transparent outline-none text-left"
                    >
                      <AnimatedLogOut className="w-4 h-4 text-destructive" />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setIsAuthDialogOpen(true)}
                className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-dashed border-primary/50 text-primary hover:text-primary-foreground hover:bg-primary hover:border-primary transition-all active:scale-95 cursor-pointer bg-transparent hover:animate-pulse animate-infinite"
                title="Đăng nhập"
              >
                <AnimatedLogIn className="w-4 h-4" />
              </button>
            )}

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="w-8 h-8 flex md:hidden items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer bg-transparent"
              aria-label="Toggle Navigation Menu"
            >
              {isMobileMenuOpen ? <AnimateIcon icon={X} animation="rotate" className="w-4 h-4" /> : <AnimateIcon icon={Menu} animation="rotate" className="w-4 h-4" />}
            </button>

          </div>
        </div>
        <ScrollProgressProvider global>
          <ScrollProgress mode="scaleX" className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-primary z-50 origin-left" />
        </ScrollProgressProvider>
      </header>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 top-14 z-40 md:hidden bg-background/95 backdrop-blur-md animate-fade-in flex flex-col p-6">
          <nav className="flex flex-col gap-4 mt-6">
            <Link 
              href="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-[8px] text-sm font-bold border ${pathname === '/' ? 'border-primary bg-secondary/30 text-primary' : 'border-border bg-card text-foreground'}`}
            >
              <AnimatedHome className="w-4 h-4" />
              <span>Trang chủ</span>
            </Link>
            
            {isAdmin && (
              <Link 
                href="/products"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-[8px] text-sm font-bold border ${pathname === '/products' ? 'border-primary bg-secondary/30 text-primary' : 'border-border bg-card text-foreground'}`}
              >
                <AnimatedNewspaper className="w-4 h-4" />
                <span>Quản lý danh sách</span>
              </Link>
            )}
            
            <Link 
              href="/contact"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-[8px] text-sm font-bold border ${pathname === '/contact' ? 'border-primary bg-secondary/30 text-primary' : 'border-border bg-card text-foreground'}`}
            >
              <AnimatedMail className="w-4 h-4" />
              <span>Liên hệ</span>
            </Link>
          </nav>
        </div>
      )}

      <AuthDialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen} />
      {user && (
        <ProfileDialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen} />
      )}
    </>
  );
}

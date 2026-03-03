'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Plus, BookOpen, Mail, Github, Facebook, ArrowDown, Home as HomeIcon, LogOut, User as UserIcon, LogIn, Lock, LayoutDashboard, FileText } from 'lucide-react';
import { PostCard } from '@/components/PostCard';
import dynamic from 'next/dynamic';
import { useAuth } from '@/providers/AuthContext';
import Link from 'next/link';
import Image from 'next/image';

const CreatePostForm = dynamic(() => import('@/components/CreatePostForm').then(m => ({ default: m.CreatePostForm })), { ssr: false });
const AuthDialog = dynamic(() => import('@/components/AuthDialog').then(m => ({ default: m.AuthDialog })), { ssr: false });
const ProfileDialog = dynamic(() => import('@/components/ProfileDialog').then(m => ({ default: m.ProfileDialog })), { ssr: false });

interface Post {
  _id: string;
  title: string;
  description?: string;
  tags?: string[];
  content: string;
  images: string[];
  author: string;
  createdAt: string;
  updatedAt: string;
}

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { user, logout, isLoading: isAuthLoading, isAdmin } = useAuth();
  const [contactSent, setContactSent] = useState(false);
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const half = window.innerHeight / 2;
      const postsEl = document.getElementById('posts');
      const contactEl = document.getElementById('contact');

      if (contactEl && scrollY >= (contactEl as HTMLElement).offsetTop - half) {
        setActiveSection('contact');
      } else if (postsEl && scrollY >= (postsEl as HTMLElement).offsetTop - half) {
        setActiveSection('posts');
      } else {
        setActiveSection('home');
      }
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [posts, user, isLoading, isAuthLoading]);

  const [standaloneTags, setStandaloneTags] = useState<{ _id: string, name: string }[]>([]);

  const fetchTags = async () => {
    try {
      const response = await fetch('/api/tags');
      if (response.ok) {
        setStandaloneTags(await response.json());
      }
    } catch (error) {
      console.error('Lỗi khi tải tags:', error);
    }
  };

  const fetchPosts = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/posts');
      if (response.ok) {
        const data = await response.json();
        setPosts(data);
      }
    } catch (error) {
      console.error('Lỗi khi tải bài viết:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
    fetchTags();
  }, []);

  const availableTags = useMemo(() => {
    const postTags = posts.flatMap((post) => post.tags || []);
    const standaloneNames = standaloneTags.map(t => t.name);
    return Array.from(new Set([...postTags, ...standaloneNames])).filter(Boolean);
  }, [posts, standaloneTags]);

  const handlePostDeleted = useCallback((postId: string) => {
    setPosts((prev) => prev.filter((post) => post._id !== postId));
  }, []);

  const [isSending, setIsSending] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  const handleContactSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSending(true);
    setContactError(null);
    setContactSent(false);

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string || user?.name || '';
    const email = formData.get('email') as string || user?.email || '';
    const message = formData.get('message') as string;

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });

      if (response.ok) {
        setContactSent(true);
        (e.target as HTMLFormElement).reset();
        setTimeout(() => setContactSent(false), 5000);
      } else {
        const errorData = await response.json();
        setContactError(errorData.error || 'Có lỗi xảy ra, vui lòng thử lại.');
      }
    } catch (error) {
      console.error('Lỗi khi gửi liên hệ:', error);
      setContactError('Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setIsSending(false);
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-white dark:bg-[#0e0505] transition-colors relative selection:bg-red-200 selection:text-red-900 dark:selection:bg-red-900/50 dark:selection:text-red-100">
      {/* Subtle grid pattern background */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(theme(colors.red.200)_1px,transparent_1px)] dark:bg-[radial-gradient(theme(colors.red.900)_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.25] dark:opacity-[0.07] z-0 mix-blend-multiply dark:mix-blend-screen" />

      {/* ── SIDEBAR / BOTTOM NAVBAR ── */}
      <nav className="fixed md:top-0 md:left-0 bottom-0 left-0 right-0 z-50 md:w-24 w-full flex md:flex-col flex-row items-center justify-around md:justify-start md:py-8 py-3 md:gap-8 px-4 md:px-0 bg-white/90 md:bg-transparent dark:bg-[#1a0808]/90 md:dark:bg-transparent backdrop-blur-md border-t border-red-100 dark:border-red-900/30 md:border-t-0 transition-all duration-300 shadow-[0_-4px_20px_-10px_rgba(220,38,38,0.15)] md:shadow-none">
        {/* Logo (Desktop only) */}
        <div className="hidden md:flex flex-col items-center gap-2">
          <div className="w-12 h-12 gradient-red rounded-none flex items-center justify-center text-white shadow-lg shadow-red-500/30">
            <BookOpen className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold text-red-600 dark:text-red-400 tracking-[0.2em] uppercase">Sutie</span>
        </div>

        <div className="hidden md:block w-10 h-px bg-red-100 dark:bg-white/20" />

        {/* Nav links */}
        <div className="flex md:flex-col flex-row items-center justify-center gap-6 md:gap-8 flex-1 md:flex-none">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            title="Trang chủ"
            className="relative flex flex-col items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-red-400 dark:text-red-300 hover:text-red-600 dark:hover:text-red-100 transition-all hover:scale-110 active:scale-95 cursor-pointer">
            <HomeIcon className="w-6 h-6 md:w-6 md:h-6" />
            <span className="hidden md:block">Trang chủ</span>
            <span className={`absolute right-0 translate-x-full top-1/2 -translate-y-1/2 h-px w-8 bg-gradient-to-r from-transparent via-red-400/35 dark:via-red-400/25 to-transparent transition-all duration-500 ease-out origin-left hidden md:block ${activeSection === 'home' ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'}`} />
            <span className={`absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-px rounded-full bg-red-500/60 md:hidden transition-all duration-300 ${activeSection === 'home' ? 'opacity-100 w-4' : 'opacity-0 w-0'}`} />
          </button>
          <a href="#posts"
            title="Bài viết"
            className="relative flex flex-col items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-red-400 dark:text-red-300 hover:text-red-600 dark:hover:text-red-100 transition-all hover:scale-110 active:scale-95 group">
            <FileText className="w-6 h-6 md:w-6 md:h-6" />
            <span className="hidden md:block">Bài viết</span>
            <span className={`absolute right-0 translate-x-full top-1/2 -translate-y-1/2 h-px w-8 bg-gradient-to-r from-transparent via-red-400/35 dark:via-red-400/25 to-transparent transition-all duration-500 ease-out origin-left hidden md:block ${activeSection === 'posts' ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'}`} />
            <span className={`absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-px rounded-full bg-red-500/60 md:hidden transition-all duration-300 ${activeSection === 'posts' ? 'opacity-100 w-4' : 'opacity-0 w-0'}`} />
          </a>
          <a href="#contact"
            title="Liên hệ"
            className="relative flex flex-col items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-red-400 dark:text-red-300 hover:text-red-600 dark:hover:text-red-100 transition-all hover:scale-110 active:scale-95">
            <Mail className="w-6 h-6 md:w-6 md:h-6" />
            <span className="hidden md:block">Liên hệ</span>
            <span className={`absolute right-0 translate-x-full top-1/2 -translate-y-1/2 h-px w-8 bg-gradient-to-r from-transparent via-red-400/35 dark:via-red-400/25 to-transparent transition-all duration-500 ease-out origin-left hidden md:block ${activeSection === 'contact' ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'}`} />
            <span className={`absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-px rounded-full bg-red-500/60 md:hidden transition-all duration-300 ${activeSection === 'contact' ? 'opacity-100 w-4' : 'opacity-0 w-0'}`} />
          </a>
          {isAdmin && (
            <Link href="/admin"
              title="Dashboard"
              className="flex flex-col items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-red-600 dark:text-red-400 hover:opacity-70 transition-all hover:scale-110 active:scale-95">
              <LayoutDashboard className="w-6 h-6 md:w-6 md:h-6" />
              <span className="hidden md:block">Quản trị</span>
            </Link>
          )}
        </div>

        {/* Bottom actions */}
        <div className="flex flex-row md:flex-col items-center gap-4 md:gap-6 mt-0 md:mt-auto">
          {user ? (
            <>
              <div className="group relative">
                <button
                  className="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden border-2 border-red-100 dark:border-white/25 hover:border-red-500 dark:hover:border-red-300 transition-all shadow-md shadow-red-500/10"
                >
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                      <UserIcon className="w-6 h-6 text-red-400" />
                    </div>
                  )}
                </button>

                {/* Profile dropdown */}
                <div className="absolute left-1/2 md:left-full -translate-x-1/2 md:translate-x-0 md:ml-4 bottom-[calc(100%+8px)] md:bottom-0 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 bg-white dark:bg-[#1a0808] border border-red-100 dark:border-red-900/30 rounded-none shadow-2xl shadow-red-500/10 p-4 min-w-[240px] z-50 transform translate-y-[10px] md:translate-y-0 md:translate-x-[-10px] group-hover:translate-y-0 md:group-hover:translate-x-0">
                  <div className="px-3 py-2 border-b border-red-50 dark:border-red-900/20 mb-2">
                    <p className="text-sm font-black text-neutral-900 dark:text-neutral-100 truncate tracking-tight">{user.name}</p>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate font-medium">{user.email}</p>
                  </div>
                  <button
                    onClick={() => setIsProfileDialogOpen(true)}
                    className="w-full flex items-center gap-3 px-3 py-3 text-sm font-bold text-neutral-800 dark:text-neutral-200 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all border-b border-red-50 dark:border-red-900/20"
                  >
                    <UserIcon className="w-5 h-5" />
                    <span>Hồ sơ cá nhân</span>
                  </button>
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-3 py-3 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <button
              onClick={() => setIsAuthDialogOpen(true)}
              className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-dashed border-red-200 dark:border-white/30 flex items-center justify-center text-red-400 dark:text-red-300 hover:text-red-600 dark:hover:text-red-100 hover:border-red-500 dark:hover:border-red-300 transition-all active:scale-95"
              title="Đăng nhập"
            >
              <LogIn className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          )}

          <div className="hidden md:block w-8 h-px bg-red-100 dark:bg-white/20" />
          <ThemeToggle />
        </div>
      </nav>

      {/* ── HERO SECTION ── */}
      <section data-section="home" className="relative min-h-screen flex items-center justify-center px-6 md:px-12 md:pl-24 pt-16 pb-24 md:pt-0 md:pb-0 overflow-hidden snap-start">
        {/* Background gradient blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-200/40 dark:bg-red-900/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] opacity-60 animate-blob" />
          <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-rose-200/40 dark:bg-rose-900/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] opacity-60 animate-blob animation-delay-2000" />
          <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-red-300/30 dark:bg-red-950/30 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[80px] opacity-40 animate-blob animation-delay-4000" />
        </div>

        <div className="relative z-10 max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 md:gap-12 items-center text-center lg:text-left mt-8 md:mt-0">
          {/* ── LEFT SIDE: TEXT CONTENT ── */}
          <div className="flex flex-col items-center lg:items-start order-2 lg:order-1">
            <div className="hidden lg:inline-flex hero-animate items-center gap-2 bg-red-50 dark:bg-white/5 text-red-600 dark:text-red-200 text-[10px] md:text-xs font-medium px-3 py-1.5 rounded-none mb-6 md:mb-8 border border-red-200 dark:border-white/20 w-fit">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-none animate-pulse" />
              Góc dịch thuật của Sutie
            </div>

            <h1 className="hero-animate hero-delay-1 text-4xl sm:text-5xl md:text-6xl font-bold text-neutral-900 dark:text-neutral-50 mb-4 md:mb-6 leading-tight tracking-tight">
              Kho lưu trữ<br className="block sm:hidden" />{' '}
              <span className="text-gradient-red">
                của Sutie
              </span>
            </h1>

            <p className="hero-animate hero-delay-2 text-base md:text-lg lg:text-xl text-neutral-600 dark:text-neutral-300 mb-8 md:mb-12 font-medium leading-relaxed max-w-lg">
              Nơi mình chia sẻ niềm đam mê ngôn ngữ qua từng trang sách và những câu chuyện được chuyển ngữ với tất cả tâm huyết.
            </p>

            <div className="hero-animate hero-delay-3 flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              {user ? (
                isAdmin && (
                  <Button
                    onClick={() => setIsCreateDialogOpen(true)}
                    size="lg"
                    className="rounded-[8px] px-6 md:px-8 py-3 text-sm md:text-base font-semibold gradient-red text-white hover:opacity-90 border-0 shadow-xl shadow-red-500/30 w-full sm:w-fit"
                  >
                    <Plus className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                    Tạo bài viết
                  </Button>
                )
              ) : (
                <Button
                  onClick={() => setIsAuthDialogOpen(true)}
                  size="lg"
                  className="rounded-[8px] px-6 md:px-8 py-3 text-sm md:text-base font-semibold gradient-red text-white hover:opacity-90 border-0 shadow-xl shadow-red-500/30 w-full sm:w-fit"
                >
                  <LogIn className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                  Bắt đầu ngay
                </Button>
              )}
              <Button
                variant="outline"
                size="lg"
                className="rounded-[8px] px-6 md:px-8 py-3 text-sm md:text-base w-full sm:w-fit border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-400"
                onClick={() => document.getElementById('posts')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Khám phá
                <ArrowDown className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>

          {/* ── RIGHT SIDE: DRAGON IMAGE ── */}
          <div className="hero-animate hero-delay-2 flex flex-col items-center justify-center relative h-full min-h-[280px] md:min-h-96 w-full order-1 lg:order-2 gap-12 lg:gap-0">
            <div className="lg:hidden hero-animate inline-flex items-center gap-2 bg-red-50 dark:bg-white/5 text-red-600 dark:text-red-200 text-[10px] md:text-xs font-medium px-3 py-1.5 rounded-none border border-red-200 dark:border-white/20 w-fit">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-none animate-pulse" />
              Góc dịch thuật của Sutie
            </div>
            <div className="group relative w-[280px] sm:w-[350px] md:w-full max-w-[500px] aspect-square rounded-[8px] overflow-hidden cursor-pointer animate-float">
              <Image
                src="/dragon.png"
                alt="Sutie's Dragon Avatar"
                fill
                priority
                className="object-cover drop-shadow-2xl"
              />
              {/* Tooltip */}
              <div className="absolute inset-0 flex items-end justify-center pb-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                <div className="bg-black/75 backdrop-blur-sm text-white text-sm font-medium px-4 py-2 rounded-none max-w-[90%] text-center shadow-xl">
                  Hình ảnh là sản phẩm của AI và không có tác giả
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="hidden lg:flex absolute bottom-8 left-1/2 -translate-x-1/2 flex-col items-center gap-2 text-red-400">
          <span className="text-xs">Cuộn xuống</span>
          <div className="w-px h-8 bg-gradient-to-b from-red-400 to-transparent" />
        </div>
      </section>

      {/* ── POSTS SECTION ── */}
      <section id="posts" data-section="posts" className="min-h-screen flex items-start pt-24 pb-20 md:pt-40 md:pb-32 px-6 md:px-12 md:pl-24 bg-red-50/50 dark:bg-red-950/10 snap-start">
        <div className="max-w-7xl mx-auto w-full text-center sm:text-left">
          {/* Section header */}
          <div className="reveal flex flex-col sm:flex-row items-center sm:items-end justify-between mb-10 md:mb-12 gap-4 sm:gap-0">
            <div>
              <p className="text-xs md:text-sm font-medium text-red-500 dark:text-red-400 mb-2 uppercase tracking-widest">Khám phá</p>
              <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-neutral-50">Bài viết mới nhất</h2>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
              {isAdmin && (
                <Button
                  onClick={() => setIsCreateDialogOpen(true)}
                  size="sm"
                  className="rounded-md flex items-center gap-1.5 gradient-red text-white hover:opacity-90 border-0 shadow-sm w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4" />
                  Tạo bài viết
                </Button>
              )}
              <Link href="/products" passHref className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-md flex w-full justify-center sm:w-auto items-center gap-1.5 border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 hover:bg-red-600 dark:hover:bg-red-500 hover:text-white hover:border-transparent transition-colors cursor-pointer"
                >
                  Xem Tất Cả
                </Button>
              </Link>
            </div>
          </div>

          {/* Conditionally render content */}
          {isLoading || isAuthLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-red-50 dark:bg-red-900/20 rounded-none h-72 animate-pulse" />
              ))}
            </div>
          ) : !user ? (
            <div className="reveal hero-delay-2 flex flex-col items-center justify-center py-20 px-6 bg-white/50 dark:bg-red-950/10 backdrop-blur-sm border border-dashed border-red-200 dark:border-red-900/30 rounded-none text-center shadow-sm relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-red-50/50 to-transparent dark:from-red-900/5 pointer-events-none" />
              <div className="relative z-10 w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-none flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                <Lock className="w-8 h-8 text-red-400 group-hover:text-red-500 transition-colors" />
              </div>
              <h3 className="relative z-10 text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">Nội dung đã bị khóa</h3>
              <p className="relative z-10 text-neutral-600 dark:text-neutral-400 max-w-sm mb-8 leading-relaxed">
                Bạn cần đăng nhập hoặc tạo tài khoản mới để có thể xem được danh sách các bài viết và câu chuyện.
              </p>
              <Button
                onClick={() => setIsAuthDialogOpen(true)}
                className="relative z-10 rounded-none px-8 py-5 gradient-red text-white hover:opacity-90 border-0 shadow-xl shadow-red-500/20 text-base font-semibold"
              >
                Đăng nhập ngay
              </Button>
            </div>
          ) : posts.length === 0 ? (
            <div className="reveal hero-delay-2 text-center py-24">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-none flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-7 h-7 text-red-400" />
              </div>
              <p className="text-neutral-500 dark:text-neutral-400 text-lg">Chưa có bài viết nào</p>
            </div>
          ) : (
            <div className="reveal hero-delay-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {[...posts]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 6)
                .map((post) => (
                  <PostCard
                    key={post._id}
                    post={post}
                    onDelete={handlePostDeleted}
                    onUpdate={fetchPosts}
                  />
                ))}
            </div>
          )}
        </div>
      </section>

      {/* ── CONTACT SECTION ── */}
      <section id="contact" data-section="contact" className="min-h-screen flex items-center py-20 pb-32 md:py-32 px-6 md:px-12 md:pl-24 snap-start">
        <div className="max-w-5xl mx-auto w-full">
          <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-start">
            {/* Left: info */}
            <div className="reveal text-center md:text-left">
              <p className="text-xs md:text-sm font-medium text-red-500 dark:text-red-400 mb-2 uppercase tracking-widest">Liên hệ</p>
              <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-neutral-50 mb-4 md:mb-6">Kết nối với tôi</h2>
              <p className="text-sm md:text-base text-neutral-600 dark:text-neutral-300 leading-relaxed mb-8 md:mb-10 max-w-sm mx-auto md:mx-0">
                Có ý tưởng, câu hỏi, hoặc đơn giản chỉ muốn nói chuyện? Tôi rất vui khi được lắng nghe.
              </p>
              <div className="space-y-4 inline-flex flex-col items-start w-full sm:w-auto text-left">
                <a href="mailto:sutiexuxi.supp.0410@gmail.com"
                  className="flex items-center gap-3 text-neutral-700 dark:text-neutral-300 hover:text-red-600 dark:hover:text-red-300 transition-colors group">
                  <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-none flex items-center justify-center group-hover:bg-red-100 dark:group-hover:bg-red-900/40 transition-colors">
                    <Mail className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">sutiexuxi.supp.0410@gmail.com</span>
                </a>
                <a href="https://github.com/DinhManh203" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 text-neutral-700 dark:text-neutral-300 hover:text-red-600 dark:hover:text-red-300 transition-colors group">
                  <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-none flex items-center justify-center group-hover:bg-red-100 dark:group-hover:bg-red-900/40 transition-colors">
                    <Github className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">https://github.com/DinhManh203</span>
                </a>
                <a href="https://www.facebook.com/profile.php?id=61585590627494" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 text-neutral-700 dark:text-neutral-300 hover:text-red-600 dark:hover:text-red-300 transition-colors group">
                  <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-none flex items-center justify-center group-hover:bg-red-100 dark:group-hover:bg-red-900/40 transition-colors">
                    <Facebook className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">Facebook</span>
                </a>
              </div>
            </div>

            {/* Right: form */}
            <div className="reveal reveal-delay-2 bg-red-50/60 dark:bg-red-900/10 rounded-[8px] p-6 md:p-8 border border-red-100 dark:border-red-900/30">
              {contactSent ? (
                <div className="text-center py-8">
                  <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-none flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="font-semibold text-neutral-900 dark:text-neutral-100 mb-1">Đã gửi!</p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Cảm ơn bạn, tôi sẽ phản hồi sớm nhất có thể.</p>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-1.5">Tên</label>
                    {user ? (
                      <input
                        key="user-name"
                        type="text"
                        name="name"
                        value={user.name || ''}
                        readOnly
                        className="w-full px-4 py-3 rounded-[8px] border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10 text-neutral-500 dark:text-neutral-400 text-sm cursor-not-allowed transition-all"
                      />
                    ) : (
                      <input
                        key="guest-name"
                        required
                        type="text"
                        name="name"
                        defaultValue=""
                        placeholder="Tên của bạn"
                        className="w-full px-4 py-3 rounded-[8px] border border-red-200 dark:border-red-800/40 bg-white/60 dark:bg-red-950/20 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-sm focus:outline-none transition-all backdrop-blur-sm shadow-sm"
                      />
                    )}
                  </div>
                  <div className="reveal-delay-1">
                    <label className="block text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-1.5">Email</label>
                    {user ? (
                      <input
                        key="user-email"
                        type="email"
                        name="email"
                        value={user.email || ''}
                        readOnly
                        className="w-full px-4 py-3 rounded-[8px] border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10 text-neutral-500 dark:text-neutral-400 text-sm cursor-not-allowed transition-all"
                      />
                    ) : (
                      <input
                        key="guest-email"
                        required
                        type="email"
                        name="email"
                        defaultValue=""
                        placeholder="email@example.com"
                        className="w-full px-4 py-3 rounded-[8px] border border-red-200 dark:border-red-800/40 bg-white/60 dark:bg-red-950/20 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-sm focus:outline-none transition-all backdrop-blur-sm shadow-sm"
                      />
                    )}
                  </div>
                  <div className="reveal-delay-2">
                    <label className="block text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-1.5">Tin nhắn</label>
                    <textarea
                      required
                      name="message"
                      rows={4}
                      placeholder="Nội dung tin nhắn..."
                      className="w-full px-4 py-3 rounded-[8px] border border-red-200 dark:border-red-800/40 bg-white/60 dark:bg-red-950/20 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-sm focus:outline-none transition-all backdrop-blur-sm shadow-sm resize-none"
                    />
                  </div>

                  {contactError && (
                    <p className="text-red-500 text-sm font-medium">{contactError}</p>
                  )}

                  <Button type="submit" disabled={isSending} className="w-full rounded-[8px] gradient-red text-white hover:opacity-90 border-0 shadow-lg shadow-red-500/20 disabled:opacity-50">
                    {isSending ? 'Đang gửi...' : 'Gửi tin nhắn'}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-red-100 dark:border-red-900/30 py-10 pb-24 md:pb-12 px-6 md:px-12 md:pl-24 snap-start bg-gradient-to-r from-white via-red-50/30 to-white dark:from-[#0e0505] dark:via-red-950/20 dark:to-[#0e0505]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="flex items-center gap-2 text-red-500 dark:text-red-400">
            <BookOpen className="w-4 h-4" />
            <span className="text-sm font-medium">Sutie Archive</span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">© {new Date().getFullYear()} Sutie Archive. Mọi quyền được bảo lưu.</p>
          <div className="flex gap-5 text-xs text-neutral-500 dark:text-neutral-400">
            <a href="#posts" className="hover:text-red-600 dark:hover:text-red-300 transition-colors">Bài viết</a>
            <a href="#contact" className="hover:text-red-600 dark:hover:text-red-300 transition-colors">Liên hệ</a>
          </div>
        </div>
      </footer>

      {/* Dialogs */}
      <AuthDialog
        open={isAuthDialogOpen}
        onOpenChange={setIsAuthDialogOpen}
      />

      <CreatePostForm
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onPostCreated={fetchPosts}
        availableTags={availableTags}
      />

      {user && (
        <ProfileDialog
          open={isProfileDialogOpen}
          onOpenChange={setIsProfileDialogOpen}
        />
      )}
    </div>
  );
}

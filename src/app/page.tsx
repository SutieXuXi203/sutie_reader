'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Plus, BookOpen, Mail, Github, Facebook, ArrowDown, Home as HomeIcon, LogOut, User as UserIcon, LogIn, Lock, LayoutDashboard, BookmarkCheck, ChevronRight, X, Newspaper } from 'lucide-react';
import { PostCard } from '@/components/PostCard';
import dynamic from 'next/dynamic';
import { useAuth } from '@/providers/AuthContext';
import Link from 'next/link';
import Image from 'next/image';
import { getOptimizedImageUrl } from '@/lib/utils';
import { notify } from '@/lib/notify';
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
  chapters?: Array<{
    title: string;
    chapterNumber: number;
    content: string;
    images: string[];
  }>;
  chapterCount?: number;
  author: string;
  createdAt: string;
  updatedAt: string;
}
interface BookmarkItem {
  _id: string;
  postId: string;
  chapterIndex?: number;
  currentPage: number;
  totalPages: number;
  updatedAt: string;
  post: {
    _id: string;
    title: string;
    images: string[];
    author: string;
    tags?: string[];
  };
}
const SECTION_IDS = ['home', 'posts', 'contact'] as const;

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const { user, logout, isLoading: isAuthLoading, isAdmin } = useAuth();
  const [activeSection, setActiveSection] = useState('home');
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  useEffect(() => {
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

        if (activeId) {
          setActiveSection(activeId);
        }
      },
      {
        root: null,
        rootMargin: '-20% 0px -40% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1]
      }
    );

    SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id) || document.querySelector(`[data-section="${id}"]`);
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, []);
  useEffect(() => {
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
    const observeAll = () => {
      document.querySelectorAll('.reveal:not(.reveal-visible)').forEach((el) => observer.observe(el));
    };
    observeAll();
    return () => {
      observer.disconnect();
    };
  }, [posts.length, bookmarks.length, user]);
  const [standaloneTags, setStandaloneTags] = useState<{ _id: string, name: string }[]>([]);
  const fetchTags = useCallback(async () => {
    try {
      const response = await fetch('/api/tags');
      if (response.ok) {
        setStandaloneTags(await response.json());
      }
    } catch (error) {
      console.error('Lỗi khi tải tags:', error);
    }
  }, []);
  const fetchPosts = useCallback(async () => {
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
  }, []);
  const fetchBookmarks = useCallback(async () => {
    try {
      const res = await fetch('/api/bookmarks');
      if (res.ok) {
        const data = await res.json();
        setBookmarks(data);
      }
    } catch (error) {
      console.error('Lỗi khi tải bookmarks:', error);
    }
  }, []);
  const removeBookmark = useCallback(async (postId: string) => {
    try {
      await fetch(`/api/bookmarks/${postId}`, { method: 'DELETE' });
      setBookmarks((prev) => prev.filter((b) => b.postId !== postId));
    } catch (error) {
      console.error('Lỗi khi xóa bookmark:', error);
    }
  }, []);
  useEffect(() => {
    fetchPosts();
    fetchTags();
  }, [fetchPosts, fetchTags]);
  useEffect(() => {
    if (user) {
      fetchBookmarks();
    } else {
      setBookmarks([]);
    }
  }, [user, fetchBookmarks]);
  const availableTags = useMemo(() => {
    const postTags = posts.flatMap((post) => post.tags || []);
    const standaloneNames = standaloneTags.map(t => t.name);
    return Array.from(new Set([...postTags, ...standaloneNames])).filter(Boolean);
  }, [posts, standaloneTags]);
  const sortedRecentPosts = useMemo(() =>
    [...posts]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6),
    [posts]
  );
  const handlePostDeleted = useCallback((postId: string) => {
    setPosts((prev) => prev.filter((post) => post._id !== postId));
  }, []);
  const [isSending, setIsSending] = useState(false);
  const handleContactSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSending(true);
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
        (e.target as HTMLFormElement).reset();
        notify.success('Đã gửi tin nhắn', 'Cảm ơn bạn, tôi sẽ phản hồi sớm nhất có thể.');
      } else {
        const errorData = await response.json();
        notify.error(errorData.error || 'Có lỗi xảy ra, vui lòng thử lại.');
      }
    } catch (error) {
      console.error('Lỗi khi gửi liên hệ:', error);
      notify.error('Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setIsSending(false);
    }
  }, [user]);
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors relative selection:bg-primary/30 selection:text-primary-foreground dark:selection:bg-primary/20">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(theme(colors.primary)_1px,transparent_1px)] opacity-[0.1] z-0 mix-blend-screen" />
      <nav className="fixed md:top-0 md:left-0 bottom-0 left-0 right-0 z-50 md:w-16 md:h-screen w-full flex md:flex-col flex-row items-center justify-around md:justify-start md:py-8 py-3 px-4 md:px-0 bg-card/70 backdrop-blur-xl border-t border-white/20 shadow-[0_-8px_20px_rgba(0,0,0,0.12)] md:bg-transparent md:backdrop-blur-none md:border-0 md:shadow-none transition-all duration-300">
        <div className="hidden md:flex md:flex-col md:items-center md:gap-16 md:absolute md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2">
          {[
            { id: 'home', label: 'Trang chủ' },
            { id: 'posts', label: 'Bài viết' },
            { id: 'contact', label: 'Liên hệ' },
          ].map((section) => (
            <button
              key={section.id}
              onClick={() => {
                if (section.id === 'home') {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                  document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth' });
                }
              }}
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
        </div>
        <div className="flex md:hidden flex-row items-center justify-center gap-6 flex-1">
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
          {isAdmin && (
            <Link href="/admin"
              title="Dashboard"
              className="flex flex-col items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-primary/70 hover:text-primary transition-all hover:scale-110 active:scale-95">
              <LayoutDashboard className="w-6 h-6" />
            </Link>
          )}
        </div>
        <div className="flex flex-row md:flex-col items-center gap-4 md:gap-6 md:mt-auto">
          {user ? (
            <>
              <div className="group relative">
                <button
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
                <div className="absolute left-1/2 md:left-full -translate-x-1/2 md:translate-x-0 md:ml-4 bottom-[calc(100%+8px)] md:bottom-0 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 bg-card border border-border backdrop-blur-md rounded-[8px] shadow-2xl p-2 min-w-[240px] z-50 transform translate-y-[10px] md:translate-y-0 md:translate-x-[-10px] group-hover:translate-y-0 md:group-hover:translate-x-0">
                  <div className="px-3 py-2 border-b border-border mb-2">
                    <p className="text-sm font-black text-foreground truncate tracking-tight">{user.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate font-medium">{user.email}</p>
                  </div>
                  <button
                    onClick={() => setIsProfileDialogOpen(true)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-[8px] text-sm font-bold text-foreground hover:bg-muted transition-all mb-1 cursor-pointer"
                  >
                    <UserIcon className="w-5 h-5" />
                    <span>Hồ sơ cá nhân</span>
                  </button>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-[8px] text-sm font-bold text-foreground hover:bg-muted transition-all mb-1"
                    >
                      <LayoutDashboard className="w-5 h-5" />
                      <span>Quản trị</span>
                    </Link>
                  )}
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-[8px] text-sm font-bold text-destructive hover:bg-destructive/10 transition-all mt-1 border-t border-border"
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
          <div className="hidden md:block w-8 h-px bg-border group-hover:opacity-100" />
          <ThemeToggle />
        </div>
      </nav>
      <section data-section="home" className="relative min-h-screen flex items-center justify-center px-6 md:px-12 md:pl-24 pt-16 pb-24 md:pt-0 md:pb-0 overflow-hidden snap-start">
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full mix-blend-screen filter blur-[100px] opacity-60 animate-blob" />
          <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-foreground/10 rounded-full mix-blend-screen filter blur-[100px] opacity-60 animate-blob animation-delay-2000" />
          <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-primary/30 rounded-full mix-blend-screen filter blur-[80px] opacity-40 animate-blob animation-delay-4000" />
        </div>
        <div className="relative z-10 max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 md:gap-12 items-center text-center lg:text-left mt-8 md:mt-0">
          <div className="flex flex-col items-center lg:items-start order-2 lg:order-1">
            <div className="hidden lg:inline-flex hero-animate items-center gap-2 bg-card/60 backdrop-blur-md text-foreground text-[10px] md:text-xs font-semibold px-4 py-2 rounded-none mb-6 md:mb-8 border border-border w-fit shadow-lg shadow-black/10">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_8px_var(--color-primary)]" />
              Góc dịch thuật của Sutie
            </div>
            <h1 className="hero-animate hero-delay-1 mb-4 md:mb-6 text-[clamp(1.95rem,4.2vw,3.4rem)] font-bold leading-[1.14] tracking-[-0.01em] text-[#8C2F39] dark:text-[#FFF6E7]">
              Kho lưu trữ{' '}
              <span className="text-[#8C2F39] dark:text-[#FFF6E7]">
                của Sutie
              </span>
            </h1>
            <p className="hero-animate hero-delay-2 text-base md:text-lg lg:text-xl text-muted-foreground mb-8 md:mb-12 font-medium leading-relaxed max-w-lg">
              Nơi mình chia sẻ niềm đam mê ngôn ngữ qua từng trang sách và những câu chuyện được chuyển ngữ với tất cả tâm huyết.
            </p>
            <div className="hero-animate hero-delay-3 flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              {user ? (
                isAdmin && (
                  <Button
                    onClick={() => setIsCreateDialogOpen(true)}
                    size="lg"
                    className="rounded-[8px] px-6 md:px-8 py-3 text-sm md:text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground border border-primary/20 transition-all w-full sm:w-fit"
                  >
                    <Plus className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                    Tạo bài viết
                  </Button>
                )
              ) : (
                <Button
                  onClick={() => setIsAuthDialogOpen(true)}
                  size="lg"
                  className="rounded-[8px] px-6 md:px-8 py-3 text-sm md:text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground border border-primary/20 transition-all w-full sm:w-fit"
                >
                  <LogIn className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                  Bắt đầu ngay
                </Button>
              )}
              <Button
                variant="outline"
                size="lg"
                className="rounded-[8px] px-6 md:px-8 py-3 text-sm md:text-base w-full sm:w-fit bg-card/40 backdrop-blur-sm border-border text-foreground hover:bg-card hover:border-primary/50 transition-all font-semibold"
                onClick={() => document.getElementById('posts')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Khám phá
                <ArrowDown className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
          <div className="hero-animate hero-delay-2 flex flex-col items-center justify-center relative h-full min-h-[280px] md:min-h-96 w-full order-1 lg:order-2 gap-12 lg:gap-0">
            <div className="lg:hidden hero-animate inline-flex items-center gap-2 bg-white/8 backdrop-blur-md text-[#FFF6E7] text-xs font-bold px-3.5 py-1.5 rounded-none border border-white/30 shadow-[0_8px_20px_rgba(0,0,0,0.2)] w-fit">
              <span className="w-1.5 h-1.5 bg-[#FFF6E7] rounded-[8px] animate-pulse" />
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
              <div className="absolute inset-0 flex items-end justify-center pb-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                <div className="bg-black/75 backdrop-blur-sm text-white text-sm font-medium px-4 py-2 rounded-[8px] max-w-[90%] text-center shadow-xl">
                  Hình ảnh là sản phẩm của AI và không có tác giả
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="hidden lg:flex absolute bottom-8 left-1/2 -translate-x-1/2 flex-col items-center gap-2 text-primary/75">
          <span className="text-xs">Cuộn xuống</span>
          <div className="w-px h-8 bg-gradient-to-b from-primary/70 to-transparent" />
        </div>
      </section>
      <section id="posts" data-section="posts" className="min-h-screen flex items-start pt-24 pb-20 md:pt-40 md:pb-32 px-6 md:px-12 md:pl-24 bg-secondary/50 snap-start">
        <div className="max-w-7xl mx-auto w-full text-center sm:text-left">
          {user && bookmarks.length > 0 && (
            <div className="reveal mb-12 md:mb-16">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <BookmarkCheck className="w-5 h-5 text-primary" />
                  <h3 className="text-lg md:text-xl font-bold text-foreground">Đang đọc dở</h3>
                </div>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-2 px-2">
                {bookmarks.map((bm) => {
                  const progress = bm.totalPages > 1 ? ((bm.currentPage) / (bm.totalPages - 1)) * 100 : 100;
                  return (
                    <div key={bm._id} className="group relative flex-shrink-0 w-[260px] md:w-[300px] bg-card border border-border rounded-[8px] overflow-hidden hover:border-primary/50 transition-all shadow-sm hover:shadow-lg hover:shadow-primary/10">
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeBookmark(bm.postId); }}
                        className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-black/50 backdrop-blur-sm text-white/70 hover:text-white hover:bg-destructive/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                        title="Xóa đánh dấu"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <Link href={`/posts/${bm.postId}`} className="block">
                        <div className="relative h-36 md:h-40 bg-secondary dark:bg-primary/10 overflow-hidden">
                          {bm.post.images[0] && (
                            <Image
                              src={getOptimizedImageUrl(bm.post.images[0])}
                              alt={bm.post.title}
                              fill
                              className="object-cover object-top group-hover:scale-105 transition-transform duration-500"
                              unoptimized
                            />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                          <div className="absolute bottom-2 left-3 flex items-center gap-1.5 text-white text-xs font-bold">
                            <BookOpen className="w-3 h-3" />
                            Chương {(bm.chapterIndex ?? 0) + 1} · Trang {bm.currentPage + 1}/{bm.totalPages}
                          </div>
                        </div>
                        <div className="p-3 md:p-4">
                          <h4 className="text-sm font-bold text-foreground line-clamp-1 mb-1">{bm.post.title}</h4>
                          <p className="text-[11px] text-muted-foreground mb-3">{bm.post.author}</p>
                          <div className="h-1 bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all duration-300 shadow-[0_0_10px_var(--color-primary)]"
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[10px] text-muted-foreground">{Math.round(progress)}% hoàn thành</span>
                            <span className="text-[10px] text-primary font-medium flex items-center gap-0.5 group-hover:gap-1 transition-all">
                              Đọc tiếp <ChevronRight className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="reveal flex flex-col sm:flex-row items-center sm:items-end justify-between mb-10 md:mb-12 gap-4 sm:gap-0">
            <div>
              <p className="text-xs md:text-sm font-medium text-primary mb-2 uppercase tracking-widest">Khám phá</p>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">Bài viết mới nhất</h2>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
              {isAdmin && (
                <Button
                  onClick={() => setIsCreateDialogOpen(true)}
                  size="sm"
                  className="rounded-[8px] flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 border border-border w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4" />
                  Tạo bài viết
                </Button>
              )}
              <Link href="/products" passHref className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-[8px] flex w-full justify-center sm:w-auto items-center gap-1.5 border-border bg-card text-foreground hover:bg-secondary transition-colors cursor-pointer"
                >
                  Xem Tất Cả
                </Button>
              </Link>
            </div>
          </div>
          {isLoading || isAuthLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-card rounded-[8px] h-72 animate-pulse border border-border" />
              ))}
            </div>
          ) : !user ? (
            <div className="reveal hero-delay-2 flex flex-col items-center justify-center py-20 px-6 bg-card/50 backdrop-blur-md border border-border rounded-[8px] text-center shadow-lg relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
              <div className="relative z-10 w-16 h-16 bg-background rounded-[8px] flex items-center justify-center mb-6 border border-border group-hover:scale-110 transition-transform duration-500 shadow-md">
                <Lock className="w-8 h-8 text-primary group-hover:brightness-110 transition-colors" />
              </div>
              <h3 className="relative z-10 text-xl font-bold text-foreground mb-2">Nội dung đã bị khóa</h3>
              <p className="relative z-10 text-muted-foreground max-w-sm mb-8 leading-relaxed">
                Bạn cần đăng nhập hoặc tạo tài khoản mới để có thể xem được danh sách các bài viết và câu chuyện.
              </p>
              <Button
                onClick={() => setIsAuthDialogOpen(true)}
                className="relative z-10 rounded-[8px] px-8 py-5 bg-primary text-primary-foreground hover:bg-primary/90 text-base font-bold border border-border"
              >
                Đăng nhập ngay
              </Button>
            </div>
          ) : posts.length === 0 ? (
            <div className="reveal hero-delay-2 text-center py-24">
              <div className="w-16 h-16 bg-card rounded-[8px] flex items-center justify-center mx-auto mb-4 border border-border shadow-md">
                <BookOpen className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-lg font-medium">Chưa có bài viết nào</p>
            </div>
          ) : (
            <div className="reveal hero-delay-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {sortedRecentPosts.map((post) => (
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
      <section id="contact" data-section="contact" className="min-h-screen flex items-center py-20 pb-32 md:py-32 px-6 md:px-12 md:pl-24 bg-background snap-start">
        <div className="max-w-5xl mx-auto w-full">
          <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-start">
            <div className="reveal text-center md:text-left">
              <p className="text-xs md:text-sm font-medium text-primary mb-2 uppercase tracking-widest">Liên hệ</p>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 md:mb-6">Kết nối với tôi</h2>
              <p className="text-sm md:text-base text-muted-foreground leading-relaxed mb-8 md:mb-10 max-w-sm mx-auto md:mx-0">
                Có ý tưởng, câu hỏi, hoặc đơn giản chỉ muốn nói chuyện? Tôi rất vui khi được lắng nghe.
              </p>
              <div className="space-y-4 inline-flex flex-col items-start w-full sm:w-auto text-left">
                <a href="mailto:sutiexuxi.supp.0410@gmail.com"
                  className="flex items-center gap-3 text-foreground hover:text-primary transition-colors group">
                  <div className="w-10 h-10 bg-card border border-border rounded-[8px] flex items-center justify-center group-hover:bg-secondary transition-colors">
                    <Mail className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">sutiexuxi.supp.0410@gmail.com</span>
                </a>
                <a href="https://github.com/DinhManh203" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 text-foreground hover:text-primary transition-colors group">
                  <div className="w-10 h-10 bg-card border border-border rounded-[8px] flex items-center justify-center group-hover:bg-secondary transition-colors">
                    <Github className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">https://github.com/DinhManh203</span>
                </a>
                <a href="https://www.facebook.com/profile.php?id=61585590627494" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 text-foreground hover:text-primary transition-colors group">
                  <div className="w-10 h-10 bg-card border border-border rounded-[8px] flex items-center justify-center group-hover:bg-secondary transition-colors">
                    <Facebook className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">Facebook</span>
                </a>
              </div>
            </div>
            <div className="reveal reveal-delay-2 bg-card/60 backdrop-blur-md rounded-[8px] p-6 md:p-8 border border-border shadow-lg">
              <form onSubmit={handleContactSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-foreground mb-1.5">Tên</label>
                  {user ? (
                    <input
                      key="user-name"
                      type="text"
                      name="name"
                      value={user.name || ''}
                      readOnly
                      className="w-full px-4 py-3 rounded-[8px] border border-border bg-secondary text-muted-foreground text-sm cursor-not-allowed transition-all"
                    />
                  ) : (
                    <input
                      key="guest-name"
                      required
                      type="text"
                      name="name"
                      defaultValue=""
                      placeholder="Tên của bạn"
                      className="w-full px-4 py-3 rounded-[8px] border border-border bg-card/50 text-foreground placeholder:text-muted-foreground/70 text-sm focus:outline-none focus:border-primary transition-all backdrop-blur-sm shadow-sm"
                    />
                  )}
                </div>
                <div className="reveal-delay-1">
                  <label className="block text-sm font-bold text-foreground mb-1.5">Email</label>
                  {user ? (
                    <input
                      key="user-email"
                      type="email"
                      name="email"
                      value={user.email || ''}
                      readOnly
                      className="w-full px-4 py-3 rounded-[8px] border border-border bg-secondary text-muted-foreground text-sm cursor-not-allowed transition-all"
                    />
                  ) : (
                    <input
                      key="guest-email"
                      required
                      type="email"
                      name="email"
                      defaultValue=""
                      placeholder="email@example.com"
                      className="w-full px-4 py-3 rounded-[8px] border border-border bg-card/50 text-foreground placeholder:text-muted-foreground/70 text-sm focus:outline-none focus:border-primary transition-all backdrop-blur-sm shadow-sm"
                    />
                  )}
                </div>
                <div className="reveal-delay-2">
                  <label className="block text-sm font-bold text-foreground mb-1.5">Tin nhắn</label>
                  <textarea
                    required
                    name="message"
                    rows={4}
                    placeholder="Nội dung tin nhắn..."
                    className="w-full px-4 py-3 rounded-[8px] border border-border bg-card/50 text-foreground placeholder:text-muted-foreground/70 text-sm focus:outline-none focus:border-primary transition-all backdrop-blur-sm shadow-sm resize-none"
                  />
                </div>
                <Button type="submit" disabled={isSending} className="w-full rounded-[8px] gradient-red text-white hover:opacity-90 border border-border disabled:opacity-50">
                  {isSending ? 'Đang gửi...' : 'Gửi tin nhắn'}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </section>
      <footer className="reveal py-10 pb-24 md:pb-12 px-6 md:px-12 md:pl-24 snap-start bg-secondary/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="flex items-center gap-2 text-primary">
            <BookOpen className="w-4 h-4" />
            <span className="text-sm font-bold text-foreground">Sutie Archive</span>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Sutie Archive. Mọi quyền được bảo lưu.</p>
          <div className="flex gap-5 text-xs text-muted-foreground">
            <a href="#posts" className="hover:text-primary transition-colors">Bài viết</a>
            <a href="#contact" className="hover:text-primary transition-colors">Liên hệ</a>
          </div>
        </div>
      </footer>
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

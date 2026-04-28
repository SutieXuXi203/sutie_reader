'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, BookOpen, Mail, Github, Facebook, ArrowDown, Lock, BookmarkCheck, ChevronRight, X, LogIn, Eye, EyeOff } from 'lucide-react';
import { PostCard } from '@/components/PostCard';
import dynamic from 'next/dynamic';
import { useAuth } from '@/providers/AuthContext';
import Link from 'next/link';
import Image from 'next/image';
import { getOptimizedImageUrl } from '@/lib/utils';
import { notify } from '@/lib/notify';
const CreatePostForm = dynamic(() => import('@/components/CreatePostForm').then(m => ({ default: m.CreatePostForm })), { ssr: false });
const AuthDialog = dynamic(() => import('@/components/AuthDialog').then(m => ({ default: m.AuthDialog })), { ssr: false });

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

const HERO_IMAGE_VISIBILITY_STORAGE_KEY = 'sutie:hero-image-visible';

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const { user, isLoading: isAuthLoading, isAdmin } = useAuth();
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [isHeroImageVisible, setIsHeroImageVisible] = useState(true);
  const [isHeroVisibilityLoaded, setIsHeroVisibilityLoaded] = useState(false);

  useEffect(() => {
    const savedValue = window.localStorage.getItem(HERO_IMAGE_VISIBILITY_STORAGE_KEY);
    if (savedValue === 'true') {
      setIsHeroImageVisible(true);
    } else if (savedValue === 'false') {
      setIsHeroImageVisible(false);
    }
    setIsHeroVisibilityLoaded(true);
  }, []);

  useEffect(() => {
    if (!isHeroVisibilityLoaded) return;
    window.localStorage.setItem(
      HERO_IMAGE_VISIBILITY_STORAGE_KEY,
      String(isHeroImageVisible)
    );
  }, [isHeroImageVisible, isHeroVisibilityLoaded]);

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
  }, [posts.length, bookmarks.length, user, isLoading, isAuthLoading]);
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


      <section data-section="home" className="relative section-fullscreen flex items-center justify-center px-6 md:px-12 md:pl-24 pt-16 pb-24 md:pt-0 md:pb-0 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
          <div className="absolute top-[4%] left-[-18%] md:-top-16 md:left-[4%] w-48 h-48 rounded-full border border-primary/20 bg-primary/10 opacity-42 animate-float-y-soft float-y-fast" />
          <div className="absolute top-[-10%] right-[-30%] md:-top-24 md:right-auto md:left-[2%] w-72 h-72 rounded-full bg-primary/20 blur-[140px] opacity-28 animate-float-y-soft float-y-slow" />

          <div className="absolute top-[34%] right-[-20%] md:top-[14%] md:right-[8%] w-56 h-56 rounded-full border border-foreground/20 bg-foreground/10 opacity-38 animate-float-y-soft animation-delay-2000" />
          <div className="absolute top-[28%] right-[-34%] md:top-[8%] md:right-[4%] w-80 h-80 rounded-full bg-foreground/16 blur-[145px] opacity-26 animate-float-y-soft float-y-slow animation-delay-3000" />

          <div className="absolute bottom-[22%] left-[-10%] md:bottom-[10%] md:left-[20%] w-40 h-40 rounded-full border border-primary/18 bg-primary/10 opacity-35 animate-float-y-soft float-y-fast animation-delay-4000" />
          <div className="absolute bottom-[16%] left-[-24%] md:bottom-[6%] md:left-[14%] w-64 h-64 rounded-full bg-primary/16 blur-[120px] opacity-30 animate-float-y-soft animation-delay-1000" />

          <div className="absolute bottom-[8%] right-[6%] md:bottom-[18%] md:right-[26%] w-44 h-44 rounded-full border border-primary/18 bg-primary/10 opacity-32 animate-float-y-soft animation-delay-3000" />
          <div className="absolute bottom-[0%] right-[-16%] md:bottom-[12%] md:right-[18%] w-60 h-60 rounded-full bg-primary/14 blur-[115px] opacity-25 animate-float-y-soft float-y-slow animation-delay-2000" />
        </div>
        <div className="relative z-10 max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 md:gap-12 items-center text-center lg:text-left mt-8 md:mt-0">
          <div className="flex flex-col items-center lg:items-start order-2 lg:order-1">
            <div className="hidden lg:inline-flex hero-animate items-center gap-2 bg-card/60 backdrop-blur-md text-foreground text-[10px] md:text-xs font-semibold px-4 py-2 rounded-none mb-6 md:mb-8 border border-border w-fit shadow-lg shadow-black/10">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_8px_var(--color-primary)]" />
              Nơi lưu trữ bản dịch của Sutie
            </div>
            <h1 className="hero-animate hero-delay-1 mb-4 md:mb-6 text-[clamp(1.95rem,4.2vw,3.4rem)] font-bold leading-[1.14] tracking-[-0.01em] text-[#8C2F39] dark:text-[#FFF6E7]">
              <span className="text-[#8C2F39] dark:text-[#FFF6E7]">
                Sutie Xù Xì
              </span>
            </h1>
            <p className="hero-animate hero-delay-2 text-base md:text-lg lg:text-xl text-muted-foreground mb-8 md:mb-12 font-medium leading-relaxed max-w-lg">
              Nơi mình dịch những truyện hay để bạn đọc và cùng chạm vào vẻ đẹp của ngôn ngữ.
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
            <div className="lg:hidden hero-animate inline-flex items-center gap-2 bg-card/75 backdrop-blur-md text-foreground text-xs font-bold px-3.5 py-1.5 rounded-none border border-border shadow-[0_8px_20px_rgba(0,0,0,0.12)] w-fit">
              <span className="w-1.5 h-1.5 bg-primary rounded-[8px] animate-pulse" />
              Nơi lưu trữ bản dịch của Sutie
            </div>
            <div className="relative w-[280px] sm:w-[350px] md:w-full max-w-[500px]">
              <div className="mb-3 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIsHeroImageVisible((prev) => !prev)}
                  className="rounded-[8px] bg-card/70 backdrop-blur-sm"
                  aria-label={isHeroImageVisible ? 'Ẩn hình ảnh hero' : 'Hiện hình ảnh hero'}
                >
                  {isHeroImageVisible ? (
                    <>
                      <EyeOff className="w-4 h-4 mr-1.5" />
                      Tắt ảnh
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-1.5" />
                      Bật ảnh
                    </>
                  )}
                </Button>
              </div>
              <div className="pointer-events-none absolute -inset-10 -z-10" aria-hidden="true">
                <div className="absolute top-[-6%] right-[-8%] w-28 h-28 rounded-full bg-primary/22 blur-[34px] opacity-55" />
                <div className="absolute bottom-[8%] left-[-12%] w-36 h-36 rounded-full bg-foreground/20 blur-[46px] opacity-45" />
                <div className="absolute top-[44%] left-[70%] w-24 h-24 rounded-full border border-primary/25 bg-primary/12 blur-[3px] opacity-50" />
              </div>
              {isHeroImageVisible ? (
                <div className="group relative aspect-square rounded-[8px] overflow-hidden cursor-pointer">
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
              ) : (
                <div className="relative aspect-square rounded-[8px] border border-dashed border-border bg-card/40 flex items-center justify-center px-6">
                  <p className="text-sm text-muted-foreground text-center">
                    Ảnh đang được tắt. Bấm nút Bật ảnh để hiển thị lại.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="hidden lg:flex absolute bottom-8 left-1/2 -translate-x-1/2 flex-col items-center gap-2 text-primary/75">
          <span className="text-xs">Cuộn xuống</span>
          <div className="w-px h-8 bg-gradient-to-b from-primary/70 to-transparent" />
        </div>
      </section>
      <section id="posts" data-section="posts" className="section-fullscreen flex items-start pt-20 pb-20 md:pt-28 md:pb-24 px-6 md:px-12 md:pl-24 bg-secondary/50">
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
                Bạn cần đăng nhập hoặc tạo tài khoản mới để có thể xem được danh sách tất cả các bài viết.
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
      <section id="contact" data-section="contact" className="section-fullscreen flex items-center py-16 pb-28 md:py-24 px-6 md:px-12 md:pl-24 bg-background">
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
      <footer className="reveal py-10 pb-24 md:pb-12 px-6 md:px-12 md:pl-24 bg-secondary/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="flex items-center gap-2 text-primary">
            <BookOpen className="w-4 h-4" />
            <span className="text-sm font-bold text-foreground">Sutie Archive</span>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Sutie Archive.</p>
          <div className="flex gap-5 text-xs text-muted-foreground">
            <a href="#posts" className="hover:text-primary transition-colors">Bài viết</a>
            <a href="#contact" className="hover:text-primary transition-colors">Liên hệ</a>
          </div>
        </div>
      </footer>
      <AuthDialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen} />
      <CreatePostForm
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onPostCreated={fetchPosts}
        availableTags={availableTags}
      />
    </div>
  );
}

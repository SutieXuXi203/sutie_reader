'use client';
import { useState, useEffect, useCallback, useDeferredValue, useMemo, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { 
  BookOpen, BookmarkCheck, ChevronRight, X, Search, Lock
} from 'lucide-react';
import { useAuth } from '@/providers/AuthContext';
import Link from 'next/link';
import Image from 'next/image';
import { getOptimizedImageUrl, normalizeSearchText } from '@/lib/utils';
import { Footer } from '@/components/Footer';
import { PostCard } from '@/components/PostCard';
import { Input } from '@/components/ui/input';
import { useSearchParams } from 'next/navigation';

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

function HomeContent() {
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const { user, isLoading: isAuthLoading } = useAuth();
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchComposing, setIsSearchComposing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const searchParams = useSearchParams();
  const tagParam = searchParams.get('tag');

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

  useEffect(() => {
    if (user) {
      fetchBookmarks();
      fetchPosts();
    } else {
      setBookmarks([]);
      setPosts([]);
    }
  }, [user, fetchBookmarks, fetchPosts]);

  useEffect(() => {
    setSearchTerm(tagParam || '');
  }, [tagParam]);

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
  }, [bookmarks.length, posts.length, user, isAuthLoading]);

  const deferredSearchTerm = useDeferredValue(searchTerm);
  const normalizedSearch = normalizeSearchText(isSearchComposing ? '' : deferredSearchTerm);
  
  const filteredPosts = useMemo(() => normalizedSearch
    ? posts.filter((post) =>
        [post.title, post.description || '', post.author, ...(post.tags || [])]
          .some((value) => normalizeSearchText(value).includes(normalizedSearch))
      )
    : posts,
    [normalizedSearch, posts]
  );

  const handlePostDeleted = useCallback((postId: string) => {
    setPosts((prev) => prev.filter((post) => post._id !== postId));
  }, []);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors relative selection:bg-primary/30 selection:text-primary-foreground dark:selection:bg-primary/20 pt-20 pb-0 flex flex-col justify-between">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(theme(colors.primary)_1px,transparent_1px)] opacity-[0.05] z-0 mix-blend-screen" />
      
      {/* Decorative Orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        <div className="absolute top-[8%] left-[2%] w-48 h-48 rounded-full border border-primary/10 bg-primary/5 opacity-30 animate-float-y-soft float-y-fast" />
        <div className="absolute top-[20%] right-[10%] w-72 h-72 rounded-full bg-primary/10 blur-[120px] opacity-20 animate-float-y-soft float-y-slow" />
        <div className="absolute bottom-[30%] left-[5%] w-56 h-56 rounded-full border border-foreground/10 bg-foreground/5 opacity-20 animate-float-y-soft animation-delay-2000" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1">
        
        {/* Dashboard Content */}
        <div id="main-content" className="space-y-8">
          
          {/* Bookmarks ("Đang đọc dở") */}
          {user && bookmarks.length > 0 && (
            <div className="reveal border border-border rounded-[16px] bg-card/40 p-5 md:p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <BookmarkCheck className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Đang đọc dở</h3>
              </div>
              
              <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
                {bookmarks.map((bm) => {
                  const progress = bm.totalPages > 1 ? ((bm.currentPage) / (bm.totalPages - 1)) * 100 : 100;
                  return (
                    <div key={bm._id} className="group relative flex-shrink-0 w-[240px] sm:w-[280px] bg-card border border-border rounded-[12px] overflow-hidden hover:border-primary/50 transition-all shadow-sm">
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeBookmark(bm.postId); }}
                        className="absolute top-2.5 right-2.5 z-10 w-5 h-5 rounded-full bg-black/60 text-white/80 hover:text-white hover:bg-destructive/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer border-0"
                        title="Xóa đánh dấu"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                      
                      <Link href={`/posts/${bm.postId}`} className="block">
                        <div className="relative h-32 bg-secondary/30 overflow-hidden">
                          {bm.post.images[0] && (
                            <Image
                              src={getOptimizedImageUrl(bm.post.images[0])}
                              alt={bm.post.title}
                              fill
                              className="object-cover object-top group-hover:scale-105 transition-transform duration-500"
                              unoptimized
                            />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                          <div className="absolute bottom-2 left-3 flex items-center gap-1 text-white text-[10px] font-bold">
                            <BookOpen className="w-3 h-3" />
                            Chương {(bm.chapterIndex ?? 0) + 1} · Trang {bm.currentPage + 1}/{bm.totalPages}
                          </div>
                        </div>
                        
                        <div className="p-3">
                          <h4 className="text-xs font-bold text-foreground line-clamp-1 mb-1">{bm.post.title}</h4>
                          <p className="text-[10px] text-muted-foreground mb-3">{bm.post.author}</p>
                          <div className="h-1 bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[9px] text-muted-foreground">{Math.round(progress)}% hoàn thành</span>
                            <span className="text-[9px] text-primary font-bold flex items-center gap-0.5 group-hover:gap-1 transition-all">
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

          {/* Stories List Section */}
          {user && (
            <div className="reveal border border-border rounded-[16px] bg-card/40 p-5 md:p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4 border-b border-border/50 pb-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-1">Thư viện</h3>
                  <h2 className="text-base sm:text-lg font-extrabold text-foreground font-sans">Danh sách truyện</h2>
                </div>
                
                {/* Search Bar */}
                <div className="w-full sm:w-[240px] shrink-0">
                  <div className="relative group">
                    <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-primary/90 transition-colors group-focus-within:text-primary">
                      <Search className="w-4 h-4" />
                    </span>
                    <Input
                      id="home-post-search"
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onCompositionStart={() => setIsSearchComposing(true)}
                      onCompositionEnd={() => setIsSearchComposing(false)}
                      spellCheck={false}
                      autoCorrect="off"
                      autoCapitalize="none"
                      autoComplete="off"
                      placeholder="Tìm theo tiêu đề, mô tả..."
                      className="h-8 rounded-[8px] pl-10 pr-3 text-xs border-border bg-card/60 backdrop-blur-md text-foreground placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-primary/20 shadow-sm transition-all"
                    />
                  </div>
                </div>
              </div>

              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="bg-card border border-border rounded-[8px] h-72 animate-pulse shadow-sm" />
                  ))}
                </div>
              ) : filteredPosts.length === 0 ? (
                <div className="text-center py-20 px-6 bg-card/30 backdrop-blur-sm border border-border rounded-[8px]">
                  <p className="text-muted-foreground text-sm">
                    Không tìm thấy truyện phù hợp với từ khóa này.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {filteredPosts.map((post) => (
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
          )}

          {/* Locked State for Guest Users */}
          {!user && (
            <div className="reveal flex flex-col items-center justify-center py-20 px-6 bg-card/50 backdrop-blur-md border border-border rounded-[8px] text-center shadow-lg group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
              <div className="relative z-10 w-16 h-16 bg-background rounded-[8px] flex items-center justify-center mb-6 border border-border group-hover:scale-110 transition-transform duration-500 shadow-md">
                <Lock className="w-8 h-8 text-primary group-hover:brightness-110 transition-colors" />
              </div>
              <h3 className="relative z-10 text-xl font-bold text-foreground mb-2">Nội dung đã bị khóa</h3>
              <p className="relative z-10 text-muted-foreground max-w-sm mb-8">
                Bạn cần đăng nhập hoặc tạo tài khoản mới để có thể xem được danh sách tất cả các bài viết.
              </p>
              <button
                onClick={() => setIsAuthDialogOpen(true)}
                className="relative z-10 rounded-[8px] px-8 py-3 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xl shadow-primary/20 text-base font-bold transition-all cursor-pointer border-0 outline-none active:scale-95"
              >
                Đăng nhập ngay
              </button>
            </div>
          )}

        </div>
      </div>

      <Footer />

      <AuthDialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen} />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}

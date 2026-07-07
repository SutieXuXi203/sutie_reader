'use client';
import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { 
  BookOpen, Github, Facebook, 
  BookmarkCheck, ChevronRight, X
} from 'lucide-react';
import { useAuth } from '@/providers/AuthContext';
import Link from 'next/link';
import Image from 'next/image';
import { getOptimizedImageUrl } from '@/lib/utils';
import { Footer } from '@/components/Footer';
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


export default function Home() {
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const { user, isLoading: isAuthLoading } = useAuth();
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);

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
  }, [bookmarks.length, user, isAuthLoading]);

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
    if (user) {
      fetchBookmarks();
    } else {
      setBookmarks([]);
    }
  }, [user, fetchBookmarks]);



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
        


        {/* Dashboard Content Stretched to Match Hero Banner */}
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
        </div>
      </div>

      <Footer />

      <AuthDialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen} />
    </div>
  );
}

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  AnimatedBookOpen,
  AnimatedArrowLeft,
  AnimatedArrowRight,
  AnimatedBookmark,
  AnimatedBookmarkCheck,
  AnimatedShieldAlert,
  AnimatedLock,
} from '@/components/animate-ui/icons/AnimateIcon';
import { Loader2, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthContext';
import { getOptimizedImageUrl } from '@/lib/utils';
import { notify } from '@/lib/notify';

interface Chapter {
  _id?: string;
  title: string;
  chapterNumber: number;
  content: string;
  images: string[];
}

interface Post {
  _id: string;
  title: string;
  description: string;
  tags?: string[];
  content: string;
  images: string[];
  chapters?: Chapter[];
  author: string;
  createdAt: string;
}

interface BookmarkData {
  chapterIndex?: number;
  currentPage: number;
  totalPages: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const normalizeChapters = (post: Post | null): Chapter[] => {
  if (!post) return [];
  if (Array.isArray(post.chapters) && post.chapters.length > 0) {
    return [...post.chapters]
      .map((chapter, index) => {
        const rawNumber =
          typeof chapter.chapterNumber === 'number' && Number.isFinite(chapter.chapterNumber)
            ? Math.floor(chapter.chapterNumber)
            : index + 1;
        const chapterNumber = rawNumber > 0 ? rawNumber : index + 1;
        return {
          ...chapter,
          chapterNumber,
          title: chapter.title?.trim() || `Chuong ${chapterNumber}`,
          content: typeof chapter.content === 'string' ? chapter.content : '',
          images: Array.isArray(chapter.images) ? chapter.images.filter(Boolean) : [],
        };
      })
      .sort((a, b) => a.chapterNumber - b.chapterNumber);
  }

  return [
    {
      title: 'Oneshot',
      chapterNumber: 1,
      content: post.content || '',
      images: Array.isArray(post.images) ? post.images : [],
    },
  ];
};

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const { user, isLoading: isAuthLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [showUI, setShowUI] = useState(true);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [nsfwAccepted, setNsfwAccepted] = useState(false);
  const [hasBookmark, setHasBookmark] = useState(false);
  const [pendingResume, setPendingResume] = useState<{
    chapterIndex: number;
    page: number;
  } | null>(null);

  const uiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialScrollDone = useRef(false);

  const resetUiTimer = useCallback(() => {
    setShowUI(true);
    if (uiTimer.current) clearTimeout(uiTimer.current);
    uiTimer.current = setTimeout(() => setShowUI(false), 2000);
  }, []);

  const removeBookmark = useCallback(async () => {
    if (!post) return;
    try {
      await fetch(`/api/bookmarks/${post._id}`, { method: 'DELETE' });
      setHasBookmark(false);
    } catch (error) {
      console.error('Error removing bookmark:', error);
    }
  }, [post]);

  const goToChapter = useCallback(
    (index: number) => {
      const chapters = normalizeChapters(post);
      if (index < 0 || index >= chapters.length || index === activeChapterIndex) return;
      setActiveChapterIndex(index);
      setCurrentPage(0);
      imageRefs.current = [];
      setShowUI(true);
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 50);
    },
    [activeChapterIndex, post]
  );

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const response = await fetch(`/api/posts/${params.id}`);
        if (response.ok) {
          const data = await response.json();
          setPost(data);
          setActiveChapterIndex(0);
          setCurrentPage(0);
          setHasBookmark(false);
          setPendingResume(null);
          initialScrollDone.current = false;
        } else {
          console.error('Không tìm thấy bài viết');
          router.push('/');
        }
      } catch (error) {
        console.error('Lỗi khi tải bài viết:', error);
        router.push('/');
      } finally {
        setIsLoading(false);
      }
    };
    if (params.id) {
      fetchPost();
    }
  }, [params.id, router]);

  useEffect(() => {
    if (!post || !user) return;
    const fetchBookmark = async () => {
      try {
        const res = await fetch(`/api/bookmarks/${post._id}`);
        if (res.ok) {
          const data = (await res.json()) as BookmarkData | null;
          const chapters = normalizeChapters(post);
          if (data && chapters.length > 0) {
            const savedChapter = clamp(data.chapterIndex ?? 0, 0, chapters.length - 1);
            const chapterImages = chapters[savedChapter]?.images || [];
            const maxPage = Math.max(chapterImages.length - 1, 0);
            const savedPage = clamp(data.currentPage ?? 0, 0, maxPage);

            if (savedChapter > 0 || savedPage > 0) {
              setHasBookmark(true);
            }

            if (!initialScrollDone.current) {
              setActiveChapterIndex(savedChapter);
              setCurrentPage(savedPage);
              setPendingResume({ chapterIndex: savedChapter, page: savedPage });
            }
          }
        }
      } catch (error) {
        console.error('Error fetching bookmark:', error);
      } finally {
        initialScrollDone.current = true;
      }
    };
    fetchBookmark();
  }, [post, user]);

  useEffect(() => {
    if (!post || !pendingResume) return;
    if (pendingResume.chapterIndex !== activeChapterIndex) return;

    const chapters = normalizeChapters(post);
    const activeChapter = chapters[activeChapterIndex];
    const timer = setTimeout(() => {
      const targetRef = imageRefs.current[pendingResume.page];
      if (targetRef) {
        targetRef.scrollIntoView({ behavior: 'smooth', block: 'start' });
        notify.info(
          `Tiếp tục từ ${activeChapter?.title || `Chương ${activeChapterIndex + 1}`} - trang ${pendingResume.page + 1
          }`
        );
      }
      setPendingResume(null);
    }, 800);

    return () => clearTimeout(timer);
  }, [pendingResume, activeChapterIndex, post]);

  useEffect(() => {
    if (!post || !user) return;
    if (!initialScrollDone.current) return;

    const chapters = normalizeChapters(post);
    const activeChapter = chapters[activeChapterIndex];
    if (!activeChapter || activeChapter.images.length === 0) return;

    if (currentPage === 0 && activeChapterIndex === 0 && !hasBookmark) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const isLastChapter = activeChapterIndex === chapters.length - 1;
      const isLastPage = currentPage >= activeChapter.images.length - 1;

      if (isLastChapter && isLastPage) {
        if (hasBookmark) {
          removeBookmark();
        }
        return;
      }

      try {
        await fetch('/api/bookmarks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postId: post._id,
            chapterIndex: activeChapterIndex,
            currentPage,
            totalPages: activeChapter.images.length,
          }),
        });
        setHasBookmark(true);
      } catch (error) {
        console.error('Error saving bookmark:', error);
      }
    }, 1500);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [currentPage, activeChapterIndex, post, user, hasBookmark, removeBookmark]);

  useEffect(() => {
    uiTimer.current = setTimeout(() => setShowUI(false), 2000);
    return () => {
      if (uiTimer.current) clearTimeout(uiTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!post) return;
    const chapters = normalizeChapters(post);
    const activeChapter = chapters[activeChapterIndex];
    if (!activeChapter || activeChapter.images.length === 0) {
      setCurrentPage(0);
      return;
    }

    const handleScroll = () => {
      resetUiTimer();
      const viewportCenter = window.scrollY + window.innerHeight * 0.35;
      let closestIdx = 0;
      let closestDist = Infinity;
      imageRefs.current.forEach((ref, idx) => {
        if (!ref) return;
        const rect = ref.getBoundingClientRect();
        const absTop = rect.top + window.scrollY;
        const dist = Math.abs(absTop - viewportCenter);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = idx;
        }
      });
      setCurrentPage(closestIdx);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [post, activeChapterIndex, resetUiTimer]);

  if (isLoading || isAuthLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
        <Loader2 className="w-10 h-10 animate-spin text-slate-500 mb-4" />
        <p>Đang chuẩn bị...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-foreground px-6 text-center">
        <div className="w-20 h-20 bg-card rounded-[8px] flex items-center justify-center mb-8 border border-border shadow-lg">
          <AnimatedLock className="w-10 h-10 text-muted-foreground" />
        </div>
        <h1 className="text-3xl font-bold mb-4">Quyền truy cập bị giới hạn</h1>
        <p className="text-muted-foreground max-w-md mb-10 leading-relaxed">
          Trang này chỉ dành cho thành viên đã đăng ký. Vui lòng quay lại trang chủ và đăng nhập để tiếp tục xem nội dung này.
        </p>
        <Link
          href="/#posts"
          className="px-10 py-4 rounded-[8px] bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all active:scale-95 shadow-xl shadow-primary/20"
        >
          Về trang chủ đăng nhập
        </Link>
      </div>
    );
  }

  if (!post) return null;

  const chapters = normalizeChapters(post);
  const activeChapter = chapters[activeChapterIndex] || chapters[0];
  const chapterImages = activeChapter?.images || [];
  const total = chapterImages.length;
  const safeTotal = Math.max(total, 1);
  const isNSFW = (post.tags || []).some((tag) => tag.toLowerCase().includes('18+'));

  if (isNSFW && !nsfwAccepted) {
    return (
      <div
        className="fixed inset-0 bg-background/95 backdrop-blur-md flex flex-col items-center justify-center text-foreground px-6 text-center z-[9999]"
        onMouseMove={resetUiTimer}
        onClick={resetUiTimer}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-destructive/10 filter blur-[100px] rounded-full pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center max-w-[500px]">
          <div className="w-16 h-16 bg-card rounded-[8px] flex items-center justify-center mb-8 border border-border shadow-lg">
            <AnimatedShieldAlert className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-5 text-foreground tracking-tight">
            Cảnh báo nội dung
          </h1>
          <div className="inline-flex items-center gap-2 bg-destructive/10 text-destructive text-[11px] font-bold px-4 py-1.5 rounded-full mb-8 border border-destructive/30">
            <span className="w-1.5 h-1.5 bg-destructive rounded-full" />
            Nội dung 18+
          </div>
          <p className="text-muted-foreground max-w-sm mb-12 leading-relaxed text-xs sm:text-sm">
            Bài viết này chứa nội dung dành cho người trên 18 tuổi. Bằng việc tiếp tục, bạn xác nhận rằng bạn đã đủ 18 tuổi.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto items-center justify-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setNsfwAccepted(true);
              }}
              className="w-full sm:w-[200px] py-3.5 rounded-[8px] bg-destructive text-destructive-foreground font-bold transition-all hover:bg-destructive/90 active:scale-95 shadow-[0_0_20px_rgba(239,68,68,0.3)] text-sm cursor-pointer"
            >
              Tôi đã đủ 18 tuổi, tiếp tục
            </button>
            <Link
              href="/#posts"
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:w-[120px] py-3.5 rounded-[8px] bg-secondary hover:bg-muted text-foreground font-bold transition-all active:scale-95 text-sm text-center border border-border cursor-pointer"
            >
              Quay lại
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background flex flex-col relative"
      onMouseMove={resetUiTimer}
      onClick={resetUiTimer}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 to-transparent pointer-events-none" />

      {createPortal(
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999 }}
          className="flex items-center justify-between gap-2 px-3 py-3 md:px-6 md:py-4 bg-card/60 backdrop-blur-md border-b border-border shadow-sm"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-4">
            <Link
              href="/#posts"
              className="inline-flex h-9 w-9 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-[8px] bg-transparent text-foreground/80 transition-colors hover:text-foreground"
              aria-label="Quay lại danh sách truyện"
            >
              <AnimatedArrowLeft className="block w-4 h-4 md:w-5 md:h-5" />
            </Link>
            <div className="flex min-w-0 items-center gap-2 md:gap-3">
              <AnimatedBookOpen className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <h1 className="text-foreground font-bold text-sm md:text-base leading-tight line-clamp-1">
                  {post.title}
                </h1>
                <p className="text-muted-foreground text-[10px] md:text-xs line-clamp-1">
                  {activeChapter?.title || `Chuong ${activeChapterIndex + 1}`} - {post.author}
                </p>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 md:gap-4">
            <button
              onClick={async () => {
                if (hasBookmark) {
                  removeBookmark();
                  return;
                }
                if (!post || !activeChapter || chapterImages.length === 0) return;
                try {
                  await fetch('/api/bookmarks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      postId: post._id,
                      chapterIndex: activeChapterIndex,
                      currentPage,
                      totalPages: chapterImages.length,
                    }),
                  });
                  setHasBookmark(true);
                } catch (error) {
                  console.error('Error saving bookmark:', error);
                }
              }}
              title={hasBookmark ? 'Xóa đánh dấu' : 'Lưu vị trí đọc'}
              className={`inline-flex h-9 w-9 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-[8px] bg-transparent p-0 transition-colors cursor-pointer ${hasBookmark
                  ? 'text-primary hover:text-primary/80'
                  : 'text-foreground/60 hover:text-foreground'
                }`}
            >
              {hasBookmark ? (
                <AnimatedBookmarkCheck className="block w-4 h-4 md:w-5 md:h-5" />
              ) : (
                <AnimatedBookmark className="block w-4 h-4 md:w-5 md:h-5" />
              )}
            </button>
            <span className="text-foreground text-xs md:text-sm font-bold bg-secondary px-2 py-1 md:px-3 md:py-1 rounded-[8px] backdrop-blur-sm border border-border">
              Chương {activeChapterIndex + 1}/{chapters.length} - Trang {total === 0 ? 0 : currentPage + 1}/{safeTotal}
            </span>
          </div>
        </div>,
        document.body
      )}

      <main className="w-full flex-1 flex flex-col items-center pt-14 md:pt-20 pb-16 md:pb-20">
        <div className="flex flex-col items-center w-full gap-0">
          {chapterImages.length > 0 ? (
            chapterImages.map((img, idx) => (
              <div
                key={`${activeChapterIndex}-${idx}`}
                ref={(el) => {
                  imageRefs.current[idx] = el;
                }}
                className="w-full max-w-5xl relative scroll-mt-16 md:scroll-mt-24"
              >
                <Image
                  src={getOptimizedImageUrl(img)}
                  alt={`Trang ${idx + 1}`}
                  width={1200}
                  height={1800}
                  className="w-full h-auto block select-none"
                  unoptimized
                  priority={idx < 2}
                />
              </div>
            ))
          ) : (
            <div className="w-full max-w-3xl mt-16 rounded-[8px] border border-border bg-card/50 p-8 text-center">
              <p className="text-foreground font-semibold mb-2">Chưa có ảnh cho chương này</p>
              <p className="text-sm text-muted-foreground">
                Hãy thêm ảnh trong trang quản trị để hiển thị nội dung chương.
              </p>
            </div>
          )}

          <div className="flex flex-col items-center gap-4 py-20 text-center w-full max-w-md px-6 z-10">
            <div className="w-16 h-1 bg-border rounded-full mb-2" />
            <h2 className="text-foreground text-xl font-bold">Cảm ơn đã theo dõi!</h2>
            <p className="text-muted-foreground text-sm">
              Bạn đã đọc xong {activeChapter?.title || `chương ${activeChapterIndex + 1}`} trong
              &quot;{post.title}&quot;.
            </p>
            <div className="flex gap-4 mt-4">
              {hasBookmark && (
                <button
                  onClick={removeBookmark}
                  className="px-6 py-3 rounded-[8px] bg-secondary text-foreground hover:bg-muted text-sm font-bold transition-transform active:scale-95 border border-border"
                >
                  Xóa đánh dấu
                </button>
              )}
              <Link
                href="/#posts"
                className="px-8 py-3 rounded-[8px] bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-bold transition-transform active:scale-95 shadow-lg shadow-primary/20 border border-primary/20"
              >
                Quay lại trang chủ
              </Link>
            </div>
          </div>
        </div>
      </main>

      <div
        className={`fixed bottom-0 left-0 right-0 z-50 transition-opacity duration-500 ${showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
      >
        <div className="h-1.5 bg-white/5">
          <div
            className="h-full bg-white transition-all duration-300 shadow-[0_0_10px_rgba(255,255,255,0.3)]"
            style={{
              width: `${safeTotal > 1 ? (currentPage / (safeTotal - 1)) * 100 : 100}%`,
            }}
          />
        </div>
      </div>

      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 pointer-events-none ${showUI ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
      >
        <div className="flex items-center gap-1.5 bg-background p-1 rounded-[8px] border border-border shadow-2xl pointer-events-auto">
          <button
            onClick={() => goToChapter(activeChapterIndex - 1)}
            disabled={activeChapterIndex === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-border bg-background text-foreground disabled:text-muted-foreground cursor-pointer disabled:cursor-not-allowed text-[11px] md:text-xs font-medium transition-colors disabled:opacity-50"
          >
            <AnimatedArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Chương trước</span>
          </button>
          <div className="relative">
            <select
              value={String(activeChapterIndex)}
              onChange={(e) => goToChapter(Number(e.target.value))}
              className="appearance-none bg-background hover:bg-muted border border-border text-foreground px-4 py-1.5 pr-8 rounded-[8px] text-[11px] md:text-xs font-medium focus:outline-none focus:border-primary/50 cursor-pointer transition-colors shadow-sm"
            >
              {chapters.map((chapter, index) => (
                <option
                  key={`${chapter.chapterNumber}-${index}`}
                  value={String(index)}
                  className="bg-background text-foreground py-2"
                >
                  Chương {chapter.chapterNumber}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
          <button
            onClick={() => goToChapter(activeChapterIndex + 1)}
            disabled={activeChapterIndex >= chapters.length - 1}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-border bg-background text-foreground disabled:text-muted-foreground cursor-pointer disabled:cursor-not-allowed text-[11px] md:text-xs font-medium transition-colors disabled:opacity-50"
          >
            <span className="hidden sm:inline">Chương sau</span>
            <AnimatedArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

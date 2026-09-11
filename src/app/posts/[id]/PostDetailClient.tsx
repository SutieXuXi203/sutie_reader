'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { Loader2, ChevronDown, Play, Pause, Settings } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthContext';
import { cn } from '@/lib/utils';
import { notify } from '@/lib/notify';
import { ReaderImage } from '@/components/ReaderImage';

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
  translator?: string;
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

export default function PostDetailClient({ initialPost }: { initialPost: Post | null }) {
  const params = useParams();
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(initialPost);
  const { user, isLoading: isAuthLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [nsfwAccepted, setNsfwAccepted] = useState(false);
  const [hasBookmark, setHasBookmark] = useState(false);
  const [isChapterMenuOpen, setIsChapterMenuOpen] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [autoMode, setAutoMode] = useState<'scroll' | 'flip'>('scroll');
  const [autoSpeed, setAutoSpeed] = useState<number>(1);
  const [isEyeCareMode, setIsEyeCareMode] = useState(false);
  const [scrollBtnPos, setScrollBtnPos] = useState({ x: 20, y: 100 });
  const [isAutoScrollSettingsOpen, setIsAutoScrollSettingsOpen] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number; currentX?: number; currentY?: number } | null>(null);
  const isDraggedRef = useRef(false);
  const autoScrollMenuRef = useRef<HTMLDivElement | null>(null);

  const [pendingResume, setPendingResume] = useState<{
    chapterIndex: number;
    page: number;
  } | null>(null);

  const uiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialScrollDone = useRef(false);
  const chapterSelectRef = useRef<HTMLDivElement | null>(null);
  const showUIRef = useRef(showUI);
  const scrollRafRef = useRef<number | null>(null);
  const chapters = useMemo(() => normalizeChapters(post), [post]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedEyeCare = localStorage.getItem('eyeCareMode');
      if (savedEyeCare === 'true') setIsEyeCareMode(true);
    }
  }, []);

  const toggleEyeCareMode = () => {
    setIsEyeCareMode((prev) => {
      const next = !prev;
      localStorage.setItem('eyeCareMode', String(next));
      return next;
    });
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setScrollBtnPos({ x: window.innerWidth - 70, y: window.innerHeight / 2 - 18 });
      
      const handleResize = () => {
        setScrollBtnPos((prev) => ({
          x: Math.max(0, Math.min(prev.x, window.innerWidth - 65)),
          y: Math.max(0, Math.min(prev.y, window.innerHeight - 40)),
        }));
      };
      
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  const handleScrollBtnPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: scrollBtnPos.x,
      initialY: scrollBtnPos.y,
    };
    isDraggedRef.current = false;

    const handleMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        isDraggedRef.current = true;
      }
      
      const clampX = Math.max(0, Math.min(dragRef.current.initialX + dx, window.innerWidth - 65));
      const clampY = Math.max(0, Math.min(dragRef.current.initialY + dy, window.innerHeight - 40));
      
      dragRef.current.currentX = clampX;
      dragRef.current.currentY = clampY;
      
      if (autoScrollMenuRef.current) {
        autoScrollMenuRef.current.style.transform = `translate3d(${clampX}px, ${clampY}px, 0)`;
      }
    };

    const handleUp = () => {
      if (dragRef.current) {
        if (dragRef.current.currentX !== undefined && dragRef.current.currentY !== undefined) {
          setScrollBtnPos({ x: dragRef.current.currentX, y: dragRef.current.currentY });
        }
        dragRef.current = null;
      }
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const handleScrollBtnClick = (e: React.MouseEvent) => {
    if (isDraggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    setIsAutoPlaying(!isAutoPlaying);
  };

  useEffect(() => {
    showUIRef.current = showUI;
  }, [showUI]);

  useEffect(() => {
    if (!isAutoScrollSettingsOpen) return;
    const handleOutsideClick = (e: PointerEvent) => {
      if (!autoScrollMenuRef.current?.contains(e.target as Node)) {
        setIsAutoScrollSettingsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
    };
  }, [isAutoScrollSettingsOpen]);

  const resetUiTimer = useCallback(() => {
    if (!showUIRef.current) {
      showUIRef.current = true;
      setShowUI(true);
    }
    if (uiTimer.current) clearTimeout(uiTimer.current);
    uiTimer.current = setTimeout(() => {
      showUIRef.current = false;
      setShowUI(false);
    }, 2000);
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
      setIsChapterMenuOpen(false);
      if (index < 0 || index >= chapters.length || index === activeChapterIndex) return;
      setActiveChapterIndex(index);
      setCurrentPage(0);
      imageRefs.current = [];
      showUIRef.current = true;
      setShowUI(true);
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 50);
    },
    [activeChapterIndex, chapters]
  );

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsAutoPlaying((prev) => !prev);
      } else if (e.code === 'ArrowLeft') {
        goToChapter(activeChapterIndex - 1);
      } else if (e.code === 'ArrowRight') {
        goToChapter(activeChapterIndex + 1);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeChapterIndex, goToChapter]);

  useEffect(() => {
    if (!post && !isLoading) {
      router.push('/');
    }
  }, [post, isLoading, router]);

  useEffect(() => {
    if (!post || !user) return;
    const fetchBookmark = async () => {
      try {
        const res = await fetch(`/api/bookmarks/${post._id}`);
        if (res.ok) {
          const data = (await res.json()) as BookmarkData | null;
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
  }, [post, user, chapters]);

  useEffect(() => {
    if (!post || !pendingResume) return;
    if (pendingResume.chapterIndex !== activeChapterIndex) return;

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
  }, [pendingResume, activeChapterIndex, post, chapters]);

  useEffect(() => {
    if (!post || !user) return;
    if (!initialScrollDone.current) return;

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
  }, [currentPage, activeChapterIndex, post, user, hasBookmark, removeBookmark, chapters]);

  useEffect(() => {
    uiTimer.current = setTimeout(() => {
      showUIRef.current = false;
      setShowUI(false);
    }, 2000);
    return () => {
      if (uiTimer.current) clearTimeout(uiTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!isChapterMenuOpen) return;

    setShowUI(true);
    showUIRef.current = true;
    if (uiTimer.current) clearTimeout(uiTimer.current);

    const handlePointerDown = (event: PointerEvent) => {
      if (!chapterSelectRef.current?.contains(event.target as Node)) {
        setIsChapterMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsChapterMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isChapterMenuOpen]);

  useEffect(() => {
    if (!post) return;
    const activeChapter = chapters[activeChapterIndex];
    if (!activeChapter || activeChapter.images.length === 0) {
      setCurrentPage(0);
      return;
    }

    const handleScroll = () => {
      if (scrollRafRef.current !== null) return;

      scrollRafRef.current = window.requestAnimationFrame(() => {
        scrollRafRef.current = null;
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
        setCurrentPage((prev) => (prev === closestIdx ? prev : closestIdx));
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, [post, activeChapterIndex, resetUiTimer, chapters]);

  useEffect(() => {
    let scrollRafId: number;

    const performAutoScroll = () => {
      if (isAutoPlaying && autoMode === 'scroll') {
        window.scrollBy(0, autoSpeed);
        if (Math.ceil(window.innerHeight + window.scrollY) >= document.body.offsetHeight) {
           setIsAutoPlaying(false);
        } else {
           scrollRafId = requestAnimationFrame(performAutoScroll);
        }
      }
    };

    if (isAutoPlaying && autoMode === 'scroll') {
      scrollRafId = requestAnimationFrame(performAutoScroll);
    }

    return () => {
      if (scrollRafId) {
        cancelAnimationFrame(scrollRafId);
      }
    };
  }, [isAutoPlaying, autoMode, autoSpeed]);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    if (isAutoPlaying && autoMode === 'flip') {
      const delay = 4000 / autoSpeed;
      intervalId = setInterval(() => {
        setCurrentPage((prev) => {
          const activeChapter = chapters[activeChapterIndex];
          if (!activeChapter) return prev;
          if (prev < activeChapter.images.length - 1) {
            const nextIdx = prev + 1;
            const targetRef = imageRefs.current[nextIdx];
            if (targetRef) {
              targetRef.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            return nextIdx;
          } else {
            setIsAutoPlaying(false);
            return prev;
          }
        });
      }, delay);
    }
    return () => clearInterval(intervalId);
  }, [isAutoPlaying, autoMode, autoSpeed, activeChapterIndex, chapters]);

  if (isLoading || isAuthLoading) {
    const loadingText = "Đang chuẩn bị...";
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-foreground font-semibold">
        <Loader2 className="w-10 h-10 animate-spin text-slate-500 mb-4" />
        <div className="flex items-center text-muted-foreground text-lg">
          {loadingText.split("").map((char, index) => (
            <span
              key={index}
              className="inline-block animate-bounce"
              style={{
                animationDelay: `${index * 0.07}s`,
                animationDuration: '1.5s',
              }}
            >
              {char === " " ? "\u00A0" : char}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-foreground px-6 text-center">
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
      className="min-h-screen flex flex-col relative"
      onMouseMove={resetUiTimer}
      onClick={resetUiTimer}
    >
      {isEyeCareMode && (
        <div className="fixed inset-0 z-[9998] pointer-events-none bg-[#f4ecd8] opacity-50 mix-blend-multiply transition-opacity duration-500" />
      )}
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
                  {activeChapter?.title || `Chuong ${activeChapterIndex + 1}`} - {post.author}{post.translator ? ` (Dịch: ${post.translator})` : ''}
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
        <div className="flex flex-col items-center w-full gap-[4px]">
          {chapterImages.length > 0 ? (
            chapterImages.map((img, idx) => (
              <div
                key={`${activeChapterIndex}-${idx}`}
                ref={(el) => {
                  imageRefs.current[idx] = el;
                }}
                className="w-full max-w-5xl relative scroll-mt-16 md:scroll-mt-24"
              >
                <ReaderImage
                  src={img}
                  alt={`Trang ${idx + 1}`}
                  idx={idx}
                  width={1200}
                  height={1800}
                  className="w-full h-auto block select-none"
                  priority={idx < 3}
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
        className={`fixed bottom-0 left-0 right-0 z-50 transition-opacity duration-500 ${
          showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'
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
          <div ref={chapterSelectRef} className="relative">
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={isChapterMenuOpen}
              aria-label="Chọn chương"
              onClick={() => setIsChapterMenuOpen((open) => !open)}
              className="inline-flex h-8 min-w-[104px] items-center justify-between gap-2 rounded-[8px] border border-border bg-background px-3.5 text-[11px] font-semibold text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/30 md:text-xs"
            >
              <span className="truncate">Chương {activeChapter?.chapterNumber || activeChapterIndex + 1}</span>
              <ChevronDown
                className={cn(
                  "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
                  isChapterMenuOpen && "rotate-180"
                )}
              />
            </button>

            {isChapterMenuOpen && (
              <div
                role="listbox"
                aria-label="Danh sách chương"
                className="absolute bottom-full left-1/2 z-50 mb-2 max-h-56 w-36 -translate-x-1/2 overflow-y-auto rounded-[8px] border border-border bg-background p-1 shadow-2xl"
              >
                {chapters.map((chapter, index) => {
                  const isActive = index === activeChapterIndex;

                  return (
                    <button
                      key={`${chapter.chapterNumber}-${index}`}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onClick={() => goToChapter(index)}
                      className={cn(
                        "flex h-8 w-full items-center rounded-[6px] px-3 text-left text-[11px] font-medium text-foreground transition-colors hover:bg-muted focus-visible:bg-muted md:text-xs",
                        isActive && "bg-muted font-bold text-foreground"
                      )}
                    >
                      Chương {chapter.chapterNumber}
                    </button>
                  );
                })}
              </div>
            )}
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

      {createPortal(
        <div
          ref={autoScrollMenuRef}
          className="fixed top-0 left-0 z-[99999] flex flex-col gap-1 select-none"
          style={{
            transform: `translate3d(${scrollBtnPos.x}px, ${scrollBtnPos.y}px, 0)`,
            willChange: 'transform'
          }}
        >
          <div
            className={`flex items-center rounded-full border shadow-[0_0_15px_rgba(0,0,0,0.2)] transition-colors cursor-grab active:cursor-grabbing touch-none ${
              isAutoPlaying ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border'
            }`}
            onPointerDown={handleScrollBtnPointerDown}
          >
            <button
              className="w-9 h-9 flex items-center justify-center rounded-l-full group"
              onClick={handleScrollBtnClick}
              title="Bật/Tắt tự động cuộn (Kéo để di chuyển)"
            >
              <div className="transition-transform duration-300 group-hover:scale-110 group-active:scale-75">
                {isAutoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </div>
            </button>
            <div className={`w-[1px] h-5 ${isAutoPlaying ? 'bg-primary-foreground/30' : 'bg-border'}`}></div>
            <button
              className={`w-7 h-9 flex items-center justify-center rounded-r-full transition-colors group ${
                isAutoPlaying ? 'hover:bg-primary-foreground/10' : 'hover:bg-muted'
              }`}
              onClick={(e) => {
                if (isDraggedRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  return;
                }
                setIsAutoScrollSettingsOpen(!isAutoScrollSettingsOpen);
              }}
              title="Cài đặt cuộn"
            >
              <Settings className={`w-3.5 h-3.5 transition-transform duration-500 ease-out group-hover:rotate-90 group-active:scale-75 ${isAutoScrollSettingsOpen ? 'rotate-90' : ''}`} />
            </button>
          </div>
          
          <div
            className={`absolute top-full mt-2 right-0 bg-background border border-border rounded-[12px] p-2 shadow-xl flex flex-col gap-2 min-w-[120px] origin-top-right transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${
              isAutoScrollSettingsOpen
                ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                : 'opacity-0 scale-90 -translate-y-2 pointer-events-none'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-semibold text-muted-foreground">Chế độ</span>
                <button
                  onClick={() => setAutoMode(m => m === 'scroll' ? 'flip' : 'scroll')}
                  className="px-2 py-1 rounded-[6px] bg-secondary hover:bg-muted text-foreground text-[11px] font-bold transition-colors"
                >
                  {autoMode === 'scroll' ? 'Cuộn' : 'Nhảy'}
                </button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold text-muted-foreground">Tốc độ</span>
                <button
                  onClick={() => {
                    const speeds = [0.25, 0.5, 1, 1.25, 1.5, 2];
                    setAutoSpeed(s => {
                      const nextIndex = (speeds.indexOf(s) + 1) % speeds.length;
                      return speeds[nextIndex];
                    });
                  }}
                  className="px-2 py-1 rounded-[6px] bg-secondary hover:bg-muted text-foreground text-[11px] font-bold transition-colors min-w-[42px] text-center select-none"
                >
                  x{autoSpeed}
                </button>
              </div>
              <div className="w-full h-[1px] bg-border my-0.5"></div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold text-muted-foreground">Bảo vệ mắt</span>
                <button
                  onClick={toggleEyeCareMode}
                  className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${isEyeCareMode ? 'bg-primary' : 'bg-muted'}`}
                >
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition duration-200 ease-in-out ${isEyeCareMode ? 'translate-x-1.5' : '-translate-x-1.5'}`} />
                </button>
              </div>
            </div>
        </div>,
        document.body
      )}
    </div>
  );
}

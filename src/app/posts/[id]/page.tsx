'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { X, BookOpen, ArrowLeft, Loader2, ShieldAlert, Bookmark, BookmarkCheck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthContext';
import { Lock } from 'lucide-react';
import { getOptimizedImageUrl } from '@/lib/utils';
interface Post {
    _id: string;
    title: string;
    description: string;
    tags?: string[];
    content: string;
    images: string[];
    author: string;
    createdAt: string;
}
export default function PostDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [post, setPost] = useState<Post | null>(null);
    const { user, isLoading: isAuthLoading } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [showUI, setShowUI] = useState(true);
    const [currentPage, setCurrentPage] = useState(0);
    const [nsfwAccepted, setNsfwAccepted] = useState(false);
    const [hasBookmark, setHasBookmark] = useState(false);
    const [resumeToast, setResumeToast] = useState<string | null>(null);
    const uiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const imageRefs = useRef<(HTMLDivElement | null)[]>([]);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const initialScrollDone = useRef(false);
    const resetUiTimer = useCallback(() => {
        setShowUI(true);
        if (uiTimer.current) clearTimeout(uiTimer.current);
        uiTimer.current = setTimeout(() => setShowUI(false), 3000);
    }, []);
    useEffect(() => {
        const fetchPost = async () => {
            try {
                const response = await fetch(`/api/posts/${params.id}`);
                if (response.ok) {
                    const data = await response.json();
                    setPost(data);
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
                    const data = await res.json();
                    if (data && data.currentPage > 0) {
                        setHasBookmark(true);
                        if (!initialScrollDone.current) {
                            const savedPage = data.currentPage;
                            setTimeout(() => {
                                const targetRef = imageRefs.current[savedPage];
                                if (targetRef) {
                                    targetRef.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    setResumeToast(`Tiếp tục từ trang ${savedPage + 1}`);
                                    setTimeout(() => setResumeToast(null), 3000);
                                }
                            }, 800);
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
    const removeBookmark = useCallback(async () => {
        if (!post) return;
        try {
            await fetch(`/api/bookmarks/${post._id}`, { method: 'DELETE' });
            setHasBookmark(false);
        } catch (error) {
            console.error('Error removing bookmark:', error);
        }
    }, [post]);
    useEffect(() => {
        if (!post || !user) return;
        if (!initialScrollDone.current) return;
        if (currentPage === 0 && !hasBookmark) return;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(async () => {
            if (currentPage === post.images.length - 1) {
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
                        currentPage,
                        totalPages: post.images.length,
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
    }, [currentPage, post, user, hasBookmark, removeBookmark]);
    useEffect(() => {
        uiTimer.current = setTimeout(() => setShowUI(false), 3000);
        return () => { if (uiTimer.current) clearTimeout(uiTimer.current); };
    }, []);
    useEffect(() => {
        if (!post) return;
        const handleScroll = () => {
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
    }, [post]);
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
                    <Lock className="w-10 h-10 text-muted-foreground" />
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
    const isNSFW = (post.tags || []).some(tag => tag.toLowerCase().includes('18+'));
    if (isNSFW && !nsfwAccepted) {
        return (
            <div className="fixed inset-0 bg-background/95 backdrop-blur-md flex flex-col items-center justify-center text-foreground px-6 text-center z-[9999]" onMouseMove={resetUiTimer} onClick={resetUiTimer}>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-destructive/10 filter blur-[100px] rounded-full pointer-events-none" />
                <div className="relative z-10 flex flex-col items-center max-w-[500px]">
                    <div className="w-16 h-16 bg-card rounded-[8px] flex items-center justify-center mb-8 border border-border shadow-lg">
                        <ShieldAlert className="w-8 h-8 text-destructive" />
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold mb-5 text-foreground tracking-tight">Cảnh báo nội dung</h1>
                    <div className="inline-flex items-center gap-2 bg-destructive/10 text-destructive text-[11px] font-bold px-4 py-1.5 rounded-full mb-8 border border-destructive/30">
                        <span className="w-1.5 h-1.5 bg-destructive rounded-full" />
                        Nội dung 18+
                    </div>
                    <p className="text-muted-foreground max-w-sm mb-12 leading-relaxed text-xs sm:text-sm">
                        Bài viết này chứa nội dung dành cho người trên 18 tuổi. Bằng việc tiếp tục, bạn xác nhận rằng bạn đã đủ 18 tuổi.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto items-center justify-center">
                        <button
                            onClick={(e) => { e.stopPropagation(); setNsfwAccepted(true); }}
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
    const total = post.images.length;
    return (
        <div className="min-h-screen bg-background flex flex-col relative" onMouseMove={resetUiTimer} onClick={resetUiTimer}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 to-transparent pointer-events-none" />
            {resumeToast && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] animate-fade-in">
                    <div className="flex items-center gap-2 bg-card/60 backdrop-blur-md text-foreground text-sm font-medium px-5 py-2.5 rounded-[8px] border border-border shadow-xl">
                        <BookmarkCheck className="w-4 h-4 text-primary" />
                        {resumeToast}
                    </div>
                </div>
            )}
            <div
                className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-3 py-3 md:px-6 md:py-4
          bg-card/60 backdrop-blur-md border-b border-border transition-opacity duration-500
          ${showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            >
                <div className="flex items-center gap-2 md:gap-4">
                    <Link href="/#posts" className="p-1.5 md:p-2 rounded-[8px] bg-secondary hover:bg-muted text-foreground transition-colors">
                        <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
                    </Link>
                    <div className="flex items-center gap-2 md:gap-3">
                        <BookOpen className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                            <h1 className="text-foreground font-bold text-sm md:text-base leading-tight line-clamp-1">{post.title}</h1>
                            <p className="text-muted-foreground text-[10px] md:text-xs">{post.author}</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 md:gap-4">
                    <button
                        onClick={async () => {
                            if (hasBookmark) {
                                removeBookmark();
                            } else if (post) {
                                try {
                                    await fetch('/api/bookmarks', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            postId: post._id,
                                            currentPage,
                                            totalPages: post.images.length,
                                        }),
                                    });
                                    setHasBookmark(true);
                                } catch (error) {
                                    console.error('Error saving bookmark:', error);
                                }
                            }
                        }}
                        title={hasBookmark ? 'Xóa đánh dấu' : 'Lưu vị trí đọc'}
                        className={`p-1.5 md:p-2 rounded-[8px] transition-all cursor-pointer ${hasBookmark
                            ? 'bg-primary/20 text-primary hover:bg-primary/30'
                            : 'bg-secondary text-foreground/60 hover:bg-muted hover:text-foreground'
                            }`}
                    >
                        {hasBookmark ? (
                            <BookmarkCheck className="w-4 h-4 md:w-5 md:h-5" />
                        ) : (
                            <Bookmark className="w-4 h-4 md:w-5 md:h-5" />
                        )}
                    </button>
                    <span className="text-foreground text-xs md:text-sm font-bold bg-secondary px-2 py-1 md:px-3 md:py-1 rounded-[8px] backdrop-blur-sm border border-border">
                        {currentPage + 1} / {total}
                    </span>
                    <Link
                        href="/#posts"
                        className="p-1.5 md:p-2 rounded-[8px] bg-secondary hover:bg-destructive/80 text-foreground hover:text-white transition-colors"
                    >
                        <X className="w-4 h-4 md:w-5 md:h-5" />
                    </Link>
                </div>
            </div>
            <main className="w-full flex-1 flex flex-col items-center pt-14 md:pt-24 pb-16 md:pb-20">
                <div className="flex flex-col items-center w-full gap-0">
                    {post.images.map((img, idx) => (
                        <div
                            key={idx}
                            ref={(el) => { imageRefs.current[idx] = el; }}
                            className="w-full max-w-5xl relative"
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
                    ))}
                    <div className="flex flex-col items-center gap-4 py-20 text-center w-full max-w-md px-6 z-10">
                        <div className="w-16 h-1 bg-border rounded-full mb-2" />
                        <h2 className="text-foreground text-xl font-bold">Cảm ơn đã theo dõi!</h2>
                        <p className="text-muted-foreground text-sm">Bạn đã đọc hết &quot;{post.title}&quot;.</p>
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
                className={`fixed bottom-0 left-0 right-0 z-50 transition-opacity duration-500 ${showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            >
                <div className="h-1.5 bg-white/5">
                    <div
                        className="h-full bg-white transition-all duration-300 shadow-[0_0_10px_rgba(255,255,255,0.3)]"
                        style={{ width: `${total > 1 ? (currentPage / (total - 1)) * 100 : 100}%` }}
                    />
                </div>
            </div>
        </div>
    );
}

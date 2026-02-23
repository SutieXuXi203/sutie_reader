'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, BookOpen, ArrowLeft, Loader2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthContext';
import { Lock } from 'lucide-react';

interface Post {
    _id: string;
    title: string;
    description: string;
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
    const uiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const imageRefs = useRef<(HTMLDivElement | null)[]>([]);

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
        uiTimer.current = setTimeout(() => setShowUI(false), 3000);
        return () => { if (uiTimer.current) clearTimeout(uiTimer.current); };
    }, []);

    // Track which image is in view
    useEffect(() => {
        if (!post) return;
        const container = document.documentElement; // Root scroll for page

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const idx = imageRefs.current.findIndex((r) => r === entry.target);
                        if (idx !== -1) setCurrentPage(idx);
                    }
                });
            },
            { threshold: 0.4 }
        );

        const currentRefs = imageRefs.current;
        currentRefs.forEach((ref) => { if (ref) observer.observe(ref); });
        return () => observer.disconnect();
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
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white px-6 text-center">
                <div className="w-20 h-20 bg-white/5 rounded-none flex items-center justify-center mb-8 border border-white/10">
                    <Lock className="w-10 h-10 text-slate-400" />
                </div>
                <h1 className="text-3xl font-bold mb-4">Quyền truy cập bị giới hạn</h1>
                <p className="text-slate-400 max-w-md mb-10 leading-relaxed">
                    Trang này chỉ dành cho thành viên đã đăng ký. Vui lòng quay lại trang chủ và đăng nhập để tiếp tục xem nội dung này.
                </p>
                <Link
                    href="/#posts"
                    className="px-10 py-4 rounded-none bg-white text-black font-bold hover:bg-slate-200 transition-all active:scale-95 shadow-xl shadow-white/5"
                >
                    Về trang chủ đăng nhập
                </Link>
            </div>
        );
    }

    if (!post) return null;

    const total = post.images.length;

    return (
        <div className="min-h-screen bg-black flex flex-col relative" onMouseMove={resetUiTimer} onClick={resetUiTimer}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900/20 to-transparent pointer-events-none" />

            {/* ── TOP BAR ── */}
            <div
                className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4
          bg-transparent transition-opacity duration-500
          ${showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            >
                <div className="flex items-center gap-4">
                    <Link href="/#posts" className="p-2 rounded-none bg-white/10 hover:bg-white/20 text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex items-center gap-3">
                        <BookOpen className="w-5 h-5 text-slate-400 flex-shrink-0" />
                        <div className="min-w-0">
                            <h1 className="text-white font-bold text-base leading-tight line-clamp-1">{post.title}</h1>
                            <p className="text-slate-400 text-xs">{post.author}</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <span className="text-white text-sm font-bold bg-white/10 px-3 py-1 rounded-none backdrop-blur-sm border border-white/10">
                        {currentPage + 1} / {total}
                    </span>
                    <Link
                        href="/#posts"
                        className="p-2 rounded-none bg-white/10 hover:bg-red-500/80 text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </Link>
                </div>
            </div>

            {/* ── CONTENT CONTAINER ── */}
            <main className="w-full flex-1 flex flex-col items-center pt-24 pb-20">
                <div className="flex flex-col items-center w-full gap-0">
                    {post.images.map((img, idx) => (
                        <div
                            key={idx}
                            ref={(el) => { imageRefs.current[idx] = el; }}
                            className="w-full max-w-5xl relative"
                        >
                            <Image
                                src={img}
                                alt={`Trang ${idx + 1}`}
                                width={1200}
                                height={1800}
                                className="w-full h-auto block select-none"
                                unoptimized
                                priority={idx < 2}
                            />
                        </div>
                    ))}

                    {/* End of chapter */}
                    <div className="flex flex-col items-center gap-4 py-20 text-center w-full max-w-md px-6 z-10">
                        <div className="w-16 h-1 bg-white/20 rounded-none mb-2" />
                        <h2 className="text-white text-xl font-bold">Cảm ơn đã theo dõi!</h2>
                        <p className="text-slate-500 text-sm">Bạn đã đọc hết "{post.title}".</p>
                        <div className="flex gap-4 mt-4">
                            <Link
                                href="/#posts"
                                className="px-8 py-3 rounded-none bg-white text-black hover:bg-slate-200 text-sm font-bold transition-transform active:scale-95 shadow-lg shadow-white/5"
                            >
                                Quay lại trang chủ
                            </Link>
                        </div>
                    </div>
                </div>
            </main>

            {/* ── PROGRESS BAR (bottom) ── */}
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

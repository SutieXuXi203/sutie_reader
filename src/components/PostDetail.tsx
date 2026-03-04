'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { X, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { getOptimizedImageUrl } from '@/lib/utils';
interface Post {
    _id: string;
    title: string;
    description: string;
    content: string;
    images: string[];
    author: string;
    createdAt: string;
}
interface PostDetailProps {
    post: Post;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}
export function PostDetail({ post, open, onOpenChange }: PostDetailProps) {
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
        if (!open) {
            setCurrentPage(0);
            setShowUI(true);
            if (uiTimer.current) clearTimeout(uiTimer.current);
            return;
        }
        uiTimer.current = setTimeout(() => setShowUI(false), 3000);
        return () => { if (uiTimer.current) clearTimeout(uiTimer.current); };
    }, [open]);
    useEffect(() => {
        if (!open) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onOpenChange(false);
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [open, onOpenChange]);
    useEffect(() => {
        if (!open) return;
        const container = scrollRef.current;
        if (!container) return;
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const idx = imageRefs.current.findIndex((r) => r === entry.target);
                        if (idx !== -1) setCurrentPage(idx);
                    }
                });
            },
            { root: container, threshold: 0.4 }
        );
        imageRefs.current.forEach((ref) => { if (ref) observer.observe(ref); });
        return () => observer.disconnect();
    }, [open, post.images.length]);
    if (!open) return null;
    const total = post.images.length;
    const progress = total > 1 ? (currentPage / (total - 1)) * 100 : 100;
    return (
        <div className="fixed inset-0 z-50 bg-[#0a0000] flex flex-col" onMouseMove={resetUiTimer}>
            <div
                className={`absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3
          bg-gradient-to-b from-black/90 via-black/60 to-transparent transition-opacity duration-500
          ${showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 gradient-red rounded-none flex items-center justify-center flex-shrink-0 shadow-lg shadow-red-900/50">
                        <BookOpen className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-white font-bold text-sm leading-tight line-clamp-1 tracking-tight">{post.title}</p>
                        <p className="text-red-300/70 text-xs font-medium">{post.author}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-none">
                        <span className="text-red-300 text-xs font-bold tracking-wider">
                            {currentPage + 1}
                        </span>
                        <span className="text-white/30 text-xs">/</span>
                        <span className="text-white/50 text-xs font-medium">{total}</span>
                    </div>
                    <button
                        onClick={() => onOpenChange(false)}
                        className="w-8 h-8 rounded-none bg-white/10 hover:bg-red-600 text-white transition-all flex items-center justify-center hover:shadow-lg hover:shadow-red-900/30"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar"
            >
                <div className="flex flex-col items-center pt-14 pb-8 gap-0">
                    {post.images.map((img, idx) => (
                        <div
                            key={idx}
                            ref={(el) => { imageRefs.current[idx] = el; }}
                            className="w-full max-w-5xl relative"
                        >
                            <Image
                                src={getOptimizedImageUrl(img)}
                                alt={`Trang ${idx + 1}`}
                                width={800}
                                height={1200}
                                className="w-full h-auto block"
                                unoptimized
                                priority={idx === 0}
                            />
                        </div>
                    ))}
                    <div className="flex flex-col items-center gap-4 py-16 text-center">
                        <div className="w-16 h-px bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />
                        <div className="w-8 h-8 gradient-red rounded-none flex items-center justify-center shadow-lg shadow-red-900/40">
                            <BookOpen className="w-4 h-4 text-white" />
                        </div>
                        <p className="text-red-300/60 text-sm font-medium tracking-widest uppercase">Hết chương</p>
                        <div className="w-16 h-px bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />
                        <button
                            onClick={() => onOpenChange(false)}
                            className="mt-2 px-8 py-2.5 rounded-none gradient-red text-white text-sm font-bold transition-all hover:opacity-90 shadow-xl shadow-red-900/40 active:scale-95 cursor-pointer"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            </div>
            <div
                className={`absolute bottom-0 left-0 right-0 z-20 transition-opacity duration-500 ${showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            >
                <div className="flex justify-center pb-2">
                    <span className="text-[10px] text-white/30 font-medium tracking-widest uppercase">
                        {Math.round(progress)}% · Trang {currentPage + 1}/{total}
                    </span>
                </div>
                <div className="h-1 bg-white/10">
                    <div
                        className="h-full bg-gradient-to-r from-red-700 to-red-400 transition-all duration-300 shadow-sm shadow-red-500/50"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
        </div>
    );
}

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, BookOpen } from 'lucide-react';
import Image from 'next/image';

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

    // Track which image is in view
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

    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col" onMouseMove={resetUiTimer}>

            {/* ── TOP BAR ── */}
            <div
                className={`absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3
          bg-gradient-to-b from-black/90 to-transparent transition-opacity duration-500
          ${showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            >
                <div className="flex items-center gap-3">
                    <BookOpen className="w-5 h-5 text-orange-400 flex-shrink-0" />
                    <div className="min-w-0">
                        <p className="text-white font-semibold text-sm leading-tight line-clamp-1">{post.title}</p>
                        <p className="text-slate-400 text-xs">{post.author}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-orange-400 text-xs font-medium">
                        {currentPage + 1}/{total}
                    </span>
                    <button
                        onClick={() => onOpenChange(false)}
                        className="p-2 rounded-lg bg-white/10 hover:bg-red-500/80 text-white transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* ── SCROLL CONTAINER ── */}
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
                                src={img}
                                alt={`Trang ${idx + 1}`}
                                width={800}
                                height={1200}
                                className="w-full h-auto block"
                                unoptimized
                                priority={idx === 0}
                            />
                        </div>
                    ))}

                    {/* End of chapter */}
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                        <div className="w-12 h-0.5 bg-orange-400/60 rounded" />
                        <p className="text-slate-500 text-sm">Hết chương</p>
                        <button
                            onClick={() => onOpenChange(false)}
                            className="mt-2 px-6 py-2 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            </div>

            {/* ── PROGRESS BAR (bottom) ── */}
            <div
                className={`absolute bottom-0 left-0 right-0 z-20 transition-opacity duration-500 ${showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            >
                <div className="h-1 bg-white/10">
                    <div
                        className="h-full bg-orange-400 transition-all duration-300"
                        style={{ width: `${total > 1 ? (currentPage / (total - 1)) * 100 : 100}%` }}
                    />
                </div>
            </div>
        </div>
    );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, BookOpen, Lock, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PostCard } from '@/components/PostCard';
import { useAuth } from '@/providers/AuthContext';
import { AuthDialog } from '@/components/AuthDialog';
import { Input } from '@/components/ui/input';

interface Post {
    _id: string;
    title: string;
    description?: string;
    tags?: string[];
    content: string;
    images: string[];
    author: string;
    createdAt: string;
    updatedAt: string;
}

export default function ProductsPage() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
    const { user, isLoading: isAuthLoading } = useAuth();
    const searchParams = useSearchParams();

    const fetchPosts = async () => {
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
    };

    useEffect(() => {
        fetchPosts();
    }, []);

    useEffect(() => {
        const tagFromUrl = searchParams.get('tag');
        if (tagFromUrl) {
            setSearchTerm(tagFromUrl);
        }
    }, [searchParams]);

    const handlePostDeleted = (postId: string) => {
        setPosts((prev) => prev.filter((post) => post._id !== postId));
    };

    const normalizedSearch = searchTerm.trim().toLowerCase();
    const filteredPosts = normalizedSearch
        ? posts.filter((post) => [post.title, post.description || '', post.author, ...(post.tags || [])].some((value) => value.toLowerCase().includes(normalizedSearch)))
        : posts;

    return (
        <div className="min-h-screen bg-white dark:bg-[#0e0505] transition-colors pt-12 pb-20 md:py-20 px-8 lg:pl-32 lg:px-12">
            <div className="max-w-7xl mx-auto">
                <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="max-w-2xl">
                        <Link href="/" passHref>
                            <Button variant="ghost" size="sm" className="mb-4 -ml-4 text-red-400 dark:text-red-300 hover:text-red-600 dark:hover:text-red-100 rounded-[8px]">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Quay lại trang chủ
                            </Button>
                        </Link>
                        <h1 className="text-4xl md:text-5xl font-bold text-red-950 dark:text-red-50 flex items-center gap-3 tracking-tight">
                            <BookOpen className="w-10 h-10 text-red-500" />
                            Tất Cả Bài Viết
                        </h1>
                        <p className="text-red-600/60 dark:text-red-400/60 mt-4 text-lg">
                            Khám phá tất cả các bài viết và câu chuyện.
                        </p>
                    </div>

                    {user && (
                        <div className="w-full md:w-[280px] shrink-0">
                            <label
                                htmlFor="post-search"
                                className="block text-xs font-semibold tracking-wide uppercase text-red-500/80 dark:text-red-300/70 mb-2"
                            >
                                Tìm bài viết
                            </label>
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-red-400/80 dark:text-red-300/70 pointer-events-none" />
                                <Input
                                    id="post-search"
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Tìm theo tiêu đề, mô tả..."
                                    className="h-9 rounded-[8px] pl-9 pr-3 text-sm border-red-200/70 dark:border-red-900/60 bg-white/90 dark:bg-[#160808]/80 text-red-900 dark:text-red-100 placeholder:text-red-400/70 dark:placeholder:text-red-400/50 focus-visible:border-red-400 dark:focus-visible:border-red-500 focus-visible:ring-red-400/20 dark:focus-visible:ring-red-500/20"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {isLoading || isAuthLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="bg-red-50 dark:bg-red-900/20 rounded-none h-72 animate-pulse" />
                        ))}
                    </div>
                ) : !user ? (
                    <div className="flex flex-col items-center justify-center py-20 px-6 bg-white dark:bg-red-950/10 border border-dashed border-red-200 dark:border-red-900/30 rounded-none text-center">
                        <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-none flex items-center justify-center mb-6">
                            <Lock className="w-8 h-8 text-red-400" />
                        </div>
                        <h3 className="text-xl font-bold text-red-950 dark:text-red-100 mb-2">Nội dung đã bị khóa</h3>
                        <p className="text-red-600/60 dark:text-red-400/60 max-w-sm mb-8">
                            Bạn cần đăng nhập hoặc tạo tài khoản mới để có thể xem được danh sách tất cả các bài viết.
                        </p>
                        <Button
                            onClick={() => setIsAuthDialogOpen(true)}
                            className="rounded-[8px] px-8 gradient-red text-white hover:opacity-90 border-0 shadow-lg shadow-red-500/20 cursor-pointer"
                        >
                            Đăng nhập ngay
                        </Button>
                    </div>
                ) : posts.length === 0 ? (
                    <div className="text-center py-24 bg-white dark:bg-red-950/10 border border-dashed border-red-200 dark:border-red-900/30 rounded-none">
                        <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-none flex items-center justify-center mx-auto mb-4">
                            <BookOpen className="w-7 h-7 text-red-400" />
                        </div>
                        <p className="text-red-400/70 dark:text-red-500/60 text-lg">Chưa có bài viết nào</p>
                    </div>
                ) : filteredPosts.length === 0 ? (
                    <div className="text-center py-20 px-6 bg-white dark:bg-red-950/10 border border-dashed border-red-200 dark:border-red-900/30 rounded-[8px]">
                        <p className="text-red-500/80 dark:text-red-300/70 text-base">
                            Không tìm thấy bài viết phù hợp với từ khóa này.
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

            <AuthDialog
                open={isAuthDialogOpen}
                onOpenChange={setIsAuthDialogOpen}
            />
        </div>
    );
}

'use client';
import { useState, useEffect, useDeferredValue, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Lock, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PostCard } from '@/components/PostCard';
import { useAuth } from '@/providers/AuthContext';
import dynamic from 'next/dynamic';
import { Input } from '@/components/ui/input';
import { normalizeSearchText } from '@/lib/utils';
const AuthDialog = dynamic(() => import('@/components/AuthDialog').then(m => ({ default: m.AuthDialog })), { ssr: false });
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
    const [isSearchComposing, setIsSearchComposing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
    const { user, isLoading: isAuthLoading } = useAuth();
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
        const params = new URLSearchParams(window.location.search);
        const tagFromUrl = params.get('tag');
        if (tagFromUrl) {
            setSearchTerm(tagFromUrl);
        }
    }, []);
    const handlePostDeleted = (postId: string) => {
        setPosts((prev) => prev.filter((post) => post._id !== postId));
    };
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
    return (
        <div className="min-h-screen bg-background text-foreground transition-colors pt-12 pb-20 md:py-20 px-8 lg:pl-32 lg:px-12">
            <div className="max-w-7xl mx-auto">
                <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="max-w-2xl">
                        <Link href="/" passHref>
                            <Button variant="ghost" size="sm" className="mb-4 -ml-4 text-primary rounded-[8px] hover:bg-secondary transition-colors">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Quay lại trang chủ
                            </Button>
                        </Link>
                        <h1 className="text-4xl md:text-5xl font-bold text-foreground flex items-center gap-3 tracking-tight">
                            <BookOpen className="w-10 h-10 text-primary" />
                            Tất Cả Bài Viết
                        </h1>
                    </div>
                    {user && (
                        <div className="w-full md:w-[280px] shrink-0">
                            <label
                                htmlFor="post-search"
                                className="block text-xs font-bold tracking-wide uppercase text-muted-foreground mb-2"
                            >
                                Tìm bài viết
                            </label>
                            <div className="relative group">
                                <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-primary/90 transition-colors group-focus-within:text-primary">
                                    <Search className="w-4 h-4" />
                                </span>
                                <Input
                                    id="post-search"
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
                                    className="h-9 rounded-[8px] pl-10 pr-3 text-sm border-border bg-card/60 backdrop-blur-md text-foreground placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-primary/20 shadow-sm transition-all"
                                />
                            </div>
                        </div>
                    )}
                </div>
                {isLoading || isAuthLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="bg-card border border-border rounded-[8px] h-72 animate-pulse shadow-sm" />
                        ))}
                    </div>
                ) : !user ? (
                    <div className="flex flex-col items-center justify-center py-20 px-6 bg-card/50 backdrop-blur-md border border-border rounded-[8px] text-center shadow-lg group relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                        <div className="relative z-10 w-16 h-16 bg-background rounded-[8px] flex items-center justify-center mb-6 border border-border group-hover:scale-110 transition-transform duration-500 shadow-md">
                            <Lock className="w-8 h-8 text-primary group-hover:brightness-110 transition-colors" />
                        </div>
                        <h3 className="relative z-10 text-xl font-bold text-foreground mb-2">Nội dung đã bị khóa</h3>
                        <p className="relative z-10 text-muted-foreground max-w-sm mb-8">
                            Bạn cần đăng nhập hoặc tạo tài khoản mới để có thể xem được danh sách tất cả các bài viết.
                        </p>
                        <Button
                            onClick={() => setIsAuthDialogOpen(true)}
                            className="relative z-10 rounded-[8px] px-8 py-5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xl shadow-primary/20 text-base font-bold transition-all cursor-pointer"
                        >
                            Đăng nhập ngay
                        </Button>
                    </div>
                ) : posts.length === 0 ? (
                    <div className="text-center py-24 bg-card/30 backdrop-blur-sm border border-border rounded-[8px]">
                        <div className="w-16 h-16 bg-background border border-border rounded-[8px] flex items-center justify-center mx-auto mb-4 shadow-sm">
                            <BookOpen className="w-7 h-7 text-muted-foreground" />
                        </div>
                        <p className="text-foreground font-medium text-lg mb-1">Chưa có bài viết nào</p>
                    </div>
                ) : filteredPosts.length === 0 ? (
                    <div className="text-center py-20 px-6 bg-card/30 backdrop-blur-sm border border-border rounded-[8px]">
                        <p className="text-muted-foreground text-sm">
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

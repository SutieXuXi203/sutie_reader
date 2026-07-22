'use client';
import { useState, useEffect, useDeferredValue, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Lock, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PostCard } from '@/components/PostCard';
import { useAuth } from '@/providers/AuthContext';
import dynamic from 'next/dynamic';
import { Input } from '@/components/ui/input';
import { normalizeSearchText } from '@/lib/utils';
import { Footer } from '@/components/Footer';

const AuthDialog = dynamic(() => import('@/components/AuthDialog').then(m => ({ default: m.AuthDialog })), { ssr: false });
const CreatePostForm = dynamic(() => import('@/components/CreatePostForm').then(m => ({ default: m.CreatePostForm })), { ssr: false });

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
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const { user, isLoading: isAuthLoading, isAdmin } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isAuthLoading && !isAdmin) {
            router.replace('/');
        }
    }, [isAuthLoading, isAdmin, router]);


    
    const [standaloneTags, setStandaloneTags] = useState<{ _id: string, name: string }[]>([]);

    const fetchTags = async () => {
        try {
            const response = await fetch('/api/tags');
            if (response.ok) {
                setStandaloneTags(await response.json());
            }
        } catch (error) {
            console.error('Lỗi khi tải tags:', error);
        }
    };

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
        fetchTags();
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

    const availableTags = useMemo(() => {
        const postTags = posts.flatMap((post) => post.tags || []);
        const standaloneNames = standaloneTags.map(t => t.name);
        return Array.from(new Set([...postTags, ...standaloneNames])).filter(Boolean);
    }, [posts, standaloneTags]);

    if (isAuthLoading || !isAdmin) {
        return (
            <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground transition-colors pt-20 pb-0 flex flex-col justify-between">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1">
                
                {/* Posts Card Wrapper */}
                <div className="border border-border rounded-[8px] bg-card/40 p-5 md:p-6 shadow-sm mt-8">
                    
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4 border-b border-border/50 pb-4">
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-1">Danh mục</h3>
                            <h2 className="text-base sm:text-lg font-extrabold text-foreground">Quản lý danh sách</h2>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                            {user && (
                                <div className="w-full sm:w-[240px] shrink-0">
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
                                            className="h-8 rounded-[8px] pl-10 pr-3 text-xs border-border bg-card/60 backdrop-blur-md text-foreground placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-primary/20 shadow-sm transition-all"
                                        />
                                    </div>
                                </div>
                            )}

                            {isAdmin && (
                                <Button
                                    onClick={() => setIsCreateDialogOpen(true)}
                                    size="sm"
                                    className="rounded-[8px] flex items-center gap-1 bg-primary text-primary-foreground hover:bg-primary/90 border border-primary/20 text-[10px] h-8 font-bold w-full sm:w-auto justify-center"
                                >
                                    <Plus className="w-3 h-3" />
                                    Tạo bài viết
                                </Button>
                            )}
                        </div>
                    </div>

                    {isLoading || isAuthLoading ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4 animate-pulse">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className="bg-card border border-border rounded-[8px] h-56 sm:h-64 animate-pulse shadow-sm" />
                            ))}
                        </div>
                    ) : !user ? (
                        <div className="flex flex-col items-center justify-center py-20 px-6 bg-card/50 backdrop-blur-md border border-border rounded-[8px] text-center shadow-lg group relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                            <div className="relative z-10 w-16 h-16 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                                <Lock className="w-8 h-8 text-primary group-hover:brightness-110 transition-colors group-hover:animate-bounce" />
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
                    ) : filteredPosts.length === 0 ? (
                        <div className="text-center py-20 px-6 bg-card/30 backdrop-blur-sm border border-border rounded-[8px]">
                            <p className="text-muted-foreground text-sm">
                                Không tìm thấy bài viết phù hợp với từ khóa này.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
                            {filteredPosts.map((post) => (
                                <PostCard
                                    key={post._id}
                                    post={post}
                                    onDelete={handlePostDeleted}
                                    onUpdate={fetchPosts}
                                    compact
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
            
            <AuthDialog
                open={isAuthDialogOpen}
                onOpenChange={setIsAuthDialogOpen}
            />
            
            <CreatePostForm
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
                onPostCreated={fetchPosts}
                availableTags={availableTags}
            />

            <Footer />
        </div>
    );
}

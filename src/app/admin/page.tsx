'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, LayoutDashboard, FileText, ArrowLeft, Home, Loader2, Search } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { CreatePostForm } from '@/components/CreatePostForm';
import { EditPostForm } from '@/components/EditPostForm';
import { Input } from '@/components/ui/input';

interface Post {
    _id: string;
    title: string;
    description: string;
    content: string;
    images: string[];
    author: string;
    createdAt: string;
}

export default function AdminDashboard() {
    const { user, isAdmin, isLoading: isAuthLoading } = useAuth();
    const router = useRouter();
    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);

    useEffect(() => {
        if (!isAuthLoading) {
            if (!user || user.role !== 'admin') {
                router.push('/');
            } else {
                fetchPosts();
            }
        }
    }, [user, isAdmin, isAuthLoading]);

    const fetchPosts = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/posts');
            if (res.ok) {
                const data = await res.json();
                setPosts(data);
            }
        } catch (error) {
            console.error('Error fetching posts:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (postId: string) => {
        if (!confirm('Bạn có chắc chắn muốn xóa bài viết này không?')) return;

        try {
            const res = await fetch(`/api/posts/${postId}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                setPosts(posts.filter(p => p._id !== postId));
            } else {
                alert('Xóa thất bại');
            }
        } catch (error) {
            console.error('Error deleting post:', error);
        }
    };

    const filteredPosts = posts.filter(post =>
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.author.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isAuthLoading || !user || user.role !== 'admin') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
            {/* Simple Sidebar */}
            <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hidden lg:flex flex-col">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2 font-bold text-xl tracking-tighter">
                        <div className="w-8 h-8 bg-slate-900 dark:bg-white rounded-lg flex items-center justify-center text-white dark:text-black">
                            <LayoutDashboard className="w-5 h-5" />
                        </div>
                        <span>Admin Panel</span>
                    </div>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    <Link
                        href="/"
                        className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                    >
                        <Home className="w-5 h-5" />
                        <span>Trang chủ</span>
                    </Link>
                    <Link
                        href="/admin"
                        className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-medium shadow-sm transition-all"
                    >
                        <FileText className="w-5 h-5" />
                        <span>Bài viết</span>
                    </Link>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                {/* Header */}
                <header className="h-20 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 sm:px-10 flex items-center justify-between sticky top-0 z-10">
                    <div className="lg:hidden">
                        <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tighter">
                            <LayoutDashboard className="w-6 h-6" />
                            <span>Admin</span>
                        </Link>
                    </div>
                    <div className="hidden lg:block">
                        <h1 className="text-xl font-bold">Quản lý bài viết</h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <Button
                            onClick={() => setIsCreateDialogOpen(true)}
                            className="rounded-full bg-slate-900 dark:bg-white text-white dark:text-black hover:opacity-90 px-6"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Tạo bài mới
                        </Button>
                    </div>
                </header>

                <div className="p-6 sm:p-10 space-y-8 max-w-7xl mx-auto">
                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <p className="text-sm font-medium text-slate-500 mb-1">Tổng bài viết</p>
                            <h3 className="text-3xl font-bold">{posts.length}</h3>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <p className="text-sm font-medium text-slate-500 mb-1">Tác giả</p>
                            <h3 className="text-3xl font-bold">1</h3>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <p className="text-sm font-medium text-slate-500 mb-1">Trạng thái</p>
                            <div className="flex items-center gap-2 mt-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-sm font-semibold">Hoạt động</span>
                            </div>
                        </div>
                    </div>

                    {/* Table Area */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div className="relative w-full sm:w-96">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Tìm kiếm bài viết..."
                                    className="pl-10 h-10 border-slate-200 dark:border-slate-800 rounded-xl"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-slate-800/50">
                                    <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        <th className="px-6 py-4">Bài viết</th>
                                        <th className="px-6 py-4">Tác giả</th>
                                        <th className="px-6 py-4">Ngày tạo</th>
                                        <th className="px-6 py-4 text-right">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                                                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                                Đang tải dữ liệu...
                                            </td>
                                        </tr>
                                    ) : filteredPosts.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                                                {searchQuery ? 'Không tìm thấy kết quả nào' : 'Chưa có bài viết nào'}
                                            </td>
                                        </tr>
                                    ) : filteredPosts.map((post) => (
                                        <tr key={post._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0">
                                                        {post.images[0] ? (
                                                            <Image src={post.images[0]} alt={post.title} fill className="object-cover" unoptimized />
                                                        ) : (
                                                            <FileText className="w-6 h-6 m-3 text-slate-400" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 max-w-[240px] sm:max-w-xs">
                                                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{post.title}</p>
                                                        <p className="text-xs text-slate-500 truncate">{post.description}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                {post.author}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                {new Date(post.createdAt).toLocaleDateString('vi-VN')}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => { setSelectedPost(post); setIsEditOpen(true); }}
                                                        className="p-2 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                                                        title="Chỉnh sửa"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(post._id)}
                                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                                                        title="Xóa"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>

            {/* Forms */}
            <CreatePostForm
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
                onPostCreated={fetchPosts}
            />
            {selectedPost && (
                <EditPostForm
                    post={selectedPost as any}
                    open={isEditOpen}
                    onOpenChange={setIsEditOpen}
                    onPostUpdated={() => { setIsEditOpen(false); fetchPosts(); }}
                />
            )}
        </div>
    );
}

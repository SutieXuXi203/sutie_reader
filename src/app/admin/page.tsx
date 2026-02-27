'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, FileText, Home, Loader2, Search, Users, ShieldAlert, User } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { CreatePostForm } from '@/components/CreatePostForm';
import { EditPostForm } from '@/components/EditPostForm';
import { Input } from '@/components/ui/input';
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

export default function AdminDashboard() {
    const { user, isAdmin, isLoading: isAuthLoading } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'posts' | 'users'>('posts');
    const [posts, setPosts] = useState<Post[]>([]);
    const [usersList, setUsersList] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUsersLoading, setIsUsersLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [sessionSeconds, setSessionSeconds] = useState(0);

    useEffect(() => {
        if (!user) return;
        const start = Date.now();
        const timer = setInterval(() => setSessionSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
        return () => clearInterval(timer);
    }, [user?.email]);

    const formatSessionTime = (sec: number) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        if (!isAuthLoading) {
            if (!user || user.role !== 'admin') {
                router.push('/');
            } else {
                fetchPosts();
                fetchUsers();
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

    const fetchUsers = async () => {
        setIsUsersLoading(true);
        try {
            const res = await fetch('/api/admin/users');
            if (res.ok) {
                const data = await res.json();
                setUsersList(data);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setIsUsersLoading(false);
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

    const handleDeleteUser = async (userId: string, email: string) => {
        if (email === user?.email) {
            alert('Bạn không thể xóa tài khoản của chính mình.');
            return;
        }
        if (!confirm('Bạn có chắc chắn muốn xóa người dùng này không? Hành động này không thể hoàn tác.')) return;

        try {
            const res = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                setUsersList(usersList.filter(u => u._id !== userId));
            } else {
                const data = await res.json();
                alert(data.error || 'Xóa thất bại');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('Đã xảy ra lỗi mạng');
        }
    };

    const filteredPosts = posts.filter(post =>
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.author.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredUsers = usersList.filter(u =>
        u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isAuthLoading || !user || user.role !== 'admin') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex font-sans selection:bg-slate-200 dark:selection:bg-slate-800">
            {/* Sidebar */}
            <aside className="w-56 bg-white dark:bg-slate-900 hidden lg:flex flex-col border-r border-slate-200 dark:border-slate-800 z-20">
                <div className="p-6">
                    <h2 className="font-semibold text-lg text-slate-800 dark:text-slate-200">Quản trị</h2>
                </div>
                <nav className="flex-1 px-3 space-y-0.5">
                    <Link
                        href="/"
                        className="flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    >
                        <Home className="w-5 h-5" />
                        <span>Trang chủ</span>
                    </Link>
                    <button
                        onClick={() => setActiveTab('posts')}
                        className={`w-full flex items-center justify-start gap-3 px-3 py-2.5 rounded-[8px] font-medium transition-colors cursor-pointer ${activeTab === 'posts' ? 'bg-slate-800 dark:bg-slate-700 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'}`}
                    >
                        <FileText className="w-5 h-5" />
                        <span>Bài viết</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`w-full flex items-center justify-start gap-3 px-3 py-2.5 rounded-[8px] font-medium transition-colors cursor-pointer ${activeTab === 'users' ? 'bg-slate-800 dark:bg-slate-700 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'}`}
                    >
                        <Users className="w-5 h-5" />
                        <span>Người dùng</span>
                    </button>
                </nav>
                {/* Tài khoản đang hoạt động */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800">
                    <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-2">Tài khoản đang hoạt động</p>
                    <div className="flex items-center gap-3 p-3 rounded-[8px] bg-slate-50 dark:bg-slate-800/50">
                        <div className="relative w-10 h-10 rounded-[8px] overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0">
                            {user.avatar ? (
                                <Image src={getOptimizedImageUrl(user.avatar)} alt={user.name || 'Avatar'} fill className="object-cover" unoptimized />
                            ) : (
                                <User className="w-5 h-5 m-2.5 text-slate-400" />
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{user.name || 'Quản trị viên'}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                            <p className="text-xs font-mono text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">{formatSessionTime(sessionSeconds)}</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-950">
                {/* Header */}
                <header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 sm:px-10 flex items-center justify-between sticky top-0 z-10">
                    <div className="flex items-center gap-6">
                        <div className="lg:hidden">
                            <Link href="/" className="text-base font-medium text-slate-700 dark:text-slate-300">Quản trị</Link>
                        </div>
                        <div className="hidden lg:flex items-center gap-4">
                            <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                                {activeTab === 'posts' ? 'Quản lý bài viết' : 'Quản lý người dùng'}
                            </h1>
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-slate-100 dark:bg-slate-800">
                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Tài khoản đang hoạt động</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="lg:hidden flex items-center gap-2 px-3 py-2 rounded-[8px] bg-slate-100 dark:bg-slate-800">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-[120px]">{user.email}</span>
                        </div>
                        {activeTab === 'posts' && (
                            <Button
                                onClick={() => setIsCreateDialogOpen(true)}
                                className="rounded-[8px] bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-700 dark:hover:bg-slate-600 px-5 h-10 font-medium transition-colors"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Tạo bài mới
                            </Button>
                        )}
                    </div>
                </header>

                <div className="p-6 sm:p-10 space-y-6 max-w-6xl mx-auto">
                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {(activeTab === 'posts' ? [
                            { label: 'Tổng bài viết', value: posts.length },
                            { label: 'Tác giả', value: '1' },
                            { label: 'Trạng thái', value: 'Hoạt động' }
                        ] : [
                            { label: 'Tổng người dùng', value: usersList.length },
                            { label: 'Quản trị viên', value: usersList.filter(u => u.role === 'admin').length },
                            { label: 'Người dùng', value: usersList.filter(u => u.role !== 'admin').length }
                        ]).map((stat, i) => (
                            <div key={i} className="bg-white dark:bg-slate-900 p-5 rounded-[8px] border border-slate-200 dark:border-slate-800">
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">{stat.label}</p>
                                {typeof stat.value === 'number' ? (
                                    <p className="text-2xl font-semibold text-slate-800 dark:text-slate-200">{stat.value}</p>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                        <span className="text-base font-medium text-slate-800 dark:text-slate-200">{stat.value}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Table Area */}
                    <div className="bg-white dark:bg-slate-900 rounded-[8px] border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800">
                            <div className="relative w-full sm:w-[400px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder={activeTab === 'posts' ? "Tìm bài viết, tác giả..." : "Tìm tên, email..."}
                                    className="pl-10 h-10 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-[8px] focus-visible:ring-1 focus-visible:ring-slate-400 text-sm"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            {activeTab === 'posts' ? (
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="text-xs font-medium text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                                            <th className="px-5 py-4 text-left">Bài viết</th>
                                            <th className="px-5 py-4 text-left">Tác giả</th>
                                            <th className="px-5 py-4 text-left">Ngày tạo</th>
                                            <th className="px-5 py-4 text-right">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                        {isLoading ? (
                                            <tr>
                                                <td colSpan={4} className="px-5 py-16 text-center text-slate-500">
                                                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
                                                    <p className="text-sm">Đang tải...</p>
                                                </td>
                                            </tr>
                                        ) : filteredPosts.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-5 py-16 text-center text-slate-500">
                                                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                                    <p className="text-sm">{searchQuery ? 'Không tìm thấy' : 'Chưa có bài viết'}</p>
                                                </td>
                                            </tr>
                                        ) : filteredPosts.map((post) => (
                                            <tr key={post._id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="relative w-12 h-12 rounded-[8px] overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                                                            {post.images[0] ? (
                                                                <Image src={getOptimizedImageUrl(post.images[0])} alt={post.title} fill className="object-cover" unoptimized />
                                                            ) : (
                                                                <FileText className="w-6 h-6 m-3 text-slate-400" />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 max-w-xs">
                                                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{post.title}</p>
                                                            <p className="text-xs text-slate-500 truncate mt-0.5">{post.description}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-400">{post.author}</td>
                                                <td className="px-5 py-4 text-sm text-slate-500 whitespace-nowrap">
                                                    {new Date(post.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => { setSelectedPost(post); setIsEditOpen(true); }}
                                                            className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-[8px] transition-colors"
                                                            title="Chỉnh sửa"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(post._id)}
                                                            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-[8px] transition-colors"
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
                            ) : (
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="text-xs font-medium text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                                            <th className="px-5 py-4 text-left">Người dùng</th>
                                            <th className="px-5 py-4 text-left">Email</th>
                                            <th className="px-5 py-4 text-left">Vai trò</th>
                                            <th className="px-5 py-4 text-left">Thời gian hoạt động</th>
                                            <th className="px-5 py-4 text-left">Ngày tham gia</th>
                                            <th className="px-5 py-4 text-right">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                        {isUsersLoading ? (
                                            <tr>
                                                <td colSpan={6} className="px-5 py-16 text-center text-slate-500">
                                                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
                                                    <p className="text-sm">Đang tải...</p>
                                                </td>
                                            </tr>
                                        ) : filteredUsers.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-5 py-16 text-center text-slate-500">
                                                    <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                                    <p className="text-sm">{searchQuery ? 'Không tìm thấy' : 'Chưa có người dùng'}</p>
                                                </td>
                                            </tr>
                                        ) : filteredUsers.map((u) => (
                                            <tr key={u._id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative shrink-0">
                                                            <div className="relative w-10 h-10 rounded-[8px] overflow-hidden bg-slate-100 dark:bg-slate-800">
                                                                {u.avatar ? (
                                                                    <Image src={getOptimizedImageUrl(u.avatar)} alt={u.name || 'Avatar'} fill className="object-cover" unoptimized />
                                                                ) : (
                                                                    <User className="w-5 h-5 m-2.5 text-slate-400" />
                                                                )}
                                                            </div>
                                                            {u.email === user?.email ? (
                                                                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" title="Tài khoản đang đăng nhập" />
                                                            ) : (
                                                                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-slate-400 ring-2 ring-white dark:ring-slate-900" title="Không hoạt động" />
                                                            )}
                                                        </div>
                                                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate max-w-[150px]">{u.name || 'Ẩn danh'}</p>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-400">{u.email}</td>
                                                <td className="px-5 py-4">
                                                    {u.role === 'admin' ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                                            <ShieldAlert className="w-3 h-3" /> Quản trị
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex px-2.5 py-1 rounded-[8px] text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                            Người dùng
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 text-sm whitespace-nowrap">
                                                    {u.email === user?.email ? (
                                                        <span className="font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">{formatSessionTime(sessionSeconds)}</span>
                                                    ) : (
                                                        <span className="text-slate-400">—</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 text-sm text-slate-500 whitespace-nowrap">
                                                    {new Date(u.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex justify-end">
                                                        <button
                                                            onClick={() => handleDeleteUser(u._id, u.email)}
                                                            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-[8px] transition-colors"
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
                            )}
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

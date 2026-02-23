'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, LayoutDashboard, FileText, ArrowLeft, Home, Loader2, Search, Users, ShieldAlert } from 'lucide-react';
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
    const [activeTab, setActiveTab] = useState<'posts' | 'users'>('posts');
    const [posts, setPosts] = useState<Post[]>([]);
    const [usersList, setUsersList] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUsersLoading, setIsUsersLoading] = useState(false);
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
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex font-sans selection:bg-slate-200 dark:selection:bg-slate-800">
            {/* Simple Sidebar */}
            <aside className="w-56 bg-white dark:bg-slate-900 hidden lg:flex flex-col shadow-2xl shadow-slate-200/50 dark:shadow-none z-20">
                <div className="p-8">
                    <div className="flex items-center gap-3 font-bold text-2xl tracking-tighter">
                        <span>Quản trị viên</span>
                    </div>
                </div>
                <nav className="flex-1 px-4 space-y-1.5">
                    <Link
                        href="/"
                        className="flex items-center gap-3 px-4 py-3 rounded-none text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition-all group cursor-pointer"
                    >
                        <Home className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        <span>Trang chủ</span>
                    </Link>
                    <button
                        onClick={() => setActiveTab('posts')}
                        className={`w-full flex items-center justify-start gap-3 px-4 py-3 rounded-none font-semibold transition-all cursor-pointer ${activeTab === 'posts' ? 'bg-slate-900 dark:bg-white text-white dark:text-black shadow-xl shadow-slate-900/20 dark:shadow-white/10' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'}`}
                    >
                        <FileText className="w-5 h-5" />
                        <span>Bài viết</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`w-full flex items-center justify-start gap-3 px-4 py-3 rounded-none font-semibold transition-all cursor-pointer ${activeTab === 'users' ? 'bg-slate-900 dark:bg-white text-white dark:text-black shadow-xl shadow-slate-900/20 dark:shadow-white/10' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'}`}
                    >
                        <Users className="w-5 h-5" />
                        <span>Người dùng</span>
                    </button>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950/40">
                {/* Header */}
                <header className="h-24 bg-transparent px-6 sm:px-12 flex items-center justify-between sticky top-0 z-10">
                    <div className="lg:hidden">
                        <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tighter">
                            <span>Quản trị viên</span>
                        </Link>
                    </div>
                    <div className="hidden lg:block">
                        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                            {activeTab === 'posts' ? 'Quản lý bài viết' : 'Quản lý người dùng'}
                        </h1>
                        <p className="text-sm text-slate-500 font-medium">Chào mừng bạn trở lại, Quản trị viên</p>
                    </div>

                    <div className="flex items-center gap-4">
                        {activeTab === 'posts' && (
                            <Button
                                onClick={() => setIsCreateDialogOpen(true)}
                                className="rounded-none bg-slate-900 dark:bg-white text-white dark:text-black hover:opacity-90 px-8 h-12 font-bold shadow-lg shadow-slate-900/20 dark:shadow-white/10 transition-all active:scale-95"
                            >
                                <Plus className="w-5 h-5 mr-2" />
                                Tạo bài mới
                            </Button>
                        )}
                    </div>
                </header>

                <div className="p-8 sm:p-12 space-y-12 max-w-7xl mx-auto">
                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {(activeTab === 'posts' ? [
                            { label: 'Tổng bài viết', value: posts.length, color: 'bg-slate-900 dark:bg-white' },
                            { label: 'Tác giả', value: '1', color: 'bg-slate-100 dark:bg-slate-800' },
                            { label: 'Trạng thái', value: 'Hoạt động', color: 'bg-slate-100 dark:bg-slate-800' }
                        ] : [
                            { label: 'Tổng người dùng', value: usersList.length, color: 'bg-slate-900 dark:bg-white' },
                            { label: 'Quản trị viên', value: usersList.filter(u => u.role === 'admin').length, color: 'bg-slate-100 dark:bg-slate-800' },
                            { label: 'Người dùng', value: usersList.filter(u => u.role !== 'admin').length, color: 'bg-slate-100 dark:bg-slate-800' }
                        ]).map((stat, i) => (
                            <div key={i} className="bg-white dark:bg-slate-900 p-8 rounded-none shadow-xl shadow-slate-200/50 dark:shadow-none transition-all hover:scale-[1.02] cursor-default">
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">{stat.label}</p>
                                {typeof stat.value === 'number' ? (
                                    <h3 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter">{stat.value}</h3>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-none bg-green-500 animate-pulse" />
                                        <span className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{stat.value}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Table Area */}
                    <div className="bg-white dark:bg-slate-900 rounded-none shadow-2xl shadow-slate-200/60 dark:shadow-none overflow-hidden">
                        <div className="p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                            <div className="relative w-full sm:w-[450px] group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-slate-900 dark:group-focus-within:text-white transition-colors" />
                                <Input
                                    placeholder={activeTab === 'posts' ? "Tìm kiếm bài viết, tác giả..." : "Tìm kiếm tên, email..."}
                                    className="pl-12 h-14 bg-slate-50 dark:bg-slate-800/50 border-none rounded-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-white transition-all text-base font-medium"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            {activeTab === 'posts' ? (
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50/50 dark:bg-slate-800/30">
                                        <tr className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
                                            <th className="px-8 py-6">Bài viết</th>
                                            <th className="px-8 py-6">Tác giả</th>
                                            <th className="px-8 py-6">Ngày tạo</th>
                                            <th className="px-8 py-6 text-right">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                        {isLoading ? (
                                            <tr>
                                                <td colSpan={4} className="px-8 py-20 text-center text-slate-400">
                                                    <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-slate-200" />
                                                    <p className="font-semibold tracking-tight">Đang tải dữ liệu của bạn...</p>
                                                </td>
                                            </tr>
                                        ) : filteredPosts.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-8 py-20 text-center text-slate-400">
                                                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                                    <p className="font-semibold tracking-tight">{searchQuery ? 'Không tìm thấy kết quả nào' : 'Chưa có bài viết nào'}</p>
                                                </td>
                                            </tr>
                                        ) : filteredPosts.map((post) => (
                                            <tr key={post._id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all duration-300">
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-5">
                                                        <div className="relative w-16 h-16 rounded-none overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow">
                                                            {post.images[0] ? (
                                                                <Image src={post.images[0]} alt={post.title} fill className="object-cover group-hover:scale-110 transition-transform duration-500" unoptimized />
                                                            ) : (
                                                                <FileText className="w-8 h-8 m-4 text-slate-300" />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 max-w-[280px] sm:max-w-md">
                                                            <p className="text-base font-bold text-slate-900 dark:text-white truncate group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">{post.title}</p>
                                                            <p className="text-sm text-slate-400 font-medium truncate mt-0.5">{post.description}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-sm font-bold text-slate-500 dark:text-slate-400">
                                                    {post.author}
                                                </td>
                                                <td className="px-8 py-6 text-sm font-semibold text-slate-400 dark:text-slate-500 whitespace-nowrap">
                                                    {new Date(post.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0">
                                                        <button
                                                            onClick={() => { setSelectedPost(post); setIsEditOpen(true); }}
                                                            className="p-3 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 rounded-none shadow-none hover:shadow-lg transition-all"
                                                            title="Chỉnh sửa bài viết"
                                                        >
                                                            <Pencil className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(post._id)}
                                                            className="p-3 text-slate-400 hover:text-red-500 hover:bg-white dark:hover:bg-slate-800 rounded-none shadow-none hover:shadow-lg transition-all"
                                                            title="Xóa bài viết"
                                                        >
                                                            <Trash2 className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50/50 dark:bg-slate-800/30">
                                        <tr className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
                                            <th className="px-8 py-6">Người dùng</th>
                                            <th className="px-8 py-6">Email</th>
                                            <th className="px-8 py-6">Vai trò</th>
                                            <th className="px-8 py-6">Ngày tham gia</th>
                                            <th className="px-8 py-6 text-right">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                        {isUsersLoading ? (
                                            <tr>
                                                <td colSpan={5} className="px-8 py-20 text-center text-slate-400">
                                                    <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-slate-200" />
                                                    <p className="font-semibold tracking-tight">Đang tải dữ liệu của bạn...</p>
                                                </td>
                                            </tr>
                                        ) : filteredUsers.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-8 py-20 text-center text-slate-400">
                                                    <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                                    <p className="font-semibold tracking-tight">{searchQuery ? 'Không tìm thấy người dùng nào' : 'Chưa có người dùng nào'}</p>
                                                </td>
                                            </tr>
                                        ) : filteredUsers.map((u) => (
                                            <tr key={u._id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all duration-300">
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-5">
                                                        <div className="relative w-12 h-12 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0 shadow-sm">
                                                            {u.avatar ? (
                                                                <Image src={u.avatar} alt={u.name || 'Avatar'} fill className="object-cover" unoptimized />
                                                            ) : (
                                                                <Users className="w-6 h-6 m-3 text-slate-300" />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 max-w-[200px] sm:max-w-xs">
                                                            <p className="text-base font-bold text-slate-900 dark:text-white truncate">{u.name || 'Ẩn danh'}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-sm font-semibold text-slate-500 dark:text-slate-400">
                                                    {u.email}
                                                </td>
                                                <td className="px-8 py-6">
                                                    {u.role === 'admin' ? (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                                                            <ShieldAlert className="w-3.5 h-3.5" /> Quản trị viên
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                                            Người dùng
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-8 py-6 text-sm font-semibold text-slate-400 dark:text-slate-500 whitespace-nowrap">
                                                    {new Date(u.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0">
                                                        <button
                                                            onClick={() => handleDeleteUser(u._id, u.email)}
                                                            className="p-3 text-slate-400 hover:text-red-500 hover:bg-white dark:hover:bg-slate-800 rounded-none shadow-none hover:shadow-lg transition-all"
                                                            title="Xóa người dùng"
                                                        >
                                                            <Trash2 className="w-5 h-5" />
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

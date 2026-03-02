'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/providers/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, FileText, Home, Loader2, Search, Users, ShieldAlert, User, Tag } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { CreatePostForm } from '@/components/CreatePostForm';
import { EditPostForm } from '@/components/EditPostForm';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { Input } from '@/components/ui/input';
import { getOptimizedImageUrl } from '@/lib/utils';

interface Post {
    _id: string;
    title: string;
    description?: string;
    tags?: string[];
    content: string;
    images: string[];
    author: string;
    createdAt: string;
}

interface AdminUser {
    _id: string;
    email: string;
    name?: string;
    role?: string;
    avatar?: string;
    createdAt: string;
}

export default function AdminDashboard() {
    const { user, isAdmin, isLoading: isAuthLoading } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'posts' | 'users' | 'tags'>('posts');
    const [posts, setPosts] = useState<Post[]>([]);
    const [usersList, setUsersList] = useState<AdminUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUsersLoading, setIsUsersLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [sessionSeconds, setSessionSeconds] = useState(0);
    const [deleteTarget, setDeleteTarget] = useState<
        | { type: 'post'; id: string; title: string }
        | { type: 'user'; id: string; email: string }
        | { type: 'tag'; id: string; name: string }
        | null
    >(null);
    const [isDeletingTarget, setIsDeletingTarget] = useState(false);

    // Tag management state
    const [standaloneTags, setStandaloneTags] = useState<{ _id: string, name: string }[]>([]);
    const [editingTag, setEditingTag] = useState<{ oldName: string, newName: string } | null>(null);
    const [isUpdatingTag, setIsUpdatingTag] = useState(false);
    const [newTagName, setNewTagName] = useState('');
    const [isCreatingTag, setIsCreatingTag] = useState(false);

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
                fetchTags();
            }
        }
    }, [user, isAdmin, isAuthLoading]);

    const fetchTags = async () => {
        try {
            const res = await fetch('/api/tags');
            if (res.ok) {
                const data = await res.json();
                setStandaloneTags(data);
            }
        } catch (error) {
            console.error('Error fetching tags:', error);
        }
    };

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

    const handleDelete = (post: Post) => {
        setDeleteTarget({
            type: 'post',
            id: post._id,
            title: post.title,
        });
    };

    const handleDeleteUser = (targetUser: AdminUser) => {
        if (targetUser.email === user?.email) {
            alert('Bạn không thể xóa tài khoản của chính mình.');
            return;
        }

        setDeleteTarget({
            type: 'user',
            id: targetUser._id,
            email: targetUser.email,
        });
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;

        setIsDeletingTarget(true);
        try {
            if (deleteTarget.type === 'post') {
                const res = await fetch(`/api/posts/${deleteTarget.id}`, {
                    method: 'DELETE',
                });

                if (res.ok) {
                    setPosts((prev) => prev.filter((p) => p._id !== deleteTarget.id));
                    setDeleteTarget(null);
                } else {
                    alert('Xóa thất bại');
                }
            } else if (deleteTarget.type === 'user') {
                const res = await fetch(`/api/admin/users/${deleteTarget.id}`, {
                    method: 'DELETE',
                });

                if (res.ok) {
                    setUsersList((prev) => prev.filter((u) => u._id !== deleteTarget.id));
                    setDeleteTarget(null);
                } else {
                    const data = await res.json();
                    alert(data.error || 'Xóa thất bại');
                }
            } else if (deleteTarget.type === 'tag') {
                const res = await fetch(`/api/tags?tag=${encodeURIComponent(deleteTarget.id)}`, {
                    method: 'DELETE',
                });

                if (res.ok) {
                    await fetchPosts(); // Refresh posts to reflect removed tag
                    await fetchTags(); // Refresh standalone tags
                    setDeleteTarget(null);
                } else {
                    const data = await res.json();
                    alert(data.error || 'Xóa tag thất bại');
                }
            }
        } catch (error) {
            console.error('Error deleting target:', error);
            alert('Đã xảy ra lỗi mạng');
        } finally {
            setIsDeletingTarget(false);
        }
    };

    const handleUpdateTag = async () => {
        if (!editingTag || !editingTag.newName.trim()) return;
        if (editingTag.oldName === editingTag.newName.trim()) {
            setEditingTag(null);
            return;
        }

        setIsUpdatingTag(true);
        try {
            const res = await fetch('/api/tags', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    oldTag: editingTag.oldName,
                    newTag: editingTag.newName.trim()
                })
            });

            if (res.ok) {
                await fetchPosts();
                await fetchTags();
                setEditingTag(null);
            } else {
                const data = await res.json();
                alert(data.error || 'Cập nhật tag thất bại');
            }
        } catch (error) {
            console.error('Lỗi khi sửa tag:', error);
            alert('Đã xảy ra lỗi mạng');
        } finally {
            setIsUpdatingTag(false);
        }
    }

    const handleCreateTag = async (e: React.FormEvent) => {
        e.preventDefault();
        const tagValue = newTagName.trim();
        if (!tagValue) return;

        setIsCreatingTag(true);
        try {
            const res = await fetch('/api/tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: tagValue })
            });

            if (res.ok) {
                setNewTagName('');
                await fetchTags();
            } else {
                const data = await res.json();
                alert(data.error || 'Tạo tag thất bại');
            }
        } catch (error) {
            console.error('Lỗi khi tạo tag:', error);
            alert('Đã xảy ra lỗi mạng');
        } finally {
            setIsCreatingTag(false);
        }
    };

    const availablePostTags = useMemo(() => {
        const postTags = posts.flatMap((post) => (post.tags || []).map((tag) => tag.trim().toLowerCase()).filter(Boolean));
        const standaloneNames = standaloneTags.map(t => t.name.trim().toLowerCase()).filter(Boolean);

        return Array.from(new Set([...postTags, ...standaloneNames]))
            .sort((a, b) => a.localeCompare(b, 'vi'));
    }, [posts, standaloneTags]);

    const tagCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        posts.forEach(post => {
            (post.tags || []).forEach(tag => {
                const normalized = tag.trim().toLowerCase();
                if (normalized) {
                    counts[normalized] = (counts[normalized] || 0) + 1;
                }
            });
        });
        return counts;
    }, [posts]);

    const filteredPosts = posts.filter(post =>
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (post.tags || []).some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
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
                    <button
                        onClick={() => setActiveTab('tags')}
                        className={`w-full flex items-center justify-start gap-3 px-3 py-2.5 rounded-[8px] font-medium transition-colors cursor-pointer ${activeTab === 'tags' ? 'bg-slate-800 dark:bg-slate-700 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'}`}
                    >
                        <Tag className="w-5 h-5" />
                        <span>Quản lý Tag</span>
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
                                {activeTab === 'posts' ? 'Quản lý bài viết' : activeTab === 'users' ? 'Quản lý người dùng' : 'Quản lý thẻ Tag'}
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
                    {activeTab !== 'tags' && (
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
                    )}

                    {/* Tags List */}
                    {activeTab === 'posts' && availablePostTags.length > 0 && (
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-[8px] border border-slate-200 dark:border-slate-800">
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                                <Tag className="w-4 h-4 text-slate-400" />
                                Danh sách Tag đã sử dụng ({availablePostTags.length})
                            </h3>
                            <div className="flex flex-wrap gap-2 mt-3">
                                {availablePostTags.map((tag) => (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => setSearchQuery(tag)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-medium bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
                                        title={`Lọc bài viết theo thẻ: ${tag}`}
                                    >
                                        #{tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Table Area */}
                    <div className="bg-white dark:bg-slate-900 rounded-[8px] border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800">
                            <div className="relative w-full sm:w-[400px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder={activeTab === 'posts' ? "Tìm bài viết, tác giả, tag..." : activeTab === 'users' ? "Tìm tên, email..." : "Tìm thẻ tag..."}
                                    className="pl-10 h-10 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-[8px] focus-visible:ring-1 focus-visible:ring-slate-400 text-sm"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            {activeTab === 'tags' && (
                                <form onSubmit={handleCreateTag} className="flex gap-2 w-full sm:w-auto">
                                    <Input
                                        placeholder="Tên tag mới..."
                                        value={newTagName}
                                        onChange={e => setNewTagName(e.target.value)}
                                        className="h-10 text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-[8px] transition-colors"
                                        disabled={isCreatingTag}
                                        maxLength={30}
                                    />
                                    <Button type="submit" disabled={isCreatingTag || !newTagName.trim()} className="h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[8px] font-medium shadow-sm transition-all duration-200 ease-in-out hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
                                        {isCreatingTag ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1.5" /><span>Thêm</span></>}
                                    </Button>
                                </form>
                            )}
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
                                                            {post.tags && post.tags.length > 0 ? (
                                                                <div className="mt-1 flex flex-wrap gap-1">
                                                                    {post.tags.slice(0, 3).map((tag) => (
                                                                        <span
                                                                            key={`${post._id}-${tag}`}
                                                                            className="inline-flex rounded-[8px] border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-500 dark:text-slate-300"
                                                                        >
                                                                            #{tag.toLowerCase()}
                                                                        </span>
                                                                    ))}
                                                                    {post.tags.length > 3 && (
                                                                        <span className="inline-flex rounded-[8px] border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">
                                                                            +{post.tags.length - 3}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs text-slate-400 mt-0.5">Chưa gắn tag</p>
                                                            )}
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
                                                            className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-[8px] transition-colors cursor-pointer"
                                                            title="Chỉnh sửa"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(post)}
                                                            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-[8px] transition-colors cursor-pointer"
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
                            ) : activeTab === 'users' ? (
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
                                                            onClick={() => handleDeleteUser(u)}
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
                            ) : activeTab === 'tags' ? (
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="text-xs font-medium text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                                            <th className="px-5 py-4 text-left">Tên thẻ (Tag)</th>
                                            <th className="px-5 py-4 text-left">Số bài viết đang sử dụng</th>
                                            <th className="px-5 py-4 text-right">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                        {availablePostTags
                                            .filter(tag => tag.includes(searchQuery.toLowerCase()))
                                            .map((tag) => (
                                                <tr key={tag} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                                    <td className="px-5 py-4">
                                                        {editingTag?.oldName === tag ? (
                                                            <div className="flex items-center gap-2">
                                                                <Input
                                                                    value={editingTag.newName}
                                                                    onChange={(e) => setEditingTag({ ...editingTag, newName: e.target.value })}
                                                                    className="h-8 text-sm"
                                                                    autoFocus
                                                                    disabled={isUpdatingTag}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-sm font-medium bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                                #{tag}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                        {tagCounts[tag] || 0} bài viết
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <div className="flex justify-end gap-2">
                                                            {editingTag?.oldName === tag ? (
                                                                <>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        className="h-8 rounded-[8px]"
                                                                        onClick={() => setEditingTag(null)}
                                                                        disabled={isUpdatingTag}
                                                                    >
                                                                        Hủy
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        className="h-8 rounded-[8px]"
                                                                        onClick={handleUpdateTag}
                                                                        disabled={isUpdatingTag}
                                                                    >
                                                                        {isUpdatingTag ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lưu'}
                                                                    </Button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <button
                                                                        onClick={() => setEditingTag({ oldName: tag, newName: tag })}
                                                                        className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-[8px] transition-colors"
                                                                        title="Sửa tên tag trên toàn bộ bài viết"
                                                                    >
                                                                        <Pencil className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setDeleteTarget({ type: 'tag', id: tag, name: tag })}
                                                                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-[8px] transition-colors"
                                                                        title="Xóa tag khỏi toàn bộ bài viết"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            ) : null}
                        </div>
                    </div>
                </div>
            </main >

            {/* Forms */}
            < CreatePostForm
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
                onPostCreated={fetchPosts}
                availableTags={availablePostTags}
            />
            {selectedPost && (
                <EditPostForm
                    post={selectedPost}
                    open={isEditOpen}
                    onOpenChange={setIsEditOpen}
                    onPostUpdated={() => { setIsEditOpen(false); fetchPosts(); }}
                    availableTags={availablePostTags}
                />
            )
            }
            <DeleteConfirmDialog
                open={!!deleteTarget}
                onOpenChange={(open) => {
                    if (!open && !isDeletingTarget) {
                        setDeleteTarget(null);
                    }
                }}
                onConfirm={handleConfirmDelete}
                isLoading={isDeletingTarget}
                title={deleteTarget?.type === 'user' ? 'Xóa người dùng?' : deleteTarget?.type === 'post' ? 'Xóa bài viết?' : 'Xóa thẻ tag?'}
                description={
                    deleteTarget?.type === 'user'
                        ? `Bạn có chắc chắn muốn xóa người dùng "${deleteTarget.email}"? Hành động này không thể hoàn tác.`
                        : deleteTarget?.type === 'post'
                            ? `Bạn có chắc chắn muốn xóa bài viết "${deleteTarget?.title || ''}"? Hành động này không thể hoàn tác.`
                            : `Bạn có chắc muốn xóa thẻ tag "#${deleteTarget?.name || ''}" khỏi toàn bộ ${tagCounts[deleteTarget?.name || ''] || 0} bài viết? Hành động này không thể hoàn tác.`
                }
                confirmLabel={isDeletingTarget ? 'Đang xóa...' : 'Xóa'}
            />
        </div >
    );
}

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
import { notify } from '@/lib/notify';
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
    isVerified?: boolean;
    createdAt: string;
}

interface DeletedAccountRecord {
    _id: string;
    email: string;
    name?: string;
    role?: 'user' | 'admin';
    verificationExpiresAt?: string;
    deletionReason: 'unverified_expired_24h';
    deletionTrigger: 'login' | 'verify';
    deletedAt: string;
}

const ROWS_PER_PAGE = 5;

export default function AdminDashboard() {
    const { user, isLoading: isAuthLoading } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'posts' | 'users' | 'tags'>('posts');
    const [posts, setPosts] = useState<Post[]>([]);
    const [usersList, setUsersList] = useState<AdminUser[]>([]);
    const [deletedAccounts, setDeletedAccounts] = useState<DeletedAccountRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUsersLoading, setIsUsersLoading] = useState(false);
    const [isDeletedAccountsLoading, setIsDeletedAccountsLoading] = useState(false);
    const [usersPage, setUsersPage] = useState(1);
    const [deletedAccountsPage, setDeletedAccountsPage] = useState(1);
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
    }, [user]);
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
                fetchDeletedAccounts();
                fetchTags();
            }
        }
    }, [user, isAuthLoading, router]);

    useEffect(() => {
        if (activeTab === 'users') {
            setUsersPage(1);
            setDeletedAccountsPage(1);
        }
    }, [searchQuery, activeTab]);
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
    const fetchDeletedAccounts = async () => {
        setIsDeletedAccountsLoading(true);
        try {
            const res = await fetch('/api/admin/deleted-accounts?limit=200');
            if (res.ok) {
                const data = await res.json();
                setDeletedAccounts(data);
            }
        } catch (error) {
            console.error('Error fetching deleted accounts:', error);
        } finally {
            setIsDeletedAccountsLoading(false);
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
            notify.warning('Bạn không thể xóa tài khoản của chính mình.');
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
                    notify.success('Đã xóa bài viết');
                    setDeleteTarget(null);
                } else {
                    notify.error('Xóa thất bại');
                }
            } else if (deleteTarget.type === 'user') {
                const res = await fetch(`/api/admin/users/${deleteTarget.id}`, {
                    method: 'DELETE',
                });
                if (res.ok) {
                    setUsersList((prev) => prev.filter((u) => u._id !== deleteTarget.id));
                    notify.success('Đã xóa người dùng');
                    setDeleteTarget(null);
                } else {
                    const data = await res.json();
                    notify.error(data.error || 'Xóa thất bại');
                }
            } else if (deleteTarget.type === 'tag') {
                const res = await fetch(`/api/tags?tag=${encodeURIComponent(deleteTarget.id)}`, {
                    method: 'DELETE',
                });
                if (res.ok) {
                    await fetchPosts();
                    await fetchTags();
                    notify.success(`Đã xóa tag #${deleteTarget.name}`);
                    setDeleteTarget(null);
                } else {
                    const data = await res.json();
                    notify.error(data.error || 'Xóa tag thất bại');
                }
            }
        } catch (error) {
            console.error('Error deleting target:', error);
            notify.error('Đã xảy ra lỗi mạng');
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
                notify.error(data.error || 'Cập nhật tag thất bại');
            }
        } catch (error) {
            console.error('Lỗi khi sửa tag:', error);
            notify.error('Đã xảy ra lỗi mạng');
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
                notify.error(data.error || 'Tạo tag thất bại');
            }
        } catch (error) {
            console.error('Lỗi khi tạo tag:', error);
            notify.error('Đã xảy ra lỗi mạng');
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
    const filteredUsers = usersList.filter(u => {
        const normalizedQuery = searchQuery.toLowerCase();
        const verificationLabel = u.role === 'admin'
            ? 'miễn xác thực'
            : (Boolean(u.isVerified) ? 'đã xác thực' : 'chưa xác thực');
        return (
            u.name?.toLowerCase().includes(normalizedQuery) ||
            u.email?.toLowerCase().includes(normalizedQuery) ||
            verificationLabel.includes(normalizedQuery)
        );
    });
    const filteredDeletedAccounts = deletedAccounts.filter((account) => {
        const normalizedQuery = searchQuery.toLowerCase();
        const triggerLabel = account.deletionTrigger === 'verify'
            ? 'xac thuc xác thực'
            : 'dang nhap đăng nhập';
        const reasonLabel = account.deletionReason === 'unverified_expired_24h'
            ? 'chua xac thuc qua han 24 gio chưa xác thực quá hạn 24 giờ'
            : account.deletionReason;
        return (
            account.name?.toLowerCase().includes(normalizedQuery) ||
            account.email?.toLowerCase().includes(normalizedQuery) ||
            triggerLabel.includes(normalizedQuery) ||
            reasonLabel.includes(normalizedQuery)
        );
    });

    const totalUsersPages = Math.max(1, Math.ceil(filteredUsers.length / ROWS_PER_PAGE));
    const totalDeletedAccountsPages = Math.max(1, Math.ceil(filteredDeletedAccounts.length / ROWS_PER_PAGE));

    const paginatedUsers = filteredUsers.slice(
        (usersPage - 1) * ROWS_PER_PAGE,
        usersPage * ROWS_PER_PAGE
    );
    const paginatedDeletedAccounts = filteredDeletedAccounts.slice(
        (deletedAccountsPage - 1) * ROWS_PER_PAGE,
        deletedAccountsPage * ROWS_PER_PAGE
    );

    useEffect(() => {
        if (usersPage > totalUsersPages) {
            setUsersPage(totalUsersPages);
        }
    }, [usersPage, totalUsersPages]);

    useEffect(() => {
        if (deletedAccountsPage > totalDeletedAccountsPages) {
            setDeletedAccountsPage(totalDeletedAccountsPages);
        }
    }, [deletedAccountsPage, totalDeletedAccountsPages]);

    if (isAuthLoading || !user || user.role !== 'admin') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }
    return (
        <div className="min-h-screen [scrollbar-gutter:stable] bg-background font-sans selection:bg-primary/20">
            <div className="mx-auto flex w-full max-w-[1600px] gap-4 px-4 py-4">
            <aside className="hidden lg:flex w-56 shrink-0 self-start lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto rounded-[10px] border border-border/70 bg-card/60 backdrop-blur-md flex-col z-20">
                <div className="p-6">
                    <h2 className="font-semibold text-lg text-foreground">Quản trị</h2>
                </div>
                <nav className="px-3 pb-3 space-y-0.5">
                    <Link
                        href="/"
                        className="flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-foreground/90 hover:bg-secondary hover:text-primary transition-colors cursor-pointer"
                    >
                        <Home className="w-5 h-5" />
                        <span>Trang chủ</span>
                    </Link>
                    <button
                        onClick={() => setActiveTab('posts')}
                        className={`w-full flex items-center justify-start gap-3 px-3 py-2.5 rounded-[8px] font-medium transition-colors cursor-pointer ${activeTab === 'posts' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-foreground/90 hover:bg-secondary hover:text-primary'}`}
                    >
                        <FileText className="w-5 h-5" />
                        <span>Bài viết</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('tags')}
                        className={`w-full flex items-center justify-start gap-3 px-3 py-2.5 rounded-[8px] font-medium transition-colors cursor-pointer ${activeTab === 'tags' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-foreground/90 hover:bg-secondary hover:text-primary'}`}
                    >
                        <Tag className="w-5 h-5" />
                        <span>Quản lý Tag</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`w-full flex items-center justify-start gap-3 px-3 py-2.5 rounded-[8px] font-medium transition-colors cursor-pointer ${activeTab === 'users' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-foreground/90 hover:bg-secondary hover:text-primary'}`}
                    >
                        <Users className="w-5 h-5" />
                        <span>Người dùng</span>
                    </button>
                </nav>
                <div className="p-4 border-t border-border/70">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Tài khoản đang hoạt động</p>
                    <div className="flex items-center gap-3 p-3 rounded-[8px] bg-secondary/70 dark:bg-primary/10">
                        <div className="relative w-10 h-10 rounded-[8px] overflow-hidden bg-secondary shrink-0">
                            {user.avatar ? (
                                <Image src={getOptimizedImageUrl(user.avatar)} alt={user.name || 'Avatar'} fill className="object-cover" unoptimized />
                            ) : (
                                <User className="w-5 h-5 m-2.5 text-primary/80" />
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">{user.name || 'Quản trị viên'}</p>
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                            <p className="text-xs font-mono text-primary mt-1 tabular-nums">{formatSessionTime(sessionSeconds)}</p>
                        </div>
                    </div>
                </div>
            </aside>
            <main className="flex-1 min-w-0 min-h-[calc(100vh-2rem)] rounded-[10px] border border-border/70 bg-card/35 shadow-sm">
                <header className="h-20 bg-card/55 backdrop-blur-md border-b border-border/70 px-6 sm:px-8 lg:px-10 flex items-center justify-between sticky top-0 z-10 rounded-t-[10px]">
                    <div className="flex items-center gap-6">
                        <div className="lg:hidden">
                            <Link href="/" className="text-base font-medium text-neutral-800 dark:text-neutral-200">Quản trị</Link>
                        </div>
                        <div className="hidden lg:flex items-center gap-4">
                            <h1 className="text-lg font-semibold text-foreground">
                                {activeTab === 'posts' ? 'Quản lý bài viết' : activeTab === 'users' ? 'Quản lý người dùng' : 'Quản lý thẻ Tag'}
                            </h1>
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-card">
                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span className="text-xs font-medium text-muted-foreground">Tài khoản đang hoạt động</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="lg:hidden flex items-center gap-2 px-3 py-2 rounded-[8px] bg-card">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-xs text-muted-foreground truncate max-w-[120px]">{user.email}</span>
                        </div>
                        {activeTab === 'posts' && (
                            <Button
                                onClick={() => setIsCreateDialogOpen(true)}
                                className="rounded-[8px] bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 px-5 h-10 font-medium transition-colors"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Tạo bài mới
                            </Button>
                        )}
                    </div>
                </header>
                <div className="p-6 sm:p-8 lg:p-10 space-y-6">
                    {activeTab !== 'tags' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {(activeTab === 'posts' ? [
                                { label: 'Tổng bài viết', value: posts.length },
                                { label: 'Tác giả', value: '1' },
                                { label: 'Trạng thái', value: 'Hoạt động' }
                            ] : [
                                { label: 'Tổng người dùng', value: usersList.length },
                                { label: 'Quản trị viên', value: usersList.filter(u => u.role === 'admin').length },
                                { label: 'Người dùng', value: usersList.filter(u => u.role !== 'admin').length },
                            ]).map((stat, i) => (
                                <div key={i} className="bg-card/50 backdrop-blur-md p-5 rounded-[8px] border border-border shadow-md">
                                    <p className="text-xs font-medium text-muted-foreground mb-2">{stat.label}</p>
                                    {typeof stat.value === 'number' ? (
                                        <p className="text-2xl font-semibold text-foreground">{stat.value}</p>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                            <span className="text-base font-medium text-foreground">{stat.value}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                    {activeTab === 'posts' && availablePostTags.length > 0 && (
                        <div className="bg-card/50 backdrop-blur-md p-5 rounded-[8px] border border-border shadow-md">
                            <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-3 flex items-center gap-2">
                                <Tag className="w-4 h-4 text-primary" />
                                Danh sách Tag đã sử dụng ({availablePostTags.length})
                            </h3>
                            <div className="flex flex-wrap gap-2 mt-3">
                                {availablePostTags.map((tag) => (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => setSearchQuery(tag)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-medium bg-card text-primary border border-border hover:border-primary/60 dark:hover:border-primary/75 hover:text-primary transition-colors cursor-pointer"
                                        title={`Lọc bài viết theo thẻ: ${tag}`}
                                    >
                                        #{tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className={activeTab === 'users' ? 'space-y-4' : 'bg-card/50 backdrop-blur-md rounded-[8px] border border-border overflow-hidden'}>
                        <div className={activeTab === 'users'
                            ? 'p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 rounded-[8px] border border-border bg-card/50 backdrop-blur-md'
                            : 'p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border'}>
                            <div className="relative w-full sm:w-[400px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/70 dark:text-neutral-300" />
                                <Input
                                    placeholder={activeTab === 'posts' ? "Tìm bài viết, tác giả, tag..." : activeTab === 'users' ? "Tìm tên, email..." : "Tìm thẻ tag..."}
                                    className="pl-10 h-10 bg-background border border-border rounded-[8px] focus-visible:ring-1 focus-visible:ring-primary text-sm text-foreground placeholder:text-foreground/90 dark:placeholder:text-neutral-300"
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
                                        className="h-10 text-sm bg-background border-border focus-visible:ring-0 focus-visible:ring-offset-0 rounded-[8px] transition-colors text-foreground placeholder:text-foreground/90 dark:placeholder:text-neutral-300"
                                        disabled={isCreatingTag}
                                        maxLength={30}
                                    />
                                    <Button type="submit" disabled={isCreatingTag || !newTagName.trim()} className="h-10 px-5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 rounded-[8px] font-medium shadow-sm transition-all duration-200 ease-in-out hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
                                        {isCreatingTag ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1.5" /><span>Thêm</span></>}
                                    </Button>
                                </form>
                            )}
                        </div>
                        <div className="w-full">
                            {activeTab === 'posts' ? (
                                <div className="min-h-[560px] lg:min-h-[680px] overflow-x-auto">
                                <table className="w-full text-center">
                                    <thead>
                                        <tr className="text-xs font-medium text-muted-foreground border-b border-border">
                                            <th className="px-5 py-4 text-center border-r border-border/60 last:border-r-0">Bài viết</th>
                                            <th className="px-5 py-4 text-center border-r border-border/60 last:border-r-0">Tác giả</th>
                                            <th className="px-5 py-4 text-center border-r border-border/60 last:border-r-0">Ngày tạo</th>
                                            <th className="px-5 py-4 text-center border-r border-border/60 last:border-r-0">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {isLoading ? (
                                            <tr>
                                                <td colSpan={4} className="px-5 py-16 text-center text-neutral-500">
                                                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
                                                    <p className="text-sm">Đang tải...</p>
                                                </td>
                                            </tr>
                                        ) : filteredPosts.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-5 py-16 text-center text-neutral-500">
                                                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                                    <p className="text-sm">{searchQuery ? 'Không tìm thấy' : 'Chưa có bài viết'}</p>
                                                </td>
                                            </tr>
                                        ) : filteredPosts.map((post) => (
                                            <tr key={post._id} className="group hover:bg-secondary/70 dark:hover:bg-primary/10 transition-colors">
                                                <td className="px-5 py-4 border-r border-border/40 last:border-r-0">
                                                    <div className="flex items-center justify-center gap-4">
                                                        <div className="relative w-12 h-12 rounded-[8px] overflow-hidden bg-card shrink-0">
                                                            {post.images[0] ? (
                                                                <Image src={getOptimizedImageUrl(post.images[0])} alt={post.title} fill className="object-cover" unoptimized />
                                                            ) : (
                                                                <FileText className="w-6 h-6 m-3 text-primary/80" />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 max-w-xs">
                                                            <p className="text-sm font-medium text-foreground truncate">{post.title}</p>
                                                            {post.tags && post.tags.length > 0 ? (
                                                                <div className="mt-1 flex flex-wrap gap-1">
                                                                    {post.tags.slice(0, 3).map((tag) => (
                                                                        <span
                                                                            key={`${post._id}-${tag}`}
                                                                            className="inline-flex rounded-[8px] border border-border px-1.5 py-0.5 text-[10px] text-primary"
                                                                        >
                                                                            #{tag.toLowerCase()}
                                                                        </span>
                                                                    ))}
                                                                    {post.tags.length > 3 && (
                                                                        <span className="inline-flex rounded-[8px] border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground/80">
                                                                            +{post.tags.length - 3}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs text-muted-foreground/80 mt-0.5">Chưa gắn tag</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-sm text-foreground/90 text-center border-r border-border/40 last:border-r-0">{post.author}</td>
                                                <td className="px-5 py-4 text-sm text-muted-foreground text-center whitespace-nowrap border-r border-border/40 last:border-r-0">
                                                    {new Date(post.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                </td>
                                                <td className="px-5 py-4 border-r border-border/40 last:border-r-0">
                                                    <div className="flex justify-center gap-2">
                                                        <button
                                                            onClick={() => { setSelectedPost(post); setIsEditOpen(true); }}
                                                            className="p-2 text-foreground/85 hover:text-primary dark:hover:text-primary/80 hover:bg-secondary/80 rounded-[8px] transition-colors cursor-pointer"
                                                            title="Chỉnh sửa"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(post)}
                                                            className="p-2 text-foreground/85 hover:text-primary hover:bg-secondary/80 rounded-[8px] transition-colors cursor-pointer"
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
                            ) : activeTab === 'users' ? (
                                <div className="w-full min-h-[560px] lg:min-h-[680px] space-y-4 pb-4">
                                    <div className="rounded-[8px] border border-border/60 bg-card/30 shadow-sm overflow-hidden">
                                        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
                                            <p className="text-sm font-semibold text-foreground">Tài khoản hiện tại</p>
                                            <span className="text-xs text-muted-foreground">{filteredUsers.length} tài khoản</span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-center">
                                                <thead>
                                                    <tr className="text-xs font-medium text-muted-foreground border-b border-border bg-secondary/20">
                                                        <th className="px-5 py-4 text-center border-r border-border/60 last:border-r-0">Người dùng</th>
                                                        <th className="px-5 py-4 text-center border-r border-border/60 last:border-r-0">Email</th>
                                                        <th className="px-5 py-4 text-center border-r border-border/60 last:border-r-0">Vai trò</th>
                                                        <th className="px-5 py-4 text-center border-r border-border/60 last:border-r-0">Xác thực</th>
                                                        <th className="px-5 py-4 text-center border-r border-border/60 last:border-r-0">Thời gian hoạt động</th>
                                                        <th className="px-5 py-4 text-center border-r border-border/60 last:border-r-0">Ngày tham gia</th>
                                                        <th className="px-5 py-4 text-center border-r border-border/60 last:border-r-0">Thao tác</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border">
                                                    {isUsersLoading ? (
                                                        <tr>
                                                            <td colSpan={7} className="px-5 py-12 text-center text-neutral-500">
                                                                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
                                                                <p className="text-sm">Đang tải...</p>
                                                            </td>
                                                        </tr>
                                                    ) : filteredUsers.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={7} className="px-5 py-12 text-center text-neutral-500">
                                                                <Users className="w-10 h-10 mx-auto mb-3 text-foreground/55" />
                                                                <p className="text-sm">{searchQuery ? 'Không tìm thấy' : 'Chưa có người dùng'}</p>
                                                            </td>
                                                        </tr>
                                                    ) : paginatedUsers.map((u) => {
                                                        const isAdminUser = u.role === 'admin';
                                                        const isVerified = Boolean(u.isVerified);
                                                        return (
                                                            <tr key={u._id} className="group hover:bg-secondary/70 dark:hover:bg-primary/10 transition-colors">
                                                                <td className="px-5 py-4 text-left border-r border-border/40 last:border-r-0">
                                                                    <div className="flex items-center justify-start gap-3">
                                                                        <div className="relative shrink-0">
                                                                            <div className="relative w-10 h-10 rounded-[8px] overflow-hidden bg-card">
                                                                                {u.avatar ? (
                                                                                    <Image src={getOptimizedImageUrl(u.avatar)} alt={u.name || 'Avatar'} fill className="object-cover" unoptimized />
                                                                                ) : (
                                                                                    <User className="w-5 h-5 m-2.5 text-primary/80" />
                                                                                )}
                                                                            </div>
                                                                            {u.email === user?.email ? (
                                                                                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-background" title="Tài khoản đang đăng nhập" />
                                                                            ) : (
                                                                                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-neutral-300 dark:bg-neutral-600 ring-2 ring-white dark:ring-background" title="Không hoạt động" />
                                                                            )}
                                                                        </div>
                                                                        <p className="text-sm font-medium text-foreground truncate max-w-[150px]">{u.name || 'Ẩn danh'}</p>
                                                                    </div>
                                                                </td>
                                                                <td className="px-5 py-4 text-sm text-foreground/90 text-left border-r border-border/40 last:border-r-0">{u.email}</td>
                                                                <td className="px-5 py-4 text-center border-r border-border/40 last:border-r-0">
                                                                    {u.role === 'admin' ? (
                                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-xs font-medium bg-secondary text-primary">
                                                                            <ShieldAlert className="w-3 h-3" /> Quản trị
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex px-2.5 py-1 rounded-[8px] text-xs font-medium bg-neutral-100 dark:bg-neutral-800/50 text-muted-foreground">
                                                                            Người dùng
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="px-5 py-4 text-center border-r border-border/40 last:border-r-0">
                                                                    {isAdminUser ? (
                                                                        <span className="inline-flex px-2.5 py-1 rounded-[8px] text-xs font-medium border border-sky-300/60 dark:border-sky-700/60 bg-sky-100/70 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300">
                                                                            Miễn xác thực
                                                                        </span>
                                                                    ) : isVerified ? (
                                                                        <span className="inline-flex px-2.5 py-1 rounded-[8px] text-xs font-medium border border-emerald-300/60 dark:border-emerald-700/60 bg-emerald-100/70 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                                                                            Đã xác thực
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex px-2.5 py-1 rounded-[8px] text-xs font-medium border border-amber-300/60 dark:border-amber-700/60 bg-amber-100/70 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                                                                            Chưa xác thực
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="px-5 py-4 text-sm text-center whitespace-nowrap border-r border-border/40 last:border-r-0">
                                                                    {u.email === user?.email ? (
                                                                        <span className="inline-flex items-center rounded-[8px] border border-emerald-300/60 dark:border-emerald-700/60 bg-emerald-100/70 dark:bg-emerald-900/30 px-2.5 py-1 text-xs font-semibold font-mono text-emerald-700 dark:text-emerald-300 tabular-nums">
                                                                            {formatSessionTime(sessionSeconds)}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center rounded-[8px] border border-border/70 bg-card/40 px-2.5 py-1 text-xs font-medium text-foreground/75 dark:text-neutral-300">
                                                                            Chưa hoạt động
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="px-5 py-4 text-sm text-muted-foreground text-center whitespace-nowrap border-r border-border/40 last:border-r-0">
                                                                    {new Date(u.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                                </td>
                                                                <td className="px-5 py-4 border-r border-border/40 last:border-r-0">
                                                                    <div className="flex justify-center">
                                                                        <button
                                                                            onClick={() => handleDeleteUser(u)}
                                                                            className="p-2 text-foreground/85 hover:text-primary hover:bg-secondary/80 rounded-[8px] transition-colors"
                                                                            title="Xóa"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                        {filteredUsers.length > 0 && (
                                            <div className="px-5 py-3 border-t border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                                <p className="text-xs text-muted-foreground">
                                                    Trang {usersPage}/{totalUsersPages} • Hiển thị {paginatedUsers.length}/{filteredUsers.length} tài khoản
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 rounded-[8px]"
                                                        onClick={() => setUsersPage((prev) => Math.max(1, prev - 1))}
                                                        disabled={usersPage === 1}
                                                    >
                                                        Trước
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 rounded-[8px]"
                                                        onClick={() => setUsersPage((prev) => Math.min(totalUsersPages, prev + 1))}
                                                        disabled={usersPage === totalUsersPages}
                                                    >
                                                        Sau
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="rounded-[8px] border border-border/60 bg-card/30 shadow-sm overflow-hidden">
                                        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
                                            <p className="text-sm font-semibold text-foreground">Tài khoản bị xóa tự động (chưa xác thực)</p>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-muted-foreground">{filteredDeletedAccounts.length} tài khoản</span>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 rounded-[8px]"
                                                    onClick={fetchDeletedAccounts}
                                                    disabled={isDeletedAccountsLoading}
                                                >
                                                    {isDeletedAccountsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Làm mới'}
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-center">
                                                <thead>
                                                    <tr className="text-xs font-medium text-muted-foreground border-b border-border bg-secondary/20">
                                                        <th className="px-5 py-4 text-center border-r border-border/60 last:border-r-0">Tài khoản</th>
                                                        <th className="px-5 py-4 text-center border-r border-border/60 last:border-r-0">Email</th>
                                                        <th className="px-5 py-4 text-center border-r border-border/60 last:border-r-0">Nguồn xóa</th>
                                                        <th className="px-5 py-4 text-center border-r border-border/60 last:border-r-0">Lý do</th>
                                                        <th className="px-5 py-4 text-center border-r border-border/60 last:border-r-0">Hạn xác thực</th>
                                                        <th className="px-5 py-4 text-center border-r border-border/60 last:border-r-0">Thời điểm xóa</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border">
                                                    {isDeletedAccountsLoading ? (
                                                        <tr>
                                                            <td colSpan={6} className="px-5 py-12 text-center text-foreground/80">
                                                                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
                                                                <p className="text-sm">Đang tải...</p>
                                                            </td>
                                                        </tr>
                                                    ) : filteredDeletedAccounts.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={6} className="px-5 py-12 text-center text-foreground/80">
                                                                <Users className="w-10 h-10 mx-auto mb-3 text-foreground/55" />
                                                                <p className="text-sm">{searchQuery ? 'Không tìm thấy' : 'Chưa có tài khoản bị xóa tự động'}</p>
                                                            </td>
                                                        </tr>
                                                    ) : paginatedDeletedAccounts.map((account) => (
                                                        <tr key={account._id} className="group hover:bg-secondary/70 dark:hover:bg-primary/10 transition-colors">
                                                            <td className="px-5 py-4 text-sm font-medium text-foreground border-r border-border/40 last:border-r-0">
                                                                {account.name || 'Ẩn danh'}
                                                            </td>
                                                            <td className="px-5 py-4 text-sm text-foreground/90 border-r border-border/40 last:border-r-0">
                                                                {account.email}
                                                            </td>
                                                            <td className="px-5 py-4 text-center border-r border-border/40 last:border-r-0">
                                                                <span className="inline-flex px-2.5 py-1 rounded-[8px] text-xs font-medium bg-neutral-100 dark:bg-neutral-800/50 text-muted-foreground">
                                                                    {account.deletionTrigger === 'verify' ? 'Xác thực' : 'Đăng nhập'}
                                                                </span>
                                                            </td>
                                                            <td className="px-5 py-4 text-center border-r border-border/40 last:border-r-0">
                                                                <span className="inline-flex px-2.5 py-1 rounded-[8px] text-xs font-medium border border-amber-300/60 dark:border-amber-700/60 bg-amber-100/70 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                                                                    Chưa xác thực quá hạn 24h
                                                                </span>
                                                            </td>
                                                            <td className="px-5 py-4 text-sm text-muted-foreground text-center whitespace-nowrap border-r border-border/40 last:border-r-0">
                                                                {account.verificationExpiresAt
                                                                    ? new Date(account.verificationExpiresAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                                                    : '--'}
                                                            </td>
                                                            <td className="px-5 py-4 text-sm text-muted-foreground text-center whitespace-nowrap border-r border-border/40 last:border-r-0">
                                                                {new Date(account.deletedAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        {filteredDeletedAccounts.length > 0 && (
                                            <div className="px-5 py-3 border-t border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                                <p className="text-xs text-muted-foreground">
                                                    Trang {deletedAccountsPage}/{totalDeletedAccountsPages} • Hiển thị {paginatedDeletedAccounts.length}/{filteredDeletedAccounts.length} tài khoản
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 rounded-[8px]"
                                                        onClick={() => setDeletedAccountsPage((prev) => Math.max(1, prev - 1))}
                                                        disabled={deletedAccountsPage === 1}
                                                    >
                                                        Trước
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 rounded-[8px]"
                                                        onClick={() => setDeletedAccountsPage((prev) => Math.min(totalDeletedAccountsPages, prev + 1))}
                                                        disabled={deletedAccountsPage === totalDeletedAccountsPages}
                                                    >
                                                        Sau
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : activeTab === 'tags' ? (
                                <div className="min-h-[560px] lg:min-h-[680px] overflow-x-auto">
                                <table className="w-full text-center">
                                    <thead>
                                        <tr className="text-xs font-medium text-muted-foreground border-b border-border">
                                            <th className="px-5 py-4 text-center border-r border-border/60 last:border-r-0">Tên thẻ (Tag)</th>
                                            <th className="px-5 py-4 text-center border-r border-border/60 last:border-r-0">Số bài viết đang sử dụng</th>
                                            <th className="px-5 py-4 text-center border-r border-border/60 last:border-r-0">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {availablePostTags
                                            .filter(tag => tag.includes(searchQuery.toLowerCase()))
                                            .map((tag) => (
                                                <tr key={tag} className="group hover:bg-secondary/70 dark:hover:bg-primary/10 transition-colors">
                                                    <td className="px-5 py-4 border-r border-border/40 last:border-r-0">
                                                        {editingTag?.oldName === tag ? (
                                                            <div className="flex items-center justify-center gap-2">
                                                                <Input
                                                                    value={editingTag.newName}
                                                                    onChange={(e) => setEditingTag({ ...editingTag, newName: e.target.value })}
                                                                    className="h-8 text-sm text-foreground"
                                                                    autoFocus
                                                                    disabled={isUpdatingTag}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-sm font-medium bg-card text-primary border border-border">
                                                                #{tag}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4 text-sm text-foreground/90 text-center border-r border-border/40 last:border-r-0">
                                                        {tagCounts[tag] || 0} bài viết
                                                    </td>
                                                    <td className="px-5 py-4 border-r border-border/40 last:border-r-0">
                                                        <div className="flex justify-center gap-2">
                                                            {editingTag?.oldName === tag ? (
                                                                <>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        className="h-8 rounded-[8px] text-muted-foreground"
                                                                        onClick={() => setEditingTag(null)}
                                                                        disabled={isUpdatingTag}
                                                                    >
                                                                        Hủy
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        className="h-8 rounded-[8px] bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20"
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
                                                                        className="p-2 text-foreground/85 hover:text-primary dark:hover:text-primary/80 hover:bg-secondary/80 rounded-[8px] transition-colors"
                                                                        title="Sửa tên tag trên toàn bộ bài viết"
                                                                    >
                                                                        <Pencil className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setDeleteTarget({ type: 'tag', id: tag, name: tag })}
                                                                        className="p-2 text-foreground/85 hover:text-primary hover:bg-secondary/80 rounded-[8px] transition-colors"
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
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            </main >
            </div>
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



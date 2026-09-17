'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/providers/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
    Plus,
    FileText,
    Home,
    Loader2,
    Search,
    Users,
    User,
    Tag,
    RefreshCw,
    Share2,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { Input } from '@/components/ui/input';
import { getOptimizedImageUrl } from '@/lib/utils';
import { notify } from '@/lib/notify';
import {
    AdminTabKey,
    Post,
    AdminUser,
    DeletedAccountRecord,
    SharedStoryPost,
    SharesStats,
} from './types';
import { PostsTab } from './tabs/PostsTab';
import { SharesTab } from './tabs/SharesTab';
import { UsersTab } from './tabs/UsersTab';
import { TagsTab } from './tabs/TagsTab';

const CreatePostForm = dynamic(() => import('@/components/CreatePostForm').then(m => ({ default: m.CreatePostForm })), { ssr: false });
const EditPostForm = dynamic(() => import('@/components/EditPostForm').then(m => ({ default: m.EditPostForm })), { ssr: false });
const DeleteConfirmDialog = dynamic(() => import('@/components/DeleteConfirmDialog').then(m => ({ default: m.DeleteConfirmDialog })), { ssr: false });
const ShareDialog = dynamic(() => import('@/components/ShareDialog').then(m => ({ default: m.ShareDialog })), { ssr: false });

const formatSessionTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
};

function SessionElapsedTime({
    as: Component = 'span',
    className,
}: {
    as?: 'p' | 'span';
    className?: string;
}) {
    const [sessionSeconds, setSessionSeconds] = useState(0);

    useEffect(() => {
        const start = Date.now();
        const timer = setInterval(() => setSessionSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
        return () => clearInterval(timer);
    }, []);

    return <Component className={className}>{formatSessionTime(sessionSeconds)}</Component>;
}

export default function AdminDashboard() {
    const { user, isLoading: isAuthLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isAuthLoading && (!user || user.role !== 'admin')) {
            router.replace('/');
        }
    }, [user, isAuthLoading, router]);

    // Tab Navigation: Synchronous 0ms switch
    const [activeTab, setActiveTab] = useState<AdminTabKey>('posts');

    // Lazy mount + Keep alive pattern
    const [visitedTabs, setVisitedTabs] = useState<Record<AdminTabKey, boolean>>({
        posts: true,
        shares: false,
        users: false,
        tags: false,
    });

    const handleTabChange = useCallback((newTab: AdminTabKey) => {
        setVisitedTabs((prev) => (prev[newTab] ? prev : { ...prev, [newTab]: true }));
        setActiveTab(newTab);
    }, []);

    // Core Data States
    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoadingPosts, setIsLoadingPosts] = useState(true);

    const [sharedPosts, setSharedPosts] = useState<SharedStoryPost[]>([]);
    const [sharesStats, setSharesStats] = useState<SharesStats>({
        totalStoriesWithGuests: 0,
        totalUniqueGuests: 0,
        totalGuestVisits: 0,
    });
    const [isSharesLoading, setIsSharesLoading] = useState(false);

    const [usersList, setUsersList] = useState<AdminUser[]>([]);
    const [usersLoadError, setUsersLoadError] = useState<string | null>(null);
    const [isUsersLoading, setIsUsersLoading] = useState(false);
    const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

    const [deletedAccounts, setDeletedAccounts] = useState<DeletedAccountRecord[]>([]);
    const [isDeletedAccountsLoading, setIsDeletedAccountsLoading] = useState(false);

    const [standaloneTags, setStandaloneTags] = useState<{ _id: string; name: string }[]>([]);
    const [editingTag, setEditingTag] = useState<{ oldName: string; newName: string } | null>(null);
    const [isUpdatingTag, setIsUpdatingTag] = useState(false);
    const [newTagName, setNewTagName] = useState('');
    const [isCreatingTag, setIsCreatingTag] = useState(false);

    // Search Query
    const [searchQuery, setSearchQuery] = useState('');

    // Dialog States
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<
        | { type: 'post'; id: string; title: string }
        | { type: 'user'; id: string; email: string }
        | { type: 'tag'; id: string; name: string }
        | null
    >(null);
    const [isDeletingTarget, setIsDeletingTarget] = useState(false);
    const [selectedSharePost, setSelectedSharePost] = useState<{ id: string; title: string } | null>(null);
    const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);

    // Data Fetchers with On-Demand Caching
    const lastFetchRef = useRef<Record<string, number>>({});

    const fetchPosts = useCallback(async (force = false) => {
        if (!force && posts.length > 0 && Date.now() - (lastFetchRef.current['posts'] || 0) < 60000) {
            return;
        }
        setIsLoadingPosts(true);
        try {
            const res = await fetch('/api/posts', { credentials: 'same-origin' });
            if (res.ok) {
                const data = await res.json();
                setPosts(data);
                lastFetchRef.current['posts'] = Date.now();
            }
        } catch (error) {
            console.error('Error fetching posts:', error);
        } finally {
            setIsLoadingPosts(false);
        }
    }, [posts.length]);

    const fetchShares = useCallback(async (force = false) => {
        if (!force && sharedPosts.length > 0 && Date.now() - (lastFetchRef.current['shares'] || 0) < 60000) {
            return;
        }
        setIsSharesLoading(true);
        try {
            const res = await fetch('/api/admin/shares', { credentials: 'same-origin' });
            if (res.ok) {
                const data = await res.json();
                setSharedPosts(data.posts || []);
                setSharesStats(data.stats || { totalStoriesWithGuests: 0, totalUniqueGuests: 0, totalGuestVisits: 0 });
                lastFetchRef.current['shares'] = Date.now();
            } else {
                const err = await res.json().catch(() => ({}));
                notify.error(err.error || 'Không thể tải danh sách chia sẻ');
            }
        } catch (error) {
            console.error('Error fetching shares:', error);
            notify.error('Lỗi kết nối khi tải danh sách chia sẻ');
        } finally {
            setIsSharesLoading(false);
        }
    }, [sharedPosts.length]);

    const fetchTags = useCallback(async (force = false) => {
        if (!force && standaloneTags.length > 0 && Date.now() - (lastFetchRef.current['tags'] || 0) < 60000) {
            return;
        }
        try {
            const res = await fetch('/api/tags', { credentials: 'same-origin' });
            if (res.ok) {
                const data = await res.json();
                setStandaloneTags(data);
                lastFetchRef.current['tags'] = Date.now();
            }
        } catch (error) {
            console.error('Error fetching tags:', error);
        }
    }, [standaloneTags.length]);

    const fetchUsers = useCallback(async (force = false) => {
        if (!force && usersList.length > 0 && Date.now() - (lastFetchRef.current['users'] || 0) < 60000) {
            return;
        }
        setIsUsersLoading(true);
        setUsersLoadError(null);
        try {
            const res = await fetch('/api/admin/users');
            if (res.ok) {
                const data = await res.json();
                setUsersList(data);
                lastFetchRef.current['users'] = Date.now();
                return;
            }
            let errorMessage = 'Không thể tải danh sách người dùng.';
            try {
                const data = await res.json();
                if (data?.error) errorMessage = data.error;
            } catch { }
            setUsersLoadError(errorMessage);
            notify.error(errorMessage);
        } catch (error) {
            console.error('Error fetching users:', error);
            setUsersLoadError('Không thể tải danh sách người dùng do lỗi mạng.');
            notify.error('Không thể tải danh sách người dùng do lỗi mạng.');
        } finally {
            setIsUsersLoading(false);
        }
    }, [usersList.length]);

    const fetchDeletedAccounts = useCallback(async (force = false) => {
        if (!force && deletedAccounts.length > 0 && Date.now() - (lastFetchRef.current['deletedAccounts'] || 0) < 60000) {
            return;
        }
        setIsDeletedAccountsLoading(true);
        try {
            const res = await fetch('/api/admin/deleted-accounts?limit=200');
            if (res.ok) {
                const data = await res.json();
                setDeletedAccounts(data);
                lastFetchRef.current['deletedAccounts'] = Date.now();
            }
        } catch (error) {
            console.error('Error fetching deleted accounts:', error);
        } finally {
            setIsDeletedAccountsLoading(false);
        }
    }, [deletedAccounts.length]);

    // On-demand load based on activeTab
    useEffect(() => {
        if (!isAuthLoading) {
            if (!user || user.role !== 'admin') {
                router.push('/');
                return;
            }
            if (activeTab === 'posts') {
                fetchPosts();
                fetchTags();
            } else if (activeTab === 'users') {
                fetchUsers();
                fetchDeletedAccounts();
            } else if (activeTab === 'shares') {
                fetchShares();
            } else if (activeTab === 'tags') {
                fetchTags();
            }
        }
    }, [user, isAuthLoading, router, activeTab, fetchPosts, fetchUsers, fetchDeletedAccounts, fetchTags, fetchShares]);

    // Computed Metadata
    const availablePostTags = useMemo(() => {
        const postTags = posts.flatMap((post) => (post.tags || []).map((tag) => tag.trim().toLowerCase()).filter(Boolean));
        const standaloneNames = standaloneTags.map((t) => t.name.trim().toLowerCase()).filter(Boolean);
        return Array.from(new Set([...postTags, ...standaloneNames])).sort((a, b) => a.localeCompare(b, 'vi'));
    }, [posts, standaloneTags]);

    const availableAuthors = useMemo(() => {
        const authors = posts.map((post) => post.author?.trim()).filter(Boolean);
        return Array.from(new Set(authors)).sort((a, b) => a.localeCompare(b, 'vi'));
    }, [posts]);

    const availableTranslators = useMemo(() => {
        const translators = posts.map((post) => post.translator?.trim()).filter(Boolean) as string[];
        return Array.from(new Set(translators)).sort((a, b) => a.localeCompare(b, 'vi'));
    }, [posts]);

    const tagCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        posts.forEach((post) => {
            (post.tags || []).forEach((tag) => {
                const normalized = tag.trim().toLowerCase();
                if (normalized) {
                    counts[normalized] = (counts[normalized] || 0) + 1;
                }
            });
        });
        return counts;
    }, [posts]);

    // Memoized Handlers for Zero Re-render Propagation
    const handleEditPost = useCallback((p: Post) => {
        setSelectedPost(p);
        setIsEditOpen(true);
    }, []);

    const handleDeletePost = useCallback((post: Post) => {
        setDeleteTarget({ type: 'post', id: post._id, title: post.title });
    }, []);

    const handleSearchTagClick = useCallback((tag: string) => {
        setSearchQuery(tag);
    }, []);

    const handleOpenShareDialog = useCallback((p: { id: string; title: string }) => {
        setSelectedSharePost(p);
        setIsShareDialogOpen(true);
    }, []);

    const handleDeleteUser = useCallback((targetUser: AdminUser) => {
        if (targetUser.email === user?.email) {
            notify.warning('Bạn không thể xóa tài khoản của chính mình.');
            return;
        }
        setDeleteTarget({ type: 'user', id: targetUser._id, email: targetUser.email });
    }, [user?.email]);

    const handleChangeRole = useCallback(async (targetUser: AdminUser, newRole: 'guest' | 'user' | 'admin') => {
        if (targetUser.email === user?.email) {
            notify.warning('Không thể thay đổi vai trò của chính mình.');
            return;
        }
        setUpdatingRoleId(targetUser._id);
        try {
            const res = await fetch(`/api/admin/users/${targetUser._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole }),
            });
            if (res.ok) {
                setUsersList((prev) =>
                    prev.map((u) => (u._id === targetUser._id ? { ...u, role: newRole } : u))
                );
                notify.success(`Đã đổi vai trò của ${targetUser.email} thành ${newRole === 'admin' ? 'Quản trị' : newRole === 'user' ? 'Thành viên' : 'Khách'}`);
            } else {
                const data = await res.json();
                notify.error(data.error || 'Cập nhật vai trò thất bại');
            }
        } catch {
            notify.error('Lỗi kết nối khi cập nhật vai trò');
        } finally {
            setUpdatingRoleId(null);
        }
    }, [user?.email]);

    const handleConfirmDelete = useCallback(async () => {
        if (!deleteTarget) return;
        setIsDeletingTarget(true);
        try {
            if (deleteTarget.type === 'post') {
                const res = await fetch(`/api/posts/${deleteTarget.id}`, { method: 'DELETE' });
                if (res.ok) {
                    setPosts((prev) => prev.filter((p) => p._id !== deleteTarget.id));
                    notify.success('Đã xóa bài viết');
                    setDeleteTarget(null);
                } else {
                    notify.error('Xóa thất bại');
                }
            } else if (deleteTarget.type === 'user') {
                const res = await fetch(`/api/admin/users/${deleteTarget.id}`, { method: 'DELETE' });
                if (res.ok) {
                    setUsersList((prev) => prev.filter((u) => u._id !== deleteTarget.id));
                    notify.success('Đã xóa người dùng');
                    setDeleteTarget(null);
                } else {
                    const data = await res.json();
                    notify.error(data.error || 'Xóa thất bại');
                }
            } else if (deleteTarget.type === 'tag') {
                const res = await fetch(`/api/tags?tag=${encodeURIComponent(deleteTarget.id)}`, { method: 'DELETE' });
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
    }, [deleteTarget, fetchPosts, fetchTags]);

    const handleUpdateTag = useCallback(async () => {
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
                    newTag: editingTag.newName.trim(),
                }),
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
    }, [editingTag, fetchPosts, fetchTags]);

    const handleCreateTag = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const tagValue = newTagName.trim();
        if (!tagValue) return;
        setIsCreatingTag(true);
        try {
            const res = await fetch('/api/tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: tagValue }),
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
    }, [newTagName, fetchTags]);

    const handleDeleteTag = useCallback((tag: string) => {
        setDeleteTarget({ type: 'tag', id: tag, name: tag });
    }, []);

    const handleNewTagNameChange = useCallback((val: string) => {
        setNewTagName(val);
    }, []);

    const handleEditingTagChange = useCallback((val: { oldName: string; newName: string } | null) => {
        setEditingTag(val);
    }, []);

    if (isAuthLoading || !user || user.role !== 'admin') {
        return (
            <div className="min-h-screen flex items-center justify-center text-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-16 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-0 [scrollbar-gutter:stable] font-sans selection:bg-primary/20">
            <div className="mx-auto flex w-full max-w-[1600px] gap-4 px-2 py-2 sm:px-4 sm:py-4">
                {/* Desktop Sidebar */}
                <aside className="hidden lg:flex w-56 shrink-0 self-start lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto rounded-[8px] border border-border/70 bg-card/60 backdrop-blur-md flex-col z-20">
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
                            type="button"
                            onClick={() => handleTabChange('posts')}
                            className={`w-full flex items-center justify-start gap-3 px-3 py-2.5 rounded-[8px] font-medium transition-colors cursor-pointer ${
                                activeTab === 'posts'
                                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                                    : 'text-foreground/90 hover:bg-secondary hover:text-primary'
                            }`}
                        >
                            <FileText className="w-5 h-5" />
                            <span>Bài viết</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleTabChange('shares')}
                            className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-[8px] font-medium transition-colors cursor-pointer ${
                                activeTab === 'shares'
                                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                                    : 'text-foreground/90 hover:bg-secondary hover:text-primary'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <Share2 className="w-5 h-5" />
                                <span>Chia sẻ</span>
                            </div>
                            {sharesStats.totalStoriesWithGuests > 0 && (
                                <span
                                    className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${
                                        activeTab === 'shares'
                                            ? 'bg-primary-foreground text-primary'
                                            : 'bg-primary/10 text-primary'
                                    }`}
                                >
                                    {sharesStats.totalStoriesWithGuests}
                                </span>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleTabChange('tags')}
                            className={`w-full flex items-center justify-start gap-3 px-3 py-2.5 rounded-[8px] font-medium transition-colors cursor-pointer ${
                                activeTab === 'tags'
                                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                                    : 'text-foreground/90 hover:bg-secondary hover:text-primary'
                            }`}
                        >
                            <Tag className="w-5 h-5" />
                            <span>Quản lý Tag</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleTabChange('users')}
                            className={`w-full flex items-center justify-start gap-3 px-3 py-2.5 rounded-[8px] font-medium transition-colors cursor-pointer ${
                                activeTab === 'users'
                                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                                    : 'text-foreground/90 hover:bg-secondary hover:text-primary'
                            }`}
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
                                <SessionElapsedTime as="p" className="text-xs font-mono text-primary mt-1 tabular-nums" />
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 min-w-0 min-h-[calc(100vh-5rem)] rounded-[8px] border border-border/70 bg-card/35 shadow-sm">
                    {/* Header */}
                    <header className="min-h-16 bg-card/80 backdrop-blur-md border-b border-border/70 px-3 py-3 sm:px-8 lg:px-10 flex items-start sm:items-center justify-between gap-3 sticky top-14 z-30 rounded-t-[8px]">
                        <div className="flex min-w-0 flex-1 items-center gap-6">
                            <div className="min-w-0 lg:hidden">
                                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Quản trị</p>
                                <h1 className="truncate text-base font-semibold text-foreground">
                                    {activeTab === 'posts'
                                        ? 'Quản lý bài viết'
                                        : activeTab === 'shares'
                                            ? 'Quản lý chia sẻ (Khách truy cập)'
                                            : activeTab === 'users'
                                                ? 'Quản lý người dùng'
                                                : 'Quản lý thẻ Tag'}
                                </h1>
                                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{user.email}</p>
                            </div>
                            <div className="hidden lg:flex items-center gap-4">
                                <h1 className="text-lg font-semibold text-foreground">
                                    {activeTab === 'posts'
                                        ? 'Quản lý bài viết'
                                        : activeTab === 'shares'
                                            ? 'Quản lý chia sẻ (Khách truy cập)'
                                            : activeTab === 'users'
                                                ? 'Quản lý người dùng'
                                                : 'Quản lý thẻ Tag'}
                                </h1>
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-card">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <span className="text-xs font-medium text-muted-foreground">Tài khoản đang hoạt động</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            {activeTab === 'posts' && (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => { fetchPosts(true); fetchTags(true); }}
                                        disabled={isLoadingPosts}
                                        className="h-9 rounded-[8px] border-border text-foreground hover:bg-secondary px-2.5 sm:px-3 text-xs"
                                        title="Tải lại danh sách bài viết"
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPosts ? 'animate-spin' : ''} sm:mr-1.5`} />
                                        <span className="hidden sm:inline">Làm mới</span>
                                    </Button>
                                    <Button
                                        onClick={() => setIsCreateDialogOpen(true)}
                                        className="h-9 rounded-[8px] bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 px-3 sm:px-5 text-xs sm:text-sm font-medium transition-colors"
                                    >
                                        <Plus className="w-4 h-4 sm:mr-2" />
                                        <span className="hidden min-[380px]:inline">Tạo bài mới</span>
                                    </Button>
                                </>
                            )}
                            {activeTab === 'shares' && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fetchShares(true)}
                                    disabled={isSharesLoading}
                                    className="h-9 rounded-[8px] border-border text-foreground hover:bg-secondary px-2.5 sm:px-3 text-xs"
                                    title="Tải lại danh sách truyện có khách truy cập"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${isSharesLoading ? 'animate-spin' : ''} sm:mr-1.5`} />
                                    <span className="hidden sm:inline">Làm mới</span>
                                </Button>
                            )}
                            {activeTab === 'users' && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => { fetchUsers(true); fetchDeletedAccounts(true); }}
                                    disabled={isUsersLoading || isDeletedAccountsLoading}
                                    className="h-9 rounded-[8px] border-border text-foreground hover:bg-secondary px-2.5 sm:px-3 text-xs"
                                    title="Tải lại danh sách người dùng"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${isUsersLoading || isDeletedAccountsLoading ? 'animate-spin' : ''} sm:mr-1.5`} />
                                    <span className="hidden sm:inline">Làm mới</span>
                                </Button>
                            )}
                            {activeTab === 'tags' && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => { fetchTags(true); fetchPosts(true); }}
                                    className="h-9 rounded-[8px] border-border text-foreground hover:bg-secondary px-2.5 sm:px-3 text-xs"
                                    title="Tải lại danh sách thẻ tag"
                                >
                                    <RefreshCw className="w-3.5 h-3.5 sm:mr-1.5" />
                                    <span className="hidden sm:inline">Làm mới</span>
                                </Button>
                            )}
                        </div>
                    </header>

                    {/* Content Body */}
                    <div className="p-3 sm:p-8 lg:p-10 space-y-4 sm:space-y-6">
                        {/* Stat Cards */}
                        {activeTab !== 'tags' && (
                            <div className="grid grid-cols-3 gap-2 sm:gap-4">
                                {(activeTab === 'posts'
                                    ? [
                                        { label: 'Tổng bài viết', value: posts.length },
                                        { label: 'Tác giả', value: availableAuthors.length },
                                        { label: 'Trạng thái', value: 'Hoạt động' },
                                    ]
                                    : activeTab === 'shares'
                                        ? [
                                            { label: 'Truyện có khách đọc', value: sharesStats.totalStoriesWithGuests },
                                            { label: 'Tài khoản khách', value: sharesStats.totalUniqueGuests },
                                            { label: 'Lượt khách đọc', value: sharesStats.totalGuestVisits },
                                        ]
                                        : [
                                            { label: 'Tổng người dùng', value: usersList.length },
                                            { label: 'Quản trị viên', value: usersList.filter((u) => u.role === 'admin').length },
                                            { label: 'Người dùng', value: usersList.filter((u) => u.role !== 'admin').length },
                                        ]
                                ).map((stat, i) => (
                                    <div key={i} className="bg-card/50 backdrop-blur-md p-3 sm:p-5 rounded-[8px] border border-border shadow-md">
                                        <p className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-1.5 sm:mb-2 leading-tight">
                                            {stat.label}
                                        </p>
                                        {typeof stat.value === 'number' ? (
                                            <p className="text-lg sm:text-2xl font-semibold text-foreground">{stat.value}</p>
                                        ) : (
                                            <div className="flex items-center gap-1.5 sm:gap-2">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                <span className="text-xs sm:text-base font-medium text-foreground">{stat.value}</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Search Input Filter Container */}
                        <div className="bg-card/50 backdrop-blur-md rounded-[8px] border border-border p-3 sm:p-5">
                            <div className="relative w-full sm:w-[400px]">
                                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-foreground/70 dark:text-neutral-300">
                                    <Search className="h-4 w-4" />
                                </span>
                                <Input
                                    placeholder={
                                        activeTab === 'posts'
                                            ? 'Tìm bài viết, tác giả, tag...'
                                            : activeTab === 'shares'
                                                ? 'Tìm tên truyện, tác giả, email khách...'
                                                : activeTab === 'users'
                                                    ? 'Tìm tên, email...'
                                                    : 'Tìm thẻ tag...'
                                    }
                                    className="h-10 pl-10 pr-3 py-0 leading-10 bg-background border border-border rounded-[8px] focus-visible:ring-1 focus-visible:ring-primary text-sm text-foreground placeholder:text-foreground/90 dark:placeholder:text-neutral-300"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Tabs Container: Keep-Alive & Lazy Mount with Custom Memo Optimization */}
                        <div className="w-full">
                            {/* Posts Tab */}
                            <PostsTab
                                isActive={activeTab === 'posts'}
                                posts={posts}
                                isLoading={isLoadingPosts}
                                searchQuery={searchQuery}
                                onSearchTagClick={handleSearchTagClick}
                                availablePostTags={availablePostTags}
                                onEditPost={handleEditPost}
                                onDeletePost={handleDeletePost}
                            />

                            {/* Shares Tab */}
                            {visitedTabs.shares && (
                                <SharesTab
                                    isActive={activeTab === 'shares'}
                                    sharedPosts={sharedPosts}
                                    isLoading={isSharesLoading}
                                    searchQuery={searchQuery}
                                    onOpenShareDialog={handleOpenShareDialog}
                                />
                            )}

                            {/* Users Tab */}
                            {visitedTabs.users && (
                                <UsersTab
                                    isActive={activeTab === 'users'}
                                    currentUserEmail={user?.email}
                                    usersList={usersList}
                                    isUsersLoading={isUsersLoading}
                                    usersLoadError={usersLoadError}
                                    onRefreshUsers={fetchUsers}
                                    updatingRoleId={updatingRoleId}
                                    onChangeRole={handleChangeRole}
                                    onDeleteUser={handleDeleteUser}
                                    deletedAccounts={deletedAccounts}
                                    isDeletedAccountsLoading={isDeletedAccountsLoading}
                                    onRefreshDeletedAccounts={fetchDeletedAccounts}
                                    searchQuery={searchQuery}
                                />
                            )}

                            {/* Tags Tab */}
                            {visitedTabs.tags && (
                                <TagsTab
                                    isActive={activeTab === 'tags'}
                                    availablePostTags={availablePostTags}
                                    tagCounts={tagCounts}
                                    newTagName={newTagName}
                                    onNewTagNameChange={handleNewTagNameChange}
                                    isCreatingTag={isCreatingTag}
                                    onCreateTag={handleCreateTag}
                                    editingTag={editingTag}
                                    onEditingTagChange={handleEditingTagChange}
                                    isUpdatingTag={isUpdatingTag}
                                    onUpdateTag={handleUpdateTag}
                                    onDeleteTag={handleDeleteTag}
                                    searchQuery={searchQuery}
                                />
                            )}
                        </div>
                    </div>
                </main>
            </div>

            {/* Mobile Bottom Navigation */}
            <nav className="lg:hidden fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1rem)] max-w-md rounded-[8px] bg-card/85 backdrop-blur-xl border border-border/70 shadow-[0_10px_30px_rgba(0,0,0,0.18)] px-2 py-1.5">
                <div className="grid grid-cols-5 gap-1">
                    <Link
                        href="/"
                        className="flex flex-col items-center justify-center gap-0.5 rounded-[8px] py-1.5 text-[10px] font-medium text-foreground/80 hover:bg-secondary/70 hover:text-primary transition-colors"
                        title="Trang chủ"
                    >
                        <Home className="w-4 h-4" />
                        <span>Trang chủ</span>
                    </Link>
                    <button
                        type="button"
                        onClick={() => handleTabChange('posts')}
                        className={`flex flex-col items-center justify-center gap-0.5 rounded-[8px] py-1.5 text-[10px] font-medium transition-colors ${
                            activeTab === 'posts' ? 'bg-secondary text-primary' : 'text-foreground/80 hover:bg-secondary/70 hover:text-primary'
                        }`}
                        title="Bài viết"
                    >
                        <FileText className="w-4 h-4" />
                        <span>Bài viết</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleTabChange('shares')}
                        className={`flex flex-col items-center justify-center gap-0.5 rounded-[8px] py-1.5 text-[10px] font-medium transition-colors ${
                            activeTab === 'shares' ? 'bg-secondary text-primary' : 'text-foreground/80 hover:bg-secondary/70 hover:text-primary'
                        }`}
                        title="Chia sẻ"
                    >
                        <Share2 className="w-4 h-4" />
                        <span>Chia sẻ</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleTabChange('tags')}
                        className={`flex flex-col items-center justify-center gap-0.5 rounded-[8px] py-1.5 text-[10px] font-medium transition-colors ${
                            activeTab === 'tags' ? 'bg-secondary text-primary' : 'text-foreground/80 hover:bg-secondary/70 hover:text-primary'
                        }`}
                        title="Tag"
                    >
                        <Tag className="w-4 h-4" />
                        <span>Tag</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleTabChange('users')}
                        className={`flex flex-col items-center justify-center gap-0.5 rounded-[8px] py-1.5 text-[10px] font-medium transition-colors ${
                            activeTab === 'users' ? 'bg-secondary text-primary' : 'text-foreground/80 hover:bg-secondary/70 hover:text-primary'
                        }`}
                        title="Người dùng"
                    >
                        <Users className="w-4 h-4" />
                        <span>Người dùng</span>
                    </button>
                </div>
            </nav>

            {/* Dialogs */}
            {isCreateDialogOpen && (
                <CreatePostForm
                    open={isCreateDialogOpen}
                    onOpenChange={setIsCreateDialogOpen}
                    onPostCreated={fetchPosts}
                    availableTags={availablePostTags}
                    availableAuthors={availableAuthors}
                    availableTranslators={availableTranslators}
                />
            )}
            {selectedPost && isEditOpen && (
                <EditPostForm
                    post={selectedPost}
                    open={isEditOpen}
                    onOpenChange={setIsEditOpen}
                    onPostUpdated={() => {
                        setIsEditOpen(false);
                        fetchPosts();
                    }}
                    availableTags={availablePostTags}
                />
            )}
            {deleteTarget && (
                <DeleteConfirmDialog
                    open={!!deleteTarget}
                    onOpenChange={(open) => {
                        if (!open && !isDeletingTarget) {
                            setDeleteTarget(null);
                        }
                    }}
                    onConfirm={handleConfirmDelete}
                    isLoading={isDeletingTarget}
                    title={
                        deleteTarget?.type === 'user'
                            ? 'Xóa người dùng?'
                            : deleteTarget?.type === 'post'
                                ? 'Xóa bài viết?'
                                : 'Xóa thẻ tag?'
                    }
                    description={
                        deleteTarget?.type === 'user'
                            ? `Bạn có chắc chắn muốn xóa người dùng "${deleteTarget.email}"? Hành động này không thể hoàn tác.`
                            : deleteTarget?.type === 'post'
                                ? `Bạn có chắc chắn muốn xóa bài viết "${deleteTarget?.title || ''}"? Hành động này không thể hoàn tác.`
                                : `Bạn có chắc muốn xóa thẻ tag "#${deleteTarget?.name || ''}" khỏi toàn bộ ${tagCounts[deleteTarget?.name || ''] || 0} bài viết? Hành động này không thể hoàn tác.`
                    }
                    confirmLabel={isDeletingTarget ? 'Đang xóa...' : 'Xóa'}
                />
            )}
            {selectedSharePost && isShareDialogOpen && (
                <ShareDialog
                    open={isShareDialogOpen}
                    onOpenChange={(open) => {
                        setIsShareDialogOpen(open);
                        if (!open) {
                            setSelectedSharePost(null);
                            fetchShares();
                        }
                    }}
                    postId={selectedSharePost.id}
                    postTitle={selectedSharePost.title}
                />
            )}
        </div>
    );
}

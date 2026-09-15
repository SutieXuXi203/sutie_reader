'use client';

import { useState, useMemo, memo, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
    Users,
    User,
    Trash2,
    RefreshCw,
    Loader2,
} from 'lucide-react';
import { getOptimizedImageUrl } from '@/lib/utils';
import { UserRoleSelect } from '@/components/UserRoleSelect';
import { AdminUser, DeletedAccountRecord } from '../types';

interface UsersTabProps {
    currentUserEmail?: string;
    usersList: AdminUser[];
    isUsersLoading: boolean;
    usersLoadError: string | null;
    onRefreshUsers: () => void;
    updatingRoleId: string | null;
    onChangeRole: (user: AdminUser, newRole: 'guest' | 'user' | 'admin') => void;
    onDeleteUser: (user: AdminUser) => void;
    deletedAccounts: DeletedAccountRecord[];
    isDeletedAccountsLoading: boolean;
    onRefreshDeletedAccounts: () => void;
    searchQuery: string;
}

const ROWS_PER_PAGE = 5;

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

export const UsersTab = memo(function UsersTab({
    currentUserEmail,
    usersList,
    isUsersLoading,
    usersLoadError,
    onRefreshUsers,
    updatingRoleId,
    onChangeRole,
    onDeleteUser,
    deletedAccounts,
    isDeletedAccountsLoading,
    onRefreshDeletedAccounts,
    searchQuery,
}: UsersTabProps) {
    const [usersPage, setUsersPage] = useState(1);
    const [deletedAccountsPage, setDeletedAccountsPage] = useState(1);

    const lowercaseSearch = useMemo(() => searchQuery.toLowerCase(), [searchQuery]);

    const filteredUsers = useMemo(() => {
        if (!lowercaseSearch) return usersList;
        return usersList.filter((u) => {
            const verificationLabel =
                u.role === 'admin'
                    ? 'miễn xác thực'
                    : Boolean(u.isVerified)
                        ? 'đã xác thực'
                        : 'chưa xác thực';
            return (
                u.name?.toLowerCase().includes(lowercaseSearch) ||
                u.email?.toLowerCase().includes(lowercaseSearch) ||
                verificationLabel.includes(lowercaseSearch)
            );
        });
    }, [usersList, lowercaseSearch]);

    const filteredDeletedAccounts = useMemo(() => {
        if (!lowercaseSearch) return deletedAccounts;
        return deletedAccounts.filter((account) => {
            const triggerLabel =
                account.deletionTrigger === 'verify'
                    ? 'xac thuc xác thực'
                    : account.deletionTrigger === 'system'
                        ? 'he thong hệ thống'
                        : 'dang nhap đăng nhập';
            const reasonLabel =
                account.deletionReason === 'unverified_expired_24h'
                    ? 'chua xac thuc qua han 24 gio chưa xác thực quá hạn 24 giờ'
                    : account.deletionReason;
            return (
                account.name?.toLowerCase().includes(lowercaseSearch) ||
                account.email?.toLowerCase().includes(lowercaseSearch) ||
                triggerLabel.includes(lowercaseSearch) ||
                reasonLabel.includes(lowercaseSearch)
            );
        });
    }, [deletedAccounts, lowercaseSearch]);

    const totalUsersPages = Math.max(1, Math.ceil(filteredUsers.length / ROWS_PER_PAGE));
    const totalDeletedAccountsPages = Math.max(1, Math.ceil(filteredDeletedAccounts.length / ROWS_PER_PAGE));

    const paginatedUsers = useMemo(() => {
        const page = Math.min(usersPage, totalUsersPages);
        return filteredUsers.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);
    }, [filteredUsers, usersPage, totalUsersPages]);

    const paginatedDeletedAccounts = useMemo(() => {
        const page = Math.min(deletedAccountsPage, totalDeletedAccountsPages);
        return filteredDeletedAccounts.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);
    }, [filteredDeletedAccounts, deletedAccountsPage, totalDeletedAccountsPages]);

    return (
        <div className="w-full min-h-[360px] lg:min-h-[680px] space-y-3 sm:space-y-4 pb-4">
            {/* Active Users Table */}
            <div className="rounded-[8px] border border-border/60 bg-card/30 shadow-sm overflow-hidden">
                <div className="flex flex-col min-[430px]:flex-row min-[430px]:items-center justify-between gap-2 px-3 py-3 sm:px-5 sm:py-4 border-b border-border/60">
                    <p className="text-sm font-semibold text-foreground">Tài khoản hiện tại</p>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{filteredUsers.length} tài khoản</span>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                onRefreshUsers();
                                onRefreshDeletedAccounts();
                            }}
                            disabled={isUsersLoading || isDeletedAccountsLoading}
                            className="h-7 px-2.5 rounded-[8px] text-xs border-border text-muted-foreground hover:text-foreground"
                            title="Làm mới danh sách"
                        >
                            <span className="inline-flex items-center gap-1.5">
                                <RefreshCw className={`w-3.5 h-3.5 ${isUsersLoading || isDeletedAccountsLoading ? 'animate-spin' : ''}`} />
                                Làm mới
                            </span>
                        </Button>
                    </div>
                </div>

                {/* Mobile view */}
                <div className="md:hidden p-3 space-y-3">
                    {isUsersLoading ? (
                        <div className="flex flex-col items-center justify-center rounded-[8px] border border-border/60 bg-card/40 px-4 py-12 text-center text-neutral-500">
                            <Loader2 className="w-8 h-8 animate-spin mb-3 text-primary" />
                            <p className="text-sm">Đang tải...</p>
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="rounded-[8px] border border-border/60 bg-card/70 px-4 py-8 text-center">
                            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-secondary/80">
                                <Users className="w-6 h-6 text-foreground" />
                            </div>
                            <p className="text-sm font-semibold text-foreground">
                                {usersLoadError
                                    ? 'Không tải được danh sách người dùng'
                                    : searchQuery
                                        ? 'Không tìm thấy người dùng'
                                        : 'Chưa có người dùng'}
                            </p>
                            {usersLoadError && (
                                <p className="mt-1 text-xs text-muted-foreground">{usersLoadError}</p>
                            )}
                        </div>
                    ) : (
                        paginatedUsers.map((u) => {
                            const isAdminUser = u.role === 'admin';
                            const isVerified = Boolean(u.isVerified);
                            return (
                                <article key={u._id} className="rounded-[8px] border border-border/70 bg-card/55 p-3 shadow-sm">
                                    <div className="flex items-start gap-3">
                                        <div className="relative shrink-0">
                                            <div className="relative h-11 w-11 overflow-hidden rounded-[8px] bg-card">
                                                {u.avatar ? (
                                                    <Image src={getOptimizedImageUrl(u.avatar)} alt={u.name || 'Avatar'} fill className="object-cover" unoptimized />
                                                ) : (
                                                    <User className="w-5 h-5 m-3 text-primary/80" />
                                                )}
                                            </div>
                                            {u.email === currentUserEmail ? (
                                                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background" title="Tài khoản đang đăng nhập" />
                                            ) : (
                                                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-neutral-300 dark:bg-neutral-600 ring-2 ring-background" title="Không hoạt động" />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold text-foreground">{u.name || 'Ẩn danh'}</p>
                                            <p className="mt-0.5 break-all text-xs text-muted-foreground">{u.email}</p>
                                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                                <UserRoleSelect
                                                    role={u.role || 'guest'}
                                                    disabled={u.email === currentUserEmail}
                                                    isLoading={updatingRoleId === u._id}
                                                    size="sm"
                                                    onChange={(newRole) => onChangeRole(u, newRole)}
                                                />
                                                {isAdminUser ? (
                                                    <span className="inline-flex rounded-[8px] border border-sky-300/60 bg-sky-100/70 px-2 py-1 text-[11px] font-medium text-sky-700 dark:border-sky-700/60 dark:bg-sky-900/30 dark:text-sky-300">
                                                        Miễn xác thực
                                                    </span>
                                                ) : isVerified ? (
                                                    <span className="inline-flex rounded-[8px] border border-emerald-300/60 bg-emerald-100/70 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-900/30 dark:text-emerald-300">
                                                        Đã xác thực
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex rounded-[8px] border border-amber-300/60 bg-amber-100/70 px-2 py-1 text-[11px] font-medium text-amber-700 dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-300">
                                                        Chưa xác thực
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                                        <div>
                                            <p>Hoạt động</p>
                                            <p className="mt-0.5 font-medium text-foreground/80">
                                                {u.email === currentUserEmail ? (
                                                    <SessionElapsedTime as="span" />
                                                ) : 'Chưa hoạt động'}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p>Ngày tham gia</p>
                                            <p className="mt-0.5 font-medium text-foreground/80">{new Date(u.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => onDeleteUser(u)}
                                        className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-[8px] border border-border bg-background/70 text-xs font-medium text-foreground/85 transition-colors hover:bg-secondary hover:text-primary"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Xóa người dùng
                                    </button>
                                </article>
                            );
                        })
                    )}
                </div>

                {/* Desktop table view */}
                <div className="hidden md:block overflow-x-auto">
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
                                    <td colSpan={7} className="px-5 py-12 text-center">
                                        <div className="mx-auto max-w-sm rounded-[8px] border border-border/60 bg-card/70 px-6 py-7">
                                            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-secondary/80">
                                                <Users className="w-6 h-6 text-foreground" />
                                            </div>
                                            <p className="text-sm font-semibold text-foreground">
                                                {usersLoadError
                                                    ? 'Không tải được danh sách người dùng'
                                                    : searchQuery
                                                        ? 'Không tìm thấy người dùng'
                                                        : 'Chưa có người dùng'}
                                            </p>
                                            {usersLoadError && (
                                                <p className="mt-1 text-xs text-muted-foreground">{usersLoadError}</p>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedUsers.map((u) => {
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
                                                        {u.email === currentUserEmail ? (
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
                                                <div className="flex justify-center">
                                                    <UserRoleSelect
                                                        role={u.role || 'guest'}
                                                        disabled={u.email === currentUserEmail}
                                                        isLoading={updatingRoleId === u._id}
                                                        onChange={(newRole) => onChangeRole(u, newRole)}
                                                    />
                                                </div>
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
                                                {u.email === currentUserEmail ? (
                                                    <span className="inline-flex items-center rounded-[8px] border border-emerald-300/60 dark:border-emerald-700/60 bg-emerald-100/70 dark:bg-emerald-900/30 px-2.5 py-1 text-xs font-semibold font-mono text-emerald-700 dark:text-emerald-300 tabular-nums">
                                                        <SessionElapsedTime />
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
                                                        onClick={() => onDeleteUser(u)}
                                                        className="p-2 text-foreground/85 hover:text-primary hover:bg-secondary/80 rounded-[8px] transition-colors cursor-pointer"
                                                        title="Xóa"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Users Pagination */}
                {filteredUsers.length > 0 && (
                    <div className="px-3 sm:px-5 py-3 border-t border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                            Trang {usersPage}/{totalUsersPages} • Hiển thị {paginatedUsers.length}/{filteredUsers.length} tài khoản
                        </p>
                        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-9 sm:h-8 w-full sm:w-auto rounded-[8px]"
                                onClick={() => setUsersPage((prev) => Math.max(1, prev - 1))}
                                disabled={usersPage === 1}
                            >
                                Trước
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-9 sm:h-8 w-full sm:w-auto rounded-[8px]"
                                onClick={() => setUsersPage((prev) => Math.min(totalUsersPages, prev + 1))}
                                disabled={usersPage >= totalUsersPages}
                            >
                                Sau
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Deleted Accounts Table */}
            <div className="rounded-[8px] border border-border/60 bg-card/30 shadow-sm overflow-hidden">
                <div className="flex flex-col min-[430px]:flex-row min-[430px]:items-center justify-between gap-2 px-3 py-3 sm:px-5 sm:py-4 border-b border-border/60">
                    <p className="text-sm font-semibold text-foreground">Tài khoản bị xóa tự động (chưa xác thực)</p>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{filteredDeletedAccounts.length} tài khoản</span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-[8px]"
                            onClick={onRefreshDeletedAccounts}
                            disabled={isDeletedAccountsLoading}
                        >
                            {isDeletedAccountsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Làm mới'}
                        </Button>
                    </div>
                </div>

                {/* Mobile view */}
                <div className="md:hidden p-3 space-y-3">
                    {isDeletedAccountsLoading ? (
                        <div className="flex flex-col items-center justify-center rounded-[8px] border border-border/60 bg-card/40 px-4 py-12 text-center text-foreground/80">
                            <Loader2 className="w-8 h-8 animate-spin mb-3 text-primary" />
                            <p className="text-sm">Đang tải...</p>
                        </div>
                    ) : filteredDeletedAccounts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-[8px] border border-border/60 bg-card/40 px-4 py-12 text-center text-foreground/80">
                            <Users className="w-10 h-10 mb-3 text-foreground/55" />
                            <p className="text-sm">{searchQuery ? 'Không tìm thấy' : 'Chưa có tài khoản bị xóa tự động'}</p>
                        </div>
                    ) : (
                        paginatedDeletedAccounts.map((account) => (
                            <article key={account._id} className="rounded-[8px] border border-border/70 bg-card/55 p-3 shadow-sm">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-foreground">{account.name || 'Ẩn danh'}</p>
                                    <p className="mt-0.5 break-all text-xs text-muted-foreground">{account.email}</p>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    <span className="inline-flex rounded-[8px] bg-neutral-100 px-2 py-1 text-[11px] font-medium text-muted-foreground dark:bg-neutral-800/50">
                                        {account.deletionTrigger === 'verify'
                                            ? 'Xác thực'
                                            : account.deletionTrigger === 'system'
                                                ? 'Hệ thống'
                                                : 'Đăng nhập'}
                                    </span>
                                    <span className="inline-flex rounded-[8px] border border-amber-300/60 bg-amber-100/70 px-2 py-1 text-[11px] font-medium text-amber-700 dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-300">
                                        Chưa xác thực quá hạn 24h
                                    </span>
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                                    <div>
                                        <p>Hạn xác thực</p>
                                        <p className="mt-0.5 font-medium text-foreground/80">
                                            {account.verificationExpiresAt
                                                ? new Date(account.verificationExpiresAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                                : '--'}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p>Thời điểm xóa</p>
                                        <p className="mt-0.5 font-medium text-foreground/80">
                                            {new Date(account.deletedAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            </article>
                        ))
                    )}
                </div>

                {/* Desktop view */}
                <div className="hidden md:block overflow-x-auto">
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
                                        <Users className="w-10 h-10 mb-3 text-foreground/55" />
                                        <p className="text-sm">{searchQuery ? 'Không tìm thấy' : 'Chưa có tài khoản bị xóa tự động'}</p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedDeletedAccounts.map((account) => (
                                    <tr key={account._id} className="group hover:bg-secondary/70 dark:hover:bg-primary/10 transition-colors">
                                        <td className="px-5 py-4 text-sm font-medium text-foreground border-r border-border/40 last:border-r-0">
                                            {account.name || 'Ẩn danh'}
                                        </td>
                                        <td className="px-5 py-4 text-sm text-foreground/90 border-r border-border/40 last:border-r-0">
                                            {account.email}
                                        </td>
                                        <td className="px-5 py-4 text-center border-r border-border/40 last:border-r-0">
                                            <span className="inline-flex px-2.5 py-1 rounded-[8px] text-xs font-medium bg-neutral-100 dark:bg-neutral-800/50 text-muted-foreground">
                                                {account.deletionTrigger === 'verify'
                                                    ? 'Xác thực'
                                                    : account.deletionTrigger === 'system'
                                                        ? 'Hệ thống'
                                                        : 'Đăng nhập'}
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
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Deleted Accounts Pagination */}
                {filteredDeletedAccounts.length > 0 && (
                    <div className="px-3 sm:px-5 py-3 border-t border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                            Trang {deletedAccountsPage}/{totalDeletedAccountsPages} • Hiển thị {paginatedDeletedAccounts.length}/{filteredDeletedAccounts.length} tài khoản
                        </p>
                        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-9 sm:h-8 w-full sm:w-auto rounded-[8px]"
                                onClick={() => setDeletedAccountsPage((prev) => Math.max(1, prev - 1))}
                                disabled={deletedAccountsPage === 1}
                            >
                                Trước
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-9 sm:h-8 w-full sm:w-auto rounded-[8px]"
                                onClick={() => setDeletedAccountsPage((prev) => Math.min(totalDeletedAccountsPages, prev + 1))}
                                disabled={deletedAccountsPage >= totalDeletedAccountsPages}
                            >
                                Sau
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

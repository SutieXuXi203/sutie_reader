'use client';

import { useState, useMemo, memo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
    Share2,
    Lock,
    Globe,
    ExternalLink,
    Clock,
    UserCheck,
    Users,
    FileText,
    Loader2,
} from 'lucide-react';
import { getOptimizedImageUrl } from '@/lib/utils';
import { SharedStoryPost, formatGuestAccessTime } from '../types';

interface SharesTabProps {
    isActive: boolean;
    sharedPosts: SharedStoryPost[];
    isLoading: boolean;
    searchQuery: string;
    onOpenShareDialog: (post: { id: string; title: string }) => void;
}

export const SharesTab = memo(
    function SharesTab({
        isActive,
        sharedPosts,
        isLoading,
        searchQuery,
        onOpenShareDialog,
    }: SharesTabProps) {
        const [sharesPage, setSharesPage] = useState(1);
        const [sharesAccessFilter, setSharesAccessFilter] = useState<'all' | 'restricted' | 'public'>('all');

        const lowercaseSearch = useMemo(() => searchQuery.toLowerCase(), [searchQuery]);

        const filteredSharedPosts = useMemo(() => {
            return sharedPosts.filter((post) => {
                const matchesQuery =
                    !lowercaseSearch ||
                    post.title.toLowerCase().includes(lowercaseSearch) ||
                    post.author.toLowerCase().includes(lowercaseSearch) ||
                    (post.translator && post.translator.toLowerCase().includes(lowercaseSearch)) ||
                    post.guestUsers.some(
                        (u) =>
                            u.email.toLowerCase().includes(lowercaseSearch) ||
                            u.name.toLowerCase().includes(lowercaseSearch)
                    );

                const matchesFilter =
                    sharesAccessFilter === 'all' || post.accessType === sharesAccessFilter;

                return matchesQuery && matchesFilter;
            });
        }, [sharedPosts, lowercaseSearch, sharesAccessFilter]);

        const totalSharesPages = Math.max(1, Math.ceil(filteredSharedPosts.length / 10));
        const paginatedSharedPosts = useMemo(() => {
            const page = Math.min(sharesPage, totalSharesPages);
            return filteredSharedPosts.slice((page - 1) * 10, page * 10);
        }, [filteredSharedPosts, sharesPage, totalSharesPages]);

        return (
            <div className={isActive ? 'space-y-4' : 'hidden'} aria-hidden={!isActive}>
                {/* Filter mode bar */}
                <div className="flex items-center justify-between gap-3 px-3 py-2 sm:px-4 rounded-[8px] bg-card/40 border border-border/60">
                    <span className="text-xs text-muted-foreground font-medium">Chế độ hiển thị:</span>
                    <div className="flex items-center gap-1.5">
                        {(['all', 'restricted', 'public'] as const).map((filterVal) => (
                            <button
                                key={filterVal}
                                type="button"
                                onClick={() => {
                                    setSharesAccessFilter(filterVal);
                                    setSharesPage(1);
                                }}
                                className={`px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors cursor-pointer ${
                                    sharesAccessFilter === filterVal
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'bg-secondary/70 text-foreground/80 hover:bg-secondary hover:text-foreground border border-border/60'
                                }`}
                            >
                                {filterVal === 'all' ? 'Tất cả' : filterVal === 'restricted' ? 'Giới hạn' : 'Công khai'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="min-h-[360px] lg:min-h-[680px]">
                    {/* Mobile card view */}
                    <div className="md:hidden p-3 space-y-3">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center rounded-[8px] border border-border/60 bg-card/40 px-4 py-12 text-center text-neutral-500">
                                <Loader2 className="w-8 h-8 animate-spin mb-3 text-primary" />
                                <p className="text-sm">Đang tải danh sách chia sẻ...</p>
                            </div>
                        ) : filteredSharedPosts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-[8px] border border-border/60 bg-card/40 px-4 py-12 text-center">
                                <Share2 className="w-10 h-10 mb-3 text-primary/80" />
                                <p className="text-sm font-medium text-foreground/90">
                                    {searchQuery ? 'Không tìm thấy kết quả phù hợp' : 'Chưa có truyện nào được khách truy cập'}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                                    {searchQuery
                                        ? 'Thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc.'
                                        : 'Khi người dùng có vai trò Khách (guest) truy cập đọc truyện, danh sách sẽ hiển thị tại đây.'}
                                </p>
                            </div>
                        ) : (
                            paginatedSharedPosts.map((post) => (
                                <article key={post._id} className="rounded-[8px] border border-border/70 bg-card/55 p-3.5 shadow-sm space-y-3">
                                    <div className="flex items-start gap-3">
                                        <div className="relative w-14 h-20 rounded-[8px] overflow-hidden bg-secondary shrink-0 border border-border/50">
                                            {post.thumbnail ? (
                                                <Image
                                                    src={getOptimizedImageUrl(post.thumbnail)}
                                                    alt={post.title}
                                                    fill
                                                    className="object-cover"
                                                    unoptimized
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                                    <FileText className="w-6 h-6" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span
                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[10px] font-medium ${
                                                        post.accessType === 'restricted'
                                                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                                    }`}
                                                >
                                                    {post.accessType === 'restricted' ? (
                                                        <>
                                                            <Lock className="w-2.5 h-2.5" />
                                                            Giới hạn
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Globe className="w-2.5 h-2.5" />
                                                            Công khai
                                                        </>
                                                    )}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground">
                                                    {post.guestUsers.length} khách đọc
                                                </span>
                                            </div>
                                            <h4 className="text-sm font-semibold text-foreground mt-1 line-clamp-2">{post.title}</h4>
                                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{post.author}</p>
                                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1">
                                                <Clock className="w-3 h-3 text-primary/70" />
                                                <span>Gần nhất: {formatGuestAccessTime(post.lastGuestAccess)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-secondary/40 rounded-[8px] p-2.5 space-y-2 border border-border/40">
                                        <p className="text-[11px] font-medium text-foreground/80 flex items-center gap-1.5">
                                            <Users className="w-3.5 h-3.5 text-primary" />
                                            Khách đã truy cập ({post.guestUsers.length})
                                        </p>
                                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                            {post.guestUsers.map((guest, idx) => (
                                                <div key={idx} className="flex items-center justify-between gap-2 text-xs py-1 border-b border-border/30 last:border-0">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className="relative w-6 h-6 rounded-full overflow-hidden bg-secondary border border-border shrink-0">
                                                            {guest.avatar ? (
                                                                <Image src={getOptimizedImageUrl(guest.avatar)} alt={guest.name} fill className="object-cover" unoptimized />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-[10px] font-semibold text-primary">
                                                                    {(guest.name || guest.email || '?').charAt(0).toUpperCase()}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-medium text-foreground truncate leading-tight">{guest.name}</p>
                                                            <p className="text-[10px] text-muted-foreground truncate leading-tight">{guest.email}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <span className="inline-block px-1.5 py-0.5 rounded text-[9px] bg-primary/10 text-primary font-medium">
                                                            Khách
                                                        </span>
                                                        <p className="text-[9px] text-muted-foreground mt-0.5">{formatGuestAccessTime(guest.lastAccessedAt)}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 pt-1">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => onOpenShareDialog({ id: post._id, title: post.title })}
                                            className="h-8 text-xs rounded-[8px] border-primary/40 text-primary hover:bg-primary/10"
                                        >
                                            <Share2 className="w-3.5 h-3.5 mr-1.5" />
                                            Quản lý chia sẻ
                                        </Button>
                                        <Link
                                            href={`/posts/${post._id}`}
                                            target="_blank"
                                            className="inline-flex items-center justify-center h-8 text-xs font-medium rounded-[8px] bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                                            Xem truyện
                                        </Link>
                                    </div>
                                </article>
                            ))
                        )}
                    </div>

                    {/* Desktop table view */}
                    <div className="hidden md:block overflow-x-auto">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-24 text-neutral-500">
                                <Loader2 className="w-8 h-8 animate-spin mb-3 text-primary" />
                                <p className="text-sm">Đang tải danh sách chia sẻ...</p>
                            </div>
                        ) : filteredSharedPosts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 text-center px-4">
                                <Share2 className="w-12 h-12 mb-3 text-primary/70" />
                                <h3 className="text-base font-semibold text-foreground">
                                    {searchQuery ? 'Không tìm thấy truyện phù hợp' : 'Chưa có truyện nào được khách truy cập'}
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                                    {searchQuery
                                        ? 'Vui lòng kiểm tra lại từ khóa tìm kiếm hoặc đổi chế độ lọc.'
                                        : 'Khi người dùng với vai trò Khách (guest) truy cập link đọc truyện, hệ thống sẽ tự động cập nhật danh sách tại đây.'}
                                </p>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse border-b border-border/60">
                                <thead>
                                    <tr className="border-b border-border/60 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-secondary/30">
                                        <th className="px-5 py-3.5 text-center w-16 border-r border-border/40 last:border-r-0">STT</th>
                                        <th className="px-5 py-3.5 min-w-[280px] border-r border-border/40 last:border-r-0">Bộ truyện</th>
                                        <th className="px-5 py-3.5 min-w-[280px] border-r border-border/40 last:border-r-0">Khách truy cập</th>
                                        <th className="px-5 py-3.5 text-center min-w-[150px] border-r border-border/40 last:border-r-0">Lần đọc gần nhất</th>
                                        <th className="px-5 py-3.5 text-center w-48 border-r border-border/40 last:border-r-0">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40 text-sm">
                                    {paginatedSharedPosts.map((post, index) => (
                                        <tr key={post._id} className="hover:bg-secondary/40 transition-colors">
                                            <td className="px-5 py-4 text-center text-muted-foreground font-medium border-r border-border/40 last:border-r-0">
                                                {(sharesPage - 1) * 10 + index + 1}
                                            </td>
                                            <td className="px-5 py-4 border-r border-border/40 last:border-r-0">
                                                <div className="flex items-center gap-3">
                                                    <div className="relative w-12 h-16 rounded-[8px] overflow-hidden bg-secondary shrink-0 border border-border/50">
                                                        {post.thumbnail ? (
                                                            <Image
                                                                src={getOptimizedImageUrl(post.thumbnail)}
                                                                alt={post.title}
                                                                fill
                                                                className="object-cover"
                                                                unoptimized
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                                                <FileText className="w-5 h-5" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span
                                                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[10px] font-medium ${
                                                                    post.accessType === 'restricted'
                                                                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                                                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                                                }`}
                                                            >
                                                                {post.accessType === 'restricted' ? (
                                                                    <>
                                                                        <Lock className="w-2.5 h-2.5" />
                                                                        Giới hạn
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Globe className="w-2.5 h-2.5" />
                                                                        Công khai
                                                                    </>
                                                                )}
                                                            </span>
                                                        </div>
                                                        <p className="font-semibold text-foreground line-clamp-1 text-sm">{post.title}</p>
                                                        <p className="text-xs text-muted-foreground mt-0.5">{post.author}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 border-r border-border/40 last:border-r-0">
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                                                            <UserCheck className="w-3 h-3" />
                                                            {post.guestUsers.length} tài khoản khách
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col gap-1 max-h-24 overflow-y-auto pr-1">
                                                        {post.guestUsers.slice(0, 3).map((guest, i) => (
                                                            <div key={i} className="flex items-center gap-2 text-xs">
                                                                <div className="relative w-5 h-5 rounded-full overflow-hidden bg-secondary shrink-0 border border-border">
                                                                    {guest.avatar ? (
                                                                        <Image src={getOptimizedImageUrl(guest.avatar)} alt={guest.name} fill className="object-cover" unoptimized />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-primary">
                                                                            {(guest.name || guest.email || '?').charAt(0).toUpperCase()}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <span className="font-medium text-foreground truncate max-w-[140px]">{guest.name}</span>
                                                                <span className="text-[11px] text-muted-foreground truncate max-w-[160px]">({guest.email})</span>
                                                            </div>
                                                        ))}
                                                        {post.guestUsers.length > 3 && (
                                                            <p className="text-[11px] text-muted-foreground italic">
                                                                + và {post.guestUsers.length - 3} khách khác...
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-center text-xs text-muted-foreground border-r border-border/40 last:border-r-0 whitespace-nowrap">
                                                {formatGuestAccessTime(post.lastGuestAccess)}
                                            </td>
                                            <td className="px-5 py-4 border-r border-border/40 last:border-r-0">
                                                <div className="flex items-center justify-center gap-2">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => onOpenShareDialog({ id: post._id, title: post.title })}
                                                        className="h-8 text-xs rounded-[8px] border-primary/40 text-primary hover:bg-primary/10"
                                                    >
                                                        <Share2 className="w-3.5 h-3.5 mr-1.5" />
                                                        Quản lý chia sẻ
                                                    </Button>
                                                    <Link
                                                        href={`/posts/${post._id}`}
                                                        target="_blank"
                                                        className="p-2 text-foreground/80 hover:text-primary hover:bg-secondary/80 rounded-[8px] transition-colors"
                                                        title="Xem bài viết (tab mới)"
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Pagination */}
                    {filteredSharedPosts.length > 0 && (
                        <div className="px-3 sm:px-5 py-3 border-t border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <p className="text-xs text-muted-foreground">
                                Trang {sharesPage}/{totalSharesPages} • Hiển thị {paginatedSharedPosts.length}/{filteredSharedPosts.length} bộ truyện
                            </p>
                            {totalSharesPages > 1 && (
                                <div className="flex items-center gap-1.5">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-8 rounded-[8px]"
                                        onClick={() => setSharesPage((prev) => Math.max(1, prev - 1))}
                                        disabled={sharesPage === 1}
                                    >
                                        Trước
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-8 rounded-[8px]"
                                        onClick={() => setSharesPage((prev) => Math.min(totalSharesPages, prev + 1))}
                                        disabled={sharesPage >= totalSharesPages}
                                    >
                                        Sau
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    },
    (prev, next) => {
        if (!prev.isActive && !next.isActive) return true;
        return (
            prev.isActive === next.isActive &&
            prev.sharedPosts === next.sharedPosts &&
            prev.isLoading === next.isLoading &&
            prev.searchQuery === next.searchQuery &&
            prev.onOpenShareDialog === next.onOpenShareDialog
        );
    }
);

'use client';

import { useState, useMemo, memo } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { FileText, Pencil, Trash2, Loader2, Tag } from 'lucide-react';
import { getOptimizedImageUrl } from '@/lib/utils';
import { Post } from '../types';

interface PostsTabProps {
    isActive: boolean;
    posts: Post[];
    isLoading: boolean;
    searchQuery: string;
    onSearchTagClick: (tag: string) => void;
    availablePostTags: string[];
    onEditPost: (post: Post) => void;
    onDeletePost: (post: Post) => void;
}

export const PostsTab = memo(
    function PostsTab({
        isActive,
        posts,
        isLoading,
        searchQuery,
        onSearchTagClick,
        availablePostTags,
        onEditPost,
        onDeletePost,
    }: PostsTabProps) {
        const [postsPage, setPostsPage] = useState(1);
        const [postsPerPage, setPostsPerPage] = useState<number | 'all'>(15);

        const lowercaseSearch = useMemo(() => searchQuery.toLowerCase(), [searchQuery]);

        const filteredPosts = useMemo(() => {
            if (!lowercaseSearch) return posts;
            return posts.filter(
                (post) =>
                    post.title.toLowerCase().includes(lowercaseSearch) ||
                    post.author.toLowerCase().includes(lowercaseSearch) ||
                    (post.translator && post.translator.toLowerCase().includes(lowercaseSearch)) ||
                    (post.tags || []).some((tag) => tag.toLowerCase().includes(lowercaseSearch))
            );
        }, [posts, lowercaseSearch]);

        const totalPostsPages = useMemo(() => {
            if (postsPerPage === 'all') return 1;
            return Math.max(1, Math.ceil(filteredPosts.length / postsPerPage));
        }, [filteredPosts.length, postsPerPage]);

        const paginatedPosts = useMemo(() => {
            if (postsPerPage === 'all') return filteredPosts;
            const page = Math.min(postsPage, totalPostsPages);
            return filteredPosts.slice((page - 1) * postsPerPage, page * postsPerPage);
        }, [filteredPosts, postsPage, postsPerPage, totalPostsPages]);

        return (
            <div className={isActive ? 'space-y-4 sm:space-y-6' : 'hidden'} aria-hidden={!isActive}>
                {/* Tag List Banner */}
                {availablePostTags.length > 0 && (
                    <div className="bg-card/50 backdrop-blur-md p-3 sm:p-5 rounded-[8px] border border-border shadow-md">
                        <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-3 flex items-center gap-2">
                            <Tag className="w-4 h-4 text-primary" />
                            Danh sách Tag đã sử dụng ({availablePostTags.length})
                        </h3>
                        <div className="flex flex-wrap gap-2 mt-3">
                            {availablePostTags.map((tag) => (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={() => onSearchTagClick(tag)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-medium bg-card text-primary border border-border hover:border-primary/60 dark:hover:border-primary/75 hover:text-primary transition-colors cursor-pointer"
                                    title={`Lọc bài viết theo thẻ: ${tag}`}
                                >
                                    #{tag}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Posts Content */}
                <div className="min-h-[360px] lg:min-h-[680px]">
                    {/* Mobile card view */}
                    <div className="md:hidden p-3 space-y-3">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center rounded-[8px] border border-border/60 bg-card/40 px-4 py-12 text-center text-neutral-500">
                                <Loader2 className="w-8 h-8 animate-spin mb-3 text-primary" />
                                <p className="text-sm">Đang tải...</p>
                            </div>
                        ) : filteredPosts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-[8px] border border-border/60 bg-card/40 px-4 py-12 text-center">
                                <FileText className="w-10 h-10 mb-3 text-primary/80" />
                                <p className="text-sm font-medium text-foreground/90">
                                    {searchQuery ? 'Không tìm thấy' : 'Chưa có bài viết'}
                                </p>
                            </div>
                        ) : (
                            paginatedPosts.map((post) => (
                                <article
                                    key={post._id}
                                    className="rounded-[8px] border border-border/70 bg-card/55 p-3 shadow-sm"
                                >
                                    <div className="flex gap-3">
                                        <div className="relative flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-card">
                                            {post.images[0] ? (
                                                <Image
                                                    src={getOptimizedImageUrl(post.images[0])}
                                                    alt={post.title}
                                                    fill
                                                    className="object-cover object-top"
                                                    unoptimized
                                                />
                                            ) : (
                                                <FileText className="w-7 h-7 text-primary/80" />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">
                                                {post.title}
                                            </p>
                                            {post.tags && post.tags.length > 0 ? (
                                                <div className="mt-2 flex flex-wrap gap-1">
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
                                                <p className="mt-1 text-xs text-muted-foreground/80">
                                                    Chưa gắn tag
                                                </p>
                                            )}
                                            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                                                <span className="truncate">{post.author}</span>
                                                <span className="text-right whitespace-nowrap">
                                                    {new Date(post.createdAt).toLocaleDateString('vi-VN', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: 'numeric',
                                                    })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => onEditPost(post)}
                                            className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] border border-border bg-background/70 text-xs font-medium text-foreground/85 transition-colors hover:bg-secondary hover:text-primary"
                                        >
                                            <Pencil className="w-4 h-4" />
                                            Sửa
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onDeletePost(post)}
                                            className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] border border-border bg-background/70 text-xs font-medium text-foreground/85 transition-colors hover:bg-secondary hover:text-primary"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Xóa
                                        </button>
                                    </div>
                                </article>
                            ))
                        )}
                    </div>

                    {/* Desktop table view */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-center">
                            <thead>
                                <tr className="text-xs font-medium text-muted-foreground border-b border-border">
                                    <th className="px-5 py-4 text-left border-r border-border/60 last:border-r-0">
                                        Bài viết
                                    </th>
                                    <th className="px-5 py-4 text-center border-r border-border/60 last:border-r-0">
                                        Tác giả
                                    </th>
                                    <th className="px-5 py-4 text-center border-r border-border/60 last:border-r-0">
                                        Ngày tạo
                                    </th>
                                    <th className="px-5 py-4 text-center border-r border-border/60 last:border-r-0">
                                        Thao tác
                                    </th>
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
                                        <td colSpan={4} className="px-5 py-16 text-center">
                                            <div className="mx-auto flex w-fit flex-col items-center px-6 py-5">
                                                <FileText className="w-10 h-10 mx-auto mb-3 text-primary/80" />
                                                <p className="text-sm font-medium text-foreground/90">
                                                    {searchQuery ? 'Không tìm thấy' : 'Chưa có bài viết'}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedPosts.map((post) => (
                                        <tr
                                            key={post._id}
                                            className="group hover:bg-secondary/70 dark:hover:bg-primary/10 transition-colors"
                                        >
                                            <td className="px-5 py-4 text-left border-r border-border/40 last:border-r-0">
                                                <div className="flex items-center justify-start gap-4">
                                                    <div className="relative w-12 h-12 rounded-[8px] overflow-hidden bg-card shrink-0">
                                                        {post.images[0] ? (
                                                            <Image
                                                                src={getOptimizedImageUrl(post.images[0])}
                                                                alt={post.title}
                                                                fill
                                                                className="object-cover"
                                                                unoptimized
                                                            />
                                                        ) : (
                                                            <FileText className="w-6 h-6 m-3 text-primary/80" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 max-w-xs text-left">
                                                        <p className="text-sm font-medium text-foreground truncate">
                                                            {post.title}
                                                        </p>
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
                                                            <p className="text-xs text-muted-foreground/80 mt-0.5">
                                                                Chưa gắn tag
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-sm text-foreground/90 text-center border-r border-border/40 last:border-r-0">
                                                {post.author}
                                            </td>
                                            <td className="px-5 py-4 text-sm text-muted-foreground text-center whitespace-nowrap border-r border-border/40 last:border-r-0">
                                                {new Date(post.createdAt).toLocaleDateString('vi-VN', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric',
                                                })}
                                            </td>
                                            <td className="px-5 py-4 border-r border-border/40 last:border-r-0">
                                                <div className="flex justify-center gap-2">
                                                    <button
                                                        onClick={() => onEditPost(post)}
                                                        className="p-2 text-foreground/85 hover:text-primary dark:hover:text-primary/80 hover:bg-secondary/80 rounded-[8px] transition-colors cursor-pointer"
                                                        title="Chỉnh sửa"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => onDeletePost(post)}
                                                        className="p-2 text-foreground/85 hover:text-primary hover:bg-secondary/80 rounded-[8px] transition-colors cursor-pointer"
                                                        title="Xóa"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {filteredPosts.length > 0 && (
                        <div className="px-3 sm:px-5 py-3 border-t border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <p className="text-xs text-muted-foreground">
                                {postsPerPage === 'all'
                                    ? `Hiển thị tất cả ${filteredPosts.length} bài viết`
                                    : `Trang ${postsPage}/${totalPostsPages} • Hiển thị ${paginatedPosts.length}/${filteredPosts.length} bài viết`}
                            </p>
                            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <span>Số lượng:</span>
                                    <select
                                        value={postsPerPage}
                                        onChange={(e) => {
                                            const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                                            setPostsPerPage(val);
                                            setPostsPage(1);
                                        }}
                                        className="h-8 px-2 text-xs rounded-[8px] bg-secondary/80 border border-border text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                                    >
                                        <option value={10}>10 / trang</option>
                                        <option value={15}>15 / trang</option>
                                        <option value={30}>30 / trang</option>
                                        <option value="all">Tất cả ({filteredPosts.length})</option>
                                    </select>
                                </div>
                                {postsPerPage !== 'all' && totalPostsPages > 1 && (
                                    <div className="flex items-center gap-1.5">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-8 rounded-[8px]"
                                            onClick={() => setPostsPage((prev) => Math.max(1, prev - 1))}
                                            disabled={postsPage === 1}
                                        >
                                            Trước
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-8 rounded-[8px]"
                                            onClick={() => setPostsPage((prev) => Math.min(totalPostsPages, prev + 1))}
                                            disabled={postsPage >= totalPostsPages}
                                        >
                                            Sau
                                        </Button>
                                    </div>
                                )}
                            </div>
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
            prev.posts === next.posts &&
            prev.isLoading === next.isLoading &&
            prev.searchQuery === next.searchQuery &&
            prev.availablePostTags === next.availablePostTags &&
            prev.onEditPost === next.onEditPost &&
            prev.onDeletePost === next.onDeletePost &&
            prev.onSearchTagClick === next.onSearchTagClick
        );
    }
);

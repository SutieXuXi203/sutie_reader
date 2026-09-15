'use client';

import { useMemo, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tag, Pencil, Trash2, Loader2, Plus } from 'lucide-react';

interface TagsTabProps {
    availablePostTags: string[];
    tagCounts: Record<string, number>;
    newTagName: string;
    onNewTagNameChange: (val: string) => void;
    isCreatingTag: boolean;
    onCreateTag: (e: React.FormEvent) => void;
    editingTag: { oldName: string; newName: string } | null;
    onEditingTagChange: (val: { oldName: string; newName: string } | null) => void;
    isUpdatingTag: boolean;
    onUpdateTag: () => void;
    onDeleteTag: (tag: string) => void;
    searchQuery: string;
}

export const TagsTab = memo(function TagsTab({
    availablePostTags,
    tagCounts,
    newTagName,
    onNewTagNameChange,
    isCreatingTag,
    onCreateTag,
    editingTag,
    onEditingTagChange,
    isUpdatingTag,
    onUpdateTag,
    onDeleteTag,
    searchQuery,
}: TagsTabProps) {
    const lowercaseSearch = useMemo(() => searchQuery.toLowerCase(), [searchQuery]);

    const filteredTagNames = useMemo(
        () => availablePostTags.filter((tag) => tag.includes(lowercaseSearch)),
        [availablePostTags, lowercaseSearch]
    );

    return (
        <div className="space-y-4">
            {/* Form tạo tag mới */}
            <div className="p-3 sm:p-4 rounded-[8px] border border-border bg-card/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                    <h3 className="text-sm font-semibold text-foreground">Thêm thẻ Tag mới</h3>
                    <p className="text-xs text-muted-foreground">Tạo thẻ tag chuẩn hóa trước để dùng cho bài viết</p>
                </div>
                <form onSubmit={onCreateTag} className="flex gap-2 w-full sm:w-auto">
                    <Input
                        placeholder="Tên tag mới..."
                        value={newTagName}
                        onChange={(e) => onNewTagNameChange(e.target.value)}
                        className="h-9 text-sm bg-background border-border rounded-[8px] text-foreground placeholder:text-muted-foreground w-full sm:w-48"
                        disabled={isCreatingTag}
                        maxLength={30}
                    />
                    <Button
                        type="submit"
                        disabled={isCreatingTag || !newTagName.trim()}
                        className="h-9 px-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-[8px] font-medium text-xs sm:text-sm shrink-0"
                    >
                        {isCreatingTag ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <>
                                <Plus className="w-4 h-4 mr-1.5" />
                                <span>Thêm</span>
                            </>
                        )}
                    </Button>
                </form>
            </div>

            {/* Danh sách thẻ tag */}
            <div className="min-h-[360px] lg:min-h-[680px]">
                {/* Mobile view */}
                <div className="md:hidden p-3 space-y-3">
                    {filteredTagNames.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-[8px] border border-border/60 bg-card/40 px-4 py-12 text-center text-foreground/80">
                            <Tag className="w-10 h-10 mb-3 text-primary/80" />
                            <p className="text-sm">{searchQuery ? 'Không tìm thấy tag' : 'Chưa có tag'}</p>
                        </div>
                    ) : (
                        filteredTagNames.map((tag) => (
                            <article key={tag} className="rounded-[8px] border border-border/70 bg-card/55 p-3 shadow-sm">
                                {editingTag?.oldName === tag ? (
                                    <div className="space-y-3">
                                        <Input
                                            value={editingTag.newName}
                                            onChange={(e) => onEditingTagChange({ ...editingTag, newName: e.target.value })}
                                            className="h-10 text-sm text-foreground"
                                            autoFocus
                                            disabled={isUpdatingTag}
                                        />
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-9 rounded-[8px] text-muted-foreground"
                                                onClick={() => onEditingTagChange(null)}
                                                disabled={isUpdatingTag}
                                            >
                                                Hủy
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="h-9 rounded-[8px] bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20"
                                                onClick={onUpdateTag}
                                                disabled={isUpdatingTag}
                                            >
                                                {isUpdatingTag ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lưu'}
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <span className="inline-flex max-w-full items-center gap-1.5 rounded-[8px] border border-border bg-card px-3 py-1.5 text-sm font-medium text-primary">
                                                    <span className="truncate">#{tag}</span>
                                                </span>
                                                <p className="mt-2 text-xs text-muted-foreground">
                                                    {tagCounts[tag] || 0} bài viết đang sử dụng
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-3 grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => onEditingTagChange({ oldName: tag, newName: tag })}
                                                className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] border border-border bg-background/70 text-xs font-medium text-foreground/85 transition-colors hover:bg-secondary hover:text-primary"
                                            >
                                                <Pencil className="w-4 h-4" />
                                                Sửa
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => onDeleteTag(tag)}
                                                className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] border border-border bg-background/70 text-xs font-medium text-foreground/85 transition-colors hover:bg-secondary hover:text-primary"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Xóa
                                            </button>
                                        </div>
                                    </>
                                )}
                            </article>
                        ))
                    )}
                </div>

                {/* Desktop table view */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-center">
                        <thead>
                            <tr className="text-xs font-medium text-muted-foreground border-b border-border">
                                <th className="px-5 py-4 text-center border-r border-border/60 last:border-r-0">Tên thẻ (Tag)</th>
                                <th className="px-5 py-4 text-center border-r border-border/60 last:border-r-0">Số bài viết đang sử dụng</th>
                                <th className="px-5 py-4 text-center border-r border-border/60 last:border-r-0">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredTagNames.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-5 py-16 text-center text-muted-foreground">
                                        <Tag className="w-10 h-10 mx-auto mb-3 text-primary/80" />
                                        <p className="text-sm">{searchQuery ? 'Không tìm thấy tag phù hợp' : 'Chưa có tag nào'}</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredTagNames.map((tag) => (
                                    <tr key={tag} className="group hover:bg-secondary/70 dark:hover:bg-primary/10 transition-colors">
                                        <td className="px-5 py-4 border-r border-border/40 last:border-r-0">
                                            {editingTag?.oldName === tag ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <Input
                                                        value={editingTag.newName}
                                                        onChange={(e) => onEditingTagChange({ ...editingTag, newName: e.target.value })}
                                                        className="h-8 text-sm text-foreground max-w-xs"
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
                                                            onClick={() => onEditingTagChange(null)}
                                                            disabled={isUpdatingTag}
                                                        >
                                                            Hủy
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            className="h-8 rounded-[8px] bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20"
                                                            onClick={onUpdateTag}
                                                            disabled={isUpdatingTag}
                                                        >
                                                            {isUpdatingTag ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lưu'}
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => onEditingTagChange({ oldName: tag, newName: tag })}
                                                            className="p-2 text-foreground/85 hover:text-primary dark:hover:text-primary/80 hover:bg-secondary/80 rounded-[8px] transition-colors"
                                                            title="Sửa tên tag trên toàn bộ bài viết"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => onDeleteTag(tag)}
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
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
});

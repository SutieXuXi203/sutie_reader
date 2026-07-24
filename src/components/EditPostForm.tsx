'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, X } from 'lucide-react';
import Image from 'next/image';
import imageCompression from 'browser-image-compression';
import { getOptimizedImageUrl } from '@/lib/utils';
import { TagPicker } from '@/components/TagPicker';
import { notify } from '@/lib/notify';
import { useUploadProgress } from '@/providers/UploadProgressProvider';

interface Post {
    _id: string;
    title: string;
    description?: string;
    tags?: string[];
    content: string;
    images: string[];
    author: string;
}

interface EditPostFormProps {
    post: Post;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onPostUpdated: () => void;
    availableTags?: string[];
}

export function EditPostForm({ post, open, onOpenChange, onPostUpdated, availableTags = [] }: EditPostFormProps) {
    const { showProgress, updateProgress } = useUploadProgress();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [title, setTitle] = useState(post.title);
    const [tags, setTags] = useState<string[]>(post.tags || []);
    const [content, setContent] = useState(post.content || '');
    const [author, setAuthor] = useState(post.author);

    const [keptImages, setKeptImages] = useState<string[]>(post.images);
    const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
    const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);

    useEffect(() => {
        setTitle(post.title);
        setTags(post.tags || []);
        setContent(post.content || '');
        setAuthor(post.author);
        setKeptImages(post.images);
        setNewImageFiles([]);
        setNewImagePreviews([]);
    }, [post, open]);

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (!selectedFiles.length) return;

        e.target.value = '';

        const allNewFiles = [...newImageFiles, ...selectedFiles].sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );

        setNewImageFiles(allNewFiles);

        const previewPromises = allNewFiles.map((file) => {
            return new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(file);
            });
        });

        const sortedPreviews = await Promise.all(previewPromises);
        setNewImagePreviews(sortedPreviews);
    };

    const removeKept = (idx: number) =>
        setKeptImages((prev) => prev.filter((_, i) => i !== idx));

    const removeNew = (idx: number) => {
        setNewImageFiles((prev) => prev.filter((_, i) => i !== idx));
        setNewImagePreviews((prev) => prev.filter((_, i) => i !== idx));
    };

    const uploadNewImages = async (
        files: File[],
        uploadTitle: string,
        postId: string,
        onProgress?: (completed: number, total: number) => void
    ): Promise<string[]> => {
        if (!files.length) return [];

        const tokenRes = await fetch('/api/auth/token');
        if (!tokenRes.ok) {
            const errData = await tokenRes.json().catch(() => ({}));
            throw new Error(errData?.error || 'Không lấy được phiên đăng nhập Admin');
        }
        const { token } = await tokenRes.json();

        const workerUrl = (process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_URL || 'https://sutie-images.manhdinh0410.workers.dev').replace(/\/+$/, '');

        const sortedFiles = [...files].sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );

        const BATCH_SIZE = 2;
        const allUrls: string[] = [];

        for (let i = 0; i < sortedFiles.length; i += BATCH_SIZE) {
            const batchFiles = sortedFiles.slice(i, i + BATCH_SIZE);

            const compressedBatch = await Promise.all(
                batchFiles.map(async (file) => {
                    if (file.size <= 500 * 1024) return file;
                    try {
                        return await imageCompression(file, {
                            maxSizeMB: 1,
                            maxWidthOrHeight: 1920,
                            useWebWorker: true,
                        });
                    } catch (error) {
                        console.error('Lỗi khi nén ảnh:', error);
                        return file;
                    }
                })
            );

            const formData = new FormData();
            formData.append('title', uploadTitle);
            if (postId) formData.append('postId', postId);
            compressedBatch.forEach((compressed, idx) => formData.append('files', compressed, batchFiles[idx].name));

            const res = await fetch(`${workerUrl}/upload`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formData,
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.details || data?.error || `Upload thất bại ở nhóm ảnh ${Math.floor(i / BATCH_SIZE) + 1}`);
            }

            const { urls } = await res.json();
            allUrls.push(...(urls as string[]));

            onProgress?.(allUrls.length, sortedFiles.length);
        }

        return allUrls;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            notify.error('Vui lòng điền tiêu đề');
            return;
        }
        if (keptImages.length + newImageFiles.length === 0) {
            notify.error('Cần có ít nhất một hình ảnh');
            return;
        }

        const currentTitle = title;
        const currentContent = content;
        const currentAuthor = author;
        const currentTags = tags;
        const currentKept = [...keptImages];
        const currentNewFiles = [...newImageFiles];

        setIsSubmitting(true);

        // Đóng dialog chỉnh sửa ngay lập tức
        onOpenChange(false);

        if (currentNewFiles.length > 0) {
            showProgress(`Đang cập nhật "${currentTitle}"`, currentNewFiles.length);
        }

        try {
            const newUrls = await uploadNewImages(currentNewFiles, currentTitle, post._id, (completed, total) => {
                updateProgress(completed, total, 'uploading');
            });

            if (currentNewFiles.length > 0) {
                updateProgress(currentNewFiles.length, currentNewFiles.length, 'saving');
            }

            const allImages = [...currentKept, ...newUrls];
            const response = await fetch(`/api/posts/${post._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: currentTitle,
                    tags: currentTags,
                    content: currentContent,
                    author: currentAuthor,
                    images: allImages,
                }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data?.details || data?.error || `Server error ${response.status}`);
            }

            if (currentNewFiles.length > 0) {
                updateProgress(currentNewFiles.length, currentNewFiles.length, 'success');
                setTimeout(() => {
                    // Tự đóng sau 4s
                }, 4000);
            } else {
                notify.success('Cập nhật bài viết thành công');
            }

            onPostUpdated();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            notify.error('Cập nhật không thành công', message);
            console.error('Lỗi khi cập nhật bài viết:', err);

            if (currentNewFiles.length > 0) {
                updateProgress(0, currentNewFiles.length, 'error', message);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-w-2xl max-h-[85vh] overflow-y-auto overscroll-contain custom-scrollbar rounded-[12px] border border-border shadow-2xl dark:shadow-primary/20 bg-popover text-popover-foreground p-6 space-y-5"
            >
                <DialogHeader>
                    <DialogTitle className="text-xl font-medium">Chỉnh sửa bài viết</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Tiêu đề</label>
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tiêu đề" maxLength={100} disabled={isSubmitting} className="rounded-[8px]" />
                        <p className="text-xs text-muted-foreground mt-1">{title.length}/100</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Tag (không bắt buộc)</label>
                        <TagPicker
                            selectedTags={tags}
                            onChange={setTags}
                            availableTags={availableTags}
                            disabled={isSubmitting}
                            placeholder="Nhập tag rồi nhấn Enter"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Nội dung (không bắt buộc)</label>
                        <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Nội dung bài viết" rows={4} disabled={isSubmitting} className="rounded-[8px]" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Tác giả (tuỳ chọn)</label>
                        <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Tên của bạn" disabled={isSubmitting} className="rounded-[8px]" />
                    </div>
                    {keptImages.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Ảnh hiện tại ({keptImages.length})</label>
                            <div className="max-h-60 overflow-y-auto rounded-lg border border-border/60 p-3 bg-muted/20 custom-scrollbar">
                                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                                    {keptImages.map((src, idx) => (
                                        <div key={idx} className="relative group bg-slate-100 dark:bg-slate-800 rounded-[10px] overflow-hidden h-28 border border-border/40 shadow-sm hover:shadow-md transition-all">
                                            <span className="absolute top-1.5 left-1.5 bg-black/75 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm z-10 border border-white/20 select-none shadow">
                                                #{idx + 1}
                                            </span>
                                            <Image src={getOptimizedImageUrl(src)} alt={`Ảnh ${idx + 1}`} fill className="object-cover transition-transform duration-300 group-hover:scale-105" unoptimized />
                                            <button type="button" onClick={() => removeKept(idx)} title="Xóa ảnh" aria-label="Xóa ảnh"
                                                className="absolute top-1.5 right-1.5 bg-rose-600 hover:bg-rose-700 active:scale-90 text-white p-1.5 rounded-full shadow-md hover:shadow-rose-500/30 transition-all cursor-pointer z-10 border border-white/40 flex items-center justify-center">
                                                <X className="h-3.5 w-3.5 stroke-[2.5]" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Thêm ảnh mới</label>
                        <div className="border border-input rounded-[8px] p-6 text-center hover:bg-secondary/60 dark:hover:bg-secondary/40 transition-colors">
                            <input type="file" multiple accept="image/*" onChange={handleImageSelect} disabled={isSubmitting} className="hidden" id="edit-image-input" />
                            <label htmlFor="edit-image-input" className="cursor-pointer block">
                                <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                                <p className="text-sm text-foreground/80">Click để tải ảnh lên</p>
                                <p className="text-xs text-muted-foreground mt-1">PNG, JPG, GIF tối đa 50MB</p>
                            </label>
                        </div>
                    </div>
                    {newImagePreviews.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Ảnh mới ({newImagePreviews.length})</label>
                            <div className="max-h-60 overflow-y-auto rounded-lg border border-border/60 p-3 bg-muted/20 custom-scrollbar">
                                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                                    {newImagePreviews.map((preview, idx) => (
                                        <div key={idx} className="relative group bg-slate-100 dark:bg-slate-800 rounded-[10px] overflow-hidden h-28 border border-border/40 shadow-sm hover:shadow-md transition-all">
                                            <span className="absolute top-1.5 left-1.5 bg-black/75 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm z-10 border border-white/20 select-none shadow">
                                                #{idx + 1}
                                            </span>
                                            <Image src={preview} alt={`Preview ${idx + 1}`} fill className="object-cover transition-transform duration-300 group-hover:scale-105" />
                                            <button type="button" onClick={() => removeNew(idx)} title="Xóa ảnh" aria-label="Xóa ảnh"
                                                className="absolute top-1.5 right-1.5 bg-rose-600 hover:bg-rose-700 active:scale-90 text-white p-1.5 rounded-full shadow-md hover:shadow-rose-500/30 transition-all cursor-pointer z-10 border border-white/40 flex items-center justify-center">
                                                <X className="h-3.5 w-3.5 stroke-[2.5]" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="pt-3 border-t border-border/40 flex gap-2 justify-end">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="rounded-[8px]" size="sm">Hủy</Button>
                        <Button type="submit" disabled={isSubmitting} className="rounded-[8px]" size="sm">
                            {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

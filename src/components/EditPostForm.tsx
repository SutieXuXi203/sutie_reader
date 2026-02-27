'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, X } from 'lucide-react';
import Image from 'next/image';
import imageCompression from 'browser-image-compression';
import { getOptimizedImageUrl } from '@/lib/utils';

interface Post {
    _id: string;
    title: string;
    description: string;
    content: string;
    images: string[];
    author: string;
}

interface EditPostFormProps {
    post: Post;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onPostUpdated: () => void;
}

export function EditPostForm({ post, open, onOpenChange, onPostUpdated }: EditPostFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [title, setTitle] = useState(post.title);
    const [description, setDescription] = useState(post.description);
    const [content, setContent] = useState(post.content);
    const [author, setAuthor] = useState(post.author);
    // Keep existing image paths (strings, not base64 blobs)
    const [keptImages, setKeptImages] = useState<string[]>(post.images);
    const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
    const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
    const [error, setError] = useState('');

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const total = keptImages.length + newImageFiles.length + files.length;
        if (total > 10) { setError('Tối đa 10 hình ảnh'); return; }
        setNewImageFiles((prev) => [...prev, ...files]);
        setError('');
        files.forEach((file) => {
            const reader = new FileReader();
            reader.onloadend = () => setNewImagePreviews((prev) => [...prev, reader.result as string]);
            reader.readAsDataURL(file);
        });
    };

    const removeKept = (idx: number) =>
        setKeptImages((prev) => prev.filter((_, i) => i !== idx));

    const removeNew = (idx: number) => {
        setNewImageFiles((prev) => prev.filter((_, i) => i !== idx));
        setNewImagePreviews((prev) => prev.filter((_, i) => i !== idx));
    };

    const uploadNewImages = async (files: File[], uploadTitle: string): Promise<string[]> => {
        if (!files.length) return [];
        // Nén ảnh mới trước khi upload
        const compressedFiles = await Promise.all(
            files.map(async (file) => {
                const options = {
                    maxSizeMB: 1,
                    maxWidthOrHeight: 1920,
                    useWebWorker: true,
                };
                try {
                    return await imageCompression(file, options);
                } catch (error) {
                    console.error('Lỗi khi nén ảnh:', error);
                    return file; // Nén lỗi thì upload ảnh gốc
                }
            })
        );
        const formData = new FormData();
        formData.append('title', uploadTitle);
        compressedFiles.forEach((f) => formData.append('files', f));
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data?.details || data?.error || 'Upload thất bại');
        }
        const { urls } = await res.json();
        return urls as string[];
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!title || !content) {
            setError('Vui lòng điền tiêu đề và nội dung');
            return;
        }
        if (keptImages.length + newImageFiles.length === 0) {
            setError('Cần có ít nhất một hình ảnh');
            return;
        }

        setIsSubmitting(true);
        try {
            // 1. Upload new files to filesystem, get paths
            const newUrls = await uploadNewImages(newImageFiles, title);

            // 2. Merge: kept existing paths + new paths (no base64 sent to MongoDB)
            const allImages = [...keptImages, ...newUrls];

            const response = await fetch(`/api/posts/${post._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, description, content, author, images: allImages }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data?.details || data?.error || `Server error ${response.status}`);
            }

            onOpenChange(false);
            onPostUpdated();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setError(`Cập nhật không thành công: ${message}`);
            console.error('Lỗi khi cập nhật bài viết:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-[8px] border-none shadow-none no-scrollbar"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle className="text-xl font-medium">Chỉnh sửa bài viết</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-2 rounded-none text-sm">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Tiêu đề</label>
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tiêu đề" maxLength={100} disabled={isSubmitting} className="rounded-[8px]" />
                        <p className="text-xs text-slate-400 mt-1">{title.length}/100</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Mô tả ngắn (không bắt buộc)</label>
                        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mô tả ngắn" maxLength={300} rows={2} disabled={isSubmitting} className="rounded-[8px]" />
                        <p className="text-xs text-slate-400 mt-1">{description.length}/300</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Nội dung</label>
                        <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Nội dung bài viết" rows={4} disabled={isSubmitting} className="rounded-[8px]" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Tác giả (tuỳ chọn)</label>
                        <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Tên của bạn" disabled={isSubmitting} className="rounded-[8px]" />
                    </div>

                    {/* Kept existing images */}
                    {keptImages.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Ảnh hiện tại ({keptImages.length})</label>
                            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                                {keptImages.map((src, idx) => (
                                    <div key={idx} className="relative group bg-slate-100 dark:bg-slate-800 rounded-[8px] overflow-hidden h-24">
                                        <Image src={getOptimizedImageUrl(src)} alt={`Ảnh ${idx + 1}`} fill className="object-cover" unoptimized />
                                        <button type="button" onClick={() => removeKept(idx)}
                                            className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Upload new images */}
                    <div>
                        <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Thêm ảnh mới</label>
                        <div className="border border-slate-200 dark:border-slate-700 rounded-[8px] p-6 text-center hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                            <input type="file" multiple accept="image/*" onChange={handleImageSelect} disabled={isSubmitting} className="hidden" id="edit-image-input" />
                            <label htmlFor="edit-image-input" className="cursor-pointer block">
                                <Upload className="h-6 w-6 mx-auto mb-2 text-slate-400" />
                                <p className="text-sm text-slate-700 dark:text-slate-300">Click để tải ảnh lên</p>
                                <p className="text-xs text-slate-500 mt-1">PNG, JPG, GIF tối đa 50MB (tối đa 10 ảnh)</p>
                            </label>
                        </div>
                    </div>

                    {newImagePreviews.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Ảnh mới ({newImagePreviews.length})</label>
                            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                                {newImagePreviews.map((preview, idx) => (
                                    <div key={idx} className="relative group bg-slate-100 dark:bg-slate-800 rounded-[8px] overflow-hidden h-24">
                                        <Image src={preview} alt={`Preview ${idx}`} fill className="object-cover" />
                                        <button type="button" onClick={() => removeNew(idx)}
                                            className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex gap-2 justify-end pt-2">
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

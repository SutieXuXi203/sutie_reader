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
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [title, setTitle] = useState(post.title);
    const [tags, setTags] = useState<string[]>(post.tags || []);
    const [content, setContent] = useState(post.content);
    const [author, setAuthor] = useState(post.author);
    const [keptImages, setKeptImages] = useState<string[]>(post.images);
    const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
    const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
    const [error, setError] = useState('');
    useEffect(() => {
        setTitle(post.title);
        setTags(post.tags || []);
        setContent(post.content);
        setAuthor(post.author);
        setKeptImages(post.images);
        setNewImageFiles([]);
        setNewImagePreviews([]);
        setError('');
    }, [post, open]);
    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const total = keptImages.length + newImageFiles.length + files.length;
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
                    return file;
                }
            })
        );
        const formData = new FormData();
        formData.append('title', uploadTitle);
        compressedFiles.forEach((compressed, i) => formData.append('files', compressed, files[i].name));
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
            const newUrls = await uploadNewImages(newImageFiles, title);
            const allImages = [...keptImages, ...newUrls];
            const response = await fetch(`/api/posts/${post._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, tags, content, author, images: allImages }),
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
                className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-[8px] border border-red-200/80 dark:border-red-900/40 bg-white bg-gradient-to-b from-white via-red-50 to-white dark:bg-[#140606] dark:from-[#190909] dark:via-[#1f0c0c] dark:to-[#140606] shadow-[0_28px_72px_-24px_rgba(153,27,27,0.4)] dark:shadow-[0_32px_80px_-28px_rgba(0,0,0,0.78)] no-scrollbar z-[10001]"
                overlayClassName="z-[10000] backdrop-blur-none bg-red-950/35 dark:bg-black/65"
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
                        <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Nội dung</label>
                        <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Nội dung bài viết" rows={4} disabled={isSubmitting} className="rounded-[8px]" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Tác giả (tuỳ chọn)</label>
                        <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Tên của bạn" disabled={isSubmitting} className="rounded-[8px]" />
                    </div>
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
                    <div>
                        <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Thêm ảnh mới</label>
                        <div className="border border-slate-200 dark:border-slate-700 rounded-[8px] p-6 text-center hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                            <input type="file" multiple accept="image/*" onChange={handleImageSelect} disabled={isSubmitting} className="hidden" id="edit-image-input" />
                            <label htmlFor="edit-image-input" className="cursor-pointer block">
                                <Upload className="h-6 w-6 mx-auto mb-2 text-slate-400" />
                                <p className="text-sm text-slate-700 dark:text-slate-300">Click để tải ảnh lên</p>
                                <p className="text-xs text-slate-500 mt-1">PNG, JPG, GIF tối đa 50MB</p>
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

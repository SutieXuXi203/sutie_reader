'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, X } from 'lucide-react';
import Image from 'next/image';
import imageCompression from 'browser-image-compression';

interface CreatePostFormProps {
  onPostCreated: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePostForm({ onPostCreated, open, onOpenChange }: CreatePostFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [author, setAuthor] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [error, setError] = useState('');

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newFiles = [...imageFiles, ...files];
    if (newFiles.length > 10) { setError('Tối đa 10 hình ảnh được phép'); return; }
    setImageFiles(newFiles);
    setError('');
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreviews((prev) => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (files: File[], uploadTitle: string): Promise<string[]> => {
    // Nén ảnh trước khi upload
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
    compressedFiles.forEach((file) => formData.append('files', file));
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

    if (!title || !content || imageFiles.length === 0) {
      setError('Vui lòng điền tiêu đề, nội dung và chọn ít nhất một hình ảnh');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Upload images to filesystem first
      const imageUrls = await uploadImages(imageFiles, title);

      // 2. Create post with image paths (not base64)
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          content,
          author: author || 'Không rõ tác giả',
          images: imageUrls,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.details || data?.error || `Server error ${response.status}`);
      }

      setTitle('');
      setDescription('');
      setContent('');
      setAuthor('');
      setImageFiles([]);
      setImagePreviews([]);
      onOpenChange(false);
      onPostCreated();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Tạo bài viết không thành công: ${message}`);
      console.error('Lỗi khi tạo bài viết:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-none border border-red-100 dark:border-red-900/30 shadow-2xl dark:shadow-red-900/20 no-scrollbar">
        <DialogHeader>
          <DialogTitle className="text-xl font-medium">Tạo bài viết mới</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-2 rounded-none text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Tiêu đề</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tiêu đề bài viết" maxLength={100} disabled={isSubmitting} className="rounded-none border-slate-200 dark:border-slate-700" />
            <p className="text-xs text-slate-400 mt-1">{title.length}/100</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Mô tả ngắn (không bắt buộc)</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mô tả ngắn gọn" maxLength={300} rows={2} disabled={isSubmitting} className="rounded-none border-slate-200 dark:border-slate-700" />
            <p className="text-xs text-slate-400 mt-1">{description.length}/300</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Nội dung</label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Nội dung bài viết" rows={4} disabled={isSubmitting} className="rounded-none border-slate-200 dark:border-slate-700" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Tên tác giả (không bắt buộc)</label>
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Tên của bạn" disabled={isSubmitting} className="rounded-none border-slate-200 dark:border-slate-700" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Hình ảnh</label>
            <div className="border border-slate-200 dark:border-slate-700 rounded-none p-6 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
              <input type="file" multiple accept="image/*" onChange={handleImageSelect} disabled={isSubmitting} className="hidden" id="image-input" />
              <label htmlFor="image-input" className="cursor-pointer block">
                <Upload className="h-6 w-6 mx-auto mb-2 text-slate-400" />
                <p className="text-sm text-slate-700 dark:text-slate-300">Nhấp để tải ảnh lên</p>
                <p className="text-xs text-slate-500 mt-1">PNG, JPG, GIF tối đa 50MB (tối đa 10 ảnh)</p>
              </label>
            </div>
          </div>

          {imagePreviews.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Đã chọn ({imagePreviews.length})</label>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative group bg-slate-100 dark:bg-slate-800 rounded-none overflow-hidden h-24">
                    <Image src={preview} alt={`Xem trước ${index}`} fill className="object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white p-1 rounded-none opacity-0 group-hover:opacity-100 transition-opacity text-xs cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="rounded-[8px]" size="sm">
              Hủy
            </Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-[8px]" size="sm">
              {isSubmitting ? 'Đang đăng bài...' : 'Đăng bài'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, X } from 'lucide-react';
import Image from 'next/image';
import imageCompression from 'browser-image-compression';
import { TagPicker } from '@/components/TagPicker';
interface CreatePostFormProps {
  onPostCreated: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableTags?: string[];
}
export function CreatePostForm({ onPostCreated, open, onOpenChange, availableTags = [] }: CreatePostFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [author, setAuthor] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [error, setError] = useState('');
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newFiles = [...imageFiles, ...files];
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
    if (!title || !content || imageFiles.length === 0) {
      setError('Vui lòng điền tiêu đề, nội dung và chọn ít nhất một hình ảnh');
      return;
    }
    setIsSubmitting(true);
    try {
      const imageUrls = await uploadImages(imageFiles, title);
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          tags,
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
      setTags([]);
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-[8px] border border-border shadow-2xl dark:shadow-red-900/20 no-scrollbar">
        <DialogHeader>
          <DialogTitle className="text-xl font-medium">Tạo bài viết mới</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-secondary border border-border text-red-700 dark:text-red-400 px-4 py-2 rounded-[8px] text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Tiêu đề</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tiêu đề bài viết" maxLength={100} disabled={isSubmitting} className="rounded-[8px] border-slate-200 dark:border-slate-700" />
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
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Nội dung</label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Nội dung bài viết" rows={4} disabled={isSubmitting} className="rounded-[8px] border-slate-200 dark:border-slate-700" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Tên tác giả (không bắt buộc)</label>
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Tên của bạn" disabled={isSubmitting} className="rounded-[8px] border-slate-200 dark:border-slate-700" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Hình ảnh</label>
            <div className="border border-slate-200 dark:border-slate-700 rounded-[8px] p-6 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
              <input type="file" multiple accept="image/*" onChange={handleImageSelect} disabled={isSubmitting} className="hidden" id="image-input" />
              <label htmlFor="image-input" className="cursor-pointer block">
                <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-slate-700 dark:text-slate-300">Nhấp để tải ảnh lên</p>
                <p className="text-xs text-slate-500 mt-1">PNG, JPG, GIF tối đa 50MB</p>
              </label>
            </div>
          </div>
          {imagePreviews.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Đã chọn ({imagePreviews.length})</label>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative group bg-slate-100 dark:bg-slate-800 rounded-[8px] overflow-hidden h-24">
                    <Image src={preview} alt={`Xem trước ${index}`} fill className="object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white p-1 rounded-[8px] opacity-0 group-hover:opacity-100 transition-opacity text-xs cursor-pointer"
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


'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Upload, X } from 'lucide-react';
import Image from 'next/image';
import imageCompression from 'browser-image-compression';
import { TagPicker } from '@/components/TagPicker';
import { notify } from '@/lib/notify';

interface CreatePostFormProps {
  onPostCreated: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableTags?: string[];
}

type CreateStep = 'story' | 'chapter';

export function CreatePostForm({
  onPostCreated,
  open,
  onOpenChange,
  availableTags = [],
}: CreatePostFormProps) {
  const [step, setStep] = useState<CreateStep>('story');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [author, setAuthor] = useState('');

  const [createdPostId, setCreatedPostId] = useState<string | null>(null);
  const [createdPostTitle, setCreatedPostTitle] = useState('');
  const [createdChapterCount, setCreatedChapterCount] = useState(0);

  const [chapterTitle, setChapterTitle] = useState('Chương 1');
  const [chapterContent, setChapterContent] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const draftPostIdRef = useRef<string | null>(null);
  const createdChapterCountRef = useRef(0);

  const resetStoryFields = () => {
    setTitle('');
    setTags([]);
    setAuthor('');
  };

  const resetChapterFields = () => {
    setChapterContent('');
    setImageFiles([]);
    setImagePreviews([]);
  };

  const resetAll = () => {
    setStep('story');
    setIsSubmitting(false);
    setCreatedPostId(null);
    setCreatedPostTitle('');
    setCreatedChapterCount(0);
    setChapterTitle('Chương 1');
    resetStoryFields();
    resetChapterFields();
    draftPostIdRef.current = null;
    createdChapterCountRef.current = 0;
  };

  const cleanupDraftPost = async () => {
    const draftId = draftPostIdRef.current;
    if (!draftId || createdChapterCountRef.current > 0) return;
    try {
      await fetch(`/api/posts/${draftId}`, { method: 'DELETE' });
    } catch (cleanupError) {
      console.warn('Không thể xóa truyện nháp:', cleanupError);
    }
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      void cleanupDraftPost();
      resetAll();
    }
    onOpenChange(nextOpen);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setImageFiles((prev) => [...prev, ...files]);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        setImagePreviews((prev) => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (
    files: File[],
    uploadTitle: string
  ): Promise<string[]> => {
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
        } catch (compressionError) {
          console.error('Lỗi khi nén ảnh:', compressionError);
          return file;
        }
      })
    );

    const BATCH_SIZE = 2;
    const allUrls: string[] = [];

    for (let i = 0; i < compressedFiles.length; i += BATCH_SIZE) {
      const batch = compressedFiles.slice(i, i + BATCH_SIZE);
      const originalBatchFiles = files.slice(i, i + BATCH_SIZE);

      const formData = new FormData();
      formData.append('title', uploadTitle);
      batch.forEach((compressed, idx) =>
        formData.append('files', compressed, originalBatchFiles[idx].name)
      );

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data?.details || data?.error || `Upload thất bại ở nhóm ảnh ${Math.floor(i / BATCH_SIZE) + 1}`
        );
      }

      const { urls } = await res.json();
      allUrls.push(...(urls as string[]));
    }

    return allUrls;
  };

  const handleCreateStory = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      notify.error('Vui lòng nhập tiêu đề truyện');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          tags,
          author: author || 'Không rõ tác giả',
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.details || data?.error || `Server error ${response.status}`);
      }

      const createdPost = await response.json();
      if (!createdPost?._id) {
        throw new Error('Không lấy được ID truyện mới');
      }

      setCreatedPostId(createdPost._id);
      setCreatedPostTitle(createdPost.title || title.trim());
      setStep('chapter');
      setChapterTitle('Chương 1');
      draftPostIdRef.current = createdPost._id;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      notify.error('Tạo truyện không thành công', message);
      console.error('Lỗi khi tạo truyện:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveChapter = async (keepAdding: boolean) => {
    if (!createdPostId) {
      notify.error('Không tìm thấy truyện để thêm chương');
      return;
    }
    if (!chapterContent.trim() || imageFiles.length === 0) {
      notify.error('Vui lòng nhập nội dung chương và chọn ít nhất một ảnh');
      return;
    }

    setIsSubmitting(true);
    try {
      const uploadTitle = createdPostTitle || title || 'untitled';
      const imageUrls = await uploadImages(imageFiles, uploadTitle);
      const chapterNumber = createdChapterCountRef.current + 1;
      const response = await fetch(`/api/posts/${createdPostId}/chapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: chapterTitle.trim() || `Chương ${chapterNumber}`,
          chapterNumber,
          content: chapterContent.trim(),
          images: imageUrls,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.details || data?.error || `Server error ${response.status}`);
      }

      const nextChapterCount = createdChapterCountRef.current + 1;
      createdChapterCountRef.current = nextChapterCount;
      setCreatedChapterCount(nextChapterCount);

      if (keepAdding) {
        resetChapterFields();
        setChapterTitle(`Chương ${nextChapterCount + 1}`);
      } else {
        onPostCreated();
        resetAll();
        onOpenChange(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      notify.error('Lưu chương không thành công', message);
      console.error('Lỗi khi lưu chương:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto custom-scrollbar rounded-[12px] border border-border shadow-2xl dark:shadow-primary/20 bg-popover text-popover-foreground p-6 space-y-5">
        <DialogHeader>
          <DialogTitle className="text-xl font-medium">
            {step === 'story' ? 'Tạo truyện mới' : 'Thêm chương cho truyện'}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {step === 'story'
              ? 'Bước 1/2: Tạo thông tin truyện'
              : 'Bước 2/2: Thêm nội dung chương'}
          </p>
        </DialogHeader>

        {step === 'story' ? (
          <form onSubmit={handleCreateStory} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
                Tiêu đề truyện
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Tên truyện"
                maxLength={100}
                disabled={isSubmitting}
                className="rounded-[8px]"
              />
              <p className="text-xs text-muted-foreground mt-1">{title.length}/100</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
                Tag (không bắt buộc)
              </label>
              <TagPicker
                selectedTags={tags}
                onChange={setTags}
                availableTags={availableTags}
                disabled={isSubmitting}
                placeholder="Nhập tag rồi nhấn Enter"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
                Tên tác giả (không bắt buộc)
              </label>
              <Input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Tên của bạn"
                disabled={isSubmitting}
                className="rounded-[8px]"
              />
            </div>

            <div className="pt-3 border-t border-border/40 flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogOpenChange(false)}
                disabled={isSubmitting}
                className="rounded-[8px]"
                size="sm"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="rounded-[8px]"
                size="sm"
              >
                {isSubmitting ? 'Đang tạo truyện...' : 'Tạo truyện và thêm chương'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="rounded-[8px] border border-border bg-card/60 px-4 py-3 text-sm">
              <p className="font-medium text-foreground">
                Truyện: <span className="text-primary">{createdPostTitle}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Đã thêm {createdChapterCount} chương
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
                Tên chương
              </label>
              <Input
                value={chapterTitle}
                onChange={(e) => setChapterTitle(e.target.value)}
                placeholder={`Chương ${createdChapterCount + 1}`}
                disabled={isSubmitting}
                className="rounded-[8px]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
                Nội dung chương
              </label>
              <Textarea
                value={chapterContent}
                onChange={(e) => setChapterContent(e.target.value)}
                placeholder="Nội dung chương"
                rows={4}
                disabled={isSubmitting}
                className="rounded-[8px]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
                Ảnh chương
              </label>
              <div className="border border-input rounded-[8px] p-6 text-center hover:bg-secondary/60 dark:hover:bg-secondary/40 transition-colors">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageSelect}
                  disabled={isSubmitting}
                  className="hidden"
                  id="chapter-image-input"
                />
                <label htmlFor="chapter-image-input" className="cursor-pointer block">
                  <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-foreground/80">
                    Nhấn để tải ảnh lên
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG, GIF tối đa 50MB</p>
                </label>
              </div>
            </div>

            {imagePreviews.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
                  Đã chọn ({imagePreviews.length})
                </label>
                <div className="max-h-[30vh] overflow-y-auto rounded-lg border border-border/60 p-3 bg-muted/20 custom-scrollbar">
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                    {imagePreviews.map((preview, index) => (
                      <div
                        key={index}
                        className="relative group bg-slate-100 dark:bg-slate-800 rounded-[8px] overflow-hidden h-24"
                      >
                        <Image
                          src={preview}
                          alt={`Xem trước ${index}`}
                          fill
                          className="object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 bg-primary hover:bg-primary/90 text-white p-1 rounded-[8px] opacity-0 group-hover:opacity-100 transition-opacity text-xs cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-border/40 flex flex-wrap gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogOpenChange(false)}
                disabled={isSubmitting}
                className="rounded-[8px]"
                size="sm"
              >
                Hủy
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => void handleSaveChapter(true)}
                className="rounded-[8px]"
                size="sm"
              >
                {isSubmitting ? 'Đang lưu...' : 'Lưu chương và thêm chương mới'}
              </Button>
              <Button
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleSaveChapter(false)}
                className="rounded-[8px]"
                size="sm"
              >
                {isSubmitting ? 'Đang lưu...' : 'Lưu và hoàn tất'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}


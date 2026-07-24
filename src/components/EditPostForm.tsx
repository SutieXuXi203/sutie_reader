'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, X, Plus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { TagPicker } from '@/components/TagPicker';
import { notify } from '@/lib/notify';
import { useUploadProgress } from '@/providers/UploadProgressProvider';
import { uploadImages } from '@/lib/uploadService';
import { cn, getOptimizedImageUrl } from '@/lib/utils';

interface Chapter {
  _id?: string;
  title: string;
  chapterNumber: number;
  content: string;
  images: string[];
}

interface Post {
  _id: string;
  title: string;
  description?: string;
  tags?: string[];
  content?: string;
  images: string[];
  chapters?: Chapter[];
  author: string;
}

interface EditPostFormProps {
  post: Post;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPostUpdated: () => void;
  availableTags?: string[];
}

interface ChapterEditState {
  title: string;
  chapterNumber: number;
  content: string;
  keptImages: string[];
  newImageFiles: File[];
  newImagePreviews: string[];
}

export function EditPostForm({ post, open, onOpenChange, onPostUpdated, availableTags = [] }: EditPostFormProps) {
  const { showProgress, updateProgress } = useUploadProgress();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [title, setTitle] = useState(post.title);
  const [tags, setTags] = useState<string[]>(post.tags || []);
  const [author, setAuthor] = useState(post.author);

  const [chapters, setChapters] = useState<ChapterEditState[]>([]);
  const [selectedChapterIndex, setSelectedChapterIndex] = useState<number>(0);

  useEffect(() => {
    if (!open) return;
    setTitle(post.title);
    setTags(post.tags || []);
    setAuthor(post.author);

    if (post.chapters && post.chapters.length > 0) {
      setChapters(post.chapters.map((ch, idx) => ({
        title: ch.title || `Chương ${ch.chapterNumber || idx + 1}`,
        chapterNumber: ch.chapterNumber || idx + 1,
        content: ch.content || '',
        keptImages: Array.isArray(ch.images) ? ch.images : [],
        newImageFiles: [],
        newImagePreviews: [],
      })));
      setSelectedChapterIndex(0);
    } else {
      setIsLoadingDetails(true);
      fetch(`/api/posts/${post._id}`)
        .then((res) => res.json())
        .then((data) => {
          const fetchedChapters = data.chapters && data.chapters.length > 0
            ? data.chapters
            : [
                {
                  title: 'Chương 1',
                  chapterNumber: 1,
                  content: data.content || post.content || '',
                  images: data.images || post.images || [],
                },
              ];

          setChapters(
            fetchedChapters.map((ch: any, idx: number) => ({
              title: ch.title || `Chương ${ch.chapterNumber || idx + 1}`,
              chapterNumber: ch.chapterNumber || idx + 1,
              content: ch.content || '',
              keptImages: Array.isArray(ch.images) ? ch.images : [],
              newImageFiles: [],
              newImagePreviews: [],
            }))
          );
          setSelectedChapterIndex(0);
        })
        .catch((err) => {
          console.error('Lỗi tải chi tiết truyện:', err);
          setChapters([
            {
              title: 'Chương 1',
              chapterNumber: 1,
              content: post.content || '',
              keptImages: post.images || [],
              newImageFiles: [],
              newImagePreviews: [],
            },
          ]);
          setSelectedChapterIndex(0);
        })
        .finally(() => {
          setIsLoadingDetails(false);
        });
    }
  }, [post, open]);

  const activeChapter = chapters[selectedChapterIndex] || {
    title: '',
    chapterNumber: 1,
    content: '',
    keptImages: [],
    newImageFiles: [],
    newImagePreviews: [],
  };

  const updateActiveChapter = (updater: (prev: ChapterEditState) => ChapterEditState) => {
    setChapters((prev) =>
      prev.map((ch, idx) => (idx === selectedChapterIndex ? updater(ch) : ch))
    );
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;

    e.target.value = '';

    const currentNewFiles = activeChapter.newImageFiles || [];
    const allNewFiles = [...currentNewFiles, ...selectedFiles].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );

    const previewPromises = allNewFiles.map((file) => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    });

    const sortedPreviews = await Promise.all(previewPromises);

    updateActiveChapter((ch) => ({
      ...ch,
      newImageFiles: allNewFiles,
      newImagePreviews: sortedPreviews,
    }));
  };

  const removeKept = (idx: number) => {
    updateActiveChapter((ch) => ({
      ...ch,
      keptImages: ch.keptImages.filter((_, i) => i !== idx),
    }));
  };

  const removeNew = (idx: number) => {
    updateActiveChapter((ch) => ({
      ...ch,
      newImageFiles: ch.newImageFiles.filter((_, i) => i !== idx),
      newImagePreviews: ch.newImagePreviews.filter((_, i) => i !== idx),
    }));
  };

  const handleAddChapter = () => {
    const nextNum = chapters.length + 1;
    const newChap: ChapterEditState = {
      title: `Chương ${nextNum}`,
      chapterNumber: nextNum,
      content: '',
      keptImages: [],
      newImageFiles: [],
      newImagePreviews: [],
    };
    setChapters((prev) => [...prev, newChap]);
    setSelectedChapterIndex(chapters.length);
  };

  const handleDeleteChapter = (indexToDelete: number) => {
    if (chapters.length <= 1) {
      notify.error('Bài viết phải có ít nhất một chương');
      return;
    }
    setChapters((prev) => prev.filter((_, i) => i !== indexToDelete));
    if (selectedChapterIndex >= indexToDelete && selectedChapterIndex > 0) {
      setSelectedChapterIndex(selectedChapterIndex - 1);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      notify.error('Vui lòng điền tiêu đề truyện');
      return;
    }

    for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i];
      if (!ch.content.trim() && ch.keptImages.length + ch.newImageFiles.length === 0) {
        notify.error(`Chương "${ch.title}" cần có ít nhất nội dung chữ hoặc một hình ảnh`);
        setSelectedChapterIndex(i);
        return;
      }
    }

    const currentTitle = title.trim();
    const currentAuthor = author.trim();
    const currentTags = tags;

    const totalNewFiles = chapters.reduce((sum, ch) => sum + ch.newImageFiles.length, 0);

    setIsSubmitting(true);
    onOpenChange(false);

    let taskId = '';
    if (totalNewFiles > 0) {
      taskId = showProgress(`Đang cập nhật "${currentTitle}"`, totalNewFiles);
    }

    try {
      let uploadedCount = 0;
      const updatedChaptersPayload = [];

      for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i];
        let uploadedUrls: string[] = [];

        if (ch.newImageFiles.length > 0) {
          uploadedUrls = await uploadImages(
            ch.newImageFiles,
            currentTitle,
            post._id,
            (completed) => {
              if (taskId) updateProgress(taskId, uploadedCount + completed, totalNewFiles, 'uploading');
            }
          );
          uploadedCount += ch.newImageFiles.length;
        }

        updatedChaptersPayload.push({
          title: ch.title.trim() || `Chương ${i + 1}`,
          chapterNumber: i + 1,
          content: ch.content.trim(),
          images: [...ch.keptImages, ...uploadedUrls],
        });
      }

      if (totalNewFiles > 0 && taskId) {
        updateProgress(taskId, totalNewFiles, totalNewFiles, 'saving');
      }

      const response = await fetch(`/api/posts/${post._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: currentTitle,
          tags: currentTags,
          author: currentAuthor,
          chapters: updatedChaptersPayload,
          content: updatedChaptersPayload[0]?.content || '',
          images: updatedChaptersPayload[0]?.images || [],
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.details || data?.error || `Server error ${response.status}`);
      }

      if (totalNewFiles > 0 && taskId) {
        updateProgress(taskId, totalNewFiles, totalNewFiles, 'success');
      } else {
        notify.success('Cập nhật bài viết thành công');
      }

      onPostUpdated();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notify.error(`Lỗi: ${message}`);
      console.error('Lỗi khi cập nhật bài viết:', error);

      if (totalNewFiles > 0 && taskId) {
        updateProgress(taskId, 0, totalNewFiles, 'error', message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto overscroll-contain custom-scrollbar rounded-[12px] border border-border shadow-2xl dark:shadow-primary/20 bg-popover text-popover-foreground p-6 space-y-5">
        <DialogHeader>
          <DialogTitle className="text-xl font-medium">Chỉnh sửa bài viết</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
              Tiêu đề bộ truyện
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tiêu đề"
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
              Tác giả (tuỳ chọn)
            </label>
            <Input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Tên tác giả"
              disabled={isSubmitting}
              className="rounded-[8px]"
            />
          </div>

          <div className="pt-4 border-t border-border/50 space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-slate-900 dark:text-white">
                Danh sách Chương ({chapters.length})
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddChapter}
                disabled={isSubmitting}
                className="text-xs h-8 px-2.5 rounded-lg flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm chương
              </Button>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <Select
                value={selectedChapterIndex.toString()}
                onValueChange={(val) => setSelectedChapterIndex(parseInt(val || '0', 10))}
              >
                <SelectTrigger className="flex-1 min-w-0 bg-background overflow-hidden text-left">
                  <SelectValue placeholder="Chọn chương...">
                    <span className="truncate block w-full">{activeChapter.title || `Chương ${selectedChapterIndex + 1}`}</span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false} className="max-w-[calc(100vw-2rem)] sm:max-w-md">
                  {chapters.map((ch, idx) => (
                    <SelectItem key={`chapter-option-${idx}`} value={idx.toString()}>
                      <span className="truncate block max-w-[200px] sm:max-w-[300px]">{ch.title || `Chương ${idx + 1}`}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {chapters.length > 1 && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="shrink-0 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white"
                  title="Xóa chương đang chọn"
                  onClick={() => handleDeleteChapter(selectedChapterIndex)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>

            <div className="p-4 rounded-xl border border-border/60 bg-muted/10 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Tiêu đề Chương ({selectedChapterIndex + 1})
                </label>
                <Input
                  value={activeChapter.title}
                  onChange={(e) =>
                    updateActiveChapter((ch) => ({ ...ch, title: e.target.value }))
                  }
                  placeholder={`Ví dụ: Chương ${selectedChapterIndex + 1}`}
                  maxLength={100}
                  disabled={isSubmitting}
                  className="rounded-[8px]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Nội dung Chương (không bắt buộc)
                </label>
                <Textarea
                  value={activeChapter.content}
                  onChange={(e) =>
                    updateActiveChapter((ch) => ({ ...ch, content: e.target.value }))
                  }
                  placeholder="Nội dung chữ của chương này"
                  rows={4}
                  disabled={isSubmitting}
                  className="rounded-[8px]"
                />
              </div>

              {activeChapter.keptImages.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Ảnh hiện tại của chương ({activeChapter.keptImages.length})
                  </label>
                  <div className="max-h-60 overflow-y-auto rounded-lg border border-border/60 p-3 bg-background/50 custom-scrollbar">
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                      {activeChapter.keptImages.map((src, idx) => (
                        <div
                          key={idx}
                          className="relative group bg-slate-100 dark:bg-slate-800 rounded-[10px] overflow-hidden h-28 border border-border/40 shadow-sm hover:shadow-md transition-all"
                        >
                          <span className="absolute top-1.5 left-1.5 bg-black/75 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm z-10 border border-white/20 select-none shadow">
                            #{idx + 1}
                          </span>
                          <Image
                            src={getOptimizedImageUrl(src)}
                            alt={`Ảnh ${idx + 1}`}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                            unoptimized
                          />
                          <button
                            type="button"
                            onClick={() => removeKept(idx)}
                            title="Xóa ảnh"
                            aria-label="Xóa ảnh"
                            className="absolute top-1.5 right-1.5 bg-rose-600 hover:bg-rose-700 active:scale-90 text-white p-1.5 rounded-full shadow-md hover:shadow-rose-500/30 transition-all cursor-pointer z-10 border border-white/40 flex items-center justify-center"
                          >
                            <X className="h-3.5 w-3.5 stroke-[2.5]" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Thêm ảnh mới cho chương này
                </label>
                <div className="border border-input rounded-[8px] p-5 text-center hover:bg-secondary/60 dark:hover:bg-secondary/40 transition-colors bg-background">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageSelect}
                    disabled={isSubmitting}
                    className="hidden"
                    id={`edit-image-input-${selectedChapterIndex}`}
                  />
                  <label
                    htmlFor={`edit-image-input-${selectedChapterIndex}`}
                    className="cursor-pointer block"
                  >
                    <Upload className="h-5 w-5 mx-auto mb-1.5 text-muted-foreground" />
                    <p className="text-xs font-medium text-foreground/80">Click để chọn ảnh tải lên</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">PNG, JPG, GIF tối đa 50MB</p>
                  </label>
                </div>
              </div>

              {activeChapter.newImagePreviews.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Ảnh mới chuẩn bị thêm ({activeChapter.newImagePreviews.length})
                  </label>
                  <div className="max-h-60 overflow-y-auto rounded-lg border border-border/60 p-3 bg-background/50 custom-scrollbar">
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                      {activeChapter.newImagePreviews.map((preview, idx) => (
                        <div
                          key={idx}
                          className="relative group bg-slate-100 dark:bg-slate-800 rounded-[10px] overflow-hidden h-28 border border-border/40 shadow-sm hover:shadow-md transition-all"
                        >
                          <span className="absolute top-1.5 left-1.5 bg-black/75 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm z-10 border border-white/20 select-none shadow">
                            #{idx + 1}
                          </span>
                          <Image
                            src={preview}
                            alt={`Preview ${idx + 1}`}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <button
                            type="button"
                            onClick={() => removeNew(idx)}
                            title="Xóa ảnh"
                            aria-label="Xóa ảnh"
                            className="absolute top-1.5 right-1.5 bg-rose-600 hover:bg-rose-700 active:scale-90 text-white p-1.5 rounded-full shadow-md hover:shadow-rose-500/30 transition-all cursor-pointer z-10 border border-white/40 flex items-center justify-center"
                          >
                            <X className="h-3.5 w-3.5 stroke-[2.5]" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-border/40 flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || isLoadingDetails}
              className="rounded-[8px]"
              size="sm"
            >
              Hủy
            </Button>
            <Button type="submit" disabled={isSubmitting || isLoadingDetails} className="rounded-[8px]" size="sm">
              {isLoadingDetails ? 'Đang tải dữ liệu...' : isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

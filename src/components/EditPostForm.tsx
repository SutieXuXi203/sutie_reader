'use client';

import { useEffect, useRef, useState, DragEvent } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { Upload, X, Plus, Trash2, RefreshCw, Maximize2, Minimize2 } from 'lucide-react';
import Image from 'next/image';
import { TagPicker } from '@/components/TagPicker';
import { notify } from '@/lib/notify';
import { useUploadProgress } from '@/providers/UploadProgressProvider';
import { uploadImages, syncDriveImages } from '@/lib/uploadService';
import { cn, getOptimizedImageUrl } from '@/lib/utils';

export interface ChapterImage {
  id: string;
  isNew: boolean;
  url: string; // the existing url or the preview url
  file?: File; // only present if isNew is true
}

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

interface PostDetailsResponse {
  content?: string;
  images?: string[];
  chapters?: Chapter[];
}

interface ChapterEditState {
  title: string;
  chapterNumber: number;
  content: string;
  images: ChapterImage[];
}

const generateId = () => Math.random().toString(36).substring(2, 9);
const EXPANDED_INITIAL_IMAGE_COUNT = 10;
const EXPANDED_IMAGE_BATCH_SIZE = 18;
const EXPANDED_IMAGE_BATCH_DELAY_MS = 28;

const revokeImagePreview = (image: ChapterImage) => {
  if (image.isNew && image.url.startsWith('blob:') && typeof URL !== 'undefined') {
    URL.revokeObjectURL(image.url);
  }
};

export function EditPostForm({ post, open, onOpenChange, onPostUpdated, availableTags = [] }: EditPostFormProps) {
  const { showProgress, updateProgress } = useUploadProgress();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [title, setTitle] = useState(post.title);
  const [tags, setTags] = useState<string[]>(post.tags || []);
  const [author, setAuthor] = useState(post.author);

  const [chapters, setChapters] = useState<ChapterEditState[]>([]);
  const [selectedChapterIndex, setSelectedChapterIndex] = useState<number>(0);
  const [draggedImageId, setDraggedImageId] = useState<string | null>(null);
  const [dragOverImageId, setDragOverImageId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'before' | 'after' | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedImageLimit, setExpandedImageLimit] = useState(0);
  const chaptersRef = useRef<ChapterEditState[]>([]);

  useEffect(() => {
    if (!open) return;
    setIsExpanded(false);
    setExpandedImageLimit(0);
    setTitle(post.title);
    setTags(post.tags || []);
    setAuthor(post.author);

    const mapToChapterImage = (url: string): ChapterImage => ({
      id: generateId(),
      isNew: false,
      url,
    });

    if (post.chapters && post.chapters.length > 0) {
      setChapters(post.chapters.map((ch, idx) => ({
        title: ch.title || `Chương ${ch.chapterNumber || idx + 1}`,
        chapterNumber: ch.chapterNumber || idx + 1,
        content: ch.content || '',
        images: (Array.isArray(ch.images) ? ch.images : []).map(mapToChapterImage),
      })));
      setSelectedChapterIndex(0);
    } else {
      setIsLoadingDetails(true);
      fetch(`/api/posts/${post._id}`)
        .then((res) => res.json())
        .then((data: PostDetailsResponse) => {
          const fetchedChapters: Chapter[] = data.chapters && data.chapters.length > 0
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
            fetchedChapters.map((ch, idx) => ({
              title: ch.title || `Chương ${ch.chapterNumber || idx + 1}`,
              chapterNumber: ch.chapterNumber || idx + 1,
              content: ch.content || '',
              images: (Array.isArray(ch.images) ? ch.images : []).map(mapToChapterImage),
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
              images: (post.images || []).map(mapToChapterImage),
            },
          ]);
          setSelectedChapterIndex(0);
        })
        .finally(() => {
          setIsLoadingDetails(false);
        });
    }
  }, [post, open]);

  useEffect(() => {
    chaptersRef.current = chapters;
  }, [chapters]);

  useEffect(() => {
    if (open) return;
    setIsExpanded(false);
    setExpandedImageLimit(0);
    setChapters((current) => {
      if (current.length === 0) return current;
      current.forEach((chapter) => chapter.images.forEach(revokeImagePreview));
      return [];
    });
  }, [open]);

  useEffect(() => () => {
    chaptersRef.current.forEach((chapter) => chapter.images.forEach(revokeImagePreview));
  }, []);

  const activeChapter = chapters[selectedChapterIndex] || {
    title: '',
    chapterNumber: 1,
    content: '',
    images: [],
  };

  const updateActiveChapter = (updater: (prev: ChapterEditState) => ChapterEditState) => {
    setChapters((prev) =>
      prev.map((ch, idx) => (idx === selectedChapterIndex ? updater(ch) : ch))
    );
  };

  useEffect(() => {
    if (!isExpanded) {
      setExpandedImageLimit(0);
      return;
    }

    const totalImages = activeChapter.images.length;
    const initialLimit = Math.min(EXPANDED_INITIAL_IMAGE_COUNT, totalImages);
    setExpandedImageLimit(initialLimit);
    if (totalImages <= initialLimit) return;

    let nextLimit = initialLimit;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const queueNextBatch = () => {
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        nextLimit = Math.min(nextLimit + EXPANDED_IMAGE_BATCH_SIZE, totalImages);
        setExpandedImageLimit(nextLimit);
        if (nextLimit < totalImages) queueNextBatch();
      }, EXPANDED_IMAGE_BATCH_DELAY_MS);
    };

    queueNextBatch();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [activeChapter.images.length, isExpanded]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;

    e.target.value = '';

    const newImages = selectedFiles.map<ChapterImage>((file) => ({
      id: generateId(),
      isNew: true,
      url: URL.createObjectURL(file),
      file,
    }));

    updateActiveChapter((ch) => ({
      ...ch,
      images: [...ch.images, ...newImages],
    }));
  };

  const removeImage = (idToRemove: string) => {
    const removedImage = activeChapter.images.find((img) => img.id === idToRemove);
    if (removedImage) revokeImagePreview(removedImage);

    updateActiveChapter((ch) => ({
      ...ch,
      images: ch.images.filter((img) => img.id !== idToRemove),
    }));
  };

  const clearActiveChapterImages = () => {
    updateActiveChapter((ch) => {
      ch.images.forEach(revokeImagePreview);
      return { ...ch, images: [] };
    });
    setIsExpanded(false);
  };

  const handleDragStart = (e: DragEvent<HTMLDivElement>, id: string) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggedImageId(id);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    if (!draggedImageId || draggedImageId === targetId) {
      setDragOverImageId(null);
      setDragOverPosition(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const isBefore = mouseX < rect.width / 2;
    const position = isBefore ? 'before' : 'after';

    setDragOverImageId(targetId);
    setDragOverPosition(position);
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>, targetId: string) => {
    setDragOverImageId((current) => (current === targetId ? null : current));
    setDragOverPosition((current) => (current === targetId ? null : current));
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    if (!draggedImageId) return;

    if (draggedImageId !== targetId) {
      updateActiveChapter((ch) => {
        const newImages = [...ch.images];
        const draggedIdx = newImages.findIndex((img) => img.id === draggedImageId);
        if (draggedIdx === -1) return ch;

        const [draggedItem] = newImages.splice(draggedIdx, 1);
        
        let targetIdx = newImages.findIndex((img) => img.id === targetId);
        if (targetIdx === -1) return ch;

        if (dragOverPosition === 'after') {
          targetIdx += 1;
        }

        newImages.splice(targetIdx, 0, draggedItem);
        return { ...ch, images: newImages };
      });
    }

    setDraggedImageId(null);
    setDragOverImageId(null);
    setDragOverPosition(null);
  };

  const handleDragEnd = () => {
    setDraggedImageId(null);
    setDragOverImageId(null);
    setDragOverPosition(null);
  };

  const handleAddChapter = () => {
    const nextNum = chapters.length + 1;
    const newChap: ChapterEditState = {
      title: `Chương ${nextNum}`,
      chapterNumber: nextNum,
      content: '',
      images: [],
    };
    setChapters((prev) => [...prev, newChap]);
    setSelectedChapterIndex(chapters.length);
  };

  const handleDeleteChapter = (indexToDelete: number) => {
    if (chapters.length <= 1) {
      notify.error('Bài viết phải có ít nhất một chương');
      return;
    }
    chapters[indexToDelete]?.images.forEach(revokeImagePreview);
    setChapters((prev) => prev.filter((_, i) => i !== indexToDelete));
    if (selectedChapterIndex >= indexToDelete && selectedChapterIndex > 0) {
      setSelectedChapterIndex(selectedChapterIndex - 1);
    }
  };

  const handleSyncDrive = async () => {
    try {
      setIsSyncing(true);
      const syncedUrls = await syncDriveImages(title, post._id);

      const newSyncedImages: ChapterImage[] = syncedUrls.map(url => ({
        id: generateId(),
        isNew: false,
        url,
      }));

      updateActiveChapter((ch) => {
        ch.images.forEach(revokeImagePreview);
        return {
          ...ch,
          images: newSyncedImages,
        };
      });
      notify.success(`Đã đồng bộ ${syncedUrls.length} ảnh từ Google Drive cho chương hiện tại.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      notify.error('Đồng bộ thất bại', msg);
    } finally {
      setIsSyncing(false);
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
      if (!ch.content.trim() && ch.images.length === 0) {
        notify.error(`Chương "${ch.title}" cần có ít nhất nội dung chữ hoặc một hình ảnh`);
        setSelectedChapterIndex(i);
        return;
      }
    }

    const currentTitle = title.trim();
    const currentAuthor = author.trim();
    const currentTags = tags;

    const totalNewFiles = chapters.reduce((sum, ch) => sum + ch.images.filter(img => img.isNew).length, 0);

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

        const newImagesInOrder = ch.images.filter(img => img.isNew);
        const newFiles = newImagesInOrder.map(img => img.file!);
        let uploadedUrls: string[] = [];

        if (newFiles.length > 0) {
          uploadedUrls = await uploadImages(
            newFiles,
            currentTitle,
            post._id,
            (completed) => {
              if (taskId) updateProgress(taskId, uploadedCount + completed, totalNewFiles, 'uploading');
            }
          );
          uploadedCount += newFiles.length;
        }

        let newUrlIndex = 0;
        const finalImageUrls = ch.images.map(img => {
          if (img.isNew) {
            return uploadedUrls[newUrlIndex++];
          }
          return img.url;
        });

        updatedChaptersPayload.push({
          title: ch.title.trim() || `Chương ${i + 1}`,
          chapterNumber: i + 1,
          content: ch.content.trim(),
          images: finalImageUrls,
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

  const renderFormActions = (className?: string) => (
    <div className={cn("flex flex-wrap justify-end gap-2 border-t border-border/40 pt-4 pb-1", className)}>
      <Button
        type="button"
        variant="outline"
        onClick={() => onOpenChange(false)}
        disabled={isSubmitting || isLoadingDetails}
        className="min-w-20 rounded-[8px]"
        size="sm"
      >
        Hủy
      </Button>
      <Button type="submit" disabled={isSubmitting || isLoadingDetails} className="min-w-[118px] rounded-[8px]" size="sm">
        {isLoadingDetails ? 'Đang tải dữ liệu...' : isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
      </Button>
    </div>
  );

  const renderImageGrid = (expanded = false) => {
    const visibleImages = expanded
      ? activeChapter.images.slice(
        0,
        expandedImageLimit || Math.min(EXPANDED_INITIAL_IMAGE_COUNT, activeChapter.images.length)
      )
      : activeChapter.images;

    return (
      <div className={cn(
        "grid gap-3",
        expanded ? "grid-cols-2 min-[520px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" : "grid-cols-2 min-[420px]:grid-cols-3 md:grid-cols-4"
      )}>
        {visibleImages.map((img, idx) => (
        <div
          key={img.id}
          draggable={!isSubmitting}
          onDragStart={(e) => handleDragStart(e, img.id)}
          onDragOver={(e) => handleDragOver(e, img.id)}
          onDragLeave={(e) => handleDragLeave(e, img.id)}
          onDrop={(e) => handleDrop(e, img.id)}
          onDragEnd={handleDragEnd}
          style={expanded ? { contentVisibility: 'auto', containIntrinsicSize: '160px 240px' } : undefined}
          className={cn(
            "relative aspect-[2/3] cursor-move overflow-hidden rounded-[10px] border bg-slate-100 shadow-sm dark:bg-slate-800",
            expanded ? "contain-layout contain-paint" : "group transition-shadow hover:shadow-md",
            draggedImageId === img.id ? "opacity-60 scale-[0.98] border-primary" : "border-border/40",
            img.isNew && "ring-2 ring-primary/50"
          )}
        >
          <span className="absolute top-1.5 left-1.5 bg-black/75 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-md z-10 border border-white/20 select-none shadow">
            #{idx + 1}
          </span>
          {img.isNew && (
            <span className="absolute bottom-1.5 left-1.5 bg-blue-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md z-10 select-none">
              MỚI
            </span>
          )}
          {expanded ? (
            <img
              src={img.isNew ? img.url : getOptimizedImageUrl(img.url)}
              alt={`Ảnh ${idx + 1}`}
              loading="lazy"
              decoding="async"
              draggable={false}
              className="h-full w-full object-cover"
            />
          ) : (
            <Image
              src={img.isNew ? img.url : getOptimizedImageUrl(img.url)}
              alt={`Ảnh ${idx + 1}`}
              fill
              sizes="(max-width: 420px) 45vw, (max-width: 768px) 28vw, 160px"
              className="object-cover transition-transform duration-150 group-hover:scale-[1.02]"
              unoptimized={!img.isNew}
            />
          )}
          <button
            type="button"
            onClick={() => removeImage(img.id)}
            title="Xóa ảnh"
            aria-label="Xóa ảnh"
            className="absolute top-1.5 right-1.5 z-10 flex items-center justify-center rounded-full border border-white/40 bg-rose-600 p-1.5 text-white shadow-md transition-colors hover:bg-rose-700 active:scale-95"
          >
            <X className="h-3.5 w-3.5 stroke-[2.5]" />
          </button>
          {dragOverImageId === img.id && dragOverPosition && (
            <div
              className={cn(
                "absolute top-0 bottom-0 w-[5px] bg-primary z-30 pointer-events-none transition-all duration-75",
                dragOverPosition === 'before' ? "left-0 rounded-r-md" : "right-0 rounded-l-md"
              )}
              style={{ boxShadow: '0 0 10px hsl(var(--primary))' }}
            />
          )}
        </div>
        ))}
      </div>
    );
  };

  const openImagePopup = () => {
    setExpandedImageLimit(Math.min(EXPANDED_INITIAL_IMAGE_COUNT, activeChapter.images.length));
    setIsExpanded(true);
  };

  const closeImagePopup = () => {
    setIsExpanded(false);
    setExpandedImageLimit(0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "overflow-y-auto overscroll-contain custom-scrollbar rounded-[12px] border border-border shadow-2xl dark:shadow-primary/20 bg-popover text-popover-foreground p-5 duration-75 flex flex-col sm:p-6 data-open:fade-in-0 data-closed:fade-out-0",
        "!max-w-[min(720px,calc(100vw-2rem))] w-[min(720px,calc(100vw-2rem))] max-h-[92vh] space-y-5"
      )}>
        <DialogHeader>
          <DialogTitle className="text-xl font-medium">Chỉnh sửa bài viết</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 space-y-5">
          <div className="space-y-5">
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

          <div className="border-border/50 flex flex-col min-h-0 pt-4 border-t space-y-4">
            <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
              <label className="block text-sm font-semibold text-slate-900 dark:text-white">
                Danh sách Chương ({chapters.length})
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddChapter}
                disabled={isSubmitting}
                className="h-8 self-start rounded-lg px-2.5 text-xs min-[420px]:self-auto"
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

            <div className="rounded-xl border border-border/60 bg-muted/10 flex flex-col min-h-0 p-3 space-y-4 sm:p-4">
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

              {activeChapter.images.length > 0 && (
                <div>
                  <div className="mb-2 flex flex-col gap-2 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
                    <label className="block text-xs font-medium leading-tight text-muted-foreground">
                      Ảnh hiện tại của chương ({activeChapter.images.length})
                    </label>
                    <div className="grid w-full grid-cols-2 gap-1.5 min-[480px]:flex min-[480px]:w-auto min-[480px]:flex-wrap min-[480px]:justify-end min-[480px]:gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 min-w-0 px-2 text-[11px] leading-none"
                        onClick={openImagePopup}
                        disabled={isSubmitting}
                      >
                        <Maximize2 className="h-3 w-3 mr-1" /> Phóng to
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 min-w-0 px-2 text-[11px] leading-none text-rose-500 hover:text-rose-600 hover:bg-rose-50/50 dark:hover:bg-rose-950/50"
                        onClick={() => {
                          if (confirm('Bạn có chắc chắn muốn xóa tất cả ảnh hiện tại của chương này?')) {
                            clearActiveChapterImages();
                          }
                        }}
                        disabled={isSubmitting || isSyncing}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Xóa tất cả
                      </Button>
                    </div>
                  </div>
                  <div className={cn(
                    "custom-scrollbar overflow-y-auto rounded-lg border border-border/60 bg-background/50 p-2.5 sm:p-3",
                    "max-h-[42vh] min-h-[152px]"
                  )}>
                    {!isExpanded && renderImageGrid()}
                  </div>
                </div>
              )}

              <div>
                <div className="mt-4 mb-2 flex flex-col gap-2 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
                  <label className="block text-xs font-medium text-muted-foreground">
                    Thêm ảnh mới cho chương này
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 self-start px-2.5 text-xs min-[480px]:self-auto"
                    onClick={handleSyncDrive}
                    disabled={isSyncing || isSubmitting}
                  >
                    <RefreshCw className={cn("h-3 w-3 mr-1.5", isSyncing && "animate-spin")} />
                    {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ từ Drive'}
                  </Button>
                </div>
                <div className="border border-dashed border-input rounded-[8px] p-6 text-center hover:bg-secondary/60 dark:hover:bg-secondary/40 transition-colors bg-background">
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
                {renderFormActions("mt-6 mb-4")}
              </div>
            </div>
          </div>

        </form>
      </DialogContent>

      {isExpanded && activeChapter.images.length > 0 && (
        <DialogPortal>
          <div
            data-lenis-prevent=""
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/68 p-3 animate-in fade-in-0 duration-75 sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Ảnh hiện tại của chương"
            onClick={closeImagePopup}
          >
            <div
              data-lenis-prevent=""
              className="flex max-h-[92vh] min-h-0 w-[min(1180px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[12px] border border-border bg-popover text-popover-foreground shadow-2xl sm:w-[min(1180px,calc(100vw-2rem))]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex flex-col gap-3 border-b border-border/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold">
                    Ảnh hiện tại của chương ({activeChapter.images.length})
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Kéo thả ảnh để đổi thứ tự hiển thị.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start rounded-[8px] sm:self-auto"
                  onClick={closeImagePopup}
                >
                  <Minimize2 className="h-3.5 w-3.5 mr-1" />
                  Thu nhỏ
                </Button>
              </div>
              <div
                data-lenis-prevent=""
                className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-4"
                onWheel={(event) => event.stopPropagation()}
                onTouchMove={(event) => event.stopPropagation()}
              >
                {renderImageGrid(true)}
              </div>
            </div>
          </div>
        </DialogPortal>
      )}
    </Dialog>
  );
}

'use client';

import { useEffect, useState, DragEvent } from 'react';
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
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!open) return;
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

  const smartSortImages = (imagesList: ChapterImage[]) => {
    return [...imagesList].sort((a, b) => {
      const getNum = (str: string) => {
        const filename = str.split('/').pop()?.split('?')[0] || str;
        return filename;
      };
      const nameA = a.isNew ? a.file!.name : a.url;
      const nameB = b.isNew ? b.file!.name : b.url;
      return getNum(nameA).localeCompare(getNum(nameB), undefined, { numeric: true, sensitivity: 'base' });
    });
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;

    e.target.value = '';

    const previewPromises = selectedFiles.map((file) => {
      return new Promise<ChapterImage>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve({
          id: generateId(),
          isNew: true,
          url: reader.result as string,
          file,
        });
        reader.readAsDataURL(file);
      });
    });

    const newImages = await Promise.all(previewPromises);

    updateActiveChapter((ch) => ({
      ...ch,
      images: smartSortImages([...ch.images, ...newImages]),
    }));
  };

  const removeImage = (idToRemove: string) => {
    updateActiveChapter((ch) => ({
      ...ch,
      images: ch.images.filter((img) => img.id !== idToRemove),
    }));
  };

  const handleDragStart = (e: DragEvent, id: string) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggedImageId(id);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedImageId || draggedImageId === targetId) return;

    updateActiveChapter((ch) => {
      const newImages = [...ch.images];
      const draggedIdx = newImages.findIndex((img) => img.id === draggedImageId);
      const targetIdx = newImages.findIndex((img) => img.id === targetId);

      if (draggedIdx === -1 || targetIdx === -1) return ch;

      const [draggedItem] = newImages.splice(draggedIdx, 1);
      newImages.splice(targetIdx, 0, draggedItem);

      return { ...ch, images: newImages };
    });
    setDraggedImageId(null);
  };

  const handleDragEnd = () => {
    setDraggedImageId(null);
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

      updateActiveChapter((ch) => ({
        ...ch,
        images: newSyncedImages,
      }));
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

              {activeChapter.images.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-muted-foreground">
                      Ảnh hiện tại của chương ({activeChapter.images.length})
                    </label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] px-2"
                        onClick={() => setIsExpanded(!isExpanded)}
                        disabled={isSubmitting}
                      >
                        {isExpanded ? (
                          <><Minimize2 className="h-3 w-3 mr-1" /> Thu nhỏ</>
                        ) : (
                          <><Maximize2 className="h-3 w-3 mr-1" /> Phóng to</>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] px-2"
                        onClick={() => updateActiveChapter(ch => ({ ...ch, images: smartSortImages(ch.images) }))}
                        disabled={isSubmitting}
                      >
                        Sắp xếp lại
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] text-rose-500 hover:text-rose-600 hover:bg-rose-50/50 dark:hover:bg-rose-950/50 px-2"
                        onClick={() => {
                          if (confirm('Bạn có chắc chắn muốn xóa tất cả ảnh hiện tại của chương này?')) {
                            updateActiveChapter((ch) => ({ ...ch, images: [] }));
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
                    "custom-scrollbar transition-all",
                    isExpanded 
                      ? "fixed inset-2 md:inset-10 z-[100] bg-background/95 backdrop-blur-xl p-4 md:p-6 rounded-2xl shadow-2xl overflow-y-auto border border-border flex flex-col" 
                      : "max-h-80 overflow-y-auto rounded-lg border border-border/60 p-3 bg-background/50"
                  )}>
                    {isExpanded && (
                      <div className="flex items-center justify-between sticky -top-4 md:-top-6 bg-background/95 backdrop-blur z-20 pb-4 pt-4 md:pt-6 border-b border-border/50 mb-4 -mx-4 md:-mx-6 px-4 md:px-6">
                        <div>
                          <h3 className="font-semibold text-lg md:text-xl">Sắp xếp ảnh</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">Kéo thả để sắp xếp lại thứ tự ảnh</p>
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="rounded-full bg-secondary hover:bg-rose-500 hover:text-white" onClick={() => setIsExpanded(false)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                    <div className={cn(
                      "grid gap-3",
                      isExpanded ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8" : "grid-cols-3 md:grid-cols-4"
                    )}>
                      {activeChapter.images.map((img, idx) => (
                        <div
                          key={img.id}
                          draggable={!isSubmitting}
                          onDragStart={(e) => handleDragStart(e, img.id)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, img.id)}
                          onDragEnd={handleDragEnd}
                          className={cn(
                            "relative group bg-slate-100 dark:bg-slate-800 rounded-[10px] overflow-hidden h-32 border shadow-sm hover:shadow-md transition-all cursor-move",
                            draggedImageId === img.id ? "opacity-50 scale-95 border-primary" : "border-border/40",
                            img.isNew && "ring-2 ring-primary/50"
                          )}
                        >
                          <span className="absolute top-1.5 left-1.5 bg-black/75 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm z-10 border border-white/20 select-none shadow">
                            #{idx + 1}
                          </span>
                          {img.isNew && (
                            <span className="absolute bottom-1.5 left-1.5 bg-blue-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm z-10 select-none">
                              MỚI
                            </span>
                          )}
                          <Image
                            src={img.isNew ? img.url : getOptimizedImageUrl(img.url)}
                            alt={`Ảnh ${idx + 1}`}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                            unoptimized={!img.isNew}
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(img.id)}
                            title="Xóa ảnh"
                            aria-label="Xóa ảnh"
                            className="absolute top-1.5 right-1.5 bg-rose-600 hover:bg-rose-700 active:scale-90 text-white p-1.5 rounded-full shadow-md hover:shadow-rose-500/30 transition-all z-10 border border-white/40 flex items-center justify-center"
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
                <div className="flex items-center justify-between mb-1.5 mt-4">
                  <label className="block text-xs font-medium text-muted-foreground">
                    Thêm ảnh mới cho chương này
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={handleSyncDrive}
                    disabled={isSyncing || isSubmitting}
                  >
                    <RefreshCw className={cn("h-3 w-3 mr-1.5", isSyncing && "animate-spin")} />
                    {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ từ Drive'}
                  </Button>
                </div>
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

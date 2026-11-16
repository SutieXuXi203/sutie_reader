'use client';

import { useRef, useState, useEffect, DragEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Upload, X, FileArchive, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { TagPicker } from '@/components/TagPicker';
import { notify } from '@/lib/notify';
import { useUploadProgress } from '@/providers/UploadProgressProvider';
import { processBackgroundChapterSave } from '@/lib/uploadService';
import { isZipFile, extractImagesFromZip, ZipExtractProgress } from '@/lib/zipHelper';
import { cn } from '@/lib/utils';

interface CreatePostFormProps {
  onPostCreated: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableTags?: string[];
  availableAuthors?: string[];
  availableTranslators?: string[];
}

type CreateStep = 'story' | 'chapter';

export function CreatePostForm({
  onPostCreated,
  open,
  onOpenChange,
  availableTags = [],
  availableAuthors = [],
  availableTranslators = [],
}: CreatePostFormProps) {
  const { showProgress, updateProgress } = useUploadProgress();
  const [step, setStep] = useState<CreateStep>('story');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [author, setAuthor] = useState('');
  const [translator, setTranslator] = useState('');

  const [createdPostId, setCreatedPostId] = useState<string | null>(null);
  const [createdPostTitle, setCreatedPostTitle] = useState('');
  const [createdChapterCount, setCreatedChapterCount] = useState(0);

  const [chapterTitle, setChapterTitle] = useState('Chương 1');
  const [chapterTranslator, setChapterTranslator] = useState('');
  const [chapterContent, setChapterContent] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploadMode, setUploadMode] = useState<'images' | 'zip'>('images');
  const [isExtractingZip, setIsExtractingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState<ZipExtractProgress | null>(null);
  const [isDraggingZip, setIsDraggingZip] = useState(false);
  const zipDragCounterRef = useRef(0);

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'before' | 'after' | null>(null);

  const draftPostIdRef = useRef<string | null>(null);
  const createdChapterCountRef = useRef(0);
  const isSavingChapterRef = useRef(false);
  const imagePreviewsRef = useRef(imagePreviews);
  useEffect(() => {
    imagePreviewsRef.current = imagePreviews;
  }, [imagePreviews]);

  useEffect(() => {
    return () => {
      imagePreviewsRef.current.forEach((url) => {
        if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
      });
    };
  }, []);

  const revokePreviews = (urls: string[]) => {
    urls.forEach((url) => {
      if (url?.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
  };

  const resetStoryFields = () => {
    setTitle('');
    setTags([]);
    setAuthor('');
    setTranslator('');
  };

  const resetChapterFields = () => {
    setChapterTranslator('');
    setChapterContent('');
    setImageFiles([]);
    setImagePreviews((prev) => {
      revokePreviews(prev);
      return [];
    });
    setDraggedIdx(null);
    setDragOverIdx(null);
    setDragOverPosition(null);
    setIsExtractingZip(false);
    setZipProgress(null);
    setIsDraggingZip(false);
    zipDragCounterRef.current = 0;
  };

  const resetAll = () => {
    setStep('story');
    setCreatedPostId(null);
    setCreatedPostTitle('');
    setCreatedChapterCount(0);
    setChapterTitle('Chương 1');
    resetStoryFields();
    resetChapterFields();
    draftPostIdRef.current = null;
    createdChapterCountRef.current = 0;
    isSavingChapterRef.current = false;
  };

  const cleanupDraftPost = async () => {
    const draftId = draftPostIdRef.current;
    if (!draftId || createdChapterCountRef.current > 0 || isSavingChapterRef.current || isExtractingZip) return;
    try {
      await fetch(`/api/posts/${draftId}?isDraft=true`, { method: 'DELETE' });
    } catch (cleanupError) {
      console.warn('Không thể xóa truyện nháp:', cleanupError);
    }
  };

  const handleDialogOpenChange = (nextOpen: boolean, eventDetails?: { reason?: string }) => {
    if (!nextOpen && (eventDetails?.reason === 'outsidePress' || eventDetails?.reason === 'outside-press')) {
      return;
    }
    if (!nextOpen) {
      if (isExtractingZip) return;
      if (!isSavingChapterRef.current) {
        void cleanupDraftPost();
        resetAll();
      }
    }
    onOpenChange(nextOpen);
  };

  const processZipFile = async (file: File) => {
    setIsExtractingZip(true);
    setZipProgress({ current: 0, total: 100, percent: 0 });
    try {
      const extractedFiles = await extractImagesFromZip(file, (p) => {
        setZipProgress(p);
      });

      setImageFiles((prev) => {
        const allFiles = [...prev, ...extractedFiles].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );
        setImagePreviews((prevPreviews) => {
          revokePreviews(prevPreviews);
          return allFiles.map((f) => URL.createObjectURL(f));
        });
        return allFiles;
      });

      notify.success(`Đã giải nén thành công ${extractedFiles.length} ảnh từ file zip!`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi khi giải nén file zip';
      notify.error('Giải nén zip thất bại', message);
    } finally {
      setIsExtractingZip(false);
      setZipProgress(null);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;

    e.target.value = '';

    const zipFiles = selectedFiles.filter(isZipFile);
    if (zipFiles.length > 0) {
      notify.error('Mục này chỉ hỗ trợ tải ảnh. Vui lòng chuyển sang tab "Tệp .ZIP" để tải file zip.');
    }

    const regularImages = selectedFiles.filter(
      (f) => !isZipFile(f) && (f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|avif|bmp)$/i.test(f.name))
    );

    if (regularImages.length === 0) return;

    setImageFiles((prev) => {
      const allFiles = [...prev, ...regularImages].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      );
      setImagePreviews((prevPreviews) => {
        revokePreviews(prevPreviews);
        return allFiles.map((file) => URL.createObjectURL(file));
      });
      return allFiles;
    });
  };

  const handleZipInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    await processZipFile(file);
  };

  const handleZipDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSubmitting || isExtractingZip) return;
    zipDragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingZip(true);
    }
  };

  const handleZipDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    zipDragCounterRef.current -= 1;
    if (zipDragCounterRef.current <= 0) {
      zipDragCounterRef.current = 0;
      setIsDraggingZip(false);
    }
  };

  const handleZipDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSubmitting || isExtractingZip) return;
    e.dataTransfer.dropEffect = 'copy';
    if (!isDraggingZip) setIsDraggingZip(true);
  };

  const handleZipDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    zipDragCounterRef.current = 0;
    setIsDraggingZip(false);
    if (isSubmitting || isExtractingZip) return;

    const files = Array.from(e.dataTransfer.files || []);
    if (!files.length) return;

    const zipFiles = files.filter(isZipFile);
    const regularImages = files.filter(
      (f) => !isZipFile(f) && (f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|avif|bmp)$/i.test(f.name))
    );

    if (zipFiles.length > 0) {
      for (const zip of zipFiles) {
        await processZipFile(zip);
      }
    }

    if (regularImages.length > 0) {
      setImageFiles((prev) => {
        const allFiles = [...prev, ...regularImages].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );
        setImagePreviews((prevPreviews) => {
          revokePreviews(prevPreviews);
          return allFiles.map((file) => URL.createObjectURL(file));
        });
        return allFiles;
      });
    }
  };

  const clearAllImages = () => {
    setImageFiles([]);
    setImagePreviews((prev) => {
      revokePreviews(prev);
      return [];
    });
    setDraggedIdx(null);
    setDragOverIdx(null);
    setDragOverPosition(null);
  };

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => {
      const urlToRevoke = prev[index];
      if (urlToRevoke?.startsWith('blob:')) {
        URL.revokeObjectURL(urlToRevoke);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleDragStart = (e: DragEvent<HTMLDivElement>, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggedIdx(index);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) {
      setDragOverIdx(null);
      setDragOverPosition(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const isBefore = mouseX < rect.width / 2;
    const position = isBefore ? 'before' : 'after';

    setDragOverIdx(index);
    setDragOverPosition(position);
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>, index: number) => {
    setDragOverIdx((current) => {
      if (current === index) {
        setDragOverPosition(null);
        return null;
      }
      return current;
    });
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, targetIdx: number) => {
    e.preventDefault();
    if (draggedIdx === null) return;

    if (draggedIdx !== targetIdx) {
      const newFiles = [...imageFiles];
      const [draggedFile] = newFiles.splice(draggedIdx, 1);

      const newPreviews = [...imagePreviews];
      const [draggedPreview] = newPreviews.splice(draggedIdx, 1);

      let insertIdx = targetIdx;
      if (draggedIdx < targetIdx) {
        insertIdx = targetIdx - 1;
      }

      if (dragOverPosition === 'after') {
        insertIdx += 1;
      }

      newFiles.splice(insertIdx, 0, draggedFile);
      newPreviews.splice(insertIdx, 0, draggedPreview);

      setImageFiles(newFiles);
      setImagePreviews(newPreviews);
    }

    setDraggedIdx(null);
    setDragOverIdx(null);
    setDragOverPosition(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
    setDragOverPosition(null);
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
          translator: translator.trim(),
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


  const handleSaveChapter = (keepAdding: boolean) => {
    if (!createdPostId) {
      notify.error('Không tìm thấy truyện để thêm chương');
      return;
    }
    if (!chapterContent.trim() && imageFiles.length === 0) {
      notify.error('Vui lòng nhập nội dung chương hoặc chọn ít nhất một ảnh');
      return;
    }

    const currentPostId = createdPostId;
    const currentTitle = chapterTitle.trim() || `Chương ${createdChapterCountRef.current + 1}`;
    const currentContent = chapterContent.trim();
    const currentFiles = [...imageFiles];
    const uploadTitle = createdPostTitle || title || 'untitled';
    const chapterNumber = createdChapterCountRef.current + 1;

    createdChapterCountRef.current += 1;
    setCreatedChapterCount(createdChapterCountRef.current);

    if (!keepAdding) {
      onOpenChange(false);
      resetAll();
    } else {
      resetChapterFields();
      setChapterTitle(`Chương ${createdChapterCountRef.current + 1}`);
    }

    void processBackgroundChapterSave(
      currentPostId,
      currentTitle,
      currentContent,
      currentFiles,
      chapterNumber,
      uploadTitle,
      showProgress,
      updateProgress,
      onPostCreated,
      notify.error,
      chapterTranslator || translator
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange} disablePointerDismissal>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto overscroll-contain custom-scrollbar rounded-[12px] border border-border shadow-2xl dark:shadow-primary/20 bg-popover text-popover-foreground p-6 space-y-5">
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
                list="author-suggestions"
                autoComplete="off"
              />
              <datalist id="author-suggestions">
                {availableAuthors.map((auth, idx) => (
                  <option key={idx} value={auth} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
                Dịch giả (không bắt buộc)
              </label>
              <Input
                value={translator}
                onChange={(e) => setTranslator(e.target.value)}
                placeholder="Tên dịch giả"
                disabled={isSubmitting}
                className="rounded-[8px]"
                list="translator-suggestions"
                autoComplete="off"
              />
              {availableTranslators.length > 0 && (
                <datalist id="translator-suggestions">
                  {availableTranslators.map((trans, idx) => (
                    <option key={idx} value={trans} />
                  ))}
                </datalist>
              )}
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
                Dịch giả chương (tuỳ chọn)
              </label>
              <Input
                value={chapterTranslator}
                onChange={(e) => setChapterTranslator(e.target.value)}
                placeholder={translator ? `Mặc định: ${translator}` : "Tên người dịch chương này"}
                maxLength={100}
                disabled={isSubmitting}
                className="rounded-[8px]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
                Nội dung chương (không bắt buộc)
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
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-900 dark:text-white">
                  Ảnh chương
                </label>
                <div className="flex items-center rounded-lg bg-secondary/80 p-0.5 border border-border/50 text-xs">
                  <button
                    type="button"
                    onClick={() => setUploadMode('images')}
                    disabled={isSubmitting || isExtractingZip}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] transition-all font-medium cursor-pointer",
                      uploadMode === 'images'
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Chọn ảnh</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMode('zip')}
                    disabled={isSubmitting || isExtractingZip}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] transition-all font-medium cursor-pointer",
                      uploadMode === 'zip'
                        ? "bg-background text-primary shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <FileArchive className="h-3.5 w-3.5" />
                    <span>Tệp .ZIP</span>
                  </button>
                </div>
              </div>

              {uploadMode === 'images' ? (
                <div className="border border-dashed border-input rounded-[8px] p-6 text-center hover:bg-secondary/60 dark:hover:bg-secondary/40 transition-colors bg-background">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageSelect}
                    disabled={isSubmitting || isExtractingZip}
                    className="hidden"
                    id="chapter-image-input"
                  />
                  <label htmlFor="chapter-image-input" className="cursor-pointer block select-none">
                    <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground/80">
                      Nhấn để tải ảnh lên
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PNG, JPG, WEBP, GIF tối đa 50MB
                    </p>
                  </label>
                </div>
              ) : (
                <div
                  onDragEnter={handleZipDragEnter}
                  onDragLeave={handleZipDragLeave}
                  onDragOver={handleZipDragOver}
                  onDrop={handleZipDrop}
                  className={cn(
                    "border-2 border-dashed rounded-[10px] p-6 text-center transition-all duration-200 relative",
                    isDraggingZip
                      ? "border-primary bg-primary/10 dark:bg-primary/20 scale-[1.01] shadow-lg shadow-primary/10 ring-2 ring-primary/20"
                      : "border-primary/40 hover:border-primary/70 hover:bg-primary/5 bg-primary/[0.02]"
                  )}
                >
                  <input
                    type="file"
                    accept=".zip,application/zip,application/x-zip-compressed,multipart/x-zip"
                    onChange={handleZipInputChange}
                    disabled={isSubmitting || isExtractingZip}
                    className="hidden"
                    id="chapter-zip-input"
                  />
                  <label
                    htmlFor="chapter-zip-input"
                    className={cn(
                      "block select-none",
                      isExtractingZip ? "cursor-wait" : "cursor-pointer"
                    )}
                  >
                    {isExtractingZip ? (
                      <div className="flex flex-col items-center py-1">
                        <Loader2 className="h-7 w-7 text-primary animate-spin mb-2" />
                        <p className="text-sm font-medium text-foreground">
                          Đang giải nén tệp .ZIP... {zipProgress ? `(${zipProgress.percent}%)` : ''}
                        </p>
                        {zipProgress && (
                          <div className="w-full max-w-xs bg-secondary rounded-full h-1.5 mt-2.5 overflow-hidden">
                            <div
                              className="bg-primary h-full transition-all duration-150"
                              style={{ width: `${zipProgress.percent}%` }}
                            />
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {zipProgress?.currentFileName ? (
                            <span className="truncate max-w-xs block font-mono text-[11px]">
                              {zipProgress.currentFileName}
                            </span>
                          ) : (
                            'Vui lòng chờ trong giây lát...'
                          )}
                        </p>
                      </div>
                    ) : isDraggingZip ? (
                      <div className="pointer-events-none py-1 flex flex-col items-center">
                        <FileArchive className="h-8 w-8 text-primary animate-bounce mb-2" />
                        <p className="text-sm font-semibold text-primary">
                          Thả tệp .ZIP vào đây để giải nén ngay!
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Các ảnh sẽ được tự động giải nén và sắp xếp theo số trang
                        </p>
                      </div>
                    ) : (
                      <>
                        <FileArchive className="h-7 w-7 mx-auto mb-2 text-primary" />
                        <p className="text-sm font-medium text-foreground/80">
                          Nhấn để chọn hoặc kéo thả tệp .ZIP vào đây
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Tự động giải nén và sắp xếp ảnh theo thứ tự số trang
                        </p>
                      </>
                    )}
                  </label>
                </div>
              )}
            </div>

            {imagePreviews.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-900 dark:text-white">
                    Đã chọn ({imagePreviews.length} ảnh)
                  </label>
                  <button
                    type="button"
                    onClick={clearAllImages}
                    disabled={isSubmitting || isExtractingZip}
                    className="text-xs text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 font-medium transition-colors cursor-pointer"
                  >
                    Xóa tất cả
                  </button>
                </div>
                <div className="max-h-[30vh] overflow-y-auto rounded-lg border border-border/60 p-3 bg-muted/20 custom-scrollbar">
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                    {imagePreviews.map((preview, index) => (
                      <div
                        key={index}
                        draggable={!isSubmitting && !isExtractingZip}
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragLeave={(e) => handleDragLeave(e, index)}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragEnd={handleDragEnd}
                        className="relative h-28 cursor-move group"
                      >
                        <div className={cn(
                          "w-full h-full overflow-hidden rounded-[10px] border bg-slate-100 shadow-sm dark:bg-slate-800 relative transition-all",
                          draggedIdx === index ? "opacity-60 scale-[0.98] border-primary" : "border-border/40",
                          "group-hover:shadow-md"
                        )}>
                          <span className="absolute top-1.5 left-1.5 bg-black/75 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm z-10 border border-white/20 select-none shadow">
                            #{index + 1}
                          </span>
                          <Image
                            src={preview}
                            alt={`Xem trước ${index + 1}`}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                            unoptimized
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            disabled={isSubmitting || isExtractingZip}
                            title="Xóa ảnh này"
                            aria-label="Xóa ảnh"
                            className="absolute top-1.5 right-1.5 bg-rose-600 hover:bg-rose-700 active:scale-90 text-white p-1.5 rounded-full shadow-md hover:shadow-rose-500/30 transition-all cursor-pointer z-10 border border-white/40 flex items-center justify-center disabled:opacity-50"
                          >
                            <X className="h-3.5 w-3.5 stroke-[2.5]" />
                          </button>
                        </div>
                        {dragOverIdx === index && dragOverPosition && (
                          <div
                            className={cn(
                              "absolute top-0 bottom-0 w-[4px] bg-primary z-30 pointer-events-none transition-all duration-75",
                              dragOverPosition === 'before' ? "-left-[9px] rounded-full" : "-right-[9px] rounded-full"
                            )}
                            style={{ boxShadow: '0 0 10px hsl(var(--primary))' }}
                          />
                        )}
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
                disabled={isSubmitting || isExtractingZip}
                className="rounded-[8px]"
                size="sm"
              >
                Hủy
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting || isExtractingZip}
                onClick={() => void handleSaveChapter(true)}
                className="rounded-[8px]"
                size="sm"
              >
                {isSubmitting ? 'Đang lưu...' : 'Lưu chương và thêm chương mới'}
              </Button>
              <Button
                type="button"
                disabled={isSubmitting || isExtractingZip}
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

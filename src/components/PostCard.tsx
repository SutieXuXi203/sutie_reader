'use client';
import { AnimatedTrash, AnimatedEdit, AnimatedUser, AnimateIcon } from '@/components/animate-ui/icons/AnimateIcon';
import { CalendarDays, ShieldAlert, Eye } from 'lucide-react';
import React, { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { useAuth } from '@/providers/AuthContext';
import { cn, getOptimizedImageUrl } from '@/lib/utils';
import { notify } from '@/lib/notify';
const EditPostForm = dynamic(() => import('@/components/EditPostForm').then(m => ({ default: m.EditPostForm })), { ssr: false });
const DeleteConfirmDialog = dynamic(() => import('@/components/DeleteConfirmDialog').then(m => ({ default: m.DeleteConfirmDialog })), { ssr: false });
interface Post {
  _id: string;
  title: string;
  description?: string;
  tags?: string[];
  content: string;
  images: string[];
  author: string;
  createdAt: string;
  updatedAt: string;
}
interface PostCardProps {
  post: Post;
  onDelete: (id: string) => void;
  onUpdate: () => void;
  availableTags?: string[];
  compact?: boolean;
}
export const PostCard = React.memo(function PostCard({ post, onDelete, onUpdate, availableTags = [], compact = false }: PostCardProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [canHoverPreview, setCanHoverPreview] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [nsfwRevealed, setNsfwRevealed] = useState(false);
  const [showNsfwConfirm, setShowNsfwConfirm] = useState(false);
  const { isAdmin } = useAuth();
  const isNSFW = (post.tags || []).some(tag => tag.toLowerCase().includes('18+'));
  useEffect(() => {
    const mediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const updateHoverCapability = () => setCanHoverPreview(mediaQuery.matches);
    updateHoverCapability();
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateHoverCapability);
      return () => mediaQuery.removeEventListener('change', updateHoverCapability);
    }
    mediaQuery.addListener(updateHoverCapability);
    return () => mediaQuery.removeListener(updateHoverCapability);
  }, []);
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (nsfwRevealed) {
      timeout = setTimeout(() => {
        setNsfwRevealed(false);
        setShowPreview(false);
      }, 5000);
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [nsfwRevealed]);
  const handleTagClick = (e: React.MouseEvent, tag: string) => {
    e.preventDefault();
    e.stopPropagation();
    const targetPath = typeof window !== 'undefined' && window.location.pathname === '/products' ? '/products' : '/';
    router.push(`${targetPath}?tag=${encodeURIComponent(tag.toLowerCase())}`);
  };
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/posts/${post._id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        onDelete(post._id);
        setIsDeleteConfirmOpen(false);
        notify.success('Đã xóa bài viết');
      } else {
        notify.error('Xóa bài viết không thành công');
      }
    } catch (error) {
      console.error('Lỗi khi xóa bài viết:', error);
      notify.error('Lỗi khi xóa bài viết');
    } finally {
      setIsDeleting(false);
    }
  };
  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, []);
  const formattedCreatedAt = formatDate(post.createdAt);
  const formattedCompactCreatedAt = new Date(post.createdAt).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const visibleTags = post.tags?.slice(0, compact ? 2 : 4) || [];
  const remainingTags = Math.max(0, (post.tags?.length || 0) - visibleTags.length);
  return (
    <>
      <Link
        href={`/posts/${post._id}`}
        className="group/card flex flex-col h-full bg-card/60 backdrop-blur-md border border-border rounded-[8px] overflow-hidden hover:shadow-[0_8px_30px_rgba(140,47,57,0.18)] hover:-translate-y-1 transition-all duration-500 cursor-pointer relative"
      >
        <div
          className={cn(
            "relative w-full bg-card/20 overflow-hidden border-b border-border dark:border-primary/20",
            compact ? "aspect-[4/5]" : "aspect-[16/9]"
          )}
          onMouseEnter={() => { if (canHoverPreview && (!isNSFW || nsfwRevealed)) setShowPreview(true); }}
          onMouseLeave={() => setShowPreview(false)}
        >
          {post.images.length > 0 ? (
            <Image
              src={getOptimizedImageUrl(post.images[0])}
              alt={post.title}
              fill
              sizes={compact ? "(max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 16vw" : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"}
              className={cn(
                "object-cover transition-transform duration-700 group-hover/card:scale-105",
                compact && "object-top",
                isNSFW && !nsfwRevealed && "blur-xl scale-110 brightness-90 saturate-75"
              )}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-primary-foreground/80 dark:text-primary/40">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          {isNSFW && !nsfwRevealed && (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/88 dark:bg-background/82 backdrop-blur-md cursor-pointer transition-all duration-300"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowNsfwConfirm(true);
              }}
            >
              <ShieldAlert className="w-8 h-8 text-primary mb-2 drop-shadow-lg" />
              <span className="text-foreground dark:text-white font-bold text-sm tracking-wider drop-shadow-md">18+</span>
              <span className="text-muted-foreground text-sm mt-2 flex items-center gap-2 font-semibold">
                <Eye className="w-5 h-5" /> Nhấn để hiển thị
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-primary/30 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 pointer-events-none" />
        </div>
        <div className={cn("flex flex-col flex-grow text-left", compact ? "p-2.5 sm:p-3" : "p-5 md:p-6")}>
          <h3 className={cn("font-bold text-foreground group-hover/card:text-primary transition-colors line-clamp-2 leading-tight", compact ? "mb-2 text-xs sm:text-sm" : "mb-3 text-lg")}>
            {post.title}
          </h3>
          {post.tags && post.tags.length > 0 ? (
            <div className={cn("flex flex-wrap", compact ? "mb-3 gap-1 min-h-[22px]" : "mb-4 gap-1.5 min-h-[28px]")}>
              {visibleTags.map((tag) => (
                <button
                  type="button"
                  onClick={(e) => handleTagClick(e, tag)}
                  key={`${post._id}-${tag}`}
                  className={cn(
                    "inline-flex items-center rounded-[8px] border border-primary/20 bg-primary/10 font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer",
                    compact ? "px-1 py-0.5 text-[9px]" : "px-1.5 py-0.5 text-[10px] sm:text-[11px]"
                  )}
                >
                  #{tag.toLowerCase()}
                </button>
              ))}
              {remainingTags > 0 && (
                <span className={cn(
                  "inline-flex items-center rounded-[8px] border border-primary/20 bg-primary/10 font-semibold text-primary",
                  compact ? "px-1 py-0.5 text-[9px]" : "px-1.5 py-0.5 text-[10px] sm:text-[11px]"
                )}>
                  +{remainingTags}
                </span>
              )}
            </div>
          ) : (
            <p className={cn("text-muted-foreground leading-relaxed flex-grow", compact ? "mb-3 line-clamp-2 text-xs" : "mb-4 line-clamp-3 text-sm")}>
              {post.description || 'Chưa gắn tag'}
            </p>
          )}
          <div className={cn("flex items-center text-foreground/80 font-semibold max-w-full", compact ? "gap-1.5 mb-3" : "gap-2 mb-6 w-fit")}>
            <AnimatedUser className={cn("shrink-0", compact ? "w-3.5 h-3.5" : "w-4 h-4")} />
            <span className={cn("truncate", compact ? "text-[11px] sm:text-xs" : "text-sm")}>{post.author}</span>
          </div>
          <div className={cn("flex flex-wrap items-center justify-between border-t border-border mt-auto", compact ? "gap-y-2 pt-2 text-[10px]" : "gap-y-3 pt-4 text-[12px] sm:text-[13px]")}>
            <div className={cn("flex flex-wrap items-center gap-y-1 text-muted-foreground font-medium", compact ? "gap-x-2" : "gap-x-3")}>
              <span className={cn("flex items-center whitespace-nowrap", compact ? "gap-1" : "gap-1.5")}>
                <AnimateIcon icon={CalendarDays} animation="scale" className={cn(compact ? "w-3 h-3" : "w-3.5 h-3.5")} />
                {compact ? formattedCompactCreatedAt : formattedCreatedAt}
              </span>
            </div>
            {isAdmin && (
              <div className={cn("flex items-center gap-1 ml-auto", compact && "mt-1")}>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsEditOpen(true); }}
                  className={cn("text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-[8px] transition-all cursor-pointer", compact ? "p-1" : "p-1.5 sm:p-2")}
                  title="Chỉnh sửa"
                >
                  <AnimatedEdit className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsDeleteConfirmOpen(true); }}
                  disabled={isDeleting}
                  className={cn("text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-[8px] transition-all disabled:opacity-50 cursor-pointer", compact ? "p-1" : "p-1.5 sm:p-2")}
                  title="Xóa"
                >
                  <AnimatedTrash className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
                </button>
              </div>
            )}
          </div>
        </div>
      </Link >
      {isAdmin && (
        <>
          <EditPostForm
            post={post}
            open={isEditOpen}
            onOpenChange={setIsEditOpen}
            onPostUpdated={() => { setIsEditOpen(false); onUpdate(); }}
            availableTags={availableTags}
          />
          <DeleteConfirmDialog
            open={isDeleteConfirmOpen}
            onOpenChange={setIsDeleteConfirmOpen}
            onConfirm={handleDelete}
            isLoading={isDeleting}
            title="Xóa bài viết?"
            description={`Bạn có chắc chắn muốn xóa "${post.title}"? Hành động này không thể hoàn tác.`}
            confirmLabel={isDeleting ? 'Đang xóa...' : 'Xóa'}
          />
        </>
      )}
      {
        canHoverPreview && showPreview && (!isNSFW || nsfwRevealed) && post.images.length > 0 && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 w-full h-full min-h-screen z-[9999] flex items-center justify-center pointer-events-none p-6 backdrop-blur-md bg-background/70 dark:bg-background/65">
            <div className="animate-popup-preview relative w-full max-w-[420px] aspect-[4/5] rounded-[8px] overflow-hidden shadow-2xl border border-border bg-card">
              <Image
                src={getOptimizedImageUrl(post.images[0])}
                alt="Preview"
                fill
                sizes="420px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/25 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <h4 className="text-white font-bold text-lg drop-shadow-md line-clamp-1">{post.title}</h4>
                <p className="text-white/80 text-xs drop-shadow-sm mt-1">Xem chi tiết bài viết</p>
              </div>
            </div>
          </div>,
          document.body
        )
      }
      {
        showNsfwConfirm && typeof document !== 'undefined' && createPortal(
          <div
            className="fixed inset-0 z-[10000] bg-background/92 dark:bg-background/92 backdrop-blur-md flex flex-col items-center justify-center px-6 text-center"
            onClick={(e) => { e.stopPropagation(); setShowNsfwConfirm(false); }}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/20 filter blur-[100px] rounded-full pointer-events-none" />
            <div
              className="relative z-10 flex flex-col items-center max-w-[400px] w-full bg-card border border-border p-8 rounded-[8px] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-14 h-14 bg-secondary rounded-[8px] flex items-center justify-center mb-6 border border-border/50">
                <ShieldAlert className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-foreground">Cảnh báo !</h3>
              <div className="inline-flex items-center gap-2 bg-secondary text-primary text-[10px] uppercase font-bold px-3 py-1 rounded-[8px] mb-6 border border-border/50">
                <span className="w-1.5 h-1.5 bg-destructive rounded-full" />
                Nội dung 18+
              </div>
              <p className="text-muted-foreground mb-8 text-sm leading-relaxed">
                Đây là nội dung nhạy cảm dành cho người trên 18 tuổi. Khám phá nội dung này?
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowNsfwConfirm(false); setNsfwRevealed(true); }}
                  className="flex-1 py-3 bg-primary text-primary-foreground font-bold rounded-[8px] hover:bg-primary/90 transition-colors shadow-[0_4px_14px_var(--color-primary)] text-sm cursor-pointer"
                >
                  Hiển thị
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowNsfwConfirm(false); }}
                  className="flex-1 py-3 bg-card text-foreground font-bold rounded-[8px] hover:bg-secondary transition-colors border border-border text-sm shadow-sm cursor-pointer"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      }
    </>
  );
});

'use client';
import { Trash2, Pencil, CalendarDays, User, ShieldAlert, Eye } from 'lucide-react';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { EditPostForm } from '@/components/EditPostForm';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { useAuth } from '@/providers/AuthContext';
import { getOptimizedImageUrl } from '@/lib/utils';
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
}
export function PostCard({ post, onDelete, onUpdate, availableTags = [] }: PostCardProps) {
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
    router.push(`/products?tag=${encodeURIComponent(tag.toLowerCase())}`);
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
      } else {
        alert('Xóa bài viết không thành công');
      }
    } catch (error) {
      console.error('Lỗi khi xóa bài viết:', error);
      alert('Lỗi khi xóa bài viết');
    } finally {
      setIsDeleting(false);
    }
  };
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };
  return (
    <>
      <Link
        href={`/posts/${post._id}`}
        className="group/card flex flex-col h-full bg-white dark:bg-[#140606] border border-red-50 dark:border-red-950/50 hover:border-red-200 dark:hover:border-red-900/40 rounded-[8px] overflow-hidden hover:shadow-[0_8px_30px_rgb(220,38,38,0.08)] dark:hover:shadow-[0_8px_30px_rgb(220,38,38,0.05)] hover:-translate-y-1 transition-all duration-300 relative"
      >
        <div
          className="relative w-full aspect-[16/9] bg-red-50 dark:bg-red-950/20 overflow-hidden border-b border-red-50 dark:border-red-950/50"
          onMouseEnter={() => { if (canHoverPreview && (!isNSFW || nsfwRevealed)) setShowPreview(true); }}
          onMouseLeave={() => setShowPreview(false)}
        >
          {post.images.length > 0 ? (
            <Image
              src={getOptimizedImageUrl(post.images[0])}
              alt={post.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className={`object-cover transition-transform duration-700 group-hover/card:scale-105 ${isNSFW && !nsfwRevealed ? 'blur-xl scale-110' : ''}`}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-red-300 dark:text-red-900/50">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          {isNSFW && !nsfwRevealed && (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-red-950/60 dark:bg-black/60 backdrop-blur-sm cursor-pointer transition-all duration-300"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowNsfwConfirm(true);
              }}
            >
              <ShieldAlert className="w-8 h-8 text-red-300 mb-2 drop-shadow-lg" />
              <span className="text-white font-bold text-sm tracking-wider drop-shadow-md">18+</span>
              <span className="text-red-200/90 text-sm mt-2 flex items-center gap-2 font-semibold">
                <Eye className="w-5 h-5" /> Nhấn để hiển thị
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 pointer-events-none" />
        </div>
        <div className="p-5 md:p-6 flex flex-col flex-grow text-left">
          <h3 className="text-lg font-bold text-red-950 dark:text-red-50 mb-3 group-hover/card:text-red-600 dark:group-hover/card:text-red-400 transition-colors line-clamp-2 leading-tight">
            {post.title}
          </h3>
          {post.tags && post.tags.length > 0 ? (
            <div className="mb-4 flex flex-wrap gap-2 min-h-[40px]">
              {post.tags.slice(0, 4).map((tag) => (
                <button
                  type="button"
                  onClick={(e) => handleTagClick(e, tag)}
                  key={`${post._id}-${tag}`}
                  className="inline-flex items-center rounded-[8px] border border-red-100 dark:border-red-900/40 bg-red-50/70 dark:bg-red-900/20 px-2 py-1 text-xs text-red-700 dark:text-red-300 hover:border-red-300 dark:hover:border-red-700 hover:bg-red-100/70 dark:hover:bg-red-900/30 transition-colors cursor-pointer"
                >
                  #{tag.toLowerCase()}
                </button>
              ))}
              {post.tags.length > 4 && (
                <span className="inline-flex items-center rounded-[8px] border border-red-100 dark:border-red-900/40 bg-red-50/70 dark:bg-red-900/20 px-2 py-1 text-xs text-red-700 dark:text-red-300">
                  +{post.tags.length - 4}
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm text-red-700/70 dark:text-red-300/60 mb-4 line-clamp-3 leading-relaxed flex-grow">
              {post.description || 'Chưa gắn tag'}
            </p>
          )}
          <div className="flex items-center gap-2 mb-6 text-red-600 dark:text-red-400 font-semibold bg-red-50/50 dark:bg-red-900/10 w-fit px-3 py-1.5 rounded-none border border-red-100 dark:border-red-900/30">
            <User className="w-4 h-4" />
            <span className="text-sm">{post.author}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-y-3 text-[12px] sm:text-[13px] pt-4 border-t border-red-50 dark:border-red-900/20 mt-auto">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-red-400/80 dark:text-red-500/60 font-medium">
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <CalendarDays className="w-3.5 h-3.5" />
                {formatDate(post.createdAt)}
              </span>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsEditOpen(true); }}
                  className="p-1.5 sm:p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-none transition-all cursor-pointer"
                  title="Chỉnh sửa"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsDeleteConfirmOpen(true); }}
                  disabled={isDeleting}
                  className="p-1.5 sm:p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-none transition-all disabled:opacity-50 cursor-pointer"
                  title="Xóa"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </Link>
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
      {canHoverPreview && showPreview && (!isNSFW || nsfwRevealed) && post.images.length > 0 && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 w-full h-full min-h-screen z-[9999] flex items-center justify-center pointer-events-none p-6 backdrop-blur-md bg-red-950/5 dark:bg-black/10">
          <div className="animate-popup-preview relative w-full max-w-[420px] aspect-[4/5] rounded-[8px] overflow-hidden shadow-[0_32px_64px_-16px_rgba(153,27,27,0.3)] dark:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] border border-red-200/30 dark:border-red-900/40 bg-red-50 dark:bg-red-950">
            <Image
              src={getOptimizedImageUrl(post.images[0])}
              alt="Preview"
              fill
              sizes="420px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-red-950/60 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <h4 className="text-white font-bold text-lg drop-shadow-md line-clamp-1">{post.title}</h4>
              <p className="text-red-200/80 text-xs drop-shadow-sm mt-1">Xem chi tiết bài viết</p>
            </div>
          </div>
        </div>,
        document.body
      )}
      {showNsfwConfirm && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[10000] bg-[#050505]/95 backdrop-blur-sm flex flex-col items-center justify-center text-white px-6 text-center"
          onClick={(e) => { e.stopPropagation(); setShowNsfwConfirm(false); }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-900/10 filter blur-[100px] rounded-full pointer-events-none" />
          <div
            className="relative z-10 flex flex-col items-center max-w-[400px] w-full bg-[#0a0202] border border-red-900/30 p-8 rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 bg-[#1a0505] rounded-[16px] flex items-center justify-center mb-6 border border-red-900/40">
              <ShieldAlert className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="text-2xl font-bold mb-4 text-white">Cảnh báo !</h3>
            <div className="inline-flex items-center gap-2 bg-[#1a0505] text-red-500 text-[10px] uppercase font-bold px-3 py-1 rounded-full mb-6 border border-red-900/30">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
              Nội dung 18+
            </div>
            <p className="text-slate-400 mb-8 text-sm leading-relaxed">
              Đây là nội dung nhạy cảm dành cho người trên 18 tuổi. Mở hình ảnh này?
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={(e) => { e.stopPropagation(); setShowNsfwConfirm(false); setNsfwRevealed(true); }}
                className="flex-1 py-3 bg-[#ff0000] text-white font-bold rounded-[8px] hover:bg-red-600 transition-colors shadow-[0_0_15px_rgba(255,0,0,0.2)] text-sm"
              >
                Hiển thị
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setShowNsfwConfirm(false); }}
                className="flex-1 py-3 bg-[#1a1a1a] text-[#a0a0a0] font-bold rounded-[8px] hover:bg-[#2a2a2a] hover:text-white transition-colors border border-white/5 text-sm"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

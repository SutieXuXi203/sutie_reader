'use client';

import { Button } from '@/components/ui/button';
import { Trash2, Pencil, CalendarDays, User } from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { EditPostForm } from '@/components/EditPostForm';
import { useAuth } from '@/providers/AuthContext';

interface Post {
  _id: string;
  title: string;
  description: string;
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
}

export function PostCard({ post, onDelete, onUpdate }: PostCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const { isAdmin } = useAuth();

  const handleDelete = async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa bài viết này không?')) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/posts/${post._id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onDelete(post._id);
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
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <>
      <Link
        href={`/posts/${post._id}`}
        className="group/card block rounded-none overflow-hidden border border-red-100 dark:border-red-900/30 bg-white/90 dark:bg-[#140606]/90 backdrop-blur-sm hover:border-red-300 dark:hover:border-red-700/60 transition-all duration-500 hover:shadow-2xl hover:shadow-red-500/20 hover:-translate-y-1.5 relative"
      >
        {/* Subtle top glow line on hover */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-red-500/70 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 z-10" />

        {/* Image */}
        <div
          className="relative w-full h-48 bg-red-50 dark:bg-red-950/30 overflow-hidden"
          onMouseEnter={() => setShowPreview(true)}
          onMouseLeave={() => setShowPreview(false)}
        >
          {post.images.length > 0 ? (
            <Image
              src={post.images[0]}
              alt={post.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover/card:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-none flex items-center justify-center">
                <svg className="w-6 h-6 text-red-300 dark:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300" />

          {/* Admin actions overlay */}
          {isAdmin && (
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity duration-200">
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsEditOpen(true); }}
                className="p-1.5 bg-white/90 dark:bg-red-950/90 text-red-500 hover:bg-red-500 hover:text-white rounded-none shadow-md transition-all cursor-pointer"
                title="Chỉnh sửa"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(); }}
                disabled={isDeleting}
                className="p-1.5 bg-white/90 dark:bg-red-950/90 text-red-400 hover:bg-red-500 hover:text-white rounded-none shadow-md transition-all disabled:opacity-50 cursor-pointer"
                title="Xóa"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          <h3 className="text-base font-bold text-red-950 dark:text-red-50 mb-2 line-clamp-2 group-hover/card:text-red-700 dark:group-hover/card:text-red-200 transition-colors leading-snug">
            {post.title}
          </h3>
          <p className="text-sm text-red-700/60 dark:text-red-300/60 mb-4 line-clamp-2 leading-relaxed">
            {post.description}
          </p>

          <div className="flex items-center justify-between text-xs pt-3 border-t border-red-50 dark:border-red-900/20">
            <span className="flex items-center gap-1.5 text-red-500 dark:text-red-400 font-medium">
              <User className="w-3 h-3" />
              {post.author}
            </span>
            <span className="flex items-center gap-1.5 text-red-400/70 dark:text-red-500/60">
              <CalendarDays className="w-3 h-3" />
              {formatDate(post.createdAt)}
            </span>
          </div>
        </div>
      </Link>

      <EditPostForm
        post={post}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onPostUpdated={() => { setIsEditOpen(false); onUpdate(); }}
      />

      {/* Animated image preview on hover */}
      {showPreview && post.images.length > 0 && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none p-6 backdrop-blur-[2px] bg-red-950/5 dark:bg-black/10">
          <div className="animate-popup-preview relative w-full max-w-[420px] aspect-[4/5] rounded-none overflow-hidden shadow-[0_32px_64px_-16px_rgba(153,27,27,0.3)] dark:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] border border-red-200/30 dark:border-red-900/40 bg-red-50 dark:bg-red-950">
            <Image
              src={post.images[0]}
              alt="Preview"
              fill
              sizes="420px"
              className="object-cover"
            />
            {/* Elegant overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-red-950/60 via-transparent to-transparent" />

            {/* Title overlay in preview */}
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <h4 className="text-white font-bold text-lg drop-shadow-md line-clamp-1">{post.title}</h4>
              <p className="text-red-200/80 text-xs drop-shadow-sm mt-1">Xem chi tiết bài viết</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

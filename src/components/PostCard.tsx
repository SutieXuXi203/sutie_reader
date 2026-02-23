'use client';

import { Button } from '@/components/ui/button';
import { Trash2, Pencil } from 'lucide-react';
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
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <Link
        href={`/posts/${post._id}`}
        className="border border-slate-200 dark:border-slate-800 rounded-none overflow-hidden hover:border-slate-400 dark:hover:border-slate-600 transition-colors cursor-pointer block group/card"
      >
        <div
          className="relative w-full h-48 bg-slate-100 dark:bg-slate-900"
          onMouseEnter={() => setShowPreview(true)}
          onMouseLeave={() => setShowPreview(false)}
        >
          {post.images.length > 0 && (
            <Image
              src={post.images[0]}
              alt={post.title}
              fill
              className="object-cover transition-transform duration-500 group-hover/card:scale-105"
              unoptimized
            />
          )}
        </div>

        <div className="p-5">
          <h3 className="text-base font-medium text-slate-900 dark:text-white mb-2 line-clamp-2 group-hover/card:text-black dark:group-hover/card:text-slate-200 transition-colors">
            {post.title}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
            {post.description}
          </p>

          <div className="flex justify-between items-start gap-3 mb-4">
            <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 flex-1">
              {post.content}
            </p>
            {isAdmin && (
              <div className="flex gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsEditOpen(true); }}
                  className="text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-900 h-8 w-8 p-0"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(); }}
                  disabled={isDeleting}
                  className="text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-900 h-8 w-8 p-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-500 pt-3 border-t border-slate-100 dark:border-slate-800">
            <span className="text-slate-600 dark:text-slate-400">{post.author}</span>
            <span>{formatDate(post.createdAt)}</span>
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none p-6 backdrop-blur-[2px] bg-white/5 dark:bg-black/5">
          <div className="animate-popup-preview relative w-full max-w-[420px] aspect-[4/5] rounded-none overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] dark:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] border border-white/20 dark:border-slate-800/50 bg-slate-100 dark:bg-slate-900">
            <Image
              src={post.images[0]}
              alt="Preview"
              fill
              className="object-cover"
              unoptimized
            />
            {/* Elegant overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

            {/* Title overlay in preview */}
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <h4 className="text-white font-semibold text-lg drop-shadow-md line-clamp-1">{post.title}</h4>
              <p className="text-white/80 text-xs drop-shadow-sm mt-1">Xem chi tiết bài viết</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

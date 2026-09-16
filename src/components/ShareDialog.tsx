'use client';

import { useState, useEffect, useCallback, useMemo, useDeferredValue } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Lock,
  Globe,
  Link as LinkIcon,
  Check,
  UserPlus,
  Trash2,
  Loader2,
  Shield,
  HelpCircle,
  ChevronDown,
  X,
  Users,
  Search,
  PanelRightOpen,
  Clock,
  UserX,
} from 'lucide-react';
import { AnimatedUser, AnimatedShare } from '@/components/animate-ui/icons/AnimateIcon';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useAuth } from '@/providers/AuthContext';
import { notify } from '@/lib/notify';
import { cn } from '@/lib/utils';

interface SharedUserItem {
  email: string;
  role: 'viewer';
  name: string;
  avatar?: string;
  addedAt: string;
  isRegistered?: boolean;
}

interface AccessedUserItem {
  userId?: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'user' | 'guest';
  lastAccessedAt: string;
}

interface ShareData {
  postId: string;
  title: string;
  accessType: 'restricted' | 'public';
  isOwner: boolean;
  owner: {
    name: string;
    email: string;
    avatar?: string;
    isCurrent?: boolean;
  };
  sharedWith: SharedUserItem[];
  accessedUsers?: AccessedUserItem[];
}

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  postTitle: string;
}

const getInitials = (name?: string, email?: string) => {
  const target = name?.trim() || email?.trim() || '?';
  return target.charAt(0).toUpperCase();
};

const formatRelativeTime = (isoString?: string | Date) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 60) return 'Vừa xong';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return date.toLocaleDateString('vi-VN');
};

export function ShareDialog({
  open,
  onOpenChange,
  postId,
  postTitle,
}: ShareDialogProps) {
  const { user, isAdmin } = useAuth();
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  const [isUpdatingAccess, setIsUpdatingAccess] = useState(false);
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [visitorSearch, setVisitorSearch] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState<AccessedUserItem | null>(null);
  const [isRevokingVisitor, setIsRevokingVisitor] = useState(false);

  const deferredSearch = useDeferredValue(visitorSearch);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    setIsMobile(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const fetchShareData = useCallback(async (signal?: AbortSignal) => {
    if (!postId) return;
    try {
      setIsLoading(true);
      const res = await fetch(`/api/posts/${postId}/share`, { signal });
      if (res.ok) {
        const data = await res.json();
        setShareData(data);
      } else {
        const err = await res.json().catch(() => ({}));
        notify.error(err.error || 'Không thể tải thông tin chia sẻ');
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.error('Lỗi khi tải thông tin chia sẻ:', err);
      notify.error('Lỗi kết nối máy chủ');
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setEmailInput('');
    setHasCopied(false);
    setIsSidebarOpen(false);
    setVisitorSearch('');
    setSelectedVisitor(null);
    fetchShareData(controller.signal);
    return () => controller.abort();
  }, [open, fetchShareData]);

  const linkVisitors = useMemo(() => {
    return (shareData?.accessedUsers || []).filter(
      (u) =>
        u.email.toLowerCase() !== (shareData?.owner.email || '').toLowerCase() &&
        !(shareData?.sharedWith || []).some(
          (s) => s.email.toLowerCase() === u.email.toLowerCase()
        )
    );
  }, [shareData]);

  const filteredVisitors = useMemo(() => {
    if (!deferredSearch.trim()) return linkVisitors;
    const q = deferredSearch.toLowerCase().trim();
    return linkVisitors.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.email.toLowerCase().includes(q)
    );
  }, [linkVisitors, deferredSearch]);

  const handleAddUser = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail) return;

    // Email regex format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      notify.error('Vui lòng nhập địa chỉ email hợp lệ');
      return;
    }

    if (shareData?.sharedWith.some((u) => u.email.toLowerCase() === cleanEmail)) {
      notify.error('Email này đã có trong danh sách được cấp quyền');
      return;
    }

    setIsSubmittingUser(true);
    try {
      const res = await fetch(`/api/posts/${postId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_user',
          email: cleanEmail,
          role: 'viewer',
        }),
      });

      const resData = await res.json();
      if (res.ok) {
        notify.success(`Đã cấp quyền truy cập cho ${cleanEmail}`);
        setEmailInput('');
        if (resData.user) {
          setShareData((prev) =>
            prev
              ? {
                ...prev,
                sharedWith: [...prev.sharedWith, resData.user],
              }
              : prev
          );
        } else {
          fetchShareData();
        }
      } else {
        notify.error(resData.error || 'Không thể thêm người dùng');
      }
    } catch (err) {
      console.error('Lỗi khi thêm người dùng:', err);
      notify.error('Lỗi khi kết nối đến máy chủ');
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleUpdateAccessType = async (newType: 'restricted' | 'public') => {
    if (!shareData || shareData.accessType === newType) return;
    setIsUpdatingAccess(true);
    try {
      const res = await fetch(`/api/posts/${postId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_access',
          accessType: newType,
        }),
      });

      if (res.ok) {
        setShareData((prev) => (prev ? { ...prev, accessType: newType } : prev));
        notify.success(
          newType === 'restricted'
            ? 'Đã chuyển sang chế độ Hạn chế'
            : 'Đã mở quyền cho bất kỳ ai có đường liên kết'
        );
      } else {
        const err = await res.json().catch(() => ({}));
        notify.error(err.error || 'Không thể cập nhật quyền truy cập');
      }
    } catch (err) {
      console.error('Lỗi khi cập nhật accessType:', err);
      notify.error('Lỗi kết nối máy chủ');
    } finally {
      setIsUpdatingAccess(false);
    }
  };

  const handleDeleteUser = async (targetEmail: string) => {
    setDeletingEmail(targetEmail);
    try {
      const res = await fetch(`/api/posts/${postId}/share?email=${encodeURIComponent(targetEmail)}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        notify.success(`Đã xóa quyền truy cập của ${targetEmail}`);
        setShareData((prev) =>
          prev
            ? {
              ...prev,
              sharedWith: prev.sharedWith.filter((u) => u.email !== targetEmail),
            }
            : prev
        );
      } else {
        const err = await res.json().catch(() => ({}));
        notify.error(err.error || 'Không thể xóa quyền');
      }
    } catch (err) {
      console.error('Lỗi khi xóa người dùng:', err);
      notify.error('Lỗi kết nối máy chủ');
    } finally {
      setDeletingEmail(null);
    }
  };

  const handleRevokeVisitorAccess = async (targetVisitor: AccessedUserItem) => {
    if (!targetVisitor) return;
    setIsRevokingVisitor(true);
    try {
      const res = await fetch(
        `/api/posts/${postId}/share?email=${encodeURIComponent(targetVisitor.email)}`,
        { method: 'DELETE' }
      );

      if (res.ok) {
        notify.success(`Đã gỡ quyền truy cập của ${targetVisitor.name || targetVisitor.email}`);
        setShareData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            accessedUsers: (prev.accessedUsers || []).filter(
              (u) => u.email.toLowerCase() !== targetVisitor.email.toLowerCase()
            ),
            sharedWith: prev.sharedWith.filter(
              (s) => s.email.toLowerCase() !== targetVisitor.email.toLowerCase()
            ),
          };
        });
        setSelectedVisitor(null);
      } else {
        const err = await res.json().catch(() => ({}));
        notify.error(err.error || 'Không thể gỡ quyền truy cập');
      }
    } catch (err) {
      console.error('Lỗi khi gỡ quyền truy cập:', err);
      notify.error('Lỗi kết nối máy chủ');
    } finally {
      setIsRevokingVisitor(false);
    }
  };

  const handleCopyLink = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const shareUrl = `${origin}/posts/${postId}`;

    let success = false;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        success = true;
      }
    } catch {
      // Fallback below
    }

    if (!success && typeof document !== 'undefined') {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        success = document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch (err) {
        console.error('Lỗi sao chép dự phòng:', err);
      }
    }

    if (success) {
      setHasCopied(true);
      notify.success('Đã sao chép đường liên kết');
      setTimeout(() => setHasCopied(false), 2500);
    } else {
      notify.error('Không thể sao chép liên kết');
    }
  };


  const renderVisitorList = () => {
    if (filteredVisitors.length === 0) {
      return (
        <div className="py-8 text-center space-y-1">
          <p className="text-xs font-medium text-foreground">Không tìm thấy tài khoản</p>
          <p className="text-[11px] text-muted-foreground">Thử tìm với tên hoặc email khác</p>
        </div>
      );
    }

    return (
      <div className="space-y-1.5">
        {filteredVisitors.map((visitor) => (
          <div
            key={visitor.email}
            onClick={() => {
              if (isAdmin) setSelectedVisitor(visitor);
            }}
            title={isAdmin ? "Nhấn để quản lý quyền truy cập" : undefined}
            className={cn(
              "flex items-center justify-between p-2.5 rounded-[8px] bg-secondary/10 hover:bg-secondary/30 border border-border/30 hover:border-border/60 transition-all duration-150 group",
              isAdmin && "cursor-pointer hover:border-primary/40 hover:bg-secondary/40 active:scale-[0.99]"
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-[8px] bg-secondary border border-border flex items-center justify-center font-bold text-xs text-foreground shrink-0 overflow-hidden">
                {visitor.avatar ? (
                  <Image
                    src={visitor.avatar}
                    alt={visitor.name}
                    width={36}
                    height={36}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                ) : (
                  getInitials(visitor.name, visitor.email)
                )}
              </div>
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-xs font-semibold text-foreground truncate max-w-[140px] sm:max-w-none">
                    {visitor.name}
                  </p>
                  {visitor.email.toLowerCase() === user?.email.toLowerCase() && (
                    <span className="text-[9px] px-1 py-0.2 rounded-[8px] bg-muted text-muted-foreground">
                      bạn
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground truncate max-w-[150px] sm:max-w-none">
                  {visitor.email}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  {visitor.role === 'admin' && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded-[8px] bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium border border-purple-500/20">
                      Quản trị viên
                    </span>
                  )}
                  {visitor.role === 'user' && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded-[8px] bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium border border-blue-500/20">
                      Thành viên
                    </span>
                  )}
                  {visitor.role === 'guest' && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded-[8px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium border border-amber-500/20">
                      Khách
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="shrink-0 pl-2 text-right space-y-0.5">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[8px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Đã truy cập
              </span>
              <p className="text-[9px] text-muted-foreground flex items-center justify-end gap-1">
                <Clock className="w-2.5 h-2.5" />
                {formatRelativeTime(visitor.lastAccessedAt)}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "w-[calc(100%-2.5rem)] sm:w-full max-w-[calc(100%-2.5rem)] rounded-[8px] bg-card border border-border shadow-2xl p-0 overflow-hidden text-foreground transition-all duration-300 max-h-[calc(100dvh-3rem)] sm:max-h-[85vh] flex flex-col",
            !isMobile && isSidebarOpen ? "md:max-w-4xl" : "sm:max-w-xl"
          )}
          showCloseButton={false}
        >
          <div className="flex flex-col md:flex-row w-full divide-y md:divide-y-0 md:divide-x divide-border flex-1 min-h-0 overflow-y-auto md:overflow-visible custom-scrollbar">
            {/* Main Share Dialog Panel */}
            <div className="flex-1 min-w-0 flex flex-col">
              {/* Drive Modal Header */}
              <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 flex items-center justify-between gap-3 bg-card shrink-0">
                <DialogTitle className="text-base sm:text-lg font-normal text-foreground truncate">
                  Chia sẻ &ldquo;{postTitle || shareData?.title || 'Truyện'}&rdquo;
                </DialogTitle>
              <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="w-8 h-8 rounded-[8px] hover:bg-muted flex items-center justify-center transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
                  title="Đóng"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Content Body */}
            <div className="px-4 sm:px-6 py-3 space-y-4 max-h-[calc(80vh-140px)] md:max-h-[calc(80vh-140px)] overflow-y-auto flex-1 min-h-0 custom-scrollbar">
              {/* Add People Bar (Google Drive Style) */}
              {isAdmin && (
                <form onSubmit={handleAddUser} className="space-y-1">
                  <div className="relative flex items-center gap-2">
                    <div className="relative flex-1 group">
                      <Input
                        type="email"
                        placeholder="Thêm người, nhóm, không gian hoặc email..."
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        disabled={isSubmittingUser}
                        className="px-3 sm:px-4 h-10 sm:h-11 rounded-[8px] border-border bg-transparent text-xs sm:text-sm placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary shadow-none"
                      />
                    </div>

                    <Button
                      type="submit"
                      size="sm"
                      disabled={!emailInput.trim() || isSubmittingUser}
                      className="h-10 sm:h-11 px-4 sm:px-5 rounded-[8px] font-medium text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shrink-0 shadow-none"
                    >
                      {isSubmittingUser ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Thêm'
                      )}
                    </Button>
                  </div>
                </form>
              )}

              {/* Section: People with access */}
              <div className="space-y-2 pt-1">
                <h3 className="text-sm font-medium text-foreground">
                  Những người có quyền truy cập
                </h3>

                {isLoading ? (
                  <div className="space-y-3 py-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-[8px] bg-muted animate-pulse shrink-0" />
                      <div className="space-y-1.5 flex-1">
                        <div className="h-3.5 w-32 bg-muted animate-pulse rounded-[8px]" />
                        <div className="h-3 w-48 bg-muted animate-pulse rounded-[8px]" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {/* Story Owner Row */}
                    <div className="flex items-center justify-between py-2 px-1 rounded-[8px] transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-[8px] bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                          {shareData?.owner.avatar ? (
                            <Image
                              src={shareData.owner.avatar}
                              alt={shareData.owner.name}
                              width={36}
                              height={36}
                              className="w-full h-full object-cover"
                              unoptimized
                            />
                          ) : (
                            getInitials(shareData?.owner.name, shareData?.owner.email)
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs sm:text-sm font-medium text-foreground truncate">
                              {shareData?.owner.name || 'Administrator'}
                            </p>
                            {shareData?.owner.isCurrent && (
                              <span className="text-xs text-muted-foreground font-normal">
                                (you)
                              </span>
                            )}
                          </div>
                          {shareData?.owner.email ? (
                            <p className="text-[11px] text-muted-foreground truncate">
                              {shareData.owner.email}
                            </p>
                          ) : (
                            <p className="text-[11px] text-muted-foreground truncate">
                              Ban Quản Trị
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 pl-2">
                        <span className="text-xs sm:text-sm text-muted-foreground font-normal select-none">
                          Chủ sở hữu
                        </span>
                      </div>
                    </div>

                    {/* Shared Users Rows */}
                    {shareData?.sharedWith && shareData.sharedWith.length > 0 && (
                      shareData.sharedWith.map((userItem) => {
                        const isDeleting = deletingEmail === userItem.email;
                        return (
                          <div
                            key={userItem.email}
                            className="flex items-center justify-between py-2 px-1 rounded-[8px] hover:bg-secondary/20 transition-colors group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-[8px] bg-secondary border border-border flex items-center justify-center font-bold text-xs text-foreground shrink-0 overflow-hidden">
                                {userItem.avatar ? (
                                  <Image
                                    src={userItem.avatar}
                                    alt={userItem.name}
                                    width={36}
                                    height={36}
                                    className="w-full h-full object-cover"
                                    unoptimized
                                  />
                                ) : (
                                  getInitials(userItem.name, userItem.email)
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-xs sm:text-sm font-medium text-foreground truncate">
                                    {userItem.name}
                                  </p>
                                  {userItem.email.toLowerCase() === user?.email.toLowerCase() && (
                                    <span className="text-xs text-muted-foreground font-normal">
                                      (you)
                                    </span>
                                  )}
                                  {!userItem.isRegistered && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-[8px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium shrink-0">
                                      Chờ đăng ký
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {userItem.email}
                                </p>
                              </div>
                            </div>

                            {/* Action Dropdown / Controls */}
                            <div className="flex items-center gap-2 shrink-0 pl-2">
                              <span className="text-xs sm:text-sm text-muted-foreground font-normal">
                                Người xem
                              </span>

                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(userItem.email)}
                                  disabled={isDeleting}
                                  className="p-1.5 rounded-[8px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                                  title={`Xóa quyền truy cập của ${userItem.email}`}
                                >
                                  {isDeleting ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-destructive" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}

                    {/* Users Who Accessed Via Link */}
                    {linkVisitors.length > 0 ? (
                      <div className="pt-3 mt-3 border-t border-border/50 space-y-2">
                        <div className="px-1 py-1 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold text-foreground tracking-tight">
                              Đã truy cập qua liên kết
                            </p>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-[8px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              {linkVisitors.length}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsSidebarOpen((prev) => !prev)}
                            className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1.5 px-2 py-1 rounded-[8px] hover:bg-primary/10 cursor-pointer transition-colors"
                          >
                            <span>{!isMobile && isSidebarOpen ? 'Thu gọn' : 'Xem toàn bộ'}</span>
                            <PanelRightOpen className={cn("w-3.5 h-3.5 transition-transform", !isMobile && isSidebarOpen && "rotate-180")} />
                          </button>
                        </div>

                        {/* Maximum 3 people displayed here */}
                        <div className="space-y-1.5">
                          {linkVisitors.slice(0, 3).map((visitor) => (
                            <div
                              key={visitor.email}
                              onClick={() => {
                                if (isAdmin) setSelectedVisitor(visitor);
                              }}
                              title={isAdmin ? "Nhấn để quản lý quyền truy cập" : undefined}
                              className={cn(
                                "flex items-center justify-between p-2.5 rounded-[8px] bg-secondary/20 hover:bg-secondary/40 border border-border/30 hover:border-border/60 transition-all duration-200 group",
                                isAdmin && "cursor-pointer hover:border-primary/40 hover:bg-secondary/50 active:scale-[0.99]"
                              )}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="relative w-10 h-10 rounded-[8px] bg-secondary border border-border flex items-center justify-center font-bold text-xs text-foreground shrink-0 overflow-hidden shadow-xs ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
                                  {visitor.avatar ? (
                                    <Image
                                      src={visitor.avatar}
                                      alt={visitor.name}
                                      width={40}
                                      height={40}
                                      className="w-full h-full object-cover"
                                      unoptimized
                                    />
                                  ) : (
                                    getInitials(visitor.name, visitor.email)
                                  )}
                                </div>
                                <div className="min-w-0 space-y-0.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
                                      {visitor.name}
                                    </p>
                                    {visitor.email.toLowerCase() === user?.email.toLowerCase() && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-[8px] bg-muted text-muted-foreground font-normal">
                                        bạn
                                      </span>
                                    )}
                                    {visitor.role === 'admin' && (
                                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-[8px] bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                        Quản trị viên
                                      </span>
                                    )}
                                    {visitor.role === 'user' && (
                                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-[8px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                        Thành viên
                                      </span>
                                    )}
                                    {visitor.role === 'guest' && (
                                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-[8px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                        Khách
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-muted-foreground truncate">
                                    {visitor.email}
                                  </p>
                                </div>
                              </div>

                              <div className="shrink-0 pl-3 text-right space-y-1">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[8px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold border border-emerald-500/20">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Đã truy cập
                                </span>
                                <p className="text-[10px] text-muted-foreground flex items-center justify-end gap-1">
                                  <Clock className="w-3 h-3 text-muted-foreground/70" />
                                  {formatRelativeTime(visitor.lastAccessedAt)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Indicator and Button when more than 3 people */}
                        {linkVisitors.length > 3 && (
                          <div className="flex items-center justify-between p-3 rounded-[8px] bg-gradient-to-r from-primary/5 via-secondary/40 to-primary/5 border border-primary/20 mt-2 shadow-xs">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-[8px] bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 ring-2 ring-primary/20">
                                +{linkVisitors.length - 3}
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-foreground">
                                  +{linkVisitors.length - 3} tài khoản khác đã truy cập
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  {isMobile ? 'Nhấn để mở danh sách chi tiết' : 'Nhấn để mở danh sách chi tiết bên cạnh'}
                                </p>
                              </div>
                            </div>

                            <Button
                              type="button"
                              size="sm"
                              onClick={() => setIsSidebarOpen(true)}
                              className="h-8 px-3.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-[8px] shadow-sm flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                            >
                              <span>Mở danh sách</span>
                              <PanelRightOpen className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      (!shareData?.sharedWith || shareData.sharedWith.length === 0) && (
                        <div className="py-3 text-center">
                          <p className="text-xs text-muted-foreground">
                            Chưa có người dùng cụ thể nào được thêm vào danh sách hoặc mở liên kết.
                          </p>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>

              {/* Section: General Access (Quyền truy cập chung) - Google Drive Style */}
              <div className="space-y-2 pt-2 border-t border-border/40">
                <h3 className="text-sm font-medium text-foreground">
                  Quyền truy cập chung
                </h3>

                <div className="flex items-start gap-3 pt-1">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0 mt-0.5 transition-colors',
                      shareData?.accessType === 'public'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400'
                        : 'bg-secondary text-muted-foreground'
                    )}
                  >
                    {shareData?.accessType === 'public' ? (
                      <Globe className="w-4 h-4" />
                    ) : (
                      <Lock className="w-4 h-4" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    {/* Access Type & Role Selects with clear gap */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                      {isAdmin ? (
                        <Select
                          value={shareData?.accessType || 'restricted'}
                          onValueChange={(val: 'restricted' | 'public' | null) => {
                            if (val) handleUpdateAccessType(val);
                          }}
                          disabled={isUpdatingAccess}
                        >
                          <SelectTrigger className="h-8 px-2.5 rounded-[8px] bg-secondary/80 hover:bg-secondary text-xs sm:text-sm font-medium text-foreground border-0 inline-flex items-center gap-1.5 cursor-pointer shadow-none transition-colors max-w-full">
                            <SelectValue placeholder="Chọn quyền">
                              {(val: 'restricted' | 'public' | null) => (
                                <span className="truncate max-w-[155px] sm:max-w-none">
                                  {val === 'public' ? 'Bất kỳ ai có đường liên kết' : 'Hạn chế'}
                                </span>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent
                            align="start"
                            side="bottom"
                            sideOffset={4}
                            alignItemWithTrigger={false}
                            className="rounded-[8px] border border-border bg-popover py-1.5 shadow-xl z-50 min-w-[240px]"
                          >
                            <SelectItem
                              value="restricted"
                              indicatorPosition="left"
                              className="py-2 text-xs sm:text-sm cursor-pointer rounded-[8px] hover:bg-secondary my-0.5 font-normal"
                            >
                              Hạn chế
                            </SelectItem>
                            <SelectItem
                              value="public"
                              indicatorPosition="left"
                              className="py-2 text-xs sm:text-sm cursor-pointer rounded-[8px] hover:bg-secondary my-0.5 font-normal"
                            >
                              Bất kỳ ai có đường liên kết
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs sm:text-sm font-medium text-foreground py-0.5 truncate max-w-[155px] sm:max-w-none">
                          {shareData?.accessType === 'public'
                            ? 'Bất kỳ ai có đường liên kết'
                            : 'Hạn chế'}
                        </span>
                      )}

                      {/* Role selector right beside it with clean spacing */}
                      <Select value="viewer">
                        <SelectTrigger className="h-8 px-2.5 sm:px-3 rounded-[8px] bg-secondary/80 hover:bg-secondary text-xs sm:text-sm font-normal text-foreground border-0 inline-flex items-center gap-1.5 cursor-pointer shadow-none shrink-0 transition-colors">
                          <SelectValue>
                            {() => 'Người xem'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent
                          align="start"
                          side="bottom"
                          sideOffset={4}
                          alignItemWithTrigger={false}
                          className="rounded-[8px] border border-border bg-popover py-1.5 shadow-xl z-50 min-w-[220px]"
                        >
                          <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 select-none">
                            Vai trò
                          </div>
                          <SelectItem
                            value="viewer"
                            indicatorPosition="left"
                            className="py-2 text-xs sm:text-sm cursor-pointer rounded-[8px] hover:bg-secondary font-normal"
                          >
                            Người xem
                          </SelectItem>
                          <SelectItem
                            value="commenter"
                            disabled
                            indicatorPosition="left"
                            className="py-2 text-xs sm:text-sm rounded-[8px] opacity-50 cursor-not-allowed font-normal"
                          >
                            Người nhận xét
                          </SelectItem>
                          <SelectItem
                            value="editor"
                            disabled
                            indicatorPosition="left"
                            className="py-2 text-xs sm:text-sm rounded-[8px] opacity-50 cursor-not-allowed font-normal"
                          >
                            <div className="space-y-0.5 text-left">
                              <p className="font-normal text-xs sm:text-sm">Người chỉnh sửa</p>
                              <p className="text-[10px] text-muted-foreground font-normal whitespace-normal">
                                Sắp xếp, thêm và chỉnh sửa tệp
                              </p>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed pl-0.5">
                      {shareData?.accessType === 'public'
                        ? 'Bất kỳ ai có đường liên kết này đều có thể xem'
                        : 'Chỉ những người có quyền truy cập mới có thể mở bằng đường liên kết này'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Drive Modal Footer */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 bg-card border-t border-border/40 flex items-center justify-between gap-2 sm:gap-3 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="h-9 sm:h-10 px-3 sm:px-4 rounded-[8px] text-xs sm:text-sm font-medium gap-1.5 sm:gap-2 border-border/80 bg-transparent hover:bg-secondary text-foreground transition-all cursor-pointer truncate max-w-[200px] sm:max-w-none"
              >
                {hasCopied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium truncate">Đã sao chép liên kết</span>
                  </>
                ) : (
                  <>
                    <LinkIcon className="w-4 h-4 text-primary shrink-0" />
                    <span className="truncate">Sao chép đường liên kết</span>
                  </>
                )}
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-9 sm:h-10 px-5 sm:px-6 rounded-[8px] text-xs sm:text-sm font-medium bg-[#1a73e8] hover:bg-[#1557b0] text-white transition-all cursor-pointer shadow-none shrink-0"
              >
                Xong
              </Button>
            </div>
          </div>

          {/* Right Sidebar on Desktop: All Accessed Users with Smooth Animation */}
          {!isMobile && (
            <AnimatePresence>
              {isSidebarOpen && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 360, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  className="w-[360px] shrink-0 bg-card flex flex-col md:max-h-[85vh] border-l border-border overflow-hidden shadow-lg"
                >
                  {/* Sidebar Header */}
                  <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 flex items-center justify-between gap-3 border-b border-border/60 bg-card shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-[8px] bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-xs">
                        <Users className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-foreground truncate">
                            Danh sách truy cập
                          </h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-[8px] bg-primary/10 text-primary">
                            {linkVisitors.length}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Tài khoản đã mở liên kết truyện
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsSidebarOpen(false)}
                      className="w-8 h-8 rounded-[8px] hover:bg-muted flex items-center justify-center transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
                      title="Đóng danh sách"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Search Bar if > 3 visitors */}
                  {linkVisitors.length > 3 && (
                    <div className="px-4 py-2.5 border-b border-border/40 bg-secondary/10 shrink-0">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                        <Input
                          placeholder="Tìm theo tên hoặc email..."
                          value={visitorSearch}
                          onChange={(e) => setVisitorSearch(e.target.value)}
                          className="pl-8 pr-7 h-8 text-xs bg-background border-border rounded-[8px]"
                        />
                        {visitorSearch && (
                          <button
                            type="button"
                            onClick={() => setVisitorSearch('')}
                            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer rounded-[8px] p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Scrollable Visitor List in Desktop Sidebar */}
                  <div className="p-3 space-y-1.5 overflow-y-auto flex-1 custom-scrollbar max-h-[calc(80vh-140px)]">
                    {renderVisitorList()}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Mobile Accessed Users Popup Modal */}
    {isMobile && (
      <Dialog open={open && isSidebarOpen} onOpenChange={setIsSidebarOpen}>
        <DialogContent
          className="w-[calc(100%-2.5rem)] max-w-[calc(100%-2.5rem)] rounded-[8px] bg-card border border-border shadow-2xl p-0 overflow-hidden text-foreground max-h-[calc(100dvh-3rem)] flex flex-col z-[60]"
          showCloseButton={false}
        >
          {/* Header */}
          <div className="px-4 py-3.5 flex items-center justify-between gap-3 border-b border-border/60 bg-card shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-[8px] bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-xs">
                <Users className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-sm font-bold text-foreground truncate">
                    Danh sách truy cập
                  </DialogTitle>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-[8px] bg-primary/10 text-primary">
                    {linkVisitors.length}
                  </span>
                </div>
                <DialogDescription className="text-[11px] text-muted-foreground">
                  Tài khoản đã mở liên kết truyện
                </DialogDescription>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="w-8 h-8 rounded-[8px] hover:bg-muted flex items-center justify-center transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
              title="Đóng danh sách"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search Bar if > 3 visitors */}
          {linkVisitors.length > 3 && (
            <div className="px-4 py-2.5 border-b border-border/40 bg-secondary/10 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Tìm theo tên hoặc email..."
                  value={visitorSearch}
                  onChange={(e) => setVisitorSearch(e.target.value)}
                  className="pl-8 pr-7 h-8 text-xs bg-background border-border rounded-[8px]"
                />
                {visitorSearch && (
                  <button
                    type="button"
                    onClick={() => setVisitorSearch('')}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer rounded-[8px] p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Scrollable Visitor List in Mobile Dialog */}
          <div className="p-3.5 flex-1 overflow-y-auto custom-scrollbar min-h-0">
            {renderVisitorList()}
          </div>

          {/* Footer with Close Button */}
          <div className="px-4 py-3 bg-card border-t border-border/40 flex items-center justify-end shrink-0">
            <Button
              type="button"
              size="sm"
              onClick={() => setIsSidebarOpen(false)}
              className="h-9 px-5 rounded-[8px] text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shadow-none"
            >
              Đóng
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )}

    {/* Admin Visitor Access Management Popup Modal */}
    <Dialog
      open={Boolean(selectedVisitor)}
      onOpenChange={(isOpen) => {
        if (!isOpen) setSelectedVisitor(null);
      }}
      disablePointerDismissal={false}
    >
      <DialogContent
        className="w-[calc(100%-2.5rem)] max-w-sm sm:max-w-md rounded-[8px] bg-card border border-border shadow-2xl p-0 overflow-hidden text-foreground z-[70] max-h-[calc(100dvh-3rem)] flex flex-col"
        showCloseButton={false}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-border/60 bg-card flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-[8px] bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-xs">
              <Shield className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm font-semibold text-foreground truncate">
                Quản lý quyền truy cập
              </DialogTitle>
              <DialogDescription className="text-[11px] text-muted-foreground truncate">
                Tài khoản đã mở liên kết truyện
              </DialogDescription>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSelectedVisitor(null)}
            className="w-8 h-8 rounded-[8px] hover:bg-muted flex items-center justify-center transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        {selectedVisitor && (
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar min-h-0">
            {/* User Profile Card */}
            <div className="flex items-center gap-3.5 p-3 sm:p-3.5 rounded-[8px] bg-secondary/30 border border-border/60">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-[8px] bg-secondary border border-border flex items-center justify-center font-bold text-sm sm:text-base text-foreground shrink-0 overflow-hidden shadow-xs">
                {selectedVisitor.avatar ? (
                  <Image
                    src={selectedVisitor.avatar}
                    alt={selectedVisitor.name}
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                ) : (
                  getInitials(selectedVisitor.name, selectedVisitor.email)
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="text-xs sm:text-sm font-semibold text-foreground truncate">
                    {selectedVisitor.name}
                  </h4>
                  {selectedVisitor.email.toLowerCase() === user?.email.toLowerCase() && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded-[8px] bg-muted text-muted-foreground font-normal">
                      bạn
                    </span>
                  )}
                  {selectedVisitor.role === 'admin' && (
                    <span className="text-[9px] font-medium px-2 py-0.5 rounded-[8px] bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                      Quản trị viên
                    </span>
                  )}
                  {selectedVisitor.role === 'user' && (
                    <span className="text-[9px] font-medium px-2 py-0.5 rounded-[8px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      Thành viên
                    </span>
                  )}
                  {selectedVisitor.role === 'guest' && (
                    <span className="text-[9px] font-medium px-2 py-0.5 rounded-[8px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      Khách
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground truncate">
                  {selectedVisitor.email}
                </p>
              </div>
            </div>

            {/* Access details */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-[8px] bg-secondary/15 border border-border/40">
                <span className="text-muted-foreground">Trạng thái</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[8px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] sm:text-[11px] font-semibold border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Đã truy cập liên kết
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-[8px] bg-secondary/15 border border-border/40">
                <span className="text-muted-foreground">Lần truy cập gần nhất</span>
                <span className="text-foreground font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3 text-muted-foreground/70" />
                  {formatRelativeTime(selectedVisitor.lastAccessedAt)}
                </span>
              </div>
            </div>

            {/* Warning Note */}
            <div className="p-3 rounded-[8px] bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <UserX className="w-3.5 h-3.5 shrink-0" />
                Gỡ quyền truy cập
              </p>
              <p className="text-[11px] text-destructive/90 leading-relaxed font-normal">
                Tài khoản này sẽ bị xóa khỏi danh sách đã truy cập. Nếu truyện ở chế độ Hạn chế, người này sẽ không còn quyền mở đọc truyện.
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 sm:px-5 py-3 bg-card border-t border-border/40 flex items-center justify-end gap-2.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSelectedVisitor(null)}
            disabled={isRevokingVisitor}
            className="h-9 px-4 rounded-[8px] text-xs font-medium cursor-pointer"
          >
            Hủy
          </Button>

          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isRevokingVisitor || !selectedVisitor}
            onClick={() => selectedVisitor && handleRevokeVisitorAccess(selectedVisitor)}
            className="h-9 px-4 rounded-[8px] text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all cursor-pointer shadow-none flex items-center gap-1.5"
          >
            {isRevokingVisitor ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Đang gỡ...</span>
              </>
            ) : (
              <>
                <UserX className="w-3.5 h-3.5" />
                <span>Gỡ quyền truy cập</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </>
  );
}

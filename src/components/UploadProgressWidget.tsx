'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface UploadProgressState {
  isVisible: boolean;
  title: string;
  subtitle?: string;
  completed: number;
  total: number;
  status: 'uploading' | 'saving' | 'success' | 'error';
  errorMessage?: string;
}

interface UploadProgressWidgetProps {
  state: UploadProgressState;
  onClose: () => void;
  onRetry?: () => void;
}

export function UploadProgressWidget({ state, onClose, onRetry }: UploadProgressWidgetProps) {
  if (!state.isVisible) return null;

  const percent = state.total > 0 ? Math.min(100, Math.round((state.completed / state.total) * 100)) : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="fixed bottom-5 right-5 z-[9999] w-80 sm:w-96 rounded-2xl border border-border shadow-2xl bg-popover/95 backdrop-blur-md text-popover-foreground p-4 space-y-3 pointer-events-auto"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center">
              {state.status === 'uploading' && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
              {state.status === 'saving' && <Sparkles className="w-5 h-5 animate-bounce text-amber-500" />}
              {state.status === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
              {state.status === 'error' && <AlertCircle className="w-5 h-5 text-rose-500" />}
            </div>
            <div>
              <h4 className="font-semibold text-sm line-clamp-1 text-foreground">{state.title}</h4>
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                {state.status === 'uploading' && `Đang nén & tải lên ảnh (${state.completed}/${state.total})...`}
                {state.status === 'saving' && 'Đang lưu nội dung chương...'}
                {state.status === 'success' && '✅ Tải lên & Lưu thành công!'}
                {state.status === 'error' && (state.errorMessage || 'Tải lên thất bại')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {(state.status === 'uploading' || state.status === 'saving') && (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
              <span>Tiến trình</span>
              <span className="font-bold text-foreground">{percent}%</span>
            </div>
            <div className="w-full h-2.5 bg-secondary/80 rounded-full overflow-hidden p-0.5 border border-border/40">
              <motion.div
                className="h-full bg-gradient-to-r from-primary via-indigo-500 to-emerald-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            </div>
          </div>
        )}

        <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/30">
          <span>{state.status === 'success' ? 'Hoàn tất' : 'Đang chạy ngầm, bạn có thể tự do lướt trang'}</span>
          {state.status === 'error' && onRetry && (
            <Button size="sm" onClick={onRetry} className="text-xs h-6 px-2.5 rounded-md">
              Thử lại
            </Button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

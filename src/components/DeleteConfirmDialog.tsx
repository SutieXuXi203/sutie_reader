'use client';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading?: boolean;
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
}
export function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
  title = 'Xóa mục này?',
  description,
  confirmLabel = 'Xóa',
  cancelLabel = 'Hủy',
}: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md rounded-[8px] border border-red-200/80 dark:border-red-900/40 bg-white bg-gradient-to-b from-white via-red-50 to-white dark:bg-[#140606] dark:from-[#190909] dark:via-[#1f0c0c] dark:to-[#140606] shadow-[0_28px_72px_-24px_rgba(153,27,27,0.4)] dark:shadow-[0_32px_80px_-28px_rgba(0,0,0,0.78)]"
        overlayClassName="backdrop-blur-none bg-red-950/35 dark:bg-black/65"
      >
        <DialogHeader className="space-y-3">
          <div className="w-11 h-11 rounded-[8px] bg-red-100 dark:bg-red-900/30 text-primary flex items-center justify-center border border-red-200/70 dark:border-red-800/50">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <DialogTitle className="text-xl font-medium text-foreground">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-red-900/70 dark:text-red-200/80">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-[8px]"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="rounded-[8px]"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


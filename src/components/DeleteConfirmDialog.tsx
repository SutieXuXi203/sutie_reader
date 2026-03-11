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
        className="sm:max-w-md rounded-[8px] border border-border shadow-2xl dark:shadow-primary/20"
      >
        <DialogHeader className="space-y-3">
          <div className="w-11 h-11 rounded-[8px] bg-secondary dark:bg-primary/25 text-primary flex items-center justify-center border border-border dark:border-primary/35">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <DialogTitle className="text-xl font-medium text-foreground">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-foreground/70 dark:text-foreground/80">
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


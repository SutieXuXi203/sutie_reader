'use client';

import { useSyncExternalStore } from 'react';
import { Eye, EyeOff, Image as ImageIcon } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useThumbnailBlur, ThumbnailBlurMode } from '@/providers/ThumbnailBlurProvider';
import { cn } from '@/lib/utils';

const BLUR_OPTIONS = {
  off: 'Tắt che mờ',
  blur: 'Che mờ',
  cover: 'Che nội dung',
} as const;

export function ThumbnailBlurToggle({ className }: { className?: string }) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const { blurMode, setBlurMode } = useThumbnailBlur();

  if (!mounted) {
    return (
      <div
        className={cn(
          'flex !h-8 h-8 w-full items-center justify-between gap-1.5 rounded-[8px] border border-border/80 bg-card/60 backdrop-blur-md px-2 sm:px-2.5 text-xs text-muted-foreground opacity-80 shadow-sm',
          className
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
          <Eye className="size-3.5 text-muted-foreground/70 shrink-0" />
          <span className="truncate text-xs font-medium">Tắt che mờ</span>
        </div>
      </div>
    );
  }

  return (
    <Select
      items={BLUR_OPTIONS}
      value={blurMode}
      onValueChange={(val) => {
        if (val && (val === 'off' || val === 'blur' || val === 'cover')) {
          setBlurMode(val as ThumbnailBlurMode);
        }
      }}
    >
      <SelectTrigger
        size="sm"
        className={cn(
          '!h-8 h-8 w-full rounded-[8px] border border-border/80 bg-card/60 hover:bg-card/90 backdrop-blur-md px-2 sm:px-2.5 text-xs text-foreground shadow-sm hover:border-primary/40 focus-visible:border-primary focus-visible:ring-primary/20 cursor-pointer transition-all gap-1.5 font-medium flex items-center justify-between [&_svg]:size-3.5',
          className
        )}
        title="Chế độ che mờ thumbnail"
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
          {blurMode === 'off' && <Eye className="size-3.5 text-muted-foreground shrink-0" />}
          {blurMode === 'blur' && <EyeOff className="size-3.5 text-primary shrink-0" />}
          {blurMode === 'cover' && <ImageIcon className="size-3.5 text-amber-500 shrink-0" />}
          <SelectValue />
        </div>
      </SelectTrigger>

      <SelectContent
        align="end"
        alignItemWithTrigger={false}
        className="min-w-[160px] p-1 rounded-[10px] border border-border bg-popover shadow-2xl z-50"
      >
        <SelectItem value="off" className="cursor-pointer py-1.5 rounded-[6px]">
          <Eye className="size-3.5 text-muted-foreground mr-1 shrink-0" />
          <span className="font-medium">Tắt che mờ</span>
        </SelectItem>
        <SelectItem value="blur" className="cursor-pointer py-1.5 rounded-[6px]">
          <EyeOff className="size-3.5 text-primary mr-1 shrink-0" />
          <span className="font-medium">Che mờ</span>
        </SelectItem>
        <SelectItem value="cover" className="cursor-pointer py-1.5 rounded-[6px]">
          <ImageIcon className="size-3.5 text-amber-500 mr-1 shrink-0" />
          <span className="font-medium">Che nội dung</span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

// Alias for semantic naming
export { ThumbnailBlurToggle as ThumbnailBlurSelect };

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
  off: 'Hiện ảnh',
  blur: 'Làm mờ',
  cover: 'Che kín',
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
          <span className="truncate text-xs font-medium">Hiện ảnh</span>
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
          '!h-8 h-8 w-full rounded-[8px] bg-card/60 hover:bg-card/90 backdrop-blur-md border border-border/80 hover:border-primary/40 text-xs text-foreground focus-visible:border-primary focus-visible:ring-primary/20 shadow-sm transition-all px-2 sm:px-2.5 py-0 flex items-center justify-between gap-1 cursor-pointer [&_svg]:size-3.5',
          className
        )}
        title="Chế độ che mờ thumbnail"
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
          {blurMode === 'off' && <Eye className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
          {blurMode === 'blur' && <EyeOff className="w-3.5 h-3.5 text-primary shrink-0" />}
          {blurMode === 'cover' && <ImageIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
          <SelectValue placeholder="Chế độ che">
            {(val: string | null) => (
              <span className="truncate text-xs font-normal text-foreground block">
                {val && val in BLUR_OPTIONS ? BLUR_OPTIONS[val as keyof typeof BLUR_OPTIONS] : 'Hiện ảnh'}
              </span>
            )}
          </SelectValue>
        </div>
      </SelectTrigger>

      <SelectContent
        align="end"
        alignItemWithTrigger={false}
        className="rounded-[10px] border border-border bg-popover p-1 w-[160px] sm:w-[170px] max-w-[calc(100vw-2rem)] shadow-2xl z-50"
      >
        <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
          Chế độ che ảnh
        </div>
        <SelectItem
          value="off"
          className={cn(
            "flex items-center gap-2.5 rounded-[6px] py-1.5 px-2.5 text-xs cursor-pointer transition-colors my-0.5 font-medium",
            blurMode === 'off' ? "bg-primary/15 text-primary" : "text-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <Eye className={cn("w-3.5 h-3.5 shrink-0", blurMode === 'off' ? "text-primary" : "text-muted-foreground")} />
          <span className="truncate">Hiện ảnh</span>
        </SelectItem>
        <SelectItem
          value="blur"
          className={cn(
            "flex items-center gap-2.5 rounded-[6px] py-1.5 px-2.5 text-xs cursor-pointer transition-colors my-0.5 font-medium",
            blurMode === 'blur' ? "bg-primary/15 text-primary" : "text-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <EyeOff className={cn("w-3.5 h-3.5 shrink-0", blurMode === 'blur' ? "text-primary" : "text-muted-foreground")} />
          <span className="truncate">Làm mờ</span>
        </SelectItem>
        <SelectItem
          value="cover"
          className={cn(
            "flex items-center gap-2.5 rounded-[6px] py-1.5 px-2.5 text-xs cursor-pointer transition-colors my-0.5 font-medium",
            blurMode === 'cover' ? "bg-primary/15 text-primary" : "text-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <ImageIcon className={cn("w-3.5 h-3.5 shrink-0", blurMode === 'cover' ? "text-amber-500" : "text-muted-foreground")} />
          <span className="truncate">Che kín</span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

// Alias for semantic naming
export { ThumbnailBlurToggle as ThumbnailBlurSelect };

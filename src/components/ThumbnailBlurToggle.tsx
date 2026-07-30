'use client';

import { Eye, EyeOff } from 'lucide-react';
import { AnimateIcon } from '@/components/animate-ui/icons/AnimateIcon';
import { Button } from '@/components/ui/button';
import { useThumbnailBlur } from '@/providers/ThumbnailBlurProvider';
import { cn } from '@/lib/utils';

export function ThumbnailBlurToggle() {
  const { isThumbnailBlurred, toggleThumbnailBlur } = useThumbnailBlur();
  const label = isThumbnailBlurred ? 'Tắt che mờ thumbnail' : 'Bật che mờ thumbnail';

  return (
    <Button
      variant="outline"
      size="icon-sm"
      className={cn(
        'rounded-full cursor-pointer border border-white/10 bg-[#2b2b2b] text-white shadow-sm hover:bg-[#363636] hover:text-white dark:border-white/10 dark:bg-[#2b2b2b] dark:text-white dark:hover:bg-[#363636]',
        isThumbnailBlurred && 'border-white/20 bg-[#343434] hover:bg-[#3d3d3d]'
      )}
      onClick={toggleThumbnailBlur}
      aria-label={label}
      aria-pressed={isThumbnailBlurred}
      title={label}
    >
      <AnimateIcon
        icon={isThumbnailBlurred ? EyeOff : Eye}
        animation="scale"
        className="h-4 w-4"
        iconProps={{
          strokeWidth: 2.25,
          color: '#ffffff',
        }}
      />
    </Button>
  );
}

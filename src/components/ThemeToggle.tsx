'use client';

// Motion Prompt #017 · MIT License (c) 2026 Shohei Ohtaki · https://showheyohtaki.github.io/motion-prompt/#017
// Mask transition / マスクトランジション
// Day scene -> night scene -> day scene.
// The next scene is drawn on top of the current one, clipped to a shape expanding from the button (Sun/Moon).
// Easing: cubic-bezier(0.65, 0, 0.35, 1) (cubic ease-in-out from #017 spec).

import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { AnimatedSun, AnimatedMoon } from '@/components/animate-ui/icons/AnimateIcon';
import { useSyncExternalStore, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { cn } from '@/lib/utils';

export function ThemeToggle({
  className,
  variant = 'outline',
}: {
  className?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link';
} = {}) {
  const mounted = useSyncExternalStore(
    () => () => { },
    () => true,
    () => false
  );
  const { theme, resolvedTheme, setTheme } = useTheme();

  const handleToggle = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      const current = resolvedTheme || theme || 'dark';
      const nextTheme = current === 'dark' ? 'light' : 'dark';

      // Kiểm tra hỗ trợ View Transitions API và prefers-reduced-motion
      if (
        typeof document === 'undefined' ||
        !(document as unknown as { startViewTransition?: unknown }).startViewTransition ||
        (typeof window !== 'undefined' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      ) {
        setTheme(nextTheme);
        return;
      }

      const rect = e.currentTarget.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;

      // Bán kính lớn nhất tính từ tâm nút bấm tới góc xa nhất của màn hình
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      // Tắt toàn bộ CSS transition trong lúc đổi theme để trình duyệt không phải
      // chạy hàng trăm transition màu ngầm bên dưới lớp snapshot (nguyên nhân gây giật).
      const killTransitions = document.createElement('style');
      killTransitions.appendChild(
        document.createTextNode(
          '*,*::before,*::after{transition:none!important;animation-play-state:running}'
        )
      );
      document.head.appendChild(killTransitions);

      // Chuyển đổi trạng thái với View Transitions API.
      // QUAN TRỌNG: next-themes chỉ áp class trong useEffect (trễ 1 nhịp), nên phải
      // flushSync + gán class đồng bộ để snapshot "new" chụp đúng theme mới ngay lập tức.
      const transition = (document as unknown as {
        startViewTransition: (cb: () => void) => {
          ready: Promise<void>;
          finished: Promise<void>;
        };
      }).startViewTransition(() => {
        const root = document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(nextTheme);
        root.style.colorScheme = nextTheme;
        flushSync(() => setTheme(nextTheme));
      });

      const cleanup = () => killTransitions.remove();
      transition.finished.then(cleanup, cleanup);

      transition.ready
        .then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 260,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            pseudoElement: '::view-transition-new(root)',
          }
        );
        })
        .catch(() => {
          // Transition bị bỏ qua (tab ẩn / bấm liên tiếp) — theme đã được áp, không cần xử lý
        });
    },
    [resolvedTheme, theme, setTheme]
  );

  if (!mounted) return null;

  const isDark = (resolvedTheme || theme) === 'dark';

  return (
    <Button
      type="button"
      variant={variant}
      size="icon-sm"
      className={cn("rounded-full cursor-pointer transition-colors", className)}
      onClick={handleToggle}
      title={isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
      aria-label={isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
    >
      {isDark ? (
        <AnimatedSun className="h-4 w-4" animation="rotate" />
      ) : (
        <AnimatedMoon className="h-4 w-4" animation="rotate" />
      )}
    </Button>
  );
}

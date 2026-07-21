'use client';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { AnimatedSun, AnimatedMoon } from '@/components/animate-ui/icons/AnimateIcon';
import { useSyncExternalStore } from 'react';

export function ThemeToggle() {
  const mounted = useSyncExternalStore(
    () => () => { },
    () => true,
    () => false
  );
  const { theme, setTheme } = useTheme();

  if (!mounted) return null;

  return (
    <Button
      variant="outline"
      size="icon-sm"
      className="rounded-full cursor-pointer"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      {theme === 'dark' ? (
        <AnimatedSun className="h-4 w-4" animation="rotate" />
      ) : (
        <AnimatedMoon className="h-4 w-4" animation="rotate" />
      )}
    </Button>
  );
}

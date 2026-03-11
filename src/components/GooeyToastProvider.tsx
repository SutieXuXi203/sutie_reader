'use client';

import { GooeyToaster } from 'goey-toast';
import { useTheme } from 'next-themes';

export function GooeyToastProvider() {
  const { resolvedTheme } = useTheme();

  return (
    <GooeyToaster
      position="top-center"
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      showProgress
      preset="smooth"
      bounce={0.2}
      closeOnEscape
      visibleToasts={1}
      gap={12}
      offset={20}
    />
  );
}

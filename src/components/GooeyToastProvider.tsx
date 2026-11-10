'use client';

import { GooeyToaster } from 'goey-toast';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

export function GooeyToastProvider() {
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div id="gooey-toast-portal-root" style={{ position: 'relative', zIndex: 999999999 }}>
      <GooeyToaster
        position="top-center"
        theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
        showProgress
        preset="smooth"
        bounce={0.2}
        closeOnEscape
        visibleToasts={1}
        gap={12}
        offset={72}
      />
    </div>,
    document.body
  );
}

'use client';

import { GooeyToaster } from 'goey-toast';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

type ToastPosition = 'top-right' | 'top-center';

const MOBILE_BREAKPOINT_QUERY = '(max-width: 767px)';

export function GooeyToastProvider() {
  const { resolvedTheme } = useTheme();
  const [position, setPosition] = useState<ToastPosition>('top-right');

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
    const syncPosition = () => {
      setPosition(mediaQuery.matches ? 'top-center' : 'top-right');
    };

    syncPosition();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncPosition);
      return () => mediaQuery.removeEventListener('change', syncPosition);
    }

    mediaQuery.addListener(syncPosition);
    return () => mediaQuery.removeListener(syncPosition);
  }, []);

  return (
    <GooeyToaster
      position={position}
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

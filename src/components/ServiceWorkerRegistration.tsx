'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });
        if (process.env.NODE_ENV === 'development') {
          console.log('[SW] Service Worker registered with scope:', registration.scope);
        }
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[SW] Service Worker registration failed:', err);
        }
      }
    };

    if (document.readyState === 'complete') {
      void registerSW();
    } else {
      window.addEventListener('load', registerSW);
      return () => window.removeEventListener('load', registerSW);
    }
  }, []);

  return null;
}

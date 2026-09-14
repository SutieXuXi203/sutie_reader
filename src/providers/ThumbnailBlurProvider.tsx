'use client';

import React, { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';

export type ThumbnailBlurMode = 'off' | 'blur' | 'cover';

type ThumbnailBlurContextValue = {
  blurMode: ThumbnailBlurMode;
  setBlurMode: (mode: ThumbnailBlurMode) => void;
  isThumbnailBlurred: boolean;
  setThumbnailBlurred: (value: boolean) => void;
  toggleThumbnailBlur: () => void;
};

const STORAGE_KEY = 'thumbnail-blur-mode';
const LEGACY_STORAGE_KEY = 'thumbnail-blur-enabled';
const CHANGE_EVENT = 'thumbnail-blur-change';
const ThumbnailBlurContext = createContext<ThumbnailBlurContextValue | undefined>(undefined);

export function ThumbnailBlurProvider({ children }: { children: React.ReactNode }) {
  const subscribe = useCallback((onStoreChange: () => void) => {
    window.addEventListener('storage', onStoreChange);
    window.addEventListener(CHANGE_EVENT, onStoreChange);

    return () => {
      window.removeEventListener('storage', onStoreChange);
      window.removeEventListener(CHANGE_EVENT, onStoreChange);
    };
  }, []);

  const getSnapshot = useCallback((): ThumbnailBlurMode => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'off' || saved === 'blur' || saved === 'cover') {
      return saved;
    }
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy === 'true') {
      return 'blur';
    }
    return 'off';
  }, []);

  const blurMode = useSyncExternalStore<ThumbnailBlurMode>(
    subscribe,
    getSnapshot,
    () => 'off'
  );

  const setBlurMode = useCallback((mode: ThumbnailBlurMode) => {
    window.localStorage.setItem(STORAGE_KEY, mode);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const setThumbnailBlurred = useCallback((value: boolean) => {
    setBlurMode(value ? 'blur' : 'off');
  }, [setBlurMode]);

  const toggleThumbnailBlur = useCallback(() => {
    const current = getSnapshot();
    setBlurMode(current === 'off' ? 'blur' : 'off');
  }, [getSnapshot, setBlurMode]);

  const value = useMemo(
    () => ({
      blurMode,
      setBlurMode,
      isThumbnailBlurred: blurMode === 'blur',
      setThumbnailBlurred,
      toggleThumbnailBlur,
    }),
    [blurMode, setBlurMode, setThumbnailBlurred, toggleThumbnailBlur]
  );

  return (
    <ThumbnailBlurContext.Provider value={value}>
      {children}
    </ThumbnailBlurContext.Provider>
  );
}

export function useThumbnailBlur() {
  const context = useContext(ThumbnailBlurContext);
  if (context === undefined) {
    throw new Error('useThumbnailBlur must be used within a ThumbnailBlurProvider');
  }
  return context;
}

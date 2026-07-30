'use client';

import React, { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';

type ThumbnailBlurContextValue = {
  isThumbnailBlurred: boolean;
  setThumbnailBlurred: (value: boolean) => void;
  toggleThumbnailBlur: () => void;
};

const STORAGE_KEY = 'thumbnail-blur-enabled';
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

  const getSnapshot = useCallback(() => (
    window.localStorage.getItem(STORAGE_KEY) === 'true'
  ), []);

  const isThumbnailBlurred = useSyncExternalStore(subscribe, getSnapshot, () => false);

  const setThumbnailBlurred = useCallback((value: boolean) => {
    window.localStorage.setItem(STORAGE_KEY, String(value));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const toggleThumbnailBlur = useCallback(() => {
    setThumbnailBlurred(!getSnapshot());
  }, [getSnapshot, setThumbnailBlurred]);

  const value = useMemo(
    () => ({
      isThumbnailBlurred,
      setThumbnailBlurred,
      toggleThumbnailBlur,
    }),
    [isThumbnailBlurred, setThumbnailBlurred, toggleThumbnailBlur]
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

'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface PreloaderContextType {
  isPreloading: boolean;
  finishPreloader: () => void;
}

const PreloaderContext = createContext<PreloaderContextType>({
  isPreloading: true,
  finishPreloader: () => {},
});

export function PreloaderProvider({ children }: { children: React.ReactNode }) {
  const [isPreloading, setIsPreloading] = useState(true);

  const finishPreloader = useCallback(() => {
    setIsPreloading(false);
  }, []);

  return (
    <PreloaderContext.Provider value={{ isPreloading, finishPreloader }}>
      {children}
    </PreloaderContext.Provider>
  );
}

export function usePreloader() {
  return useContext(PreloaderContext);
}

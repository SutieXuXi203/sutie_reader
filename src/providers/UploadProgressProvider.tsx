'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { UploadProgressWidget, UploadProgressState } from '@/components/UploadProgressWidget';

interface UploadProgressContextType {
  progressState: UploadProgressState;
  showProgress: (title: string, total: number) => void;
  updateProgress: (completed: number, total: number, status?: UploadProgressState['status'], errorMessage?: string) => void;
  hideProgress: () => void;
}

const UploadProgressContext = createContext<UploadProgressContextType | undefined>(undefined);

export function UploadProgressProvider({ children }: { children: ReactNode }) {
  const [progressState, setProgressState] = useState<UploadProgressState>({
    isVisible: false,
    title: '',
    completed: 0,
    total: 0,
    status: 'uploading',
  });

  const showProgress = (title: string, total: number) => {
    setProgressState({
      isVisible: true,
      title,
      completed: 0,
      total,
      status: 'uploading',
    });
  };

  const updateProgress = (
    completed: number,
    total: number,
    status: UploadProgressState['status'] = 'uploading',
    errorMessage?: string
  ) => {
    setProgressState((prev) => ({
      ...prev,
      completed,
      total,
      status,
      errorMessage: errorMessage || prev.errorMessage,
    }));
  };

  const hideProgress = () => {
    setProgressState((prev) => ({ ...prev, isVisible: false }));
  };

  return (
    <UploadProgressContext.Provider value={{ progressState, showProgress, updateProgress, hideProgress }}>
      {children}
      <UploadProgressWidget state={progressState} onClose={hideProgress} />
    </UploadProgressContext.Provider>
  );
}

export function useUploadProgress() {
  const context = useContext(UploadProgressContext);
  if (!context) {
    throw new Error('useUploadProgress must be used within an UploadProgressProvider');
  }
  return context;
}

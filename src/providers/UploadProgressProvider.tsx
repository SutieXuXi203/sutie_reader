'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { UploadProgressWidget, UploadProgressState } from '@/components/UploadProgressWidget';

interface UploadProgressContextType {
  tasks: UploadProgressState[];
  showProgress: (title: string, total: number) => string;
  updateProgress: (id: string, completed: number, total: number, status?: UploadProgressState['status'], errorMessage?: string) => void;
  hideProgress: (id: string) => void;
}

const UploadProgressContext = createContext<UploadProgressContextType | undefined>(undefined);

export function UploadProgressProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<UploadProgressState[]>([]);

  const showProgress = (title: string, total: number) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    setTasks((prev) => [
      ...prev,
      {
        id,
        title,
        completed: 0,
        total,
        status: 'uploading',
      },
    ]);
    return id;
  };

  const updateProgress = (
    id: string,
    completed: number,
    total: number,
    status: UploadProgressState['status'] = 'uploading',
    errorMessage?: string
  ) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? {
              ...task,
              completed,
              total,
              status,
              errorMessage: errorMessage || task.errorMessage,
            }
          : task
      )
    );
  };

  const hideProgress = (id: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  };

  return (
    <UploadProgressContext.Provider value={{ tasks, showProgress, updateProgress, hideProgress }}>
      {children}
      <UploadProgressWidget tasks={tasks} onClose={hideProgress} />
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

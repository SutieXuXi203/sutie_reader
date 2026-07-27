'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UploadProgressWidget, UploadProgressState } from '@/components/UploadProgressWidget';

// Global state outside React to survive any unmounts or layout changes
let globalTasks: UploadProgressState[] = [];
let listeners: ((tasks: UploadProgressState[]) => void)[] = [];

const notifyListeners = () => {
  listeners.forEach(listener => listener([...globalTasks]));
};

interface UploadProgressContextType {
  tasks: UploadProgressState[];
  showProgress: (title: string, total: number) => string;
  updateProgress: (id: string, completed: number, total: number, status?: UploadProgressState['status'], errorMessage?: string) => void;
  hideProgress: (id: string) => void;
}

const UploadProgressContext = createContext<UploadProgressContextType | undefined>(undefined);

export function UploadProgressProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<UploadProgressState[]>(globalTasks);

  useEffect(() => {
    const listener = (newTasks: UploadProgressState[]) => setTasks(newTasks);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  }, []);

  const showProgress = (title: string, total: number) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    globalTasks = [
      ...globalTasks,
      {
        id,
        title,
        completed: 0,
        total,
        status: 'uploading',
      },
    ];
    notifyListeners();
    return id;
  };

  const updateProgress = (
    id: string,
    completed: number,
    total: number,
    status: UploadProgressState['status'] = 'uploading',
    errorMessage?: string
  ) => {
    globalTasks = globalTasks.map((task) =>
      task.id === id
        ? {
            ...task,
            completed,
            total,
            status,
            errorMessage: errorMessage || task.errorMessage,
          }
        : task
    );
    notifyListeners();
  };

  const hideProgress = (id: string) => {
    globalTasks = globalTasks.filter((task) => task.id !== id);
    notifyListeners();
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

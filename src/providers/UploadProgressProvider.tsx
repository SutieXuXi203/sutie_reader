'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { UploadProgressWidget, UploadProgressState } from '@/components/UploadProgressWidget';
import { notifyTelegramStart, notifyTelegramProgress, clearTelegramTask } from '@/lib/telegramClient';

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

  const showProgress = useCallback((title: string, total: number) => {
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
    notifyTelegramStart(id, title, total);
    return id;
  }, []);

  const updateProgress = useCallback((
    id: string,
    completed: number,
    total: number,
    status: UploadProgressState['status'] = 'uploading',
    errorMessage?: string
  ) => {
    let taskTitle = '';
    globalTasks = globalTasks.map((task) => {
      if (task.id === id) {
        taskTitle = task.title;
        return {
          ...task,
          completed,
          total,
          status,
          errorMessage: errorMessage || task.errorMessage,
        };
      }
      return task;
    });
    notifyListeners();
    void notifyTelegramProgress(id, taskTitle, completed, total, status, errorMessage);
  }, []);

  const hideProgress = useCallback((id: string) => {
    globalTasks = globalTasks.filter((task) => task.id !== id);
    notifyListeners();
    clearTelegramTask(id);
  }, []);

  const value = useMemo(
    () => ({ tasks, showProgress, updateProgress, hideProgress }),
    [tasks, showProgress, updateProgress, hideProgress]
  );

  return (
    <UploadProgressContext.Provider value={value}>
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

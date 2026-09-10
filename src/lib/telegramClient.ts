interface TelegramTaskMeta {
  messagePromise: Promise<number | undefined>;
  messageId?: number;
  lastUpdated: number;
  lastCompleted: number;
  lastStatus: string;
}

const tasksMeta = new Map<string, TelegramTaskMeta>();

/**
 * Sends the initial "Upload started" notification to Telegram.
 */
export const notifyTelegramStart = (taskId: string, title: string, total: number) => {
  const promise = (async () => {
    try {
      const res = await fetch('/api/telegram/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', title, total }),
      });
      const data = await res.json();
      if (data.success && data.messageId) {
        const meta = tasksMeta.get(taskId);
        if (meta) {
          meta.messageId = data.messageId;
        }
        return data.messageId as number;
      }
    } catch (err) {
      console.warn('Failed to send Telegram start notification:', err);
    }
    return undefined;
  })();

  tasksMeta.set(taskId, {
    messagePromise: promise,
    lastUpdated: Date.now(),
    lastCompleted: 0,
    lastStatus: 'uploading',
  });
};

/**
 * Updates the existing Telegram message with real-time progress, saving status, success or failure.
 */
export const notifyTelegramProgress = async (
  taskId: string,
  title: string,
  completed: number,
  total: number,
  status: 'uploading' | 'saving' | 'success' | 'error',
  errorMessage?: string
) => {
  const meta = tasksMeta.get(taskId);
  if (!meta) return;

  const now = Date.now();

  if (status === 'uploading') {
    // Throttle progress updates to at least 1500ms to avoid Telegram rate limits
    if (now - meta.lastUpdated < 1500 && completed < total) {
      return;
    }
    meta.lastUpdated = now;
    meta.lastCompleted = completed;
    meta.lastStatus = status;

    const messageId = meta.messageId ?? (await meta.messagePromise);
    if (!messageId) return;

    try {
      await fetch('/api/telegram/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'progress', messageId, title, completed, total, status }),
      });
    } catch {
      // Ignored
    }
    return;
  }

  if (status === 'saving') {
    if (meta.lastStatus === 'saving') return;
    meta.lastStatus = 'saving';
    meta.lastUpdated = now;

    const messageId = meta.messageId ?? (await meta.messagePromise);
    if (!messageId) return;

    try {
      await fetch('/api/telegram/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'progress',
          messageId,
          title,
          completed,
          total,
          status: 'saving',
        }),
      });
    } catch {
      // Ignored
    }
    return;
  }

  if (status === 'success') {
    if (meta.lastStatus === 'success') return;
    meta.lastStatus = 'success';

    const messageId = meta.messageId ?? (await meta.messagePromise);

    try {
      await fetch('/api/telegram/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'success', messageId, title, completed, total }),
      });
    } catch {
      // Ignored
    }
    return;
  }

  if (status === 'error') {
    if (meta.lastStatus === 'error') return;
    meta.lastStatus = 'error';

    const messageId = meta.messageId ?? (await meta.messagePromise);

    try {
      await fetch('/api/telegram/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'error', messageId, title, errorMessage }),
      });
    } catch {
      // Ignored
    }
  }
};

export const clearTelegramTask = (taskId: string) => {
  tasksMeta.delete(taskId);
};

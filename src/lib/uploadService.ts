import imageCompression from 'browser-image-compression';
import { getOptimizedImageUrl } from '@/lib/utils';

const fetchUploadToken = async (): Promise<string> => {
  const tokenRes = await fetch('/api/auth/token');
  if (!tokenRes.ok) {
    const errData = await tokenRes.json().catch(() => ({}));
    throw new Error(errData?.error || 'Không lấy được phiên đăng nhập Admin');
  }
  const { token } = await tokenRes.json();
  return token as string;
};

// Worker nhận tối đa 10 file/request. 6 file/batch × 3 batch song song = tối đa 18 ảnh đang xử lý cùng lúc.
const BATCH_SIZE = 6;
const UPLOAD_CONCURRENCY = 3;
// Nén ảnh rất tốn RAM/CPU (giải mã ảnh lớn): giới hạn số ảnh nén đồng thời cho cả quá trình upload, kể cả khi nhiều batch chạy song song
const COMPRESS_CONCURRENCY = 4;
const MAX_BATCH_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1000;
const TOKEN_REFRESH_INTERVAL_MS = 7 * 60 * 1000; // Token hết hạn ở 10 phút

class UploadHttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'UploadHttpError';
    this.status = status;
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Lỗi mạng hoặc lỗi tạm thời của server đáng thử lại; lỗi do dữ liệu (400, 413, 415...) thì thử lại cũng vô ích */
const isRetryableUploadError = (error: unknown): boolean => {
  if (!(error instanceof UploadHttpError)) return true;
  return error.status === 408 || error.status === 429 || error.status >= 500;
};

const createLimiter = (limit: number) => {
  let active = 0;
  const waiting: Array<() => void> = [];

  // Chuyển thẳng slot cho người đang chờ (không giảm rồi tăng `active`) để không bao giờ vượt quá giới hạn
  const release = () => {
    const next = waiting.shift();
    if (next) next();
    else active -= 1;
  };

  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active >= limit) {
      await new Promise<void>((resolve) => waiting.push(resolve));
    } else {
      active += 1;
    }
    try {
      return await task();
    } finally {
      release();
    }
  };
};

const compressToWebp = async (file: File): Promise<File> => {
  try {
    const isAlreadySmallWebp = file.type === 'image/webp' && file.size <= 400 * 1024;
    if (isAlreadySmallWebp || (file as File & { skipCompression?: boolean }).skipCompression) return file;

    const compressedBlob = await imageCompression(file, {
      maxSizeMB: 0.8,
      maxWidthOrHeight: 2048,
      fileType: 'image/webp',
      initialQuality: 0.85,
      useWebWorker: true,
    });

    const baseName = file.name.replace(/\.[^.]+$/, '');
    const webpFileName = `${baseName}.webp`;
    return new File([compressedBlob], webpFileName, { type: 'image/webp' });
  } catch (error) {
    console.error('Lỗi khi nén ảnh sang WebP:', error);
    return file;
  }
};

export const uploadImages = async (
  files: File[],
  uploadTitle: string,
  postId: string,
  onProgress?: (completed: number, total: number) => void,
  chapter?: string
): Promise<string[]> => {
  if (!files.length) return [];

  let currentToken = await fetchUploadToken();
  let tokenFetchedAt = Date.now();
  let pendingRefresh: Promise<string> | null = null;

  const refreshToken = (): Promise<string> => {
    // Nhiều batch song song cùng gặp token hết hạn thì chỉ gọi làm mới một lần
    if (!pendingRefresh) {
      pendingRefresh = fetchUploadToken()
        .then((token) => {
          currentToken = token;
          tokenFetchedAt = Date.now();
          return token;
        })
        .finally(() => {
          pendingRefresh = null;
        });
    }
    return pendingRefresh;
  };

  // Tự động làm mới token nếu quá trình upload kéo dài; nếu làm mới thất bại thì dùng tiếp token hiện tại
  const getToken = async (): Promise<string> => {
    if (Date.now() - tokenFetchedAt <= TOKEN_REFRESH_INTERVAL_MS) return currentToken;
    try {
      return await refreshToken();
    } catch (err) {
      console.warn('Không thể làm mới token trước khi upload, thử dùng tiếp token hiện tại:', err);
      return currentToken;
    }
  };

  const workerUrl = (
    process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_URL ||
    ''
  ).replace(/\/+$/, '');

  const postBatch = (batch: File[], token: string) => {
    const formData = new FormData();
    formData.append('title', uploadTitle);
    if (postId) formData.append('postId', postId);
    if (chapter) formData.append('chapter', chapter);
    batch.forEach((file) => formData.append('files', file, file.name));

    return fetch(`${workerUrl}/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
  };

  const sendBatch = async (batch: File[], batchNumber: number): Promise<string[]> => {
    let token = await getToken();
    let res = await postBatch(batch, token);

    // Token hết hạn giữa chừng (401): làm mới rồi thử lại ngay; nếu batch khác đã làm mới rồi thì dùng luôn token mới
    if (res.status === 401) {
      token = currentToken !== token ? currentToken : await refreshToken();
      res = await postBatch(batch, token);
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new UploadHttpError(
        data?.details || data?.error || `Upload thất bại ở nhóm ảnh ${batchNumber}`,
        res.status
      );
    }

    const { urls } = await res.json();
    // Số URL phải khớp số ảnh gửi lên, nếu không thứ tự trang trong chương sẽ bị lệch âm thầm
    if (!Array.isArray(urls) || urls.length !== batch.length) {
      throw new UploadHttpError(`Server trả về sai số lượng ảnh ở nhóm ${batchNumber}`, 502);
    }
    return urls as string[];
  };

  const sendBatchWithRetry = async (batch: File[], batchNumber: number): Promise<string[]> => {
    for (let attempt = 1; ; attempt++) {
      try {
        return await sendBatch(batch, batchNumber);
      } catch (error) {
        if (attempt >= MAX_BATCH_ATTEMPTS || !isRetryableUploadError(error)) throw error;
        console.warn(`Upload nhóm ${batchNumber} lỗi (lần ${attempt}/${MAX_BATCH_ATTEMPTS}), thử lại...`, error);
        await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
      }
    }
  };

  const batches: File[][] = [];
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    batches.push(files.slice(i, i + BATCH_SIZE));
  }

  const limitCompression = createLimiter(COMPRESS_CONCURRENCY);
  const urlsByBatch: string[][] = new Array(batches.length);
  let completedFiles = 0;
  let aborted = false;

  const runBatch = async (batchIndex: number) => {
    if (aborted) return;
    try {
      const batch = batches[batchIndex];
      // Nén xong là gửi ngay; trong lúc batch này đang upload thì batch khác đang nén (không chờ nhau)
      const compressed = await Promise.all(batch.map((file) => limitCompression(() => compressToWebp(file))));
      urlsByBatch[batchIndex] = await sendBatchWithRetry(compressed, batchIndex + 1);

      completedFiles += batch.length;
      onProgress?.(completedFiles, files.length);
    } catch (error) {
      aborted = true; // Dừng các batch chưa bắt đầu để không upload tiếp khi cả chương đã thất bại
      throw error;
    }
  };

  // Batch đầu tiên chạy riêng để tạo thư mục truyện/chương trên Drive đúng một lần;
  // nếu chạy song song ngay từ đầu, nhiều batch có thể cùng tạo ra các thư mục trùng tên.
  await runBatch(0);

  let nextBatch = 1;
  const runners = Array.from({ length: Math.min(UPLOAD_CONCURRENCY, batches.length - 1) }, async () => {
    while (!aborted) {
      const batchIndex = nextBatch++;
      if (batchIndex >= batches.length) return;
      await runBatch(batchIndex);
    }
  });
  await Promise.all(runners);

  // Giữ đúng thứ tự trang như danh sách file người dùng đã sắp xếp
  return urlsByBatch.flat().map(getOptimizedImageUrl);
};

export const processBackgroundChapterSave = async (
  postId: string,
  chapTitle: string,
  chapContent: string,
  files: File[],
  chapNum: number,
  upTitle: string,
  showProgress: (title: string, total: number) => string,
  updateProgress: (taskId: string, completed: number, total: number, status?: 'uploading' | 'saving' | 'success' | 'error', errorMessage?: string) => void,
  onPostCreated: () => void,
  notifyError: (title: string, message?: string) => void,
  chapTranslator?: string
) => {
  const taskId = showProgress(`${upTitle} - ${chapTitle} (${files.length} ảnh)`, files.length);

  try {
    const chapterName = chapTitle || `Chương ${chapNum}`;
    const imageUrls = await uploadImages(files, upTitle, postId, (completed, total) => {
      updateProgress(taskId, completed, total, 'uploading');
    }, chapterName);

    updateProgress(taskId, files.length, files.length, 'saving');

    const response = await fetch(`/api/posts/${postId}/chapters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: chapTitle,
        chapterNumber: chapNum,
        content: chapContent,
        images: imageUrls,
        translator: chapTranslator || '',
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.details || data?.error || `Server error ${response.status}`);
    }

    updateProgress(taskId, files.length, files.length, 'success');
    onPostCreated();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    notifyError(`Lưu ${chapTitle} không thành công`, message);
    console.error(`Lỗi khi lưu ${chapTitle}:`, err);

    updateProgress(taskId, 0, files.length, 'error', message);
  }
};

export const syncDriveImages = async (
  uploadTitle: string,
  postId: string,
  chapter?: string
): Promise<string[]> => {
  const token = await fetchUploadToken();

  const workerUrl = (
    process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_URL ||
    ''
  ).replace(/\/+$/, '');

  const queryParams = new URLSearchParams();
  if (uploadTitle) queryParams.set('title', uploadTitle);
  if (postId) queryParams.set('postId', postId);
  if (chapter) queryParams.set('chapter', chapter);

  const res = await fetch(`${workerUrl}/sync?${queryParams.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.details || data?.error || 'Đồng bộ thất bại');
  }

  const { urls } = await res.json();
  return (urls as string[]).map(getOptimizedImageUrl);
};

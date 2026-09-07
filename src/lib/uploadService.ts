import imageCompression from 'browser-image-compression';
import { getOptimizedImageUrl } from '@/lib/utils';

export const uploadImages = async (
  files: File[],
  uploadTitle: string,
  postId: string,
  onProgress?: (completed: number, total: number) => void
): Promise<string[]> => {
  if (!files.length) return [];

  const tokenRes = await fetch('/api/auth/token');
  if (!tokenRes.ok) {
    const errData = await tokenRes.json().catch(() => ({}));
    throw new Error(errData?.error || 'Không lấy được phiên đăng nhập Admin');
  }
  const { token } = await tokenRes.json();

  const workerUrl = (
    process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_URL ||
    ''
  ).replace(/\/+$/, '');

  const sortedFiles = [...files];

  const BATCH_SIZE = 2;
  const allUrls: string[] = [];

  for (let i = 0; i < sortedFiles.length; i += BATCH_SIZE) {
    const batchFiles = sortedFiles.slice(i, i + BATCH_SIZE);

    const compressedBatch = await Promise.all(
      batchFiles.map(async (file) => {
        try {
          const isAlreadySmallWebp = file.type === 'image/webp' && file.size <= 400 * 1024;
          if (isAlreadySmallWebp) return file;

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
      })
    );

    const formData = new FormData();
    formData.append('title', uploadTitle);
    if (postId) formData.append('postId', postId);
    compressedBatch.forEach((compressed) =>
      formData.append('files', compressed, compressed.name)
    );

    const res = await fetch(`${workerUrl}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(
        data?.details || data?.error || `Upload thất bại ở nhóm ảnh ${Math.floor(i / BATCH_SIZE) + 1}`
      );
    }

    const { urls } = await res.json();
    allUrls.push(...(urls as string[]).map(getOptimizedImageUrl));

    onProgress?.(allUrls.length, sortedFiles.length);
  }

  return allUrls;
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
  notifyError: (title: string, message?: string) => void
) => {
  const taskId = showProgress(`${upTitle} - ${chapTitle} (${files.length} ảnh)`, files.length);

  try {
    const imageUrls = await uploadImages(files, upTitle, postId, (completed, total) => {
      updateProgress(taskId, completed, total, 'uploading');
    });

    updateProgress(taskId, files.length, files.length, 'saving');

    const response = await fetch(`/api/posts/${postId}/chapters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: chapTitle,
        chapterNumber: chapNum,
        content: chapContent,
        images: imageUrls,
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
  postId: string
): Promise<string[]> => {
  const tokenRes = await fetch('/api/auth/token');
  if (!tokenRes.ok) {
    const errData = await tokenRes.json().catch(() => ({}));
    throw new Error(errData?.error || 'Không lấy được phiên đăng nhập Admin');
  }
  const { token } = await tokenRes.json();

  const workerUrl = (
    process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_URL ||
    ''
  ).replace(/\/+$/, '');

  const queryParams = new URLSearchParams();
  if (uploadTitle) queryParams.set('title', uploadTitle);
  if (postId) queryParams.set('postId', postId);

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

import imageCompression from 'browser-image-compression';

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
    'https://sutie-images.manhdinh0410.workers.dev'
  ).replace(/\/+$/, '');

  const sortedFiles = [...files].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );

  const BATCH_SIZE = 2;
  const allUrls: string[] = [];

  for (let i = 0; i < sortedFiles.length; i += BATCH_SIZE) {
    const batchFiles = sortedFiles.slice(i, i + BATCH_SIZE);

    const compressedBatch = await Promise.all(
      batchFiles.map(async (file) => {
        if (file.size <= 500 * 1024) return file;
        try {
          return await imageCompression(file, {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
          });
        } catch (error) {
          console.error('Lỗi khi nén ảnh:', error);
          return file;
        }
      })
    );

    const formData = new FormData();
    formData.append('title', uploadTitle);
    if (postId) formData.append('postId', postId);
    compressedBatch.forEach((compressed, idx) =>
      formData.append('files', compressed, batchFiles[idx].name)
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
    allUrls.push(...(urls as string[]));

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
  showProgress: (title: string, total: number) => void,
  updateProgress: (completed: number, total: number, status?: 'uploading' | 'saving' | 'success' | 'error', errorMessage?: string) => void,
  onPostCreated: () => void,
  notifyError: (title: string, message?: string) => void
) => {
  showProgress(`${upTitle} - ${chapTitle} (${files.length} ảnh)`, files.length);

  try {
    const imageUrls = await uploadImages(files, upTitle, postId, (completed, total) => {
      updateProgress(completed, total, 'uploading');
    });

    updateProgress(files.length, files.length, 'saving');

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

    updateProgress(files.length, files.length, 'success');
    onPostCreated();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    notifyError(`Lưu ${chapTitle} không thành công`, message);
    console.error(`Lỗi khi lưu ${chapTitle}:`, err);

    updateProgress(0, files.length, 'error', message);
  }
};

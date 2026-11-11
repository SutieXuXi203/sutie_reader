import JSZip from 'jszip';

export interface ZipExtractProgress {
  current: number;
  total: number;
  percent: number;
  currentFileName?: string;
}

const VALID_IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'avif',
  'bmp',
]);

const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  bmp: 'image/bmp',
};

/**
 * Kiểm tra xem một file có phải là file zip hay không dựa trên extension hoặc MIME type
 */
export function isZipFile(file: { name: string; type?: string }): boolean {
  if (!file) return false;
  const lowerName = (file.name || '').toLowerCase();
  const lowerType = (file.type || '').toLowerCase();

  return (
    lowerName.endsWith('.zip') ||
    lowerType === 'application/zip' ||
    lowerType === 'application/x-zip-compressed' ||
    lowerType === 'application/x-zip' ||
    lowerType === 'multipart/x-zip'
  );
}

/**
 * Trích xuất toàn bộ file ảnh từ tệp .zip, tự động sắp xếp theo thứ tự tự nhiên (natural sort),
 * bỏ qua các file rác của hệ điều hành (.DS_Store, __MACOSX, v.v.).
 */
export async function extractImagesFromZip(
  zipSource: File | Blob,
  onProgress?: (progress: ZipExtractProgress) => void
): Promise<File[]> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipSource);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Không thể đọc file zip: ${message}`);
  }

  const validEntries: Array<{ relativePath: string; baseName: string; ext: string; entry: JSZip.JSZipObject }> = [];

  zip.forEach((relativePath, entry) => {
    // Bỏ qua thư mục
    if (entry.dir) return;

    // Chuẩn hóa đường dẫn
    const normalizedPath = relativePath.replace(/\\/g, '/');
    const parts = normalizedPath.split('/').filter(Boolean);
    const fileName = parts[parts.length - 1];

    // Bỏ qua file rác macOS/Windows hoặc file ẩn
    if (!fileName || fileName.startsWith('.') || normalizedPath.includes('__MACOSX/')) {
      return;
    }

    const dotIndex = fileName.lastIndexOf('.');
    if (dotIndex === -1) return;

    const ext = fileName.substring(dotIndex + 1).toLowerCase();
    if (VALID_IMAGE_EXTENSIONS.has(ext)) {
      validEntries.push({
        relativePath: normalizedPath,
        baseName: fileName,
        ext,
        entry,
      });
    }
  });

  if (validEntries.length === 0) {
    throw new Error('Tệp zip không chứa hình ảnh hợp lệ nào (.png, .jpg, .jpeg, .webp, .gif, .avif)');
  }

  // Sắp xếp tự nhiên theo đường dẫn tương đối (ví dụ: page_1.jpg, page_2.jpg, page_10.jpg)
  validEntries.sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath, undefined, { numeric: true, sensitivity: 'base' })
  );

  // Kiểm tra xem tên file (baseName) có bị trùng lặp không
  const nameCounts = new Map<string, number>();
  for (const item of validEntries) {
    nameCounts.set(item.baseName, (nameCounts.get(item.baseName) || 0) + 1);
  }
  const hasDuplicateBaseNames = Array.from(nameCounts.values()).some((count) => count > 1);

  const files: File[] = [];
  const total = validEntries.length;

  for (let i = 0; i < total; i++) {
    const item = validEntries[i];
    const blob = await item.entry.async('blob');

    // Nếu không trùng tên thì dùng trực tiếp baseName cho gọn; nếu trùng thì ghép đường dẫn để phân biệt
    let finalFileName = item.baseName;
    if (hasDuplicateBaseNames) {
      finalFileName = item.relativePath.replace(/\//g, '_');
    }

    const mimeType = MIME_MAP[item.ext] || 'image/jpeg';
    const file = new File([blob], finalFileName, { type: mimeType });
    files.push(file);

    if (onProgress) {
      onProgress({
        current: i + 1,
        total,
        percent: Math.round(((i + 1) / total) * 100),
        currentFileName: finalFileName,
      });
    }
  }

  return files;
}


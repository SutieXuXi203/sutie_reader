import { extractDriveImageId } from '@/lib/utils';

/**
 * Gom id file Drive của mọi ảnh trong bài (ảnh cấp bài + ảnh của các chương), không trùng lặp.
 * Dùng để duy trì trường `Post.imageIds` (multikey index) giúp tra "ảnh thuộc bài nào" bằng index thay vì `$regex` quét cả collection.
 */
export function collectImageIds(images?: unknown, chapters?: unknown): string[] {
  const ids = new Set<string>();

  const add = (value: unknown) => {
    if (!Array.isArray(value)) return;
    for (const item of value) {
      if (typeof item !== 'string') continue;
      const id = extractDriveImageId(item);
      if (id) ids.add(id);
    }
  };

  add(images);
  if (Array.isArray(chapters)) {
    for (const chapter of chapters) {
      if (chapter && typeof chapter === 'object') add((chapter as { images?: unknown }).images);
    }
  }
  return [...ids];
}

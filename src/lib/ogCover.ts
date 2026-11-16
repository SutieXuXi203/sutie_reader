import { extractDriveImageId } from '@/lib/utils';

interface CoverChapter {
  images?: unknown[];
  accessType?: string;
}

interface CoverPost {
  images?: unknown[];
  chapters?: CoverChapter[];
}

const firstString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

function imageIds(images: unknown[] | undefined): Set<string> {
  const ids = new Set<string>();
  for (const image of images || []) {
    const id = extractDriveImageId(firstString(image));
    if (id) ids.add(id);
  }
  return ids;
}

/**
 * Chọn ảnh bìa cho endpoint công khai `/api/og-image` (không cần đăng nhập, ảnh không xáo trộn).
 *
 * `post.images` chỉ là bản sao của ảnh chương đầu tiên, nên nếu chương đó bị `restricted` thì KHÔNG được dùng:
 * chỉ lấy ảnh thuộc một chương không bị hạn chế. Trả về chuỗi rỗng nếu không có ảnh nào công khai được.
 */
export function pickPublicCoverUrl(post: CoverPost): string {
  const chapters = Array.isArray(post.chapters) ? post.chapters : [];
  const topLevel = firstString((post.images || [])[0]);

  // Truyện kiểu cũ không có chương: chỉ còn trường ảnh cấp bài
  if (chapters.length === 0) return topLevel;

  const unrestricted = chapters.filter((chapter) => chapter.accessType !== 'restricted');
  const unrestrictedIds = new Set<string>();
  for (const chapter of unrestricted) {
    for (const id of imageIds(chapter.images)) unrestrictedIds.add(id);
  }

  const topLevelId = topLevel ? extractDriveImageId(topLevel) : null;
  if (topLevelId && unrestrictedIds.has(topLevelId)) return topLevel;

  for (const chapter of unrestricted) {
    const candidate = firstString((chapter.images || [])[0]);
    if (candidate) return candidate;
  }
  return '';
}

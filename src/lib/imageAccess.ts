import { extractDriveImageId } from '@/lib/utils';
import {
  canViewChapter,
  canViewPost,
  type AuthUserContext,
  type ChapterContext,
  type PostContext,
} from '@/lib/permissions';

export interface ImageChapter extends ChapterContext {
  images?: unknown;
}

export interface ImageOwnerPost extends PostContext {
  images?: unknown;
  chapters?: ImageChapter[];
}

export interface ImageLocation {
  found: boolean;
  chapter: ImageChapter | null;
  isCover: boolean;
}

function toIds(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images
    .filter((img): img is string => typeof img === 'string')
    .map((img) => extractDriveImageId(img))
    .filter((id): id is string => Boolean(id));
}

/** Xác định ảnh `imageId` thuộc chương nào của bài (so khớp chính xác theo file id, không so chuỗi con). */
export function locateImageInPost(post: ImageOwnerPost, imageId: string): ImageLocation {
  const chapters = Array.isArray(post.chapters) ? post.chapters : [];
  const chapter = chapters.find((ch) => toIds(ch.images).includes(imageId)) ?? null;
  const topLevelIds = toIds(post.images);

  const coverId = topLevelIds[0] ?? toIds(chapters[0]?.images)[0];

  return {
    found: Boolean(chapter) || topLevelIds.includes(imageId),
    chapter,
    isCover: coverId === imageId,
  };
}

/**
 * Quyết định tài khoản `guest` có được xem ảnh hay không.
 * - Ảnh bắt buộc phải thuộc bài đã chọn (không tin `pid` từ client): nếu không tìm thấy thì từ chối.
 * - Ảnh bìa (thumbnail) cần quyền xem bài; ảnh trong chương cần quyền xem đúng chương đó.
 */
export function authorizeGuestImage(
  user: AuthUserContext,
  post: ImageOwnerPost | null,
  imageId: string,
  { thumb }: { thumb: boolean }
): boolean {
  if (!post) return false;

  const location = locateImageInPost(post, imageId);
  if (!location.found) return false;

  if (thumb && location.isCover) {
    return canViewPost(user, post).allowed;
  }

  if (location.chapter) {
    return canViewChapter(user, post, location.chapter).allowed;
  }

  return canViewPost(user, post).allowed;
}

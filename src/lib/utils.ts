import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const DRIVE_FILE_ID_PATTERN = /^[a-zA-Z0-9_-]{10,}$/;
const PROTECTED_IMAGE_URL_VERSION = '2';

export function extractDriveImageId(url: string): string | null {
  const value = typeof url === 'string' ? url.trim() : '';
  if (!value) return null;

  if (DRIVE_FILE_ID_PATTERN.test(value)) {
    return value;
  }

  const apiImageMatch = value.match(/(?:^|\/)api\/image\/([a-zA-Z0-9_-]{10,})(?:[/?#]|$)/);
  if (apiImageMatch) {
    return apiImageMatch[1];
  }

  const workerImageMatch = value.match(/\/image\/([a-zA-Z0-9_-]{10,})(?:[/?#]|$)/);
  if (workerImageMatch) {
    return workerImageMatch[1];
  }

  const driveMatch = value.match(/(?:id=|\/d\/)([a-zA-Z0-9_-]{10,})/);
  if (driveMatch) {
    return driveMatch[1];
  }

  return null;
}

export function getOptimizedImageUrl(url: string): string {
  if (!url) return '';

  if (url.includes('sig=') && url.includes('exp=')) {
    return url;
  }

  const imageId = extractDriveImageId(url);
  if (imageId) {
    return `/api/image/${encodeURIComponent(imageId)}?v=${PROTECTED_IMAGE_URL_VERSION}`;
  }
  return url;
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export type NormalizedPostChapter = {
  title: string;
  chapterNumber: number;
  content: string;
  images: string[];
};

type PostChapterLike = Partial<NormalizedPostChapter> & {
  images?: unknown;
};

type PostWithChaptersLike = {
  chapters?: unknown;
  content?: unknown;
  images?: unknown;
};

function toImageArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getPostChapters(
  post: PostWithChaptersLike | null | undefined
): NormalizedPostChapter[] {
  if (!post) return [];

  const chapterCandidates = Array.isArray(post.chapters)
    ? (post.chapters as PostChapterLike[])
    : [];

  const normalizedFromChapters = chapterCandidates
    .map((chapter, index) => {
      const chapterNumberRaw =
        typeof chapter.chapterNumber === "number" && Number.isFinite(chapter.chapterNumber)
          ? Math.floor(chapter.chapterNumber)
          : index + 1;
      const chapterNumber = chapterNumberRaw > 0 ? chapterNumberRaw : index + 1;
      const content = typeof chapter.content === "string" ? chapter.content : "";
      const images = toImageArray(chapter.images);
      const defaultTitle = `Chương ${chapterNumber}`;
      const title =
        typeof chapter.title === "string" && chapter.title.trim()
          ? chapter.title.trim()
          : defaultTitle;

      return {
        title,
        chapterNumber,
        content,
        images,
      };
    })
    .filter((chapter) => chapter.images.length > 0 || chapter.content.trim().length > 0)
    .sort((a, b) => a.chapterNumber - b.chapterNumber);

  if (normalizedFromChapters.length > 0) {
    return normalizedFromChapters;
  }

  const legacyContent = typeof post.content === "string" ? post.content : "";
  const legacyImages = toImageArray(post.images);

  if (legacyContent.trim().length === 0 && legacyImages.length === 0) {
    return [];
  }

  return [
    {
      title: "Oneshot",
      chapterNumber: 1,
      content: legacyContent,
      images: legacyImages,
    },
  ];
}

export function getPostPrimaryContent(
  post: PostWithChaptersLike | null | undefined
): string {
  const chapters = getPostChapters(post);
  if (chapters.length > 0) {
    return chapters[0].content;
  }
  return typeof post?.content === "string" ? post.content : "";
}

export function getPostPrimaryImages(
  post: PostWithChaptersLike | null | undefined
): string[] {
  const chapters = getPostChapters(post);
  if (chapters.length > 0) {
    return chapters[0].images;
  }
  return toImageArray(post?.images);
}

export function getPostCoverImage(
  post: PostWithChaptersLike | null | undefined
): string {
  const primaryImages = getPostPrimaryImages(post);
  return primaryImages[0] || "";
}

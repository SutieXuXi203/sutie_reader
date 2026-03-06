import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getOptimizedImageUrl(url: string): string {
  if (!url) return '';

  const matchDriveId = url.match(/(?:id=|\/d\/)([a-zA-Z0-9_-]{25,})/);
  if (url.includes('drive.google.com') && matchDriveId) {
    return `/api/image/${matchDriveId[1]}`;
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

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

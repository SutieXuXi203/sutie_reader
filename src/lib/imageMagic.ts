export type DetectedImageType = 'png' | 'jpeg' | 'webp' | 'gif' | 'avif';

/** Nhận diện định dạng ảnh bằng "magic bytes" thay vì tin vào Content-Type do client khai báo (SVG bị loại). */
export function detectImageType(bytes: Uint8Array): DetectedImageType | null {
  if (bytes.length < 12) return null;

  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'gif';

  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
  if (ascii(4, 8) === 'ftyp' && (ascii(8, 12) === 'avif' || ascii(8, 12) === 'avis')) return 'avif';

  return null;
}

export const IMAGE_MIME_BY_TYPE: Record<DetectedImageType, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
};

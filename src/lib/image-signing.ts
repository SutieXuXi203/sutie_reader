import { createHmac } from 'node:crypto';
import { extractDriveImageId, protectedImageUrl } from './utils';

const IMAGE_SIGNATURE_VERSION = 'v1';
const DEFAULT_IMAGE_URL_TTL_SECONDS = 120;
const MAX_IMAGE_URL_TTL_SECONDS = 600;

function getPositiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

export function getImageSignedUrlTtlSeconds(): number {
  return Math.min(
    getPositiveIntegerEnv('IMAGE_SIGNED_URL_TTL_SECONDS', DEFAULT_IMAGE_URL_TTL_SECONDS),
    MAX_IMAGE_URL_TTL_SECONDS
  );
}

export function getImageSigningSecret(): string {
  const secret =
    process.env.IMAGE_SIGNING_SECRET ||
    process.env.CLOUDFLARE_UPLOAD_SECRET ||
    process.env.JWT_SECRET ||
    '';

  return secret.trim();
}

export function getImageSignaturePayload(
  method: string,
  fileId: string,
  expiresAt: number,
  subject: string
): string {
  return [
    IMAGE_SIGNATURE_VERSION,
    method.toUpperCase(),
    `/image/${fileId}`,
    String(expiresAt),
    subject,
  ].join('\n');
}

export function signImageRequest(
  method: string,
  fileId: string,
  expiresAt: number,
  subject: string,
  secret: string
): string {
  return createHmac('sha256', secret)
    .update(getImageSignaturePayload(method, fileId, expiresAt, subject))
    .digest('base64url');
}

/**
 * Tạo URL Worker đã ký. CHỈ dùng phía server (server-to-server): Worker trả ảnh gốc chưa xáo trộn nên URL này
 * tuyệt đối không được đưa vào phản hồi gửi cho trình duyệt.
 */
export function createSignedWorkerImageUrl({
  workerBaseUrl,
  fileId,
  subject,
}: {
  workerBaseUrl: string;
  fileId: string;
  subject: string;
}): string {
  const secret = getImageSigningSecret();
  if (!secret) {
    throw new Error('Missing IMAGE_SIGNING_SECRET, CLOUDFLARE_UPLOAD_SECRET, or JWT_SECRET');
  }

  const expiresAt = Math.floor(Date.now() / 1000) + getImageSignedUrlTtlSeconds();
  const url = new URL(`/image/${encodeURIComponent(fileId)}`, workerBaseUrl.replace(/\/+$/, '') + '/');
  url.searchParams.set('exp', String(expiresAt));
  url.searchParams.set('sub', subject);
  url.searchParams.set('sig', signImageRequest('GET', fileId, expiresAt, subject, secret));
  return url.toString();
}

/**
 * Chuyển danh sách ảnh trong DB thành URL gửi cho client.
 *
 * Trả về `/api/image/<id>.webp?...&pid=` (đi qua route kiểm quyền + xáo trộn phía server), KHÔNG trả URL Worker:
 * Worker phục vụ ảnh gốc, nếu lộ ra client thì cơ chế xáo trộn chống leech bị vô hiệu.
 *
 * @param postId - ID bài viết, đính kèm dưới dạng `?pid=` để route ảnh tra cứu bài bằng _id index (O(1)).
 */
export function signImageUrls(urls: string[], _userId: string, postId?: string): string[] {
  if (!urls || urls.length === 0) return [];
  return urls.map((url) => (extractDriveImageId(url) ? protectedImageUrl(url, postId) : url));
}

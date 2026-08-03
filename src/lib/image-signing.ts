import { createHmac } from 'node:crypto';
import { extractDriveImageId } from './utils';

const IMAGE_SIGNATURE_VERSION = 'v1';
const DEFAULT_IMAGE_URL_TTL_SECONDS = 120;
const MAX_IMAGE_URL_TTL_SECONDS = 3600;

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

export function signImageUrls(urls: string[], userId: string): string[] {
  if (!urls || urls.length === 0) return [];
  const workerBaseUrl =
    process.env.CLOUDFLARE_WORKER_URL ||
    process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_URL ||
    'https://sutie-images.manhdinh0410.workers.dev';

  return urls.map((url) => {
    const fileId = extractDriveImageId(url);
    if (!fileId) return url;
    try {
      return createSignedWorkerImageUrl({
        workerBaseUrl,
        fileId,
        subject: userId,
      });
    } catch (e) {
      console.error('Error signing image URL:', e);
      return url;
    }
  });
}

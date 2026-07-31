import { NextRequest, NextResponse } from 'next/server';
import { createSignedWorkerImageUrl } from '@/lib/image-signing';
import { getSessionUserFromToken } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DEFAULT_IMAGE_WORKER_URL = 'https://sutie-images.manhdinh0410.workers.dev';
const DRIVE_FILE_ID_PATTERN = /^[a-zA-Z0-9_-]{10,}$/;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX = 360;

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const imageRateLimitBuckets = new Map<string, RateLimitBucket>();

function getWorkerBaseUrl(): string {
  return (
    process.env.CLOUDFLARE_WORKER_URL ||
    process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_URL ||
    DEFAULT_IMAGE_WORKER_URL
  ).replace(/\/+$/, '');
}

function getPositiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

function checkImageRateLimit(key: string) {
  const now = Date.now();
  const windowMs = getPositiveIntegerEnv('IMAGE_RATE_LIMIT_WINDOW_MS', DEFAULT_RATE_LIMIT_WINDOW_MS);
  const maxRequests = getPositiveIntegerEnv('IMAGE_RATE_LIMIT_MAX', DEFAULT_RATE_LIMIT_MAX);
  const current = imageRateLimitBuckets.get(key);

  if (!current || current.resetAt <= now) {
    imageRateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  current.count += 1;
  if (current.count <= maxRequests) {
    return { allowed: true, retryAfter: 0 };
  }

  if (imageRateLimitBuckets.size > 5_000) {
    for (const [bucketKey, bucket] of imageRateLimitBuckets) {
      if (bucket.resetAt <= now) {
        imageRateLimitBuckets.delete(bucketKey);
      }
    }
  }

  return {
    allowed: false,
    retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}

function imageError(message: string, status: number, headers?: HeadersInit) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('Cache-Control', 'no-store');
  responseHeaders.set('X-Content-Type-Options', 'nosniff');

  return NextResponse.json(
    { error: message },
    {
      status,
      headers: responseHeaders,
    }
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!DRIVE_FILE_ID_PATTERN.test(id)) {
    return imageError('Invalid image id', 400);
  }

  const sessionToken = request.cookies.get('token')?.value;
  const user = await getSessionUserFromToken(sessionToken);
  if (!user) {
    return imageError('Unauthorized', 401);
  }

  const rateLimitKey = `${user.id}:${getClientIp(request)}`;
  const rateLimit = checkImageRateLimit(rateLimitKey);
  if (!rateLimit.allowed) {
    return imageError('Too many image requests', 429, {
      'Retry-After': String(rateLimit.retryAfter),
    });
  }

  try {
    const signedWorkerUrl = createSignedWorkerImageUrl({
      workerBaseUrl: getWorkerBaseUrl(),
      fileId: id,
      subject: user.id,
    });

    const upstreamHeaders = new Headers();
    const accept = request.headers.get('accept');
    if (accept) {
      upstreamHeaders.set('Accept', accept);
    }
    upstreamHeaders.set('X-Sutie-Image-Proxy', 'next-api');

    const upstream = await fetch(signedWorkerUrl, {
      headers: upstreamHeaders,
      cache: 'no-store',
    });

    if (!upstream.ok || !upstream.body) {
      const upstreamText = await upstream.text().catch(() => '');
      return new NextResponse(upstreamText || 'Image unavailable', {
        status: upstream.status || 502,
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': upstream.headers.get('content-type') || 'text/plain; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    const responseHeaders = new Headers();
    const contentType = upstream.headers.get('content-type');
    const contentDisposition = upstream.headers.get('content-disposition');
    const etag = upstream.headers.get('etag');
    const lastModified = upstream.headers.get('last-modified');

    if (contentType) responseHeaders.set('Content-Type', contentType);
    if (contentDisposition) responseHeaders.set('Content-Disposition', contentDisposition);
    if (etag) responseHeaders.set('ETag', etag);
    if (lastModified) responseHeaders.set('Last-Modified', lastModified);
    responseHeaders.set('Cache-Control', 'private, max-age=120');
    responseHeaders.set('Vary', 'Cookie');
    responseHeaders.set('X-Content-Type-Options', 'nosniff');

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Error serving signed image:', error);
    return imageError('Image unavailable', 500);
  }
}

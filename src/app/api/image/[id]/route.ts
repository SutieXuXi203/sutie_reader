import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import sharp from 'sharp';
import { createSignedWorkerImageUrl } from '@/lib/image-signing';
import { getCurrentUserFromToken } from '@/lib/server-auth';
import { scrambleImageBuffer } from '@/lib/scramble-server';
import { deriveScrambleSeed, DEFAULT_SCRAMBLE_ROWS, DEFAULT_SCRAMBLE_COLS } from '@/lib/scramble';
import { getApiCache, setApiCache } from '@/lib/api-cache';
import { checkRateLimit } from '@/lib/memoryRateLimit';
import { getClientIp } from '@/lib/clientIp';
import { authorizeGuestImage, locateImageInPost, type ImageOwnerPost } from '@/lib/imageAccess';
import { connectDB } from '@/lib/db';
import { Post } from '@/models/Post';
import { logApiError } from '@/lib/telegramLogger';
import { getCachedScrambled, getOrCreateScrambled } from '@/lib/scrambledImageCache';
import { getImageIndexStatus } from '@/lib/imageIndex';
import { isRetryableUpstreamStatus, isTransientNetworkError, withRetry } from '@/lib/upstreamRetry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DRIVE_FILE_ID_PATTERN = /^[a-zA-Z0-9_-]{10,}$/;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX = 800;
const MAX_UPSTREAM_BYTES = 25 * 1024 * 1024;
// Quyền được cache ngắn: instance khác (serverless) không nhận được lệnh invalidate khi admin đổi quyền chia sẻ
const ACCESS_CACHE_TTL_MS = 60_000;
const MAX_OWNER_POSTS = 5;
// Tối đa ~3 x 12s + backoff (300ms, 600ms) ≈ 37s, nằm trong maxDuration = 60s
const UPSTREAM_ATTEMPT_TIMEOUT_MS = 12_000;
const UPSTREAM_MAX_ATTEMPTS = 3;
const UPSTREAM_RETRY_BASE_MS = 300;

function getWorkerBaseUrl(): string {
  return (
    process.env.CLOUDFLARE_WORKER_URL ||
    process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_URL ||
    ''
  ).replace(/\/+$/, '');
}

function getPositiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
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

/** Ảnh phụ thuộc người dùng: chỉ cache riêng tư ở trình duyệt, tuyệt đối không cho cache dùng chung (CDN/proxy) lưu lại */
function privateImageHeaders(): Headers {
  const headers = new Headers();
  headers.set('Content-Type', 'image/webp');
  headers.set('Cache-Control', 'private, max-age=86400');
  headers.set('Vary', 'Cookie');
  headers.set('X-Content-Type-Options', 'nosniff');
  return headers;
}

/**
 * Tìm các bài viết thực sự chứa ảnh. `pid` chỉ là gợi ý để tra cứu nhanh (O(1) theo _id): nếu ảnh không thuộc bài `pid`
 * thì bỏ qua, nên không thể dùng `pid` của một bài công khai để đọc ảnh của bài bị hạn chế.
 *
 * Tra cứu theo multikey index `Post.imageIds` (không quét collection). `$regex` quét toàn bộ chỉ còn là đường dự phòng trong lúc
 * `imageIds` chưa được điền đủ cho dữ liệu cũ (`getImageIndexStatus() !== 'ready'`), nên khách không thể dùng id ngẫu nhiên để
 * bắt DB quét collection nhiều lần. Một ảnh có thể nằm trong nhiều bài: trả về tất cả (tối đa MAX_OWNER_POSTS), được phép nếu BẤT KỲ bài nào cho phép.
 */
async function findOwnerPosts(imageId: string, postIdHint: string | null): Promise<ImageOwnerPost[]> {
  const projection = 'accessType sharedWith images chapters';

  if (postIdHint && ObjectId.isValid(postIdHint)) {
    const hinted = (await Post.findById(postIdHint).select(projection).lean()) as ImageOwnerPost | null;
    if (hinted && locateImageInPost(hinted, imageId).found) {
      return [hinted];
    }
  }

  const indexed = (await Post.find({ imageIds: imageId })
    .select(projection)
    .limit(MAX_OWNER_POSTS)
    .lean()) as ImageOwnerPost[];
  if (indexed.length > 0 || getImageIndexStatus() === 'ready') {
    return indexed;
  }

  // Dự phòng (chỉ khi index chưa sẵn sàng): imageId đã được kiểm tra bởi DRIVE_FILE_ID_PATTERN nên chỉ gồm [a-zA-Z0-9_-], an toàn khi dùng trong regex
  return (await Post.find({
    $or: [{ images: { $regex: imageId } }, { 'chapters.images': { $regex: imageId } }],
  })
    .select(projection)
    .limit(MAX_OWNER_POSTS)
    .lean()) as ImageOwnerPost[];
}

/** Lỗi có mã trạng thái HTTP rõ ràng, được chia sẻ giữa các request cùng chờ một lần xáo trộn */
class ImageRouteError extends Error {
  status: number;
  /** Lỗi tạm thời phía upstream (429/5xx): đáng thử lại */
  retryable: boolean;
  /** Lỗi mạng gốc khi đã hết lượt thử: dùng để báo về Telegram */
  originalError?: unknown;

  constructor(message: string, status: number, options: { retryable?: boolean; originalError?: unknown } = {}) {
    super(message);
    this.name = 'ImageRouteError';
    this.status = status;
    this.retryable = options.retryable ?? false;
    this.originalError = options.originalError;
  }
}

/** Tải ảnh gốc từ Worker bằng URL ký số (chỉ server-to-server) và kiểm tra loại/kích thước */
async function fetchUpstreamImage(fileId: string, subject: string, signal: AbortSignal) {
  const signedWorkerUrl = createSignedWorkerImageUrl({
    workerBaseUrl: getWorkerBaseUrl(),
    fileId,
    subject,
  });

  const upstreamHeaders = new Headers();
  upstreamHeaders.set('X-Sutie-Image-Proxy', 'next-api');

  const upstream = await fetch(signedWorkerUrl, {
    headers: upstreamHeaders,
    cache: 'no-store',
    signal,
  });

  if (!upstream.ok || !upstream.body) {
    const upstreamStatus = upstream.status === 404 || upstream.status === 403 ? upstream.status : 502;
    // Hủy body để giải phóng socket trước khi thử lại
    void upstream.body?.cancel().catch(() => {});
    throw new ImageRouteError('Image unavailable', upstreamStatus, {
      retryable: isRetryableUpstreamStatus(upstream.status),
    });
  }

  const upstreamType = (upstream.headers.get('content-type') || '').toLowerCase();
  if (!upstreamType.startsWith('image/') || upstreamType.includes('svg')) {
    throw new ImageRouteError('Unsupported media type', 415);
  }

  const declaredLength = Number(upstream.headers.get('content-length') || 0);
  if (declaredLength > MAX_UPSTREAM_BYTES) {
    throw new ImageRouteError('Image too large', 413);
  }

  return { upstream, upstreamType };
}

/**
 * Tải trọn ảnh gốc về RAM, tự thử lại khi gặp lỗi mạng thoáng qua (`fetch failed`, `terminated`, timeout, 429/5xx).
 * Mỗi lần thử có timeout riêng bao cả bước kết nối lẫn bước đọc body, nên socket treo cũng không giữ request quá lâu.
 * Lỗi có chủ đích (404/403/415/413) trả ngay, không retry. Hết lượt thử vì lỗi mạng -> 502 (không phải 500).
 */
async function fetchUpstreamBuffer(fileId: string, subject: string) {
  try {
    return await withRetry(
      async () => {
        const signal = AbortSignal.timeout(UPSTREAM_ATTEMPT_TIMEOUT_MS);
        const { upstream, upstreamType } = await fetchUpstreamImage(fileId, subject, signal);

        const rawBuffer = Buffer.from(await upstream.arrayBuffer());
        if (rawBuffer.length > MAX_UPSTREAM_BYTES) {
          throw new ImageRouteError('Image too large', 413);
        }
        return { rawBuffer, upstreamType };
      },
      {
        attempts: UPSTREAM_MAX_ATTEMPTS,
        baseDelayMs: UPSTREAM_RETRY_BASE_MS,
        isRetryable: (error) => (error instanceof ImageRouteError ? error.retryable : isTransientNetworkError(error)),
      }
    );
  } catch (error) {
    if (error instanceof ImageRouteError) throw error;
    if (isTransientNetworkError(error)) {
      throw new ImageRouteError('Image unavailable', 502, { originalError: error });
    }
    throw error;
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await context.params;
  const id = (rawId || '').replace(/\.(webp|jpg|jpeg|png)$/i, '');
  if (!DRIVE_FILE_ID_PATTERN.test(id)) {
    return imageError('Invalid image id', 400);
  }

  const sessionToken = request.cookies.get('token')?.value;
  const user = await getCurrentUserFromToken(sessionToken);
  if (!user) {
    return imageError('Unauthorized', 401);
  }

  const rateLimit = await checkRateLimit(
    `img:${user.id}:${getClientIp(request.headers)}`,
    getPositiveIntegerEnv('IMAGE_RATE_LIMIT_MAX', DEFAULT_RATE_LIMIT_MAX),
    getPositiveIntegerEnv('IMAGE_RATE_LIMIT_WINDOW_MS', DEFAULT_RATE_LIMIT_WINDOW_MS)
  );
  if (!rateLimit.allowed) {
    return imageError('Too many image requests', 429, {
      'Retry-After': String(rateLimit.retryAfter),
    });
  }

  const isThumb =
    request.nextUrl.searchParams.get('thumb') === '1' || request.nextUrl.searchParams.get('type') === 'thumb';

  // Chống IDOR/BOLA: tài khoản guest chỉ được xem ảnh thuộc truyện/chương mình có quyền (kể cả khi xin ảnh thumbnail)
  if (user.role === 'guest') {
    const accessCacheKey = `img_access:${user.id}:${id}:${isThumb ? 't' : 'f'}`;

    let isAllowed = await getApiCache<boolean>(accessCacheKey);
    if (isAllowed === null) {
      try {
        await connectDB();
        const posts = await findOwnerPosts(id, request.nextUrl.searchParams.get('pid'));
        isAllowed = posts.some((post) => authorizeGuestImage(user, post, id, { thumb: isThumb }));
        await setApiCache(accessCacheKey, isAllowed, ACCESS_CACHE_TTL_MS);
      } catch (err) {
        // Fail-closed: không kiểm tra được quyền thì từ chối, tuyệt đối không mặc định cho phép
        console.error('Lỗi kiểm tra quyền xem ảnh:', err);
        void logApiError({
          module: '[GET] /api/image/[id] (access check)',
          error: err,
          request,
          metadata: { imageId: id },
          statusCode: 503,
        });
        return imageError('Không thể kiểm tra quyền truy cập ảnh', 503);
      }
    }

    if (!isAllowed) {
      return imageError('Forbidden: Bạn không có quyền truy cập ảnh này', 403);
    }
  }

  const isAdmin = user.role === 'admin';
  const isPreScrambled = request.nextUrl.searchParams.get('pre_scrambled') === '1' && isAdmin;
  const isRaw = request.nextUrl.searchParams.get('raw') === '1' && isAdmin;
  // Chế độ đọc truyện thông thường (xáo trộn trên server): đúng nhánh cuối của hàm này
  const isScrambledRead = !isRaw && !isPreScrambled && !isThumb;

  // Quyền truy cập đã được kiểm tra ở trên. Kết quả xáo trộn giống hệt nhau cho mọi người đọc nên dùng chung cache RAM:
  // tránh giải mã + mã hóa lại ~1 giây CPU cho mỗi lần xem.
  if (isScrambledRead) {
    const cached = getCachedScrambled(id);
    if (cached) {
      return new NextResponse(new Uint8Array(cached), { status: 200, headers: privateImageHeaders() });
    }
  }

  try {
    if (isScrambledRead) {
      const scrambledBuffer = await getOrCreateScrambled(id, async () => {
        const { rawBuffer } = await fetchUpstreamBuffer(id, user.id);

        // Chế độ đọc truyện: xáo trộn ảnh trên server (seed do server suy ra, không nhận tham số từ client)
        try {
          return await scrambleImageBuffer(rawBuffer, {
            seed: deriveScrambleSeed(id),
            rows: DEFAULT_SCRAMBLE_ROWS,
            cols: DEFAULT_SCRAMBLE_COLS,
            quality: 95,
          });
        } catch (scrambleErr) {
          // Fail-closed: lỗi xáo trộn không bao giờ được phép trả ảnh gốc cho người dùng
          console.error('Lỗi khi xáo trộn ảnh trên server:', scrambleErr);
          void logApiError({
            module: '[GET] /api/image/[id] (scramble)',
            error: scrambleErr,
            request,
            metadata: { imageId: id },
            statusCode: 500,
          });
          throw new ImageRouteError('Image unavailable', 500);
        }
      });

      return new NextResponse(new Uint8Array(scrambledBuffer), { status: 200, headers: privateImageHeaders() });
    }

    const { rawBuffer, upstreamType } = await fetchUpstreamBuffer(id, user.id);

    // Admin xem ảnh gốc / ảnh đã xáo trộn sẵn: chuyển tiếp nguyên trạng
    if (isRaw || isPreScrambled) {
      const responseHeaders = new Headers();
      responseHeaders.set('Content-Type', upstreamType);
      responseHeaders.set('Cache-Control', 'private, no-store');
      responseHeaders.set('X-Content-Type-Options', 'nosniff');
      return new NextResponse(new Uint8Array(rawBuffer), { status: 200, headers: responseHeaders });
    }

    // Thumbnail: WebP thu nhỏ (tối đa 480px), không xáo trộn. Đã qua kiểm quyền ở trên.
    try {
      const thumbBuffer = await sharp(rawBuffer)
        .resize({ width: 480, withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();

      return new NextResponse(new Uint8Array(thumbBuffer), { status: 200, headers: privateImageHeaders() });
    } catch (thumbErr) {
      console.error('Error generating thumbnail in image route:', thumbErr);
      return imageError('Image unavailable', 500);
    }
  } catch (error) {
    if (error instanceof ImageRouteError) {
      if (error.originalError) {
        // Đã thử lại hết lượt mà upstream vẫn lỗi mạng: báo Telegram (kèm lỗi gốc) nhưng trả 502 cho client
        console.error('Upstream image unreachable after retries:', error.originalError);
        void logApiError({
          module: '[GET] /api/image/[id] (upstream)',
          error: error.originalError,
          request,
          metadata: { imageId: id, attempts: UPSTREAM_MAX_ATTEMPTS },
          statusCode: error.status,
        });
      }
      return imageError(error.message, error.status);
    }

    console.error('Error serving signed image:', error);
    void logApiError({
      module: '[GET] /api/image/[id]',
      error,
      request,
      metadata: { imageId: id },
      statusCode: 500,
    });
    return imageError('Image unavailable', 500);
  }
}

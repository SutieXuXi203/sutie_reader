/**
 * Retry cho các lần gọi server-to-server (Vercel -> Cloudflare Worker -> Google Drive).
 *
 * Lỗi mạng thoáng qua (`fetch failed`, `terminated`, timeout, 429/5xx từ upstream) thường hết sau vài trăm ms,
 * nên thử lại vài lần trước khi báo lỗi cho người đọc. Lỗi có chủ đích (404/403/415/413...) KHÔNG bao giờ được retry.
 */

export type RetryOptions = {
  /** Tổng số lần thử (>= 1) */
  attempts: number;
  /** Chờ `baseDelayMs * 2^(lần thử - 1)` giữa các lần thử */
  baseDelayMs: number;
  /** Quyết định lỗi nào đáng thử lại */
  isRetryable: (error: unknown) => boolean;
  /** Dùng trong test để khỏi phải chờ thật */
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  { attempts, baseDelayMs, isRetryable, sleep = defaultSleep }: RetryOptions
): Promise<T> {
  const maxAttempts = Math.max(1, Math.floor(attempts));

  for (let attempt = 1; ; attempt++) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (attempt >= maxAttempts || !isRetryable(error)) {
        throw error;
      }
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }
}

/** Mã trạng thái upstream đáng thử lại: quá tải/giới hạn tốc độ hoặc lỗi phía máy chủ */
export function isRetryableUpstreamStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

/**
 * Lỗi mạng của undici/fetch: `TypeError: fetch failed`, `TypeError: terminated`, ECONNRESET, ETIMEDOUT,
 * hoặc AbortSignal.timeout (TimeoutError/AbortError). Mọi lỗi khác (bug logic) không được retry.
 */
export function isTransientNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  if (error.name === 'TimeoutError' || error.name === 'AbortError') return true;
  if (error instanceof TypeError && /fetch failed|terminated|network|socket|other side closed/i.test(error.message)) {
    return true;
  }

  const code = (error as Error & { code?: unknown }).code;
  if (typeof code === 'string' && /^(ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE|ENOTFOUND|EAI_AGAIN|UND_ERR_.*)$/.test(code)) {
    return true;
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  return cause !== undefined && cause !== error ? isTransientNetworkError(cause) : false;
}

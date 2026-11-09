import { getRedisClient } from './redis';

type Bucket = { count: number; resetAt: number };

const MAX_BUCKETS = 5_000;
const store = new Map<string, Bucket>();

function sweep(now: number) {
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
  // Nếu vẫn quá lớn sau khi dọn mục hết hạn, bỏ các mục cũ nhất (Map giữ thứ tự chèn)
  while (store.size >= MAX_BUCKETS) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

/**
 * Giới hạn tần suất theo cửa sổ cố định, lưu trong RAM của instance hiện tại.
 * Giữ nguyên để phục vụ kiểm thử đơn vị đồng bộ và làm fallback khi không có Redis.
 */
export function checkMemoryRateLimit(
  key: string,
  max: number,
  windowMs: number
): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    if (store.size >= MAX_BUCKETS) sweep(now);
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  current.count += 1;
  if (current.count <= max) {
    return { allowed: true, retryAfter: 0 };
  }

  return { allowed: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
}

// Lua script thực thi nguyên tử trên Redis (Fixed-window Rate Limit)
const RATE_LIMIT_LUA = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return {current, ttl}
`;

/**
 * Giới hạn tần suất tập trung:
 * - Ưu tiên dùng Redis (hỗ trợ đồng bộ xuyên suốt mọi serverless instance / container).
 * - Tự động fallback về RAM (checkMemoryRateLimit) nếu chưa cấu hình Redis hoặc kết nối lỗi.
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfter: number }> {
  const client = getRedisClient();

  if (client) {
    try {
      const redisKey = `ratelimit:${key}`;
      const res = (await client.eval(RATE_LIMIT_LUA, 1, redisKey, windowMs)) as [number, number];
      const count = Number(res[0]);
      const ttlMs = Number(res[1]);

      if (count <= max) {
        return { allowed: true, retryAfter: 0 };
      }

      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil(ttlMs / 1000)),
      };
    } catch (err) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`[RATELIMIT WARN] Lỗi Redis rate-limit cho key "${key}", fallback sang RAM:`, err);
      }
    }
  }

  return checkMemoryRateLimit(key, max, windowMs);
}

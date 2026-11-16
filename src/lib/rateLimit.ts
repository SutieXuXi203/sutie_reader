import { RateLimit } from '@/models/RateLimit';
import { getRedisClient } from './redis';

export interface AttemptResult {
  /** false nếu khóa đã có hiệu lực TRƯỚC lượt này — không được xử lý tiếp yêu cầu */
  allowed: boolean;
  /** true nếu sau lượt này khóa đang có hiệu lực */
  locked: boolean;
  attempts: number;
  remaining: number;
  retryAfterMinutes: number;
}

export interface AttemptOptions {
  max?: number;
  lockMs?: number;
}

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_LOCK_MS = 15 * 60 * 1000;
const EPOCH = new Date(0);

function toMinutes(lockUntil: Date, now: Date): number {
  return Math.max(1, Math.ceil((lockUntil.getTime() - now.getTime()) / 60000));
}

// Lua script thực thi nguyên tử trên Redis cho consumeAttempt
const CONSUME_ATTEMPT_LUA = `
local lockKey = KEYS[1]
local attKey = KEYS[2]
local max = tonumber(ARGV[1])
local lockMs = tonumber(ARGV[2])

-- 1. Kiểm tra xem có đang bị khóa không (prior lock)
local lockTtl = redis.call('PTTL', lockKey)
if lockTtl > 0 then
  local retryMinutes = math.max(1, math.ceil(lockTtl / 60000))
  return {0, 1, max, 0, retryMinutes}
end

-- 2. Tăng số lượt thử
local attempts = redis.call('INCR', attKey)
if attempts == 1 then
  redis.call('PEXPIRE', attKey, lockMs)
end

-- 3. Kiểm tra xem sau lượt thử này có đạt ngưỡng khóa không
if attempts >= max then
  redis.call('PSETEX', lockKey, lockMs, '1')
  redis.call('DEL', attKey)
  local retryMinutes = math.max(1, math.ceil(lockMs / 60000))
  return {1, 1, attempts, 0, retryMinutes}
else
  local remaining = math.max(0, max - attempts)
  return {1, 0, attempts, remaining, 0}
end
`;

/**
 * Ghi nhận MỘT lượt thử một cách nguyên tử (không đọc-rồi-ghi) TRƯỚC khi kiểm tra thông tin xác thực.
 *
 * - Ưu tiên xử lý trên Redis: Đạt tốc độ < 1ms, chặn đứng brute-force và giảm 100% gánh nặng IOPS lên MongoDB.
 * - Tự động fallback sang MongoDB một cách an toàn nếu chưa cấu hình Redis hoặc kết nối gặp sự cố.
 */
export async function consumeAttempt(
  key: string,
  { max = DEFAULT_MAX_ATTEMPTS, lockMs = DEFAULT_LOCK_MS }: AttemptOptions = {}
): Promise<AttemptResult> {
  const client = getRedisClient();

  if (client) {
    try {
      const lockKey = `rl:lock:${key}`;
      const attKey = `rl:att:${key}`;
      const res = (await client.eval(
        CONSUME_ATTEMPT_LUA,
        2,
        lockKey,
        attKey,
        max,
        lockMs
      )) as [number, number, number, number, number];

      return {
        allowed: res[0] === 1,
        locked: res[1] === 1,
        attempts: Number(res[2]),
        remaining: Number(res[3]),
        retryAfterMinutes: Number(res[4]),
      };
    } catch (err) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`[RATELIMIT WARN] Lỗi Redis consumeAttempt cho key "${key}", fallback sang MongoDB:`, err);
      }
    }
  }

  // Fallback sang MongoDB
  const hasLock = { $gt: [{ $ifNull: ['$lockUntil', EPOCH] }, EPOCH] };
  const isLocked = { $gt: [{ $ifNull: ['$lockUntil', EPOCH] }, '$$NOW'] };

  const pipeline = [
    {
      $set: {
        attempts: {
          $cond: [
            isLocked,
            { $ifNull: ['$attempts', max] },
            { $cond: [hasLock, 1, { $add: [{ $ifNull: ['$attempts', 0] }, 1] }] },
          ],
        },
        createdAt: { $ifNull: ['$createdAt', '$$NOW'] },
      },
    },
    {
      $set: {
        lockUntil: {
          $cond: [
            isLocked,
            '$lockUntil',
            { $cond: [{ $gte: ['$attempts', max] }, { $add: ['$$NOW', lockMs] }, '$$REMOVE'] },
          ],
        },
      },
    },
  ];

  const collection = RateLimit.collection;
  let before = null as { attempts?: number; lockUntil?: Date } | null;

  for (let attempt = 0; ; attempt++) {
    try {
      before = (await collection.findOneAndUpdate({ ip: key }, pipeline, {
        upsert: true,
        returnDocument: 'before',
      })) as typeof before;
      break;
    } catch (error) {
      // Hai request đầu tiên cùng upsert một khóa mới -> một bên nhận E11000, thử lại sẽ khớp bản ghi vừa tạo
      const code = (error as { code?: number }).code;
      if (code === 11000 && attempt < 3) continue;
      throw error;
    }
  }

  const now = new Date();
  const priorLock = before?.lockUntil instanceof Date ? before.lockUntil : null;

  if (priorLock && priorLock > now) {
    return {
      allowed: false,
      locked: true,
      attempts: before?.attempts ?? max,
      remaining: 0,
      retryAfterMinutes: toMinutes(priorLock, now),
    };
  }

  const attempts = priorLock ? 1 : (before?.attempts ?? 0) + 1;
  const locked = attempts >= max;

  return {
    allowed: true,
    locked,
    attempts,
    remaining: Math.max(0, max - attempts),
    retryAfterMinutes: locked ? Math.ceil(lockMs / 60000) : 0,
  };
}

/** Xóa bộ đếm khi xác thực thành công */
export async function resetAttempts(key: string): Promise<void> {
  const client = getRedisClient();
  const promises: Promise<unknown>[] = [RateLimit.collection.deleteOne({ ip: key }).catch(() => {})];

  if (client) {
    promises.push(client.del(`rl:lock:${key}`, `rl:att:${key}`).catch(() => {}));
  }

  await Promise.all(promises);
}

/** Chỉ kiểm tra có đang bị khóa hay không (không tăng bộ đếm) */
export async function getLockStatus(key: string): Promise<{ locked: boolean; retryAfterMinutes: number }> {
  const client = getRedisClient();
  if (client) {
    try {
      const ttl = await client.pttl(`rl:lock:${key}`);
      if (ttl > 0) {
        return { locked: true, retryAfterMinutes: Math.max(1, Math.ceil(ttl / 60000)) };
      }
      return { locked: false, retryAfterMinutes: 0 };
    } catch {
      // Fallback xuống MongoDB
    }
  }

  const doc = (await RateLimit.collection.findOne({ ip: key })) as { lockUntil?: Date } | null;
  const now = new Date();
  if (doc?.lockUntil instanceof Date && doc.lockUntil > now) {
    return { locked: true, retryAfterMinutes: toMinutes(doc.lockUntil, now) };
  }
  return { locked: false, retryAfterMinutes: 0 };
}

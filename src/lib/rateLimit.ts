import { RateLimit } from '@/models/RateLimit';

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

/**
 * Ghi nhận MỘT lượt thử một cách nguyên tử (không đọc-rồi-ghi) TRƯỚC khi kiểm tra thông tin xác thực.
 *
 * Vì lượt thử được tính trước và nguyên tử trên MongoDB, N request song song chỉ có tối đa `max` request
 * được `allowed`; phần còn lại bị khóa — không thể "gom" nhiều lần đoán vào một lần đếm.
 * Dùng `resetAttempts` khi xác thực thành công.
 */
export async function consumeAttempt(
  key: string,
  { max = DEFAULT_MAX_ATTEMPTS, lockMs = DEFAULT_LOCK_MS }: AttemptOptions = {}
): Promise<AttemptResult> {
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
  await RateLimit.collection.deleteOne({ ip: key });
}

/** Chỉ kiểm tra có đang bị khóa hay không (không tăng bộ đếm) */
export async function getLockStatus(key: string): Promise<{ locked: boolean; retryAfterMinutes: number }> {
  const doc = (await RateLimit.collection.findOne({ ip: key })) as { lockUntil?: Date } | null;
  const now = new Date();
  if (doc?.lockUntil instanceof Date && doc.lockUntil > now) {
    return { locked: true, retryAfterMinutes: toMinutes(doc.lockUntil, now) };
  }
  return { locked: false, retryAfterMinutes: 0 };
}

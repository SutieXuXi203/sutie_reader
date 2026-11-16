import { createHash } from 'node:crypto';
import { decodeJwt } from 'jose';
import { connectDB } from '@/lib/db';
import { RevokedToken } from '@/models/RevokedToken';
import { getRedisClient, redisSet, redisDel } from './redis';

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 32);
}

/** Thời điểm hết hạn của JWT (không xác thực chữ ký: chỉ để biết khi nào có thể xóa bản ghi thu hồi) */
function tokenExpiry(token: string, fallbackSeconds: number): Date {
  try {
    const exp = decodeJwt(token).exp;
    if (typeof exp === 'number') {
      // Cộng đệm 1 giờ để lệch đồng hồ không làm bản ghi biến mất trước khi token hết hạn thật
      return new Date(exp * 1000 + 60 * 60 * 1000);
    }
  } catch {
    // Không đọc được exp -> dùng thời hạn tối đa của phiên
  }
  return new Date(Date.now() + fallbackSeconds * 1000);
}

/**
 * Thu hồi token (Token Blacklist):
 * - Ghi vào Redis (kiểm tra nhanh, dùng chung giữa các instance) VÀ vào MongoDB (bền vững: vẫn đúng khi Redis không cấu hình,
 *   bị khởi động lại hoặc mất dữ liệu).
 * - Xóa luôn cache phiên của token trong Redis.
 */
export async function revokeToken(token?: string | null, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<void> {
  if (!token) return;
  const hash = hashToken(token);

  await Promise.all([
    redisSet(`blacklist:token:${hash}`, '1', ttlSeconds * 1000),
    redisDel(`session:user:${hash}`),
    (async () => {
      try {
        await connectDB();
        await RevokedToken.updateOne(
          { tokenHash: hash },
          { $set: { expiresAt: tokenExpiry(token, ttlSeconds) } },
          { upsert: true }
        );
      } catch (error) {
        console.warn('[tokenBlacklist] không ghi được thu hồi vào MongoDB:', error instanceof Error ? error.message : error);
      }
    })(),
  ]);
}

/** Tra danh sách thu hồi bền vững trong MongoDB (lỗi DB => coi là chưa thu hồi, giống hành vi cũ khi không có Redis) */
export async function isTokenRevokedInDb(token?: string | null): Promise<boolean> {
  if (!token) return true;
  try {
    await connectDB();
    return Boolean(await RevokedToken.exists({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } }));
  } catch {
    return false;
  }
}

/**
 * Kiểm tra token đã bị thu hồi hay chưa.
 * - Redis có phản hồi: dùng Redis (nhanh). Redis chưa cấu hình / lỗi: tra MongoDB.
 * - `durable: true`: luôn tra thêm MongoDB (dùng cho các route hiếm gặp đúc token mới: refresh, đổi hồ sơ).
 */
export async function isTokenRevoked(
  token?: string | null,
  { durable = false }: { durable?: boolean } = {}
): Promise<boolean> {
  if (!token) return true;

  let redisAnswered = false;
  const client = getRedisClient();
  if (client) {
    try {
      const value = await client.get(`blacklist:token:${hashToken(token)}`);
      if (value === '1') return true;
      redisAnswered = true;
    } catch {
      // Redis lỗi tạm thời -> rơi xuống MongoDB
    }
  }

  if (durable || !redisAnswered) {
    return isTokenRevokedInDb(token);
  }
  return false;
}

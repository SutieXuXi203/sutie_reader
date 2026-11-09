import { createHash } from 'node:crypto';
import { redisGet, redisSet, redisDel } from './redis';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 32);
}

/**
 * Thu hồi token (Token Blacklist):
 * Lưu hash của token vào Redis để vô hiệu hóa tức thì khi đăng xuất hoặc đổi mật khẩu.
 */
export async function revokeToken(token?: string | null, ttlSeconds = 7 * 24 * 60 * 60): Promise<void> {
  if (!token) return;
  const hash = hashToken(token);

  await Promise.all([
    redisSet(`blacklist:token:${hash}`, '1', ttlSeconds * 1000),
    redisDel(`session:user:${hash}`),
  ]);
}

/**
 * Kiểm tra xem token có nằm trong danh sách đen bị thu hồi hay không.
 * Trả về false nếu chưa cấu hình Redis (Graceful Fallback).
 */
export async function isTokenRevoked(token?: string | null): Promise<boolean> {
  if (!token) return true;
  const res = await redisGet(`blacklist:token:${hashToken(token)}`);
  return res === '1';
}


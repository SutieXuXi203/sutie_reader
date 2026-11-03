import crypto from 'node:crypto';

type BcryptLike = {
  hash(data: string, rounds: number): Promise<string>;
  compare(data: string, hash: string): Promise<boolean>;
};

let cached: BcryptLike | null = null;

/**
 * Ưu tiên `bcrypt` native (chạy trên thread pool của libuv, không làm nghẽn event loop).
 * Nếu không nạp được binary (môi trường lạ), tự động lùi về `bcryptjs` thuần JS. Hai thư viện dùng chung định dạng hash.
 */
async function getBcrypt(): Promise<BcryptLike> {
  if (cached) return cached;
  try {
    const native = await import('bcrypt');
    cached = (native.default ?? native) as BcryptLike;
  } catch {
    const js = await import('bcryptjs');
    cached = (js.default ?? js) as BcryptLike;
  }
  return cached;
}

export async function hashPassword(password: string, rounds = 12): Promise<string> {
  return (await getBcrypt()).hash(password, rounds);
}

export async function verifyPassword(password: string, hash: string | undefined | null): Promise<boolean> {
  if (!hash) return false;
  return (await getBcrypt()).compare(password, hash);
}

/** So sánh chuỗi bí mật theo thời gian không đổi (kể cả khi độ dài khác nhau) */
export function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

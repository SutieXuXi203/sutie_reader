import Redis from 'ioredis';

const globalWithRedis = globalThis as typeof globalThis & {
  sutieRedisClient?: Redis | null;
  sutieRedisInitAttempted?: boolean;
};

/**
 * Lấy singleton Redis client.
 * Trả về null nếu chưa cấu hình REDIS_URL hoặc kết nối thất bại (Graceful Fallback).
 */
export function getRedisClient(): Redis | null {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    return null;
  }

  if (globalWithRedis.sutieRedisClient) {
    return globalWithRedis.sutieRedisClient;
  }

  try {
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      connectTimeout: 5_000,
      lazyConnect: false,
      retryStrategy(times) {
        if (times > 3) return null; // Ngừng thử lại nếu lỗi liên tiếp > 3 lần
        return Math.min(times * 200, 1000);
      },
    });

    client.on('error', (err) => {
      // Bắt lỗi kết nối để không làm sập Node.js process
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[REDIS WARN] Lỗi kết nối Redis:', err.message);
      }
    });

    globalWithRedis.sutieRedisClient = client;
    return client;
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[REDIS WARN] Không thể khởi tạo Redis client:', err);
    }
    return null;
  }
}

/**
 * Kiểm tra xem Redis có sẵn sàng xử lý lệnh hay không.
 */
export async function isRedisAvailable(): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;

  try {
    const pong = await client.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

/**
 * Đọc giá trị string từ Redis, trả về null nếu không tìm thấy hoặc Redis không khả dụng.
 */
export async function redisGet(key: string): Promise<string | null> {
  const client = getRedisClient();
  if (!client) return null;

  try {
    return await client.get(key);
  } catch (err) {
    console.warn(`[REDIS WARN] get("${key}") thất bại:`, err);
    return null;
  }
}

/**
 * Ghi giá trị string vào Redis kèm thời hạn sống (TTL tính bằng mili-giây).
 */
export async function redisSet(key: string, value: string, ttlMs?: number): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;

  try {
    if (ttlMs && ttlMs > 0) {
      await client.set(key, value, 'PX', ttlMs);
    } else {
      await client.set(key, value);
    }
    return true;
  } catch (err) {
    console.warn(`[REDIS WARN] set("${key}") thất bại:`, err);
    return false;
  }
}

/**
 * Xóa một hoặc nhiều key trong Redis.
 */
export async function redisDel(...keys: string[]): Promise<number> {
  const validKeys = keys.filter(Boolean);
  if (validKeys.length === 0) return 0;

  const client = getRedisClient();
  if (!client) return 0;

  try {
    return await client.del(...validKeys);
  } catch (err) {
    console.warn(`[REDIS WARN] del(${validKeys.join(', ')}) thất bại:`, err);
    return 0;
  }
}

/**
 * Xóa các key khớp với pattern bằng lệnh SCAN để không làm nghẽn Redis server.
 */
export async function redisDelByPattern(pattern: string): Promise<number> {
  const client = getRedisClient();
  if (!client) return 0;

  try {
    let cursor = '0';
    let totalDeleted = 0;

    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        const deleted = await client.del(...keys);
        totalDeleted += deleted;
      }
    } while (cursor !== '0');

    return totalDeleted;
  } catch (err) {
    console.warn(`[REDIS WARN] delByPattern("${pattern}") thất bại:`, err);
    return 0;
  }
}

/**
 * Đóng kết nối Redis (dùng cho cleanup khi test hoặc shutdown).
 */
export async function closeRedis(): Promise<void> {
  if (globalWithRedis.sutieRedisClient) {
    try {
      await globalWithRedis.sutieRedisClient.quit();
    } catch {
      globalWithRedis.sutieRedisClient.disconnect();
    }
    globalWithRedis.sutieRedisClient = null;
  }
}


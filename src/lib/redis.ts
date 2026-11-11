import Redis from 'ioredis';

const globalWithRedis = globalThis as typeof globalThis & {
  sutieRedisClient?: Redis | null;
  sutieRedisInitAttempted?: boolean;
};

// Cảnh báo Telegram khi Redis mất kết nối: tối đa 1 lần / 10 phút để không spam
const REDIS_ALERT_INTERVAL_MS = 10 * 60 * 1000;
let redisAlertedAt = 0;

function reportRedisProblem(err: Error) {
  const now = Date.now();
  if (redisAlertedAt > 0 && now - redisAlertedAt < REDIS_ALERT_INTERVAL_MS) return;
  redisAlertedAt = now;
  void import('./telegramLogger')
    .then((m) =>
      m.logApiError({
        module: 'Redis',
        error: err,
        metadata: { impact: 'Rate limit, cache và blacklist dùng chung đang chạy ở chế độ dự phòng (RAM/MongoDB theo từng instance)' },
        statusCode: 500,
      })
    )
    .catch(() => undefined);
}

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
      // Mỗi lệnh có giới hạn thời gian: Redis treo không được làm treo request người dùng (đã có đường dự phòng RAM/MongoDB)
      commandTimeout: 2_000,
      lazyConnect: false,
      // KHÔNG BAO GIỜ bỏ cuộc: trả về null sẽ khiến client vào trạng thái 'end' vĩnh viễn (tới khi process khởi động lại),
      // khi đó rate limit/blacklist/cache dùng chung âm thầm mất tác dụng. Chờ tăng dần, tối đa 5 giây giữa các lần thử.
      retryStrategy(times) {
        return Math.min(times * 200, 5_000);
      },
    });

    client.on('error', (err) => {
      // Bắt lỗi kết nối để không làm sập Node.js process
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[REDIS WARN] Lỗi kết nối Redis:', err.message);
        reportRedisProblem(err);
      }
    });

    client.on('ready', () => {
      if (redisAlertedAt > 0 && process.env.NODE_ENV !== 'test') {
        console.log('[REDIS] Đã kết nối lại Redis');
        redisAlertedAt = 0;
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
 * Thêm member vào Redis SET và đặt/làm mới hạn dùng của cả SET (dùng làm chỉ mục: user -> các khóa cache của họ).
 */
export async function redisSAdd(setKey: string, member: string, ttlMs: number): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;
  try {
    await client.multi().sadd(setKey, member).pexpire(setKey, ttlMs).exec();
    return true;
  } catch (err) {
    console.warn(`[REDIS WARN] sadd("${setKey}") thất bại:`, err);
    return false;
  }
}

/**
 * Lấy toàn bộ member của Redis SET rồi xóa SET đó. Trả về mảng rỗng nếu không có Redis hoặc lỗi.
 */
export async function redisPopSet(setKey: string): Promise<string[]> {
  const client = getRedisClient();
  if (!client) return [];
  try {
    const res = await client.multi().smembers(setKey).del(setKey).exec();
    const members = res?.[0]?.[1];
    return Array.isArray(members) ? (members as string[]) : [];
  } catch (err) {
    console.warn(`[REDIS WARN] popSet("${setKey}") thất bại:`, err);
    return [];
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


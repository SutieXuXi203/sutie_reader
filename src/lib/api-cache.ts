import { redisGet, redisSet, redisDelByPattern } from './redis';

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

type ApiCacheStore = Map<string, CacheEntry<unknown>>;

const MAX_ENTRIES = 2_000;

const globalWithApiCache = globalThis as typeof globalThis & {
  sutieApiCache?: ApiCacheStore;
};

const apiCache: ApiCacheStore = globalWithApiCache.sutieApiCache ?? new Map();
globalWithApiCache.sutieApiCache = apiCache;

function getMemoryCache<T>(key: string): T | null {
  const entry = apiCache.get(key);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    apiCache.delete(key);
    return null;
  }

  return entry.value as T;
}

function evictIfFull() {
  if (apiCache.size < MAX_ENTRIES) return;

  const now = Date.now();
  for (const [key, entry] of apiCache) {
    if (entry.expiresAt <= now) apiCache.delete(key);
  }

  // Vẫn đầy sau khi dọn mục hết hạn: bỏ các mục cũ nhất (Map giữ thứ tự chèn)
  while (apiCache.size >= MAX_ENTRIES) {
    const oldest = apiCache.keys().next().value;
    if (oldest === undefined) break;
    apiCache.delete(oldest);
  }
}

function setMemoryCache<T>(key: string, value: T, ttlMs: number) {
  apiCache.delete(key);
  evictIfFull();
  apiCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

function invalidateMemoryCache(prefix: string) {
  for (const key of apiCache.keys()) {
    if (key.startsWith(prefix)) {
      apiCache.delete(key);
    }
  }
}

/**
 * Đọc dữ liệu từ cache:
 * 1. Kiểm tra RAM cache nội bộ (L1) -> nếu có và chưa hết hạn thì trả về ngay (0ms).
 * 2. Nếu RAM không có, kiểm tra Redis (L2) -> nếu có, lưu lại vào RAM L1 và trả về.
 * 3. Nếu không có ở cả 2, trả về null.
 */
export async function getApiCache<T>(key: string): Promise<T | null> {
  const memoryVal = getMemoryCache<T>(key);
  if (memoryVal !== null) {
    return memoryVal;
  }

  const redisVal = await redisGet(key);
  if (redisVal !== null) {
    try {
      const parsed = JSON.parse(redisVal) as T;
      setMemoryCache(key, parsed, 10_000);
      return parsed;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Ghi dữ liệu vào cache:
 * - Lưu đồng thời vào RAM L1 và Redis L2 (nếu có cấu hình REDIS_URL).
 */
export async function setApiCache<T>(key: string, value: T, ttlMs: number): Promise<void> {
  setMemoryCache(key, value, ttlMs);
  try {
    const serialized = JSON.stringify(value);
    await redisSet(key, serialized, ttlMs);
  } catch (err) {
    console.warn(`[CACHE WARN] Không thể tuần tự hóa key ${key} lên Redis:`, err);
  }
}

/**
 * Xóa cache theo tiền tố (prefix):
 * - Dọn sạch RAM L1 của instance này.
 * - Phát lệnh xóa SCAN & DEL trên Redis L2 để toàn bộ các serverless instances khác đều thấy ngay lập tức.
 */
export async function invalidateApiCache(prefix: string): Promise<void> {
  invalidateMemoryCache(prefix);
  await redisDelByPattern(prefix + '*');
}

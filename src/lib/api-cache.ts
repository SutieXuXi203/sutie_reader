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

export function getApiCache<T>(key: string): T | null {
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

export function setApiCache<T>(key: string, value: T, ttlMs: number) {
  apiCache.delete(key);
  evictIfFull();
  apiCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

export function invalidateApiCache(prefix: string) {
  for (const key of apiCache.keys()) {
    if (key.startsWith(prefix)) {
      apiCache.delete(key);
    }
  }
}

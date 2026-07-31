type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

type ApiCacheStore = Map<string, CacheEntry<unknown>>;

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

export function setApiCache<T>(key: string, value: T, ttlMs: number) {
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

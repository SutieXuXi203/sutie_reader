/**
 * Cache RAM cho ảnh đã xáo trộn.
 *
 * Kết quả xáo trộn chỉ phụ thuộc vào file id (seed do server suy ra từ id), giống hệt nhau cho mọi người đọc.
 * Mỗi lần tính lại tốn ~0,5–1,5 giây CPU (giải mã + mã hóa WebP lossless) nên:
 *  - Người đọc thứ hai (hoặc tải lại trang) lấy ngay từ RAM.
 *  - Nhiều người cùng mở một chương mới ở cùng thời điểm chỉ kích hoạt MỘT lần tính toán cho mỗi ảnh.
 *
 * ⚠️ Cache này chỉ được đọc SAU khi route đã xác thực và kiểm tra quyền truy cập ảnh. Không dùng để thay thế phân quyền.
 */

const DEFAULT_MAX_MB = 192;
const ENTRY_TTL_MS = 60 * 60 * 1000;

type Entry = { buffer: Buffer; expiresAt: number };

type CacheState = {
  entries: Map<string, Entry>;
  inflight: Map<string, Promise<Buffer>>;
  bytes: number;
};

const globalWithCache = globalThis as typeof globalThis & { sutieScrambledImageCache?: CacheState };

const state: CacheState =
  globalWithCache.sutieScrambledImageCache ?? { entries: new Map(), inflight: new Map(), bytes: 0 };
globalWithCache.sutieScrambledImageCache = state;

/** SCRAMBLED_IMAGE_CACHE_MB=0 để tắt cache */
function getMaxBytes(): number {
  const raw = process.env.SCRAMBLED_IMAGE_CACHE_MB;
  const mb = raw === undefined || raw === '' ? NaN : Number(raw);
  return (Number.isFinite(mb) && mb >= 0 ? mb : DEFAULT_MAX_MB) * 1024 * 1024;
}

function removeEntry(key: string) {
  const entry = state.entries.get(key);
  if (!entry) return;
  state.bytes -= entry.buffer.length;
  state.entries.delete(key);
}

export function getCachedScrambled(key: string): Buffer | null {
  const entry = state.entries.get(key);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    removeEntry(key);
    return null;
  }

  // LRU: đưa mục vừa dùng xuống cuối Map (Map giữ thứ tự chèn nên mục đầu tiên là mục lâu không dùng nhất)
  state.entries.delete(key);
  state.entries.set(key, entry);
  return entry.buffer;
}

function storeScrambled(key: string, buffer: Buffer) {
  const maxBytes = getMaxBytes();
  if (maxBytes === 0 || buffer.length > maxBytes / 2) return;

  removeEntry(key);
  while (state.bytes + buffer.length > maxBytes) {
    const oldest = state.entries.keys().next().value;
    if (oldest === undefined) break;
    removeEntry(oldest);
  }

  state.entries.set(key, { buffer, expiresAt: Date.now() + ENTRY_TTL_MS });
  state.bytes += buffer.length;
}

/**
 * Lấy ảnh đã xáo trộn từ cache; nếu chưa có thì gọi `produce` đúng một lần cho tất cả các request đang chờ cùng khóa.
 * Nếu `produce` ném lỗi, lỗi được chia sẻ cho các request đang chờ và KHÔNG được cache (lần sau thử lại).
 */
export async function getOrCreateScrambled(key: string, produce: () => Promise<Buffer>): Promise<Buffer> {
  const cached = getCachedScrambled(key);
  if (cached) return cached;

  const running = state.inflight.get(key);
  if (running) return running;

  const promise = (async () => {
    try {
      const buffer = await produce();
      storeScrambled(key, buffer);
      return buffer;
    } finally {
      state.inflight.delete(key);
    }
  })();

  state.inflight.set(key, promise);
  return promise;
}

/** Chỉ dùng trong test */
export function clearScrambledImageCache() {
  state.entries.clear();
  state.inflight.clear();
  state.bytes = 0;
}

export function getScrambledImageCacheStats() {
  return { entries: state.entries.size, bytes: state.bytes, inflight: state.inflight.size };
}

type Bucket = { count: number; resetAt: number };

const MAX_BUCKETS = 5_000;
const store = new Map<string, Bucket>();

function sweep(now: number) {
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
  // Nếu vẫn quá lớn sau khi dọn mục hết hạn, bỏ các mục cũ nhất (Map giữ thứ tự chèn)
  while (store.size >= MAX_BUCKETS) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

/**
 * Giới hạn tần suất theo cửa sổ cố định, lưu trong RAM của instance hiện tại.
 * Chỉ dùng cho bảo vệ chống lạm dụng nhẹ (không thay thế cho khóa brute-force trong DB).
 */
export function checkMemoryRateLimit(
  key: string,
  max: number,
  windowMs: number
): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    if (store.size >= MAX_BUCKETS) sweep(now);
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  current.count += 1;
  if (current.count <= max) {
    return { allowed: true, retryAfter: 0 };
  }

  return { allowed: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
}

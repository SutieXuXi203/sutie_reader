const PLACEHOLDER_ORIGIN = 'http://safe-redirect.invalid';

/**
 * Chỉ cho phép chuyển hướng tới đường dẫn nội bộ (cùng origin).
 *
 * Trình duyệt/URL parser loại bỏ các ký tự điều khiển (tab, xuống dòng) nên `/\t/evil.com` thực tế là `//evil.com`.
 * Vì vậy từ chối mọi chuỗi chứa ký tự điều khiển hoặc dấu gạch chéo ngược, rồi xác nhận lại bằng URL parser.
 */
export function getSafeCallbackUrl(url: string | null | undefined, fallback = '/'): string {
  if (!url || typeof url !== 'string') return fallback;

  const candidate = url.trim();
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(candidate)) return fallback;

  try {
    const parsed = new URL(candidate, PLACEHOLDER_ORIGIN);
    if (parsed.origin !== PLACEHOLDER_ORIGIN) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

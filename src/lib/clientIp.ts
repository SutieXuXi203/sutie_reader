const IP_PATTERN = /^[0-9a-fA-F:.]{2,45}$/;

function getTrustedProxyCount(): number {
  const raw = Number(process.env.TRUSTED_PROXY_COUNT);
  return Number.isInteger(raw) && raw >= 1 && raw <= 10 ? raw : 1;
}

/**
 * Lấy IP client từ header proxy một cách chống giả mạo.
 *
 * Client có thể tự gửi `X-Forwarded-For`, nhưng mỗi proxy tin cậy sẽ *nối thêm* IP nó thấy vào CUỐI danh sách.
 * Vì vậy lấy phần tử thứ N tính từ cuối (N = TRUSTED_PROXY_COUNT, mặc định 1) thay vì phần tử đầu tiên.
 */
export function getClientIp(headers: Pick<Headers, 'get'>): string {
  const forwardedFor = headers.get('x-forwarded-for');
  let candidate = '';

  if (forwardedFor) {
    const parts = forwardedFor
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      const index = Math.max(0, parts.length - getTrustedProxyCount());
      candidate = parts[index];
    }
  }

  if (!candidate) {
    candidate = (headers.get('x-real-ip') || '').trim();
  }

  return IP_PATTERN.test(candidate) ? candidate : 'unknown';
}

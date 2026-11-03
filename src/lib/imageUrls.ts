/**
 * Chuẩn hóa danh sách ảnh admin gửi lên: bỏ chuỗi truy vấn của URL đã ký (`sig`, `exp`, `sub`) để không lưu
 * vào DB các URL có chữ ký hết hạn.
 */
export function normalizeImages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((img): img is string => typeof img === 'string')
    .map((img) => {
      const trimmed = img.trim();
      if (!trimmed) return '';
      try {
        const parsed = new URL(trimmed, 'https://dummy.com');
        if (parsed.searchParams.has('sig')) {
          parsed.search = '';
          return parsed.origin === 'https://dummy.com' ? parsed.pathname : parsed.toString();
        }
      } catch {
        // giữ nguyên chuỗi gốc
      }
      return trimmed;
    })
    .filter(Boolean);
}

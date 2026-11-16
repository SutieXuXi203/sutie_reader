export type PageItem = number | 'ellipsis-start' | 'ellipsis-end';

/**
 * Tạo danh sách số trang để hiển thị, có dấu "…" khi quá nhiều trang.
 * Luôn hiện trang đầu, trang cuối và `siblings` trang quanh trang hiện tại.
 * Ví dụ (total=20, current=10, siblings=1): 1 … 9 10 11 … 20
 */
export function getPageItems(current: number, total: number, siblings = 1): PageItem[] {
  if (total < 1) return [];
  const safeCurrent = Math.min(Math.max(1, current), total);

  // Số ô tối đa: đầu + cuối + current + 2*siblings + 2 ô dấu "…"
  const maxSlots = siblings * 2 + 5;
  if (total <= maxSlots) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const left = Math.max(safeCurrent - siblings, 1);
  const right = Math.min(safeCurrent + siblings, total);
  const showLeftEllipsis = left > 2;
  const showRightEllipsis = right < total - 1;

  const range = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => from + i);

  if (!showLeftEllipsis && showRightEllipsis) {
    const count = siblings * 2 + 3;
    return [...range(1, count), 'ellipsis-end', total];
  }
  if (showLeftEllipsis && !showRightEllipsis) {
    const count = siblings * 2 + 3;
    return [1, 'ellipsis-start', ...range(total - count + 1, total)];
  }
  return [1, 'ellipsis-start', ...range(left, right), 'ellipsis-end', total];
}

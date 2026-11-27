/**
 * Địa chỉ gốc công khai của site, dùng cho og:image, metadataBase, sitemap, robots.
 *
 * KHÔNG dùng `VERCEL_URL` làm ưu tiên: đó là URL riêng của từng bản deploy
 * (vd. sutie-reader-abc123-team.vercel.app) và bị Vercel Deployment Protection chặn
 * bằng trang đăng nhập SSO → Discord/Facebook/Zalo không tải được ảnh xem trước.
 *
 * Thứ tự: NEXT_PUBLIC_SITE_URL → VERCEL_PROJECT_PRODUCTION_URL (tên miền production,
 * công khai) → VERCEL_URL → localhost.
 */
export function getSiteUrl(env: Record<string, string | undefined> = process.env): string {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  const production = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${production.replace(/\/+$/, '')}`;

  const deployment = env.VERCEL_URL?.trim();
  if (deployment) return `https://${deployment.replace(/\/+$/, '')}`;

  return 'http://localhost:3000';
}

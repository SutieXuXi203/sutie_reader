import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getSiteUrl } from './siteUrl';

describe('getSiteUrl (URL gốc cho og:image / sitemap)', () => {
  it('ưu tiên NEXT_PUBLIC_SITE_URL và bỏ dấu / ở cuối', () => {
    assert.equal(
      getSiteUrl({ NEXT_PUBLIC_SITE_URL: 'https://lubu-reader.vercel.app/', VERCEL_URL: 'x-abc.vercel.app' }),
      'https://lubu-reader.vercel.app'
    );
  });

  it('dùng tên miền production thay vì URL riêng của bản deploy (bị Vercel SSO chặn)', () => {
    assert.equal(
      getSiteUrl({
        VERCEL_PROJECT_PRODUCTION_URL: 'lubu-reader.vercel.app',
        VERCEL_URL: 'sutie-reader-qs026qk8n-team.vercel.app',
      }),
      'https://lubu-reader.vercel.app'
    );
  });

  it('chỉ rơi về VERCEL_URL khi không có lựa chọn nào khác', () => {
    assert.equal(getSiteUrl({ VERCEL_URL: 'x-abc.vercel.app' }), 'https://x-abc.vercel.app');
  });

  it('mặc định localhost khi chạy local', () => {
    assert.equal(getSiteUrl({}), 'http://localhost:3000');
  });
});

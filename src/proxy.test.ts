import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { proxy } from './proxy';

const SECRET = 'proxy-test-secret-proxy-test-secret-1234';
const PIN = '123456';
const originalEnv = { UNLOCK_PIN: process.env.UNLOCK_PIN, JWT_SECRET: process.env.JWT_SECRET };

function request(path: string, cookie?: string) {
  return new NextRequest(`http://localhost:3000${path}`, { headers: cookie ? { cookie } : {} });
}

function sign(payload: Record<string, unknown>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(SECRET));
}

const isRedirectTo = (res: Response, path: string) =>
  res.status === 307 && new URL(res.headers.get('location') || '').pathname === path;

describe('proxy.ts (cổng PIN và trang quản trị) — chạy mã thật', () => {
  before(() => {
    process.env.UNLOCK_PIN = PIN;
    process.env.JWT_SECRET = SECRET;
  });

  after(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key as keyof typeof originalEnv];
      else process.env[key as keyof typeof originalEnv] = value;
    }
  });

  it('KHÔNG chấp nhận cookie site_access_token là mã PIN plaintext (chống dò PIN không giới hạn)', async () => {
    const res = await proxy(request('/anything', `site_access_token=${PIN}`));
    assert.ok(isRedirectTo(res, '/unlock'), 'PIN plaintext phải bị chuyển về /unlock');
  });

  it('chấp nhận site_access_token là JWT hợp lệ có scope site_unlock', async () => {
    const token = await sign({ scope: 'site_unlock' });
    const res = await proxy(request('/anything', `site_access_token=${token}`));
    assert.equal(res.status, 200);
  });

  it('từ chối JWT sai scope (token phiên đăng nhập không dùng làm site token)', async () => {
    const token = await sign({ id: 'u1', email: 'a@gmail.com', role: 'admin' });
    const res = await proxy(request('/anything', `site_access_token=${token}`));
    assert.ok(isRedirectTo(res, '/unlock'));
  });

  it('/posts/*, /, /contact là trang công khai có chủ đích (không bị cổng PIN)', async () => {
    for (const path of ['/', '/posts/abc', '/contact']) {
      const res = await proxy(request(path));
      assert.equal(res.status, 200, `${path} phải đi qua`);
    }
  });

  it('đường dẫn có dấu chấm KHÔNG còn được miễn kiểm tra: /admin/x.y vẫn bị chặn nếu chưa đăng nhập', async () => {
    const res = await proxy(request('/admin/x.y'));
    assert.ok(isRedirectTo(res, '/'));
  });

  it('tệp tĩnh thật sự (png, css...) đi qua', async () => {
    for (const path of ['/logo.png', '/robots.txt', '/fonts/a.woff2']) {
      const res = await proxy(request(path));
      assert.equal(res.status, 200, `${path} phải đi qua`);
    }
  });

  it('/admin: token không phải admin được chuyển qua /api/auth/refresh, token hỏng về trang chủ', async () => {
    const userToken = await sign({ id: 'u1', role: 'user' });
    const refresh = await proxy(request('/admin', `token=${userToken}`));
    assert.ok(isRedirectTo(refresh, '/api/auth/refresh'));

    const broken = await proxy(request('/admin', 'token=not-a-jwt'));
    assert.ok(isRedirectTo(broken, '/'));

    const adminToken = await sign({ id: 'a1', role: 'admin' });
    const siteToken = await sign({ scope: 'site_unlock' });
    const ok = await proxy(request('/admin', `token=${adminToken}; site_access_token=${siteToken}`));
    assert.equal(ok.status, 200);
  });

  it('khi không cấu hình UNLOCK_PIN thì không chặn', async () => {
    delete process.env.UNLOCK_PIN;
    try {
      const res = await proxy(request('/anything'));
      assert.equal(res.status, 200);
    } finally {
      process.env.UNLOCK_PIN = PIN;
    }
  });
});

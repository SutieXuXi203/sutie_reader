/**
 * Kiểm thử tích hợp: thu hồi phiên (logout) + og-image không lộ chương bị khóa.
 * Cần MongoDB VÀ Redis dùng riêng cho test:
 *   MONGODB_TEST_URI=mongodb://127.0.0.1:27017/sutie_test REDIS_TEST_URL=redis://127.0.0.1:6379 npm run test:integration
 * CẢNH BÁO: database trong MONGODB_TEST_URI bị xóa sau khi chạy; các khóa Redis `blacklist:token:*`/`session:user:*` được tạo thêm.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import sharp from 'sharp';

// Cơ sở dữ liệu RIÊNG (thêm hậu tố) vì node:test chạy các file song song và mỗi file xóa database của mình khi kết thúc
const [baseUri, uriQuery] = (process.env.MONGODB_TEST_URI || '').split('?');
const MONGO_URI = baseUri ? `${baseUri}_revocation${uriQuery ? `?${uriQuery}` : ''}` : undefined;
const REDIS_URL = process.env.REDIS_TEST_URL;
const skip = MONGO_URI && REDIS_URL ? false : 'MONGODB_TEST_URI và REDIS_TEST_URL chưa được đặt';

const JWT_SECRET = 'revocation-secret-revocation-secret-1234';

function req(method: string, path: string, opts: { cookie?: string; body?: unknown; ip?: string } = {}) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': opts.ip ?? '203.0.113.9',
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
    },
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
  });
}

const tokenCookie = (set: string | null) => /(?:^|[\s,])token=([^;]+)/.exec(set || '')?.[1];

describe('Tích hợp: thu hồi phiên và og-image', { skip }, () => {
  const realFetch = globalThis.fetch;
  let mongoose: typeof import('mongoose').default;
  let sign: (u: { _id: unknown; email: string; name: string; role: string }) => Promise<string>;

  before(async () => {
    process.env.MONGODB_URI = MONGO_URI;
    process.env.REDIS_URL = REDIS_URL;
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.CLOUDFLARE_WORKER_URL = 'https://worker.test';
    process.env.IMAGE_SIGNING_SECRET = 'revocation-signing';
    delete process.env.UNLOCK_PIN;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.ADMIN_USERNAME;
    delete process.env.TEST_USERNAME;

    const png = await sharp({ create: { width: 900, height: 1300, channels: 3, background: '#a33' } }).png().toBuffer();
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith('https://worker.test/')) {
        return new Response(new Uint8Array(png), { status: 200, headers: { 'content-type': 'image/png' } });
      }
      return realFetch(input, init);
    }) as typeof fetch;

    mongoose = (await import('mongoose')).default;
    await (await import('@/lib/db')).connectDB();
    const secret = new TextEncoder().encode(JWT_SECRET);
    sign = (u) =>
      new SignJWT({ id: String(u._id), email: u.email, name: u.name, role: u.role })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(secret);
  });

  after(async () => {
    globalThis.fetch = realFetch;
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    await (await import('@/lib/redis')).closeRedis();
  });

  it('token đã đăng xuất không dùng được nữa: /api/auth/me, /api/auth/refresh, PUT /api/auth/me đều từ chối và không đúc token mới', async () => {
    const { User } = await import('@/models/User');
    const admin = await User.create({
      email: 'revoke-admin@gmail.com',
      password: 'x'.repeat(10),
      name: 'Revoke Admin',
      role: 'admin',
      isVerified: true,
    });
    const cookie = `token=${await sign(admin)}`;
    const me = await import('@/app/api/auth/me/route');
    const refresh = await import('@/app/api/auth/refresh/route');

    // Trước khi đăng xuất: phiên hợp lệ, refresh và PUT hoạt động
    assert.ok((await (await me.GET(req('GET', '/api/auth/me', { cookie }))).json()).user);

    const logout = await (await import('@/app/api/auth/logout/route')).POST(req('POST', '/api/auth/logout', { cookie }));
    assert.equal(logout.status, 200);

    // Cache RAM của chính instance này đã được xóa bởi revokeToken: không cần chờ 15 giây
    const after = await (await me.GET(req('GET', '/api/auth/me', { cookie }))).json();
    assert.equal(after.user, null, 'GET /api/auth/me phải coi token là không hợp lệ ngay lập tức');

    const refreshed = await refresh.GET(req('GET', '/api/auth/refresh?callbackUrl=/admin', { cookie }));
    assert.equal(tokenCookie(refreshed.headers.get('set-cookie')), undefined, 'refresh không được cấp token mới');
    assert.equal(new URL(refreshed.headers.get('location') || '', 'http://localhost:3000').pathname, '/');

    const put = await me.PUT(req('PUT', '/api/auth/me', { cookie, body: { name: 'Revoke Admin' } }));
    assert.equal(put.status, 401);
    assert.equal(tokenCookie(put.headers.get('set-cookie')), undefined, 'PUT không được cấp token mới');
  });

  it('đăng xuất một phiên không ảnh hưởng token khác của cùng người dùng (đăng nhập lại vẫn dùng được)', async () => {
    const { User } = await import('@/models/User');
    const user = await User.create({
      email: 'revoke-user@gmail.com',
      password: 'x'.repeat(10),
      name: 'Revoke User',
      role: 'user',
      isVerified: true,
    });
    const oldCookie = `token=${await sign(user)}`;
    await new Promise((resolve) => setTimeout(resolve, 1100)); // iat khác nhau => token khác nhau
    const newCookie = `token=${await sign(user)}`;
    assert.notEqual(oldCookie, newCookie);

    await (await import('@/app/api/auth/logout/route')).POST(req('POST', '/api/auth/logout', { cookie: oldCookie }));

    const me = await import('@/app/api/auth/me/route');
    assert.equal((await (await me.GET(req('GET', '/api/auth/me', { cookie: oldCookie }))).json()).user, null);
    assert.ok((await (await me.GET(req('GET', '/api/auth/me', { cookie: newCookie }))).json()).user, 'token mới vẫn hợp lệ');
  });

  it('/api/og-image không trả ảnh của chương bị restricted (post.images là bản sao chương 1)', async () => {
    const { Post } = await import('@/models/Post');
    const ROUTE = await import('@/app/api/og-image/[postId]/route');
    const ogRequest = (id: string, ip: string) => ({
      request: new NextRequest(`http://localhost:3000/api/og-image/${id}`, { headers: { 'x-forwarded-for': ip } }),
      ctx: { params: Promise.resolve({ postId: id }) },
    });

    const allLocked = await Post.create({
      title: 'OG all locked',
      accessType: 'public',
      author: 'a',
      images: ['RESTRICTEDCHAP1IMG0001'],
      chapters: [{ title: 'Ch1', chapterNumber: 1, accessType: 'restricted', images: ['RESTRICTEDCHAP1IMG0001'] }],
    });
    const a = ogRequest(String(allLocked._id), '198.51.100.7');
    assert.equal((await ROUTE.GET(a.request, a.ctx)).status, 404, 'không có chương công khai => không có ảnh bìa');

    const mixed = await Post.create({
      title: 'OG mixed',
      accessType: 'public',
      author: 'a',
      images: ['RESTRICTEDCHAP1IMG0001'],
      chapters: [
        { title: 'Ch1', chapterNumber: 1, accessType: 'restricted', images: ['RESTRICTEDCHAP1IMG0001'] },
        { title: 'Ch2', chapterNumber: 2, accessType: 'inherit', images: ['PUBLICCHAP2IMG00002'] },
      ],
    });
    const seen: string[] = [];
    const wrapped = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      seen.push(url);
      return wrapped(input, init);
    }) as typeof fetch;
    try {
      const m = ogRequest(String(mixed._id), '198.51.100.8');
      assert.equal((await ROUTE.GET(m.request, m.ctx)).status, 200);
    } finally {
      globalThis.fetch = wrapped;
    }
    assert.ok(seen.some((u) => u.includes('/image/PUBLICCHAP2IMG00002')), 'phải lấy ảnh của chương công khai');
    assert.ok(!seen.some((u) => u.includes('RESTRICTEDCHAP1IMG0001')), 'tuyệt đối không tải ảnh chương bị khóa');
  });
});

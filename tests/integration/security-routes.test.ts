/**
 * Kiểm thử tích hợp: gọi TRỰC TIẾP route handler thật trên MongoDB thật (Drive/Worker được giả lập bằng stub fetch).
 *
 * Chạy:  MONGODB_TEST_URI=mongodb://127.0.0.1:27017/sutie_test npm run test:integration
 * Không có MONGODB_TEST_URI thì toàn bộ file được bỏ qua (npm test thông thường không cần MongoDB).
 * CẢNH BÁO: dữ liệu trong database đó bị xóa — chỉ dùng database dành riêng cho test.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import sharp from 'sharp';

const TEST_URI = process.env.MONGODB_TEST_URI;
const skip = TEST_URI ? false : 'MONGODB_TEST_URI chưa được đặt';

const JWT_SECRET = 'integration-secret-integration-secret-1234';
const WORKER = 'https://worker.test';

type RouteContext<T> = { params: Promise<T> };

function jsonRequest(path: string, body: unknown, ip: string, cookie?: string) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

const statuses = (results: number[]) =>
  results.reduce<Record<number, number>>((acc, status) => {
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

async function makeOriginalImage() {
  const width = 800;
  const height = 1200;
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      raw[i] = Math.floor((x / width) * 255);
      raw[i + 1] = Math.floor((y / height) * 255);
      raw[i + 2] = ((x >> 5) + (y >> 5)) % 2 ? 40 : 200;
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

describe('Tích hợp: route handler thật + MongoDB', { skip }, () => {
  const realFetch = globalThis.fetch;
  let original: Buffer;
  let mongoose: typeof import('mongoose').default;
  let tokenFor: (user: { _id: unknown; email: string; name: string; role: string }) => Promise<string>;

  before(async () => {
    process.env.MONGODB_URI = TEST_URI;
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.UNLOCK_PIN = '123456';
    process.env.CLOUDFLARE_WORKER_URL = WORKER;
    process.env.IMAGE_SIGNING_SECRET = 'integration-signing-secret';
    process.env.IMAGE_RATE_LIMIT_MAX = '100000';
    delete process.env.ADMIN_USERNAME;
    delete process.env.TEST_USERNAME;
    delete process.env.TELEGRAM_BOT_TOKEN;

    original = await makeOriginalImage();
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith(`${WORKER}/`)) {
        return new Response(new Uint8Array(original), { status: 200, headers: { 'content-type': 'image/png' } });
      }
      return realFetch(input, init);
    }) as typeof fetch;

    mongoose = (await import('mongoose')).default;
    const { connectDB } = await import('@/lib/db');
    await connectDB();
    const { RateLimit } = await import('@/models/RateLimit');
    const { User } = await import('@/models/User');
    const { Post } = await import('@/models/Post');
    await Promise.all([RateLimit.init(), User.init(), Post.init()]);

    const secret = new TextEncoder().encode(JWT_SECRET);
    tokenFor = (user) =>
      new SignJWT({ id: String(user._id), email: user.email, name: user.name, role: user.role })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(secret);
  });

  after(async () => {
    globalThis.fetch = realFetch;
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('consumeAttempt: N lượt song song chỉ có đúng 5 lượt được xử lý, khóa 15 phút', async () => {
    const { consumeAttempt, resetAttempts } = await import('@/lib/rateLimit');
    const results = await Promise.all(Array.from({ length: 60 }, () => consumeAttempt('it:atomic')));
    assert.equal(results.filter((r) => r.allowed).length, 5);
    assert.equal(results.filter((r) => r.allowed && r.locked).length, 1, 'chỉ lượt thứ 5 kích hoạt khóa');
    await resetAttempts('it:atomic');
    assert.equal((await consumeAttempt('it:atomic')).allowed, true, 'reset xong dùng lại được');
  });

  it('consumeAttempt: sau khi khóa hết hạn bộ đếm được làm lại (không khóa oan sau 1 lần sai)', async () => {
    const { consumeAttempt } = await import('@/lib/rateLimit');
    const { RateLimit } = await import('@/models/RateLimit');
    for (let i = 0; i < 5; i++) await consumeAttempt('it:expiry');
    assert.equal((await consumeAttempt('it:expiry')).allowed, false);
    await RateLimit.updateOne({ ip: 'it:expiry' }, { $set: { lockUntil: new Date(Date.now() - 1000) } });
    const after = await consumeAttempt('it:expiry');
    assert.equal(after.allowed, true);
    assert.equal(after.attempts, 1);
    assert.equal(after.locked, false);
  });

  it('đăng nhập: 30 lần sai song song không "gom" được thành 1 lần đếm và không gây 500', async () => {
    const { User } = await import('@/models/User');
    const { hashPassword } = await import('@/lib/password');
    await User.create({
      email: 'victim@gmail.com',
      password: await hashPassword('CorrectHorse1', 10),
      name: 'Victim',
      role: 'guest',
      isVerified: true,
    });
    const { POST } = await import('@/app/api/auth/login/route');

    const results = await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        POST(jsonRequest('/api/auth/login', { email: 'victim@gmail.com', password: `wrong${i}` }, '9.9.9.9')).then((r) => r.status)
      )
    );
    const tally = statuses(results);
    assert.equal(tally[500] ?? 0, 0, JSON.stringify(tally));
    assert.ok((tally[401] ?? 0) <= 4, `tối đa 4 lần 401 trước khi khóa: ${JSON.stringify(tally)}`);

    const correct = await POST(jsonRequest('/api/auth/login', { email: 'victim@gmail.com', password: 'CorrectHorse1' }, '9.9.9.9'));
    assert.equal(correct.status, 429, 'đã bị khóa thì mật khẩu đúng cũng phải chờ');
  });

  it('đăng nhập: xoay X-Forwarded-For của client không vượt được khóa (IP lấy từ proxy tin cậy)', async () => {
    const { POST } = await import('@/app/api/auth/login/route');
    const codes: number[] = [];
    for (let i = 0; i < 8; i++) {
      // client tự thêm IP giả ở đầu; proxy tin cậy luôn nối IP thật (cố định) vào cuối
      const res = await POST(jsonRequest('/api/auth/login', { email: 'victim@gmail.com', password: `bad${i}` }, `10.0.0.${i}, 8.8.8.8`));
      codes.push(res.status);
    }
    assert.ok(codes.includes(429), codes.join(','));
  });

  it('mở khóa PIN: 200 PIN sai song song rồi PIN đúng vẫn bị khóa (không dò được PIN)', async () => {
    const { POST } = await import('@/app/api/unlock/route');
    const wrong = Array.from({ length: 200 }, (_, i) => String(100000 + i));
    const results = await Promise.all(wrong.map((pin) => POST(jsonRequest('/api/unlock', { pin }, '7.7.7.7')).then((r) => r.status)));
    const tally = statuses(results);
    assert.equal(tally[500] ?? 0, 0, JSON.stringify(tally));
    assert.equal(tally[200] ?? 0, 0);
    assert.ok((tally[401] ?? 0) <= 4, JSON.stringify(tally));

    const right = await POST(jsonRequest('/api/unlock', { pin: '123456' }, '7.7.7.7'));
    assert.equal(right.status, 429);
  });

  it('mở khóa PIN: PIN đúng được chấp nhận và cấp cookie JWT (không phải plaintext)', async () => {
    const { POST } = await import('@/app/api/unlock/route');
    const res = await POST(jsonRequest('/api/unlock', { pin: '123456' }, '6.6.6.6'));
    assert.equal(res.status, 200);
    const cookie = res.headers.get('set-cookie') || '';
    assert.match(cookie, /site_access_token=[\w-]+\.[\w-]+\.[\w-]+/);
    assert.ok(!cookie.includes('site_access_token=123456'));
  });

  it('xác thực OTP: 60 mã sai song song không vượt quá 5 lượt và mã bị vô hiệu', async () => {
    const { User } = await import('@/models/User');
    await User.create({
      email: 'otp@gmail.com',
      password: 'xxxxxx',
      name: 'Otp',
      role: 'guest',
      isVerified: false,
      verificationCode: '654321',
      verificationAttempts: 0,
      verificationExpiresAt: new Date(Date.now() + 600_000),
    });
    const { POST } = await import('@/app/api/auth/verify/route');
    const codes = Array.from({ length: 60 }, (_, i) => String(100000 + i));
    const results = await Promise.all(
      codes.map((code) => POST(jsonRequest('/api/auth/verify', { email: 'otp@gmail.com', code }, '4.4.4.4')).then((r) => r.status))
    );
    const tally = statuses(results);
    assert.ok((tally[400] ?? 0) <= 4, JSON.stringify(tally));

    const right = await POST(jsonRequest('/api/auth/verify', { email: 'otp@gmail.com', code: '654321' }, '4.4.4.4'));
    assert.notEqual(right.status, 200, 'mã đã bị vô hiệu thì mã đúng cũng không dùng được');
    const user = await User.findOne({ email: 'otp@gmail.com' }).lean<{ isVerified: boolean }>();
    assert.equal(user?.isVerified, false);
  });

  describe('route ảnh /api/image/[id] và API bài viết', () => {
    let guestToken: string;
    let adminToken: string;
    let ids: { pub: string; res: string; mix: string; race: string };

    const img = (id: string) => `${WORKER}/image/${id}`;

    async function getImage(id: string, query: string, token = guestToken) {
      const { GET } = await import('@/app/api/image/[id]/route');
      const request = new NextRequest(`http://localhost:3000/api/image/${id}.webp${query}`, {
        headers: { cookie: `token=${token}`, 'x-forwarded-for': '1.1.1.1' },
      });
      const response = await GET(request, { params: Promise.resolve({ id: `${id}.webp` }) } as RouteContext<{ id: string }>);
      return { status: response.status, headers: response.headers, body: Buffer.from(await response.arrayBuffer()) };
    }

    const clearAccessCache = () => (globalThis as { sutieApiCache?: Map<string, unknown> }).sutieApiCache?.clear();

    before(async () => {
      const { User } = await import('@/models/User');
      const { Post } = await import('@/models/Post');
      const guest = await User.create({ email: 'guest@gmail.com', password: 'xxxxxx', name: 'Guest', role: 'guest', isVerified: true });
      const admin = await User.create({ email: 'admin@gmail.com', password: 'xxxxxx', name: 'Admin', role: 'admin', isVerified: true });
      guestToken = await tokenFor(guest);
      adminToken = await tokenFor(admin);

      const pub = await Post.create({ title: 'Public', accessType: 'public', chapters: [{ title: 'c1', chapterNumber: 1, images: [img('PUBLICIMG0001')] }] });
      const res = await Post.create({ title: 'Restricted', accessType: 'restricted', chapters: [{ title: 'c1', chapterNumber: 1, images: [img('RESTRICTEDIMG1')] }] });
      const mix = await Post.create({
        title: 'Mixed',
        accessType: 'restricted',
        chapters: [
          { title: 'preview', chapterNumber: 1, accessType: 'public', images: [img('PREVIEWIMG001')] },
          { title: 'locked', chapterNumber: 2, accessType: 'inherit', images: [img('LOCKEDIMG0002')] },
        ],
      });
      const race = await Post.create({ title: 'Race', accessType: 'public', chapters: [{ title: 'c1', chapterNumber: 1, images: [img('RACEIMG00001')] }] });
      ids = { pub: String(pub._id), res: String(res._id), mix: String(mix._id), race: String(race._id) };
    });

    it('guest bị chặn ảnh truyện restricted (có và không có pid đúng)', async () => {
      clearAccessCache();
      assert.equal((await getImage('RESTRICTEDIMG1', `?pid=${ids.res}`)).status, 403);
      assert.equal((await getImage('RESTRICTEDIMG1', '')).status, 403);
    });

    it('IDOR: không dùng được pid của bài công khai để đọc ảnh bài restricted', async () => {
      clearAccessCache();
      assert.equal((await getImage('RESTRICTEDIMG1', `?pid=${ids.pub}`)).status, 403);
    });

    it('thumb=1 không còn bỏ qua kiểm quyền', async () => {
      clearAccessCache();
      assert.equal((await getImage('RESTRICTEDIMG1', '?thumb=1')).status, 403);
      assert.equal((await getImage('RESTRICTEDIMG1', `?thumb=1&pid=${ids.pub}`)).status, 403);
    });

    it('cache quyền theo từng ảnh: xem ảnh preview không mở khóa ảnh chương bị khóa và ngược lại', async () => {
      clearAccessCache();
      assert.equal((await getImage('PREVIEWIMG001', `?pid=${ids.mix}`)).status, 200);
      assert.equal((await getImage('LOCKEDIMG0002', `?pid=${ids.mix}`)).status, 403);

      clearAccessCache();
      assert.equal((await getImage('LOCKEDIMG0002', `?pid=${ids.mix}`)).status, 403);
      assert.equal((await getImage('PREVIEWIMG001', `?pid=${ids.mix}`)).status, 200, 'bị từ chối ảnh khác không được làm hỏng ảnh preview');
    });

    it('ảnh truyện công khai được xáo trộn, không bằng ảnh gốc; seed/rows/cols từ client bị bỏ qua', async () => {
      clearAccessCache();
      const normal = await getImage('PUBLICIMG0001', `?pid=${ids.pub}`);
      assert.equal(normal.status, 200);
      assert.match(normal.headers.get('content-type') || '', /image\/webp/);
      assert.match(normal.headers.get('cache-control') || '', /private/);
      assert.ok(!normal.body.equals(original));

      const tampered = await getImage('PUBLICIMG0001', `?pid=${ids.pub}&seed=attacker&rows=2&cols=2`);
      assert.ok(tampered.body.equals(normal.body), 'seed/rows/cols do client không được ảnh hưởng kết quả');
    });

    it('fail-closed: lỗi DB khi kiểm quyền trả 503, không cho phép', async () => {
      clearAccessCache();
      const { Post } = await import('@/models/Post');
      const originalFindById = Post.findById;
      (Post as unknown as { findById: unknown }).findById = () => {
        throw new Error('simulated db outage');
      };
      try {
        assert.equal((await getImage('PUBLICIMG0001', `?pid=${ids.pub}`)).status, 503);
      } finally {
        (Post as unknown as { findById: unknown }).findById = originalFindById;
      }
    });

    it('API bài viết không lộ URL Worker (ảnh gốc chưa xáo trộn) cho người dùng', async () => {
      const route = await import('@/app/api/posts/[id]/route');
      const response = await route.GET(
        new NextRequest(`http://localhost:3000/api/posts/${ids.pub}`, { headers: { cookie: `token=${guestToken}` } }),
        { params: Promise.resolve({ id: ids.pub }) }
      );
      const json = (await response.json()) as { chapters: { images: string[] }[] };
      const urls = json.chapters.flatMap((chapter) => chapter.images);
      assert.ok(urls.length > 0);
      for (const url of urls) {
        assert.ok(url.startsWith('/api/image/'), url);
        assert.ok(!url.includes('worker.test') && !url.includes('sig='), url);
      }
    });

    it('thêm chương song song: số chương luôn duy nhất, không mất chương', async () => {
      const { POST } = await import('@/app/api/posts/[id]/chapters/route');
      const { Post } = await import('@/models/Post');
      const K = 8;
      const results = await Promise.all(
        Array.from({ length: K }, (_, i) =>
          POST(
            jsonRequest(`/api/posts/${ids.race}/chapters`, { title: `new${i}`, images: [img(`NEWIMG${String(i).padStart(6, '0')}`)] }, '2.2.2.2', `token=${adminToken}`),
            { params: Promise.resolve({ id: ids.race }) }
          ).then((r) => r.status)
        )
      );
      assert.ok(results.every((status) => status === 200), results.join(','));

      const post = await Post.findById(ids.race).lean<{ chapters: { chapterNumber: number }[] }>();
      const numbers = (post?.chapters ?? []).map((c) => c.chapterNumber).sort((a, b) => a - b);
      assert.deepEqual(numbers, Array.from({ length: K + 1 }, (_, i) => i + 1));
    });

    it('thêm chương với số đã tồn tại -> 409', async () => {
      const { POST } = await import('@/app/api/posts/[id]/chapters/route');
      const res = await POST(
        jsonRequest(`/api/posts/${ids.race}/chapters`, { chapterNumber: 1, images: [img('DUPLICATE0001')] }, '2.2.2.2', `token=${adminToken}`),
        { params: Promise.resolve({ id: ids.race }) }
      );
      assert.equal(res.status, 409);
    });

    it('ghi nhận người đọc song song không tạo bản ghi trùng', async () => {
      const { POST } = await import('@/app/api/posts/[id]/access/route');
      const { Post } = await import('@/models/Post');
      await Promise.all(
        Array.from({ length: 10 }, () =>
          POST(jsonRequest(`/api/posts/${ids.pub}/access`, {}, '3.3.3.3', `token=${guestToken}`), { params: Promise.resolve({ id: ids.pub }) })
        )
      );
      const post = await Post.findById(ids.pub).lean<{ accessedUsers: { email: string }[] }>();
      assert.equal(post?.accessedUsers.filter((u) => u.email === 'guest@gmail.com').length, 1);
    });
  });
});

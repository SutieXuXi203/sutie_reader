/**
 * Kiểm thử tích hợp Phase B: tra ảnh bằng index, bookmark gọn, thu hồi token bền vững, tag bằng updateMany,
 * xóa cache phiên theo người dùng (cần Redis).
 *
 *   MONGODB_TEST_URI=mongodb://127.0.0.1:27017/sutie_test [REDIS_TEST_URL=redis://127.0.0.1:6379] npm run test:integration
 * CẢNH BÁO: database `<MONGODB_TEST_URI>_phaseb` bị xóa sau khi chạy.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import sharp from 'sharp';

const [baseUri, uriQuery] = (process.env.MONGODB_TEST_URI || '').split('?');
const MONGO_URI = baseUri ? `${baseUri}_phaseb${uriQuery ? `?${uriQuery}` : ''}` : undefined;
const REDIS_URL = process.env.REDIS_TEST_URL;
const skip = MONGO_URI ? false : 'MONGODB_TEST_URI chưa được đặt';

const JWT_SECRET = 'phase-b-secret-phase-b-secret-phase-b-1234';
const WORKER = 'https://worker.test';
const img = (id: string) => `${WORKER}/image/${id}`;

function req(method: string, path: string, opts: { cookie?: string; body?: unknown; ip?: string } = {}) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': opts.ip ?? '203.0.113.50',
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
    },
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
  });
}

describe('Tích hợp Phase B', { skip }, () => {
  const realFetch = globalThis.fetch;
  let mongoose: typeof import('mongoose').default;
  let sign: (u: { _id: unknown; email: string; name: string; role: string }) => Promise<string>;
  let guestCookie: string;
  let adminCookie: string;
  let guestId: string;
  const queries: string[] = [];

  before(async () => {
    process.env.MONGODB_URI = MONGO_URI;
    if (REDIS_URL) process.env.REDIS_URL = REDIS_URL;
    else delete process.env.REDIS_URL;
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.CLOUDFLARE_WORKER_URL = WORKER;
    process.env.IMAGE_SIGNING_SECRET = 'phase-b-signing';
    process.env.IMAGE_RATE_LIMIT_MAX = '100000';
    delete process.env.UNLOCK_PIN;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.ADMIN_USERNAME;
    delete process.env.TEST_USERNAME;

    const png = await sharp({ create: { width: 900, height: 1300, channels: 3, background: '#357' } }).png().toBuffer();
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith(`${WORKER}/`)) {
        return new Response(new Uint8Array(png), { status: 200, headers: { 'content-type': 'image/png' } });
      }
      return realFetch(input, init);
    }) as typeof fetch;

    mongoose = (await import('mongoose')).default;
    await (await import('@/lib/db')).connectDB();
    const { Post } = await import('@/models/Post');
    const { User } = await import('@/models/User');
    const { RevokedToken } = await import('@/models/RevokedToken');
    await Promise.all([Post.init(), User.init(), RevokedToken.init()]);

    mongoose.set('debug', (collection: string, method: string, ...args: unknown[]) => {
      queries.push(`${collection}.${method} ${JSON.stringify(args)}`);
    });

    const secret = new TextEncoder().encode(JWT_SECRET);
    sign = (u) =>
      new SignJWT({ id: String(u._id), email: u.email, name: u.name, role: u.role })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(secret);

    const guest = await User.create({ email: 'pb-guest@gmail.com', password: 'x'.repeat(10), name: 'PB Guest', role: 'guest', isVerified: true });
    const admin = await User.create({ email: 'pb-admin@gmail.com', password: 'x'.repeat(10), name: 'PB Admin', role: 'admin', isVerified: true });
    guestId = String(guest._id);
    guestCookie = `token=${await sign(guest)}`;
    adminCookie = `token=${await sign(admin)}`;
  });

  after(async () => {
    globalThis.fetch = realFetch;
    mongoose.set('debug', false);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    await (await import('@/lib/redis')).closeRedis();
  });

  describe('tra ảnh → bài viết bằng index (imageIds)', () => {
    const getImage = async (id: string, query = '') => {
      const { GET } = await import('@/app/api/image/[id]/route');
      const res = await GET(
        new NextRequest(`http://localhost:3000/api/image/${id}.webp${query}`, { headers: { cookie: guestCookie, 'x-forwarded-for': '203.0.113.60' } }),
        { params: Promise.resolve({ id: `${id}.webp` }) }
      );
      return res.status;
    };
    const clearAccessCache = () => (globalThis as { sutieApiCache?: Map<string, unknown> }).sutieApiCache?.clear();

    it('Post lưu imageIds (không lộ ra khi đọc thường) và truy vấn theo imageIds dùng IXSCAN', async () => {
      const { Post } = await import('@/models/Post');
      const post = await Post.create({
        title: 'Indexed',
        accessType: 'public',
        images: [img('IDXCOVERIMG001')],
        chapters: [
          { title: 'c1', chapterNumber: 1, images: [img('IDXCOVERIMG001'), `/api/image/IDXCHAPIMG0002.webp?v=2&pid=x`] },
          { title: 'c2', chapterNumber: 2, images: ['IDXRAWIDIMG0003'] },
        ],
      });

      const plain = await Post.findById(post._id).lean();
      assert.equal((plain as { imageIds?: unknown }).imageIds, undefined, 'imageIds là select:false');
      const withIds = await Post.findById(post._id).select('+imageIds').lean<{ imageIds: string[] }>();
      assert.deepEqual([...withIds!.imageIds].sort(), ['IDXCHAPIMG0002', 'IDXCOVERIMG001', 'IDXRAWIDIMG0003']);

      const plan = JSON.stringify(await Post.find({ imageIds: 'IDXCHAPIMG0002' }).explain('queryPlanner'));
      assert.match(plan, /IXSCAN/);
      assert.doesNotMatch(plan, /COLLSCAN/);
    });

    it('backfillImageIds điền bài cũ chưa có imageIds (mọi dạng URL) và chạy lại không đổi gì', async () => {
      const { Post } = await import('@/models/Post');
      const { backfillImageIds } = await import('@/lib/imageIndex');
      const inserted = await Post.collection.insertOne({
        title: 'Legacy',
        accessType: 'restricted',
        images: [img('LEGACYCOVER001')],
        chapters: [{ title: 'c1', chapterNumber: 1, images: [img('LEGACYCOVER001'), img('LEGACYPAGE0002')] }],
      });
      const before = await Post.collection.findOne({ _id: inserted.insertedId });
      assert.equal(before?.imageIds, undefined);

      assert.ok((await backfillImageIds()) >= 1);
      const after = await Post.collection.findOne({ _id: inserted.insertedId });
      assert.deepEqual([...(after?.imageIds as string[])].sort(), ['LEGACYCOVER001', 'LEGACYPAGE0002']);
      assert.equal(await backfillImageIds(), 0, 'idempotent');
    });

    it('guest: ảnh bài restricted bị chặn, ảnh bài công khai được phép, kể cả KHÔNG có pid — và không có truy vấn $regex', async () => {
      const { Post } = await import('@/models/Post');
      const { resetImageIndexState, getImageIndexStatus } = await import('@/lib/imageIndex');
      await Post.create({ title: 'R', accessType: 'restricted', chapters: [{ title: 'c', chapterNumber: 1, images: [img('RESTRICTPAGE001')] }] });
      await Post.create({ title: 'P', accessType: 'public', chapters: [{ title: 'c', chapterNumber: 1, images: [img('PUBLICPAGE0001')] }] });

      // Làm cho trạng thái index là 'ready' (mọi bài đã có imageIds) rồi chờ nền hoàn tất
      resetImageIndexState();
      getImageIndexStatus();
      for (let i = 0; i < 50 && getImageIndexStatus() !== 'ready'; i++) await new Promise((r) => setTimeout(r, 50));
      assert.equal(getImageIndexStatus(), 'ready');

      clearAccessCache();
      queries.length = 0;
      assert.equal(await getImage('RESTRICTPAGE001', ''), 403);
      assert.equal(await getImage('PUBLICPAGE0001', ''), 200);
      assert.equal(await getImage('UNKNOWNIMAGE999', ''), 403, 'id không thuộc bài nào');
      assert.ok(!queries.some((q) => q.includes('$regex')), `không được quét $regex:\n${queries.filter((q) => q.includes('$regex')).join('\n')}`);
    });

    it('ảnh nằm trong nhiều bài: được phép nếu BẤT KỲ bài chứa nó cho phép', async () => {
      const { Post } = await import('@/models/Post');
      await Post.create({ title: 'Shared-R', accessType: 'restricted', chapters: [{ title: 'c', chapterNumber: 1, images: [img('SHAREDIMG00001')] }] });
      await Post.create({ title: 'Shared-P', accessType: 'public', chapters: [{ title: 'c', chapterNumber: 1, images: [img('SHAREDIMG00001')] }] });
      clearAccessCache();
      assert.equal(await getImage('SHAREDIMG00001', ''), 200);
    });

    it('POST chương mới đăng ký id ảnh (bài đã có imageIds) và KHÔNG tạo imageIds thiếu cho bài cũ', async () => {
      const { Post } = await import('@/models/Post');
      const { POST } = await import('@/app/api/posts/[id]/chapters/route');
      const modern = await Post.create({ title: 'Modern', accessType: 'restricted', chapters: [{ title: 'c1', chapterNumber: 1, images: [img('MODERNPAGE0001')] }] });
      const legacy = await Post.collection.insertOne({
        title: 'Legacy2',
        accessType: 'restricted',
        images: [img('OLDPAGEIMG0001')],
        chapters: [{ title: 'c1', chapterNumber: 1, images: [img('OLDPAGEIMG0001')] }],
      });

      for (const [id, newImg] of [[String(modern._id), 'MODERNPAGE0002'], [String(legacy.insertedId), 'OLDPAGEIMG0002']] as const) {
        const res = await POST(req('POST', `/api/posts/${id}/chapters`, { cookie: adminCookie, body: { title: 'c2', images: [img(newImg)] } }), {
          params: Promise.resolve({ id }),
        });
        assert.equal(res.status, 200);
      }

      const m = await Post.findById(modern._id).select('+imageIds').lean<{ imageIds: string[] }>();
      assert.deepEqual([...m!.imageIds].sort(), ['MODERNPAGE0001', 'MODERNPAGE0002']);

      const l = await Post.collection.findOne({ _id: legacy.insertedId });
      assert.equal(l?.imageIds, undefined, 'bài cũ chưa backfill thì để backfill điền đủ (không tạo mảng thiếu)');
      const { backfillImageIds } = await import('@/lib/imageIndex');
      await backfillImageIds();
      const l2 = await Post.collection.findOne({ _id: legacy.insertedId });
      assert.deepEqual([...(l2?.imageIds as string[])].sort(), ['OLDPAGEIMG0001', 'OLDPAGEIMG0002']);
    });
  });

  describe('danh sách và bookmark', () => {
    it('bookmark: ảnh bìa có pid và phản hồi không chứa dữ liệu chương', async () => {
      const { Post } = await import('@/models/Post');
      const { POST, GET } = await import('@/app/api/bookmarks/route');
      const post = await Post.create({
        title: 'Bookmarked',
        accessType: 'public',
        chapters: [{ title: 'c1', chapterNumber: 1, content: 'SECRETTEXT', images: [img('BOOKMARKIMG001')] }],
      });
      const saved = await POST(req('POST', '/api/bookmarks', { cookie: guestCookie, body: { postId: String(post._id), chapterIndex: 0, currentPage: 3, totalPages: 10 } }));
      assert.equal(saved.status, 200);

      queries.length = 0;
      const res = await GET(req('GET', '/api/bookmarks', { cookie: guestCookie }));
      const body = (await res.json()) as Array<{ post: { images: string[] } }>;
      assert.equal(body.length, 1);
      assert.match(body[0].post.images[0], new RegExp(`pid=${String(post._id)}`));
      assert.ok(!JSON.stringify(body).includes('SECRETTEXT'));
      const pipeline = queries.find((q) => q.startsWith('comics.aggregate')) || '';
      assert.match(pipeline, /\$map/, 'pipeline chỉ giữ trường quyền của chương');
    });
  });

  describe('thu hồi token bền vững (không cần Redis)', () => {
    it('revokeToken ghi vào MongoDB: token bị từ chối ngay cả khi không có Redis, bản ghi có hạn TTL', async () => {
      const { User } = await import('@/models/User');
      const { RevokedToken } = await import('@/models/RevokedToken');
      const u = await User.create({ email: 'pb-revoke@gmail.com', password: 'x'.repeat(10), name: 'PB Revoke', role: 'user', isVerified: true });
      const cookie = `token=${await sign(u)}`;
      const token = cookie.slice('token='.length);

      const me = await import('@/app/api/auth/me/route');
      assert.ok((await (await me.GET(req('GET', '/api/auth/me', { cookie }))).json()).user);

      const logout = await import('@/app/api/auth/logout/route');
      assert.equal((await logout.POST(req('POST', '/api/auth/logout', { cookie }))).status, 200);

      assert.equal((await (await me.GET(req('GET', '/api/auth/me', { cookie }))).json()).user, null);
      const { isTokenRevoked } = await import('@/lib/tokenBlacklist');
      assert.equal(await isTokenRevoked(token), true);
      assert.equal(await isTokenRevoked(token, { durable: true }), true);

      const doc = await RevokedToken.findOne().sort({ _id: -1 }).lean();
      assert.ok(doc && doc.expiresAt.getTime() > Date.now(), 'bản ghi có hạn trong tương lai (TTL index dọn sau khi token hết hạn)');
      const indexes = await RevokedToken.collection.indexes();
      assert.ok(indexes.some((i) => i.expireAfterSeconds === 0), 'có TTL index');
    });
  });

  describe('tag: updateMany thay cho tải + save từng bài', () => {
    it('đổi tên tag: không trùng lặp, không phân biệt hoa thường, giữ các tag khác và cập nhật updatedAt', async () => {
      const { Post } = await import('@/models/Post');
      const { Tag } = await import('@/models/Tag');
      const { PUT } = await import('@/app/api/tags/route');
      await Tag.create({ name: 'action' });
      const a = await Post.create({ title: 'T1', tags: ['action', 'drama'], chapters: [{ title: 'c', chapterNumber: 1, content: 'x' }] });
      const b = await Post.create({ title: 'T2', tags: ['Action', 'adventure'], chapters: [{ title: 'c', chapterNumber: 1, content: 'x' }] });
      const c = await Post.create({ title: 'T3', tags: ['comedy'], chapters: [{ title: 'c', chapterNumber: 1, content: 'x' }] });
      const beforeA = (await Post.findById(a._id).lean())!.updatedAt;
      await new Promise((r) => setTimeout(r, 20));

      const res = await PUT(req('PUT', '/api/tags', { cookie: adminCookie, body: { oldTag: 'action', newTag: 'adventure' } }));
      assert.equal(res.status, 200);

      const ta = (await Post.findById(a._id).lean())!;
      const tb = (await Post.findById(b._id).lean())!;
      const tc = (await Post.findById(c._id).lean())!;
      assert.deepEqual(ta.tags, ['drama', 'adventure']);
      assert.deepEqual(tb.tags, ['adventure'], 'đã có tag mới thì không thêm trùng');
      assert.deepEqual(tc.tags, ['comedy'], 'bài không liên quan không bị đụng tới');
      assert.ok(ta.updatedAt.getTime() > beforeA.getTime(), 'updatedAt được cập nhật');
      assert.ok(await Tag.exists({ name: 'adventure' }));
    });

    it('xóa tag: gỡ khỏi mọi bài (không phân biệt hoa thường)', async () => {
      const { Post } = await import('@/models/Post');
      const { DELETE } = await import('@/app/api/tags/route');
      const a = await Post.create({ title: 'D1', tags: ['Horror', 'drama2'], chapters: [{ title: 'c', chapterNumber: 1, content: 'x' }] });
      const res = await DELETE(req('DELETE', '/api/tags?tag=horror', { cookie: adminCookie }));
      assert.equal(res.status, 200);
      assert.deepEqual((await Post.findById(a._id).lean())!.tags, ['drama2']);
    });

    it('chỉ admin được đổi/xóa tag', async () => {
      const { PUT, DELETE } = await import('@/app/api/tags/route');
      assert.equal((await PUT(req('PUT', '/api/tags', { cookie: guestCookie, body: { oldTag: 'a', newTag: 'b' } }))).status, 403);
      assert.equal((await DELETE(req('DELETE', '/api/tags?tag=a', { cookie: guestCookie }))).status, 403);
    });
  });

  describe('cache phiên theo người dùng (cần Redis)', { skip: REDIS_URL ? false : 'REDIS_TEST_URL chưa được đặt' }, () => {
    it('clearUserCache(userId) chỉ xóa phiên của đúng người đó, không xóa phiên người khác', async () => {
      const { User } = await import('@/models/User');
      const { getCurrentUserFromToken, clearUserCache } = await import('@/lib/server-auth');
      const { getRedisClient } = await import('@/lib/redis');
      const { createHash } = await import('node:crypto');
      const hash = (t: string) => createHash('sha256').update(t).digest('hex').slice(0, 32);

      const a = await User.create({ email: 'pb-a@gmail.com', password: 'x'.repeat(10), name: 'A', role: 'user', isVerified: true });
      const b = await User.create({ email: 'pb-b@gmail.com', password: 'x'.repeat(10), name: 'B', role: 'user', isVerified: true });
      const tokenA = (await sign(a));
      const tokenB = (await sign(b));
      assert.ok(await getCurrentUserFromToken(tokenA));
      assert.ok(await getCurrentUserFromToken(tokenB));

      const redis = getRedisClient()!;
      const waitFor = async (fn: () => Promise<boolean>) => {
        for (let i = 0; i < 40; i++) {
          if (await fn()) return true;
          await new Promise((r) => setTimeout(r, 50));
        }
        return false;
      };
      assert.ok(await waitFor(async () => (await redis.exists(`session:user:${hash(tokenA)}`, `session:user:${hash(tokenB)}`)) === 2), 'cả hai phiên đã vào Redis');
      assert.ok(await waitFor(async () => (await redis.scard(`session:uidx:${String(a._id)}`)) === 1), 'chỉ mục theo người dùng đã được ghi');

      clearUserCache(String(a._id));
      assert.ok(await waitFor(async () => (await redis.exists(`session:user:${hash(tokenA)}`)) === 0), 'phiên của A bị xóa');
      assert.equal(await redis.exists(`session:user:${hash(tokenB)}`), 1, 'phiên của B còn nguyên');
    });
  });

  it('id người dùng guest hợp lệ (sanity)', () => {
    assert.ok(guestId);
  });
});

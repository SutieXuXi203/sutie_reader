/**
 * Kiểm thử tích hợp: tải ảnh theo từng chương (GET /api/posts/[id]/chapters/[chapterNumber]) và GET /api/posts/[id]?lite=1.
 *   MONGODB_TEST_URI=mongodb://127.0.0.1:27017/sutie_test npm run test:integration
 * CẢNH BÁO: database `<MONGODB_TEST_URI>_lazy` bị xóa sau khi chạy.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';

const [baseUri, uriQuery] = (process.env.MONGODB_TEST_URI || '').split('?');
const MONGO_URI = baseUri ? `${baseUri}_lazy${uriQuery ? `?${uriQuery}` : ''}` : undefined;
const skip = MONGO_URI ? false : 'MONGODB_TEST_URI chưa được đặt';

const JWT_SECRET = 'lazy-chapters-secret-lazy-chapters-secret-12';
const WORKER = 'https://worker.test';
const img = (id: string) => `${WORKER}/image/${id}`;

function req(path: string, cookie?: string, ip = '203.0.113.70') {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: { 'x-forwarded-for': ip, ...(cookie ? { cookie } : {}) },
  });
}

describe('Tích hợp: tải ảnh theo từng chương', { skip }, () => {
  let mongoose: typeof import('mongoose').default;
  let guestCookie: string;
  let sharedCookie: string;
  let adminCookie: string;
  let ids: { open: string; locked: string; partial: string; big: string };

  const chapterRoute = async (postId: string, chapter: string, cookie?: string) => {
    const { GET } = await import('@/app/api/posts/[id]/chapters/[chapterNumber]/route');
    const res = await GET(req(`/api/posts/${postId}/chapters/${chapter}`, cookie), {
      params: Promise.resolve({ id: postId, chapterNumber: chapter }),
    });
    return { status: res.status, body: (await res.json()) as Record<string, unknown>, headers: res.headers };
  };

  const postRoute = async (postId: string, query: string, cookie?: string) => {
    const { GET } = await import('@/app/api/posts/[id]/route');
    const res = await GET(req(`/api/posts/${postId}${query}`, cookie), { params: Promise.resolve({ id: postId }) });
    const text = await res.text();
    return { status: res.status, text, body: JSON.parse(text) as { chapters: Array<Record<string, unknown>> } };
  };

  before(async () => {
    process.env.MONGODB_URI = MONGO_URI;
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.CLOUDFLARE_WORKER_URL = WORKER;
    process.env.IMAGE_SIGNING_SECRET = 'lazy-signing';
    delete process.env.REDIS_URL;
    delete process.env.UNLOCK_PIN;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.ADMIN_USERNAME;
    delete process.env.TEST_USERNAME;

    mongoose = (await import('mongoose')).default;
    await (await import('@/lib/db')).connectDB();
    const { Post } = await import('@/models/Post');
    const { User } = await import('@/models/User');
    await Promise.all([Post.init(), User.init()]);

    const secret = new TextEncoder().encode(JWT_SECRET);
    const sign = (u: { _id: unknown; email: string; name: string; role: string }) =>
      new SignJWT({ id: String(u._id), email: u.email, name: u.name, role: u.role })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(secret);

    const guest = await User.create({ email: 'lz-guest@gmail.com', password: 'x'.repeat(10), name: 'LZ Guest', role: 'guest', isVerified: true });
    const shared = await User.create({ email: 'lz-shared@gmail.com', password: 'x'.repeat(10), name: 'LZ Shared', role: 'guest', isVerified: true });
    const admin = await User.create({ email: 'lz-admin@gmail.com', password: 'x'.repeat(10), name: 'LZ Admin', role: 'admin', isVerified: true });
    guestCookie = `token=${await sign(guest)}`;
    sharedCookie = `token=${await sign(shared)}`;
    adminCookie = `token=${await sign(admin)}`;

    const open = await Post.create({
      title: 'Open',
      accessType: 'public',
      chapters: [
        { title: 'c1', chapterNumber: 1, images: [img('OPENCH1PAGE001'), img('OPENCH1PAGE002'), img('OPENCH1PAGE003')] },
        { title: 'c2', chapterNumber: 2, accessType: 'restricted', images: [img('OPENCH2LOCKED01'), img('OPENCH2LOCKED02')] },
        { title: 'c3', chapterNumber: 3, images: [] , content: 'chỉ có chữ' },
      ],
    });
    const locked = await Post.create({
      title: 'Locked',
      accessType: 'restricted',
      chapters: [{ title: 'c1', chapterNumber: 1, images: [img('LOCKEDCH1PAGE01')] }],
    });
    const partial = await Post.create({
      title: 'Partial',
      accessType: 'restricted',
      chapters: [
        { title: 'c1', chapterNumber: 1, images: [img('PARTCH1PAGE0001')], sharedWith: [{ email: 'lz-shared@gmail.com', userId: shared._id }] },
        { title: 'c2', chapterNumber: 2, images: [img('PARTCH2PAGE0001')] },
      ],
    });
    // Bộ truyện lớn: 40 chương x 100 ảnh
    const big = await Post.create({
      title: 'Big',
      accessType: 'public',
      chapters: Array.from({ length: 40 }, (_, c) => ({
        title: `c${c + 1}`,
        chapterNumber: c + 1,
        images: Array.from({ length: 100 }, (_, i) => img(`BIGCH${String(c).padStart(2, '0')}PAGE${String(i).padStart(4, '0')}`)),
      })),
    });
    ids = { open: String(open._id), locked: String(locked._id), partial: String(partial._id), big: String(big._id) };
  });

  after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('trả ảnh của đúng một chương, URL đi qua /api/image (kèm pid), không lộ URL Worker', async () => {
    const res = await chapterRoute(ids.open, '1', guestCookie);
    assert.equal(res.status, 200);
    const images = res.body.images as string[];
    assert.equal(images.length, 3);
    assert.equal(res.body.imageCount, 3);
    for (const url of images) {
      assert.match(url, /^\/api\/image\/OPENCH1PAGE00\d\.webp\?v=2&pid=/);
      assert.ok(url.includes(`pid=${ids.open}`));
    }
    assert.ok(!JSON.stringify(res.body).includes('worker.test'));
    assert.equal(res.headers.get('cache-control'), 'private, no-store');
  });

  it('chương restricted: khách bị 403 và KHÔNG nhận bất kỳ ảnh nào; admin được xem', async () => {
    const denied = await chapterRoute(ids.open, '2', guestCookie);
    assert.equal(denied.status, 403);
    assert.equal(denied.body.images, undefined);
    assert.ok(!JSON.stringify(denied.body).includes('OPENCH2LOCKED'));

    const anon = await chapterRoute(ids.open, '2');
    assert.equal(anon.status, 401);

    const admin = await chapterRoute(ids.open, '2', adminCookie);
    assert.equal(admin.status, 200);
    assert.equal((admin.body.images as string[]).length, 2);
  });

  it('bài restricted: khách chưa được chia sẻ 403, ẩn danh 401', async () => {
    assert.equal((await chapterRoute(ids.locked, '1', guestCookie)).status, 403);
    assert.equal((await chapterRoute(ids.locked, '1')).status, 401);
  });

  it('chia sẻ riêng một chương: chỉ chương đó mở, chương inherit còn lại vẫn khóa', async () => {
    assert.equal((await chapterRoute(ids.partial, '1', sharedCookie)).status, 200);
    assert.equal((await chapterRoute(ids.partial, '2', sharedCookie)).status, 403);
    assert.equal((await chapterRoute(ids.partial, '1', guestCookie)).status, 403, 'người khác không được chia sẻ');
  });

  it('chương không có ảnh trả mảng rỗng; số chương/ID sai trả 400/404', async () => {
    const textOnly = await chapterRoute(ids.open, '3', guestCookie);
    assert.equal(textOnly.status, 200);
    assert.deepEqual(textOnly.body.images, []);

    assert.equal((await chapterRoute(ids.open, '99', guestCookie)).status, 404);
    assert.equal((await chapterRoute(ids.open, '0', guestCookie)).status, 400);
    assert.equal((await chapterRoute(ids.open, 'abc', guestCookie)).status, 400);
    assert.equal((await chapterRoute('not-an-id', '1', guestCookie)).status, 400);
    assert.equal((await chapterRoute('6af3e40ab99e2eaa348f2059', '1', guestCookie)).status, 404);
  });

  it('GET /api/posts/[id]?lite=1 bỏ ảnh của mọi chương nhưng giữ số ảnh; không có lite vẫn đầy đủ (trang sửa bài)', async () => {
    const lite = await postRoute(ids.open, '?lite=1', guestCookie);
    assert.equal(lite.status, 200);
    const c1 = lite.body.chapters.find((c) => c.chapterNumber === 1)!;
    assert.deepEqual(c1.images, []);
    assert.equal(c1.imageCount, 3);
    assert.equal(c1.imagesLoaded, false);
    const c2 = lite.body.chapters.find((c) => c.chapterNumber === 2)!;
    assert.equal(c2.isLocked, true);
    assert.equal(c2.imageCount, 0);
    assert.equal(c2.imagesLoaded, true, 'chương khóa không có gì để tải');
    const c3 = lite.body.chapters.find((c) => c.chapterNumber === 3)!;
    assert.equal(c3.imagesLoaded, true, 'chương không có ảnh coi như đã tải xong');

    const full = await postRoute(ids.open, '', guestCookie);
    const f1 = full.body.chapters.find((c) => c.chapterNumber === 1)!;
    assert.equal((f1.images as string[]).length, 3);
    assert.equal(f1.imagesLoaded, undefined);
  });

  it('bộ truyện 40 chương x 100 ảnh: payload lite nhỏ hơn hẳn payload đầy đủ', async () => {
    const full = await postRoute(ids.big, '', guestCookie);
    const lite = await postRoute(ids.big, '?lite=1', guestCookie);
    const chapter = await chapterRoute(ids.big, '7', guestCookie);
    const fullKb = full.text.length / 1024;
    const liteKb = lite.text.length / 1024;
    const oneChapterKb = JSON.stringify(chapter.body).length / 1024;
    console.log(
      `  [payload] 40 chương x 100 ảnh: đầy đủ ${fullKb.toFixed(0)} KB | lite ${liteKb.toFixed(1)} KB | một chương ${oneChapterKb.toFixed(1)} KB`
    );
    assert.ok(liteKb < fullKb * 0.05, `lite ${liteKb} KB phải < 5% của ${fullKb} KB`);
    assert.equal((chapter.body.images as string[]).length, 100);
  });
});

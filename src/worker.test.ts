import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { SignJWT } from 'jose';
import { createHmac } from 'node:crypto';
import worker from '../cloudflare-worker/index.js';

type WorkerEnv = Record<string, string>;
type WorkerResponse = { status: number; headers: Headers; arrayBuffer(): Promise<ArrayBuffer>; json(): Promise<unknown> };
type WorkerModule = { fetch(request: Request, env: WorkerEnv, ctx: { waitUntil(p: unknown): void }): Promise<WorkerResponse> };
const w = worker as WorkerModule;

const SECRET = 'worker-test-secret-worker-test-secret-12';
const ENV: WorkerEnv = {
  IMAGE_SIGNING_SECRET: 'signing-secret',
  UPLOAD_SECRET: 'shared-upload-secret',
  JWT_SECRET: SECRET,
  GOOGLE_CLIENT_ID: 'id',
  GOOGLE_CLIENT_SECRET: 'secret',
  GOOGLE_REFRESH_TOKEN: 'refresh',
  GOOGLE_DRIVE_FOLDER_ID: 'ROOTFOLDER12345',
};
const ctx = { waitUntil: () => {} };

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)]);

const realFetch = globalThis.fetch;
const globals = globalThis as unknown as { caches?: unknown };
const realCaches = globals.caches;
let driveFiles: Record<string, { mimeType: string; parents: string[]; trashed?: boolean; name?: string; appProperties?: Record<string, string> }> = {};

function sign(fileId: string, subject: string, expiresAt: number) {
  const payload = ['v1', 'GET', `/image/${fileId}`, String(expiresAt), subject].join('\n');
  return createHmac('sha256', ENV.IMAGE_SIGNING_SECRET).update(payload).digest('base64url');
}

function signedUrl(fileId: string, ttl = 120) {
  const exp = Math.floor(Date.now() / 1000) + ttl;
  return `https://worker.test/image/${fileId}?exp=${exp}&sub=user1&sig=${sign(fileId, 'user1', exp)}`;
}

async function jwt(payload: Record<string, unknown>, expiresIn: string | null = '10m') {
  const builder = new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt();
  if (expiresIn) builder.setExpirationTime(expiresIn);
  return builder.sign(new TextEncoder().encode(SECRET));
}

function uploadRequest(token: string, file: Blob, name = 'a.png') {
  const form = new FormData();
  form.append('title', 'Story');
  form.append('files', file, name);
  return new Request('https://worker.test/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
}

describe('Cloudflare Worker — chạy mã thật với Drive giả lập', () => {
  before(() => {
    globals.caches = { default: { match: async () => undefined, put: async () => {} } };
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith('https://oauth2.googleapis.com/token')) {
        return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 });
      }
      const match = url.match(/drive\/v3\/files\/([^?/]+)\?(.*)/);
      if (match) {
        const file = driveFiles[decodeURIComponent(match[1])];
        if (!file) return new Response(JSON.stringify({ error: { message: 'not found' } }), { status: 404 });
        if (match[2].includes('alt=media')) {
          return new Response(new Uint8Array(PNG), { status: 200, headers: { 'content-type': file.mimeType } });
        }
        return new Response(JSON.stringify({ id: match[1], name: 'f', ...file }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    }) as typeof fetch;
  });

  after(() => {
    globalThis.fetch = realFetch;
    globals.caches = realCaches;
  });

  it('phục vụ ảnh nằm trong thư mục Drive được phép khi chữ ký hợp lệ', async () => {
    driveFiles = { GOODFILE000001: { mimeType: 'image/png', parents: ['ROOTFOLDER12345'] } };
    const res = await w.fetch(new Request(signedUrl('GOODFILE000001')), ENV, ctx);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/png');
    assert.match(res.headers.get('content-security-policy') || '', /sandbox/);
  });

  it('từ chối file nằm NGOÀI thư mục được phép (không đọc được file bất kỳ trong Drive)', async () => {
    driveFiles = { OUTSIDEFILE0001: { mimeType: 'image/png', parents: ['SOMEOTHERFOLDER'] } };
    const res = await w.fetch(new Request(signedUrl('OUTSIDEFILE0001')), ENV, ctx);
    assert.ok(res.status === 403 || res.status === 404, `status ${res.status}`);
  });

  it('/avatar cũng bị kiểm thư mục và loại file (không còn đọc được file tùy ý không cần chữ ký)', async () => {
    driveFiles = {
      OUTSIDEFILE0001: { mimeType: 'image/png', parents: ['SOMEOTHERFOLDER'] },
      DOCUMENTFILE001: { mimeType: 'text/html', parents: ['ROOTFOLDER12345'] },
    };
    for (const id of ['OUTSIDEFILE0001', 'DOCUMENTFILE001']) {
      const res = await w.fetch(new Request(`https://worker.test/avatar/${id}`), ENV, ctx);
      assert.notEqual(res.status, 200, id);
    }
  });

  it('/avatar KHÔNG phục vụ trang truyện (file trong thư mục truyện/chương) dù nằm dưới thư mục gốc cho phép', async () => {
    driveFiles = {
      COMICPAGE00001: { mimeType: 'image/png', parents: ['CHAPTERFOLDER01'] },
      CHAPTERFOLDER01: { mimeType: 'application/vnd.google-apps.folder', parents: ['STORYFOLDER0001'], name: 'Chuong 1' },
      STORYFOLDER0001: { mimeType: 'application/vnd.google-apps.folder', parents: ['ROOTFOLDER12345'], name: 'Story' },
      DIRECTCOMIC0001: { mimeType: 'image/png', parents: ['ROOTFOLDER12345'] },
    };
    for (const id of ['COMICPAGE00001', 'DIRECTCOMIC0001']) {
      const res = await w.fetch(new Request(`https://worker.test/avatar/${id}`), ENV, ctx);
      assert.equal(res.status, 404, `${id} qua /avatar phải bị từ chối`);
    }
    // cùng file đó vẫn đọc được qua /image khi có chữ ký hợp lệ
    assert.equal((await w.fetch(new Request(signedUrl('COMICPAGE00001')), ENV, ctx)).status, 200);
  });

  it('/avatar vẫn phục vụ avatar mới (có nhãn sutieKind) và avatar cũ (trong thư mục gốc "Avatars")', async () => {
    driveFiles = {
      NEWAVATAR00001: { mimeType: 'image/webp', parents: ['ROOTFOLDER12345'], appProperties: { sutieKind: 'avatar' } },
      OLDAVATAR00001: { mimeType: 'image/webp', parents: ['AVATARSFOLDER01'] },
      AVATARSFOLDER01: { mimeType: 'application/vnd.google-apps.folder', parents: ['ROOTFOLDER12345'], name: 'Avatars' },
    };
    for (const id of ['NEWAVATAR00001', 'OLDAVATAR00001']) {
      const res = await w.fetch(new Request(`https://worker.test/avatar/${id}`), ENV, ctx);
      assert.equal(res.status, 200, id);
    }
  });

  it('/avatar không nhận thư mục tên "Avatars" của một truyện (có postId) hay nằm lồng trong truyện', async () => {
    driveFiles = {
      FAKEAVATAR0001: { mimeType: 'image/png', parents: ['FAKEFOLDER00001'] },
      FAKEFOLDER00001: {
        mimeType: 'application/vnd.google-apps.folder',
        parents: ['ROOTFOLDER12345'],
        name: 'Avatars',
        appProperties: { sutiePostId: 'a'.repeat(24) },
      },
      NESTEDAVATAR01: { mimeType: 'image/png', parents: ['NESTEDFOLDER001'] },
      NESTEDFOLDER001: { mimeType: 'application/vnd.google-apps.folder', parents: ['STORYFOLDER0001'], name: 'Avatars' },
      STORYFOLDER0001: { mimeType: 'application/vnd.google-apps.folder', parents: ['ROOTFOLDER12345'], name: 'Story' },
    };
    for (const id of ['FAKEAVATAR0001', 'NESTEDAVATAR01']) {
      const res = await w.fetch(new Request(`https://worker.test/avatar/${id}`), ENV, ctx);
      assert.equal(res.status, 404, id);
    }
  });

  it('từ chối chữ ký hết hạn, bị sửa, hoặc hạn quá xa trong tương lai', async () => {
    driveFiles = { GOODFILE000001: { mimeType: 'image/png', parents: ['ROOTFOLDER12345'] } };
    assert.equal((await w.fetch(new Request(signedUrl('GOODFILE000001', -5)), ENV, ctx)).status, 403);
    assert.equal((await w.fetch(new Request(signedUrl('GOODFILE000001', 3600)), ENV, ctx)).status, 403);
    const tampered = new URL(signedUrl('GOODFILE000001'));
    tampered.searchParams.set('sub', 'attacker');
    assert.equal((await w.fetch(new Request(tampered), ENV, ctx)).status, 403);
  });

  it('upload: token phiên đăng nhập thường (role admin, không scope upload) KHÔNG được chấp nhận', async () => {
    const session = await jwt({ id: 'a1', role: 'admin' }, '7d');
    const res = await w.fetch(uploadRequest(session, new Blob([PNG], { type: 'image/png' })), ENV, ctx);
    assert.equal(res.status, 401);
  });

  it('upload: token không có exp hoặc sống quá lâu bị từ chối', async () => {
    const noExp = await jwt({ role: 'admin', scope: 'upload' }, null);
    const tooLong = await jwt({ role: 'admin', scope: 'upload' }, '2h');
    for (const token of [noExp, tooLong]) {
      const res = await w.fetch(uploadRequest(token, new Blob([PNG], { type: 'image/png' })), ENV, ctx);
      assert.equal(res.status, 401);
    }
  });

  it('upload: SVG và file giả dạng ảnh bị từ chối dù khai báo Content-Type image/*', async () => {
    const token = await jwt({ role: 'admin', scope: 'upload' });
    const svg = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], { type: 'image/svg+xml' });
    assert.equal((await w.fetch(uploadRequest(token, svg, 'x.svg'), ENV, ctx)).status, 400);

    const fakePng = new Blob(['<html><script>alert(1)</script></html>'], { type: 'image/png' });
    assert.equal((await w.fetch(uploadRequest(token, fakePng, 'x.png'), ENV, ctx)).status, 400);
  });

  it('upload: token upload hợp lệ vượt qua bước xác thực và kiểm tra nội dung (lỗi còn lại chỉ do Drive giả lập)', async () => {
    const token = await jwt({ role: 'admin', scope: 'upload' });
    const res = await w.fetch(uploadRequest(token, new Blob([PNG], { type: 'image/png' })), ENV, ctx);
    assert.notEqual(res.status, 401);
    assert.notEqual(res.status, 400);
  });
});

describe('Cloudflare Worker — upload nhiều ảnh (Drive giả lập có trạng thái)', () => {
  const calls: string[] = [];
  let maxInFlight = 0;
  let inFlight = 0;
  let failUploadsWith: number[] = [];
  let storyFolderLookups = 0;
  const uploadBodies: string[] = [];

  function multiUploadRequest(token: string, names: string[], title = 'Story') {
    const form = new FormData();
    form.append('title', title);
    form.append('postId', 'a'.repeat(24));
    for (const name of names) form.append('files', new Blob([PNG], { type: 'image/png' }), name);
    return new Request('https://worker.test/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  }

  before(() => {
    globals.caches = { default: { match: async () => undefined, put: async () => {} } };
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith('https://oauth2.googleapis.com/token')) {
        return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 });
      }
      if (url.includes('/upload/drive/v3/files')) {
        calls.push('upload');
        // Đọc tên file từ phần metadata của multipart để trả id gắn với đúng file
        const bodyText = init?.body instanceof Blob ? await init.body.text() : '';
        uploadBodies.push(bodyText);
        const name = /"name":"([^"]+)"/.exec(bodyText)?.[1] || 'unknown';
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        // File đầu tiên hoàn thành chậm nhất: nếu code ghép kết quả theo thứ tự hoàn thành thì thứ tự URL sẽ sai
        await new Promise((resolve) => setTimeout(resolve, name === 'page-0.png' ? 60 : 8));
        inFlight -= 1;
        const failure = failUploadsWith.shift();
        if (failure) {
          return new Response(JSON.stringify({ error: { message: 'rate', errors: [{ reason: 'userRateLimitExceeded' }] } }), { status: failure });
        }
        return new Response(JSON.stringify({ id: `ID-${name.replace(/\W/g, '')}` }), { status: 200 });
      }
      if (url.includes('drive/v3/files?')) {
        // Tra cứu thư mục (list) hoặc tạo thư mục (POST)
        const q = new URL(url).searchParams.get('q') || '';
        if (q.includes('sutiePostId')) storyFolderLookups += 1;
        calls.push('folder-lookup');
        return new Response(JSON.stringify({ files: [{ id: 'STORYFOLDER0001', name: 'Story' }] }), { status: 200 });
      }
      if (/drive\/v3\/files\/[^?/]+\?/.test(url)) {
        calls.push('file-metadata');
        return new Response(JSON.stringify({ id: 'x', mimeType: 'image/png', parents: ['STORYFOLDER0001'] }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    }) as typeof fetch;
  });

  after(() => {
    globalThis.fetch = realFetch;
    globals.caches = realCaches;
  });

  it('trả URL đúng thứ tự file gửi lên dù tải song song', async () => {
    calls.length = 0;
    const token = await jwt({ role: 'admin', scope: 'upload' });
    const names = Array.from({ length: 6 }, (_, i) => `page-${i}.png`);

    const res = await w.fetch(multiUploadRequest(token, names), { ...ENV, DRIVE_RETRY_BASE_MS: '1' }, ctx);
    assert.equal(res.status, 200);

    const { urls } = (await res.json()) as { urls: string[] };
    assert.deepEqual(
      urls.map((u) => u.split('/image/')[1]),
      names.map((n) => `ID-${n.replace(/\W/g, '')}`),
      'URL phải đúng thứ tự file gửi lên dù file đầu hoàn thành chậm nhất'
    );
  });

  it('avatar upload được gắn nhãn sutieKind=avatar; ảnh truyện (có postId) không bao giờ được gắn nhãn', async () => {
    const token = await jwt({ role: 'admin', scope: 'upload' });
    const env = { ...ENV, DRIVE_RETRY_BASE_MS: '1' };

    uploadBodies.length = 0;
    const avatarForm = new FormData();
    avatarForm.append('title', 'Avatars');
    avatarForm.append('isAvatar', 'true');
    avatarForm.append('files', new Blob([PNG], { type: 'image/png' }), 'avatar-u1.png');
    const avatarRes = await w.fetch(
      new Request('https://worker.test/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: avatarForm }),
      env,
      ctx
    );
    assert.equal(avatarRes.status, 200);
    assert.match(uploadBodies.join('\n'), /"sutieKind":"avatar"/);
    assert.match(((await avatarRes.json()) as { urls: string[] }).urls[0], /\/avatar\//);

    // Admin cố ý khai isAvatar cho ảnh có postId: bị bỏ qua, ảnh vẫn là ảnh truyện (URL /image/, không nhãn)
    uploadBodies.length = 0;
    const sneaky = multiUploadRequest(token, ['sneaky.png'], 'Avatars');
    const sneakyForm = await sneaky.formData();
    sneakyForm.append('isAvatar', 'true');
    const sneakyRes = await w.fetch(
      new Request('https://worker.test/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: sneakyForm }),
      env,
      ctx
    );
    assert.equal(sneakyRes.status, 200);
    assert.doesNotMatch(uploadBodies.join('\n'), /sutieKind/);
    assert.match(((await sneakyRes.json()) as { urls: string[] }).urls[0], /\/image\//);
  });

  it('có song song nhưng không vượt giới hạn mỗi request', async () => {
    calls.length = 0;
    maxInFlight = 0;
    const token = await jwt({ role: 'admin', scope: 'upload' });
    const res = await w.fetch(
      multiUploadRequest(token, Array.from({ length: 6 }, (_, i) => `p-${i}.png`)),
      { ...ENV, DRIVE_RETRY_BASE_MS: '1' },
      ctx
    );
    assert.equal(res.status, 200);
    assert.ok(maxInFlight >= 2, `maxInFlight=${maxInFlight}`);
    assert.ok(maxInFlight <= 2, `maxInFlight=${maxInFlight}`);
  });

  it('không gọi lại Drive để kiểm tra metadata sau mỗi lần upload và chỉ tra cứu thư mục một lần cho các batch sau', async () => {
    const token = await jwt({ role: 'admin', scope: 'upload' });
    const env = { ...ENV, DRIVE_RETRY_BASE_MS: '1' };
    // Lần đầu làm ấm cache thư mục
    await w.fetch(multiUploadRequest(token, ['a.png'], 'Cached Story'), env, ctx);

    calls.length = 0;
    storyFolderLookups = 0;
    const res = await w.fetch(multiUploadRequest(token, ['b.png', 'c.png', 'd.png'], 'Cached Story'), env, ctx);
    assert.equal(res.status, 200);

    assert.equal(storyFolderLookups, 0, 'batch sau phải dùng cache thư mục');
    assert.equal(calls.filter((c) => c === 'file-metadata').length, 0, 'không được hỏi metadata từng ảnh vừa upload');
    assert.equal(calls.filter((c) => c === 'upload').length, 3);
  });

  it('thử lại khi Drive báo giới hạn tốc độ (403 rateLimit / 429) rồi vẫn thành công', async () => {
    calls.length = 0;
    failUploadsWith = [403, 429];
    const token = await jwt({ role: 'admin', scope: 'upload' });

    const res = await w.fetch(multiUploadRequest(token, ['retry.png']), { ...ENV, DRIVE_RETRY_BASE_MS: '1' }, ctx);
    assert.equal(res.status, 200);
    assert.equal(calls.filter((c) => c === 'upload').length, 3, '2 lần lỗi + 1 lần thành công');
    failUploadsWith = [];
  });

  it('không thử lại vô hạn: lỗi giới hạn tốc độ kéo dài cuối cùng vẫn trả lỗi', async () => {
    calls.length = 0;
    failUploadsWith = [429, 429, 429, 429, 429, 429];
    const token = await jwt({ role: 'admin', scope: 'upload' });

    const res = await w.fetch(multiUploadRequest(token, ['fail.png']), { ...ENV, DRIVE_RETRY_BASE_MS: '1' }, ctx);
    assert.ok(res.status >= 400);
    assert.equal(calls.filter((c) => c === 'upload').length, 4, 'tối đa 4 lần thử');
    failUploadsWith = [];
  });
});

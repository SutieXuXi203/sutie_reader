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
let driveFiles: Record<string, { mimeType: string; parents: string[]; trashed?: boolean }> = {};

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

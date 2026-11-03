import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getSafeCallbackUrl } from './safeRedirect';
import { getClientIp } from './clientIp';
import { checkMemoryRateLimit } from './memoryRateLimit';
import { detectImageType } from './imageMagic';
import { isAllowedAvatarUrl, registerSchema, loginSchema, contactSchema } from './validations';
import { safeEqual } from './password';
import { normalizeImages } from './imageUrls';
import { signImageUrls, createSignedWorkerImageUrl, getImageSignedUrlTtlSeconds } from './image-signing';

const headers = (values: Record<string, string>) => new Headers(values);

describe('getSafeCallbackUrl — chống open redirect', () => {
  it('cho phép đường dẫn nội bộ hợp lệ, giữ query và hash', () => {
    assert.equal(getSafeCallbackUrl('/posts/1?chapter=2#p3'), '/posts/1?chapter=2#p3');
    assert.equal(getSafeCallbackUrl('/admin', '/'), '/admin');
  });

  it('từ chối URL tuyệt đối, protocol-relative, gạch chéo ngược', () => {
    for (const url of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', 'evil']) {
      assert.equal(getSafeCallbackUrl(url), '/', url);
    }
  });

  it('từ chối ký tự điều khiển (tab/xuống dòng bị URL parser xóa nên /\\t/evil.com thực chất là //evil.com)', () => {
    for (const url of ['/\t/evil.example', '/\n/evil.example', '/\r/evil.example', '/%0a/x\u0000']) {
      const safe = getSafeCallbackUrl(url, '/fallback');
      assert.ok(!safe.includes('\t') && !safe.includes('\n'), url);
      assert.equal(new URL(safe, 'https://app.example').origin, 'https://app.example', url);
    }
    assert.equal(getSafeCallbackUrl('/\t/evil.example', '/fallback'), '/fallback');
  });

  it('dùng fallback khi rỗng/null', () => {
    assert.equal(getSafeCallbackUrl(null, '/admin'), '/admin');
    assert.equal(getSafeCallbackUrl('', '/x'), '/x');
  });
});

describe('getClientIp — chống giả mạo X-Forwarded-For', () => {
  it('lấy IP do proxy tin cậy nối vào CUỐI danh sách, không tin phần client tự thêm ở đầu', () => {
    assert.equal(getClientIp(headers({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 203.0.113.9' })), '203.0.113.9');
  });

  it('một IP duy nhất (Vercel) được giữ nguyên; thiếu header -> unknown', () => {
    assert.equal(getClientIp(headers({ 'x-forwarded-for': '198.51.100.7' })), '198.51.100.7');
    assert.equal(getClientIp(headers({})), 'unknown');
  });

  it('từ chối giá trị không phải IP (chống chèn khóa rate-limit)', () => {
    assert.equal(getClientIp(headers({ 'x-forwarded-for': 'a:b:c, <script>' })), 'unknown');
  });

  it('TRUSTED_PROXY_COUNT=2 lấy phần tử thứ 2 từ cuối', () => {
    process.env.TRUSTED_PROXY_COUNT = '2';
    try {
      assert.equal(getClientIp(headers({ 'x-forwarded-for': '9.9.9.9, 198.51.100.7, 10.0.0.1' })), '198.51.100.7');
    } finally {
      delete process.env.TRUSTED_PROXY_COUNT;
    }
  });
});

describe('checkMemoryRateLimit', () => {
  it('chặn sau khi vượt hạn mức trong cửa sổ', () => {
    const key = `test:${Math.random()}`;
    const results = Array.from({ length: 5 }, () => checkMemoryRateLimit(key, 3, 60_000).allowed);
    assert.deepEqual(results, [true, true, true, false, false]);
  });
});

describe('detectImageType — nhận diện bằng magic bytes', () => {
  const pad = (bytes: number[]) => Uint8Array.from([...bytes, ...new Array(16).fill(0)]);

  it('nhận png/jpeg/gif/webp/avif', () => {
    assert.equal(detectImageType(pad([0x89, 0x50, 0x4e, 0x47])), 'png');
    assert.equal(detectImageType(pad([0xff, 0xd8, 0xff, 0xe0])), 'jpeg');
    assert.equal(detectImageType(pad([0x47, 0x49, 0x46, 0x38])), 'gif');
    assert.equal(detectImageType(Uint8Array.from([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP')])), 'webp');
    assert.equal(detectImageType(Uint8Array.from([0, 0, 0, 0, ...Buffer.from('ftypavif')])), 'avif');
  });

  it('từ chối SVG/HTML giả dạng ảnh', () => {
    assert.equal(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>')), null);
    assert.equal(detectImageType(Buffer.from('<!DOCTYPE html><html></html>')), null);
  });
});

describe('validations', () => {
  it('avatar chỉ nhận https và host cho phép', () => {
    assert.equal(isAllowedAvatarUrl('https://api.dicebear.com/7.x/avataaars/svg?seed=a'), true);
    assert.equal(isAllowedAvatarUrl('https://abc.workers.dev/avatar/xyz'), true);
    for (const bad of ['javascript:alert(1)', 'http://api.dicebear.com/x', 'https://evil.example/a.png', 'not a url', 'https://api.dicebear.com/' + 'a'.repeat(600)]) {
      assert.equal(isAllowedAvatarUrl(bad), false, bad.slice(0, 40));
    }
  });

  it('đăng ký: giới hạn mật khẩu 72 ký tự và avatar phải hợp lệ', () => {
    const base = { email: 'a@gmail.com', password: 'secret1', name: 'A' };
    assert.equal(registerSchema.safeParse(base).success, true);
    assert.equal(registerSchema.safeParse({ ...base, password: 'x'.repeat(73) }).success, false);
    assert.equal(registerSchema.safeParse({ ...base, avatar: 'javascript:alert(1)' }).success, false);
    assert.equal(registerSchema.safeParse({ ...base, avatar: '' }).success, true);
  });

  it('đăng nhập/liên hệ có giới hạn độ dài', () => {
    assert.equal(loginSchema.safeParse({ email: 'a@gmail.com', password: 'x'.repeat(129) }).success, false);
    assert.equal(contactSchema.safeParse({ name: 'A', email: 'a@gmail.com', message: 'm'.repeat(5001) }).success, false);
    assert.equal(contactSchema.safeParse({ name: 'A', email: 'a@gmail.com', message: 'hello' }).success, true);
  });
});

describe('safeEqual & normalizeImages', () => {
  it('safeEqual so sánh đúng, kể cả khác độ dài', () => {
    assert.equal(safeEqual('123456', '123456'), true);
    assert.equal(safeEqual('123456', '1234567'), false);
    assert.equal(safeEqual('', 'x'), false);
  });

  it('normalizeImages bỏ chữ ký hết hạn khỏi URL ảnh admin gửi lên', () => {
    const [url] = normalizeImages(['https://w.example/image/FILEID123456?exp=1&sub=u&sig=abcdefghijklmnopqrstuvwxyz0123456789ABCD']);
    assert.equal(url, 'https://w.example/image/FILEID123456');
  });
});

describe('signImageUrls — không bao giờ lộ URL Worker cho client', () => {
  const ENV_KEYS = ['CLOUDFLARE_WORKER_URL', 'IMAGE_SIGNING_SECRET', 'IMAGE_SIGNED_URL_TTL_SECONDS'] as const;
  const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

  it('trả /api/image/<id>.webp?...&pid= (đi qua kiểm quyền + xáo trộn), không có host Worker/sig', () => {
    process.env.CLOUDFLARE_WORKER_URL = 'https://worker.example';
    process.env.IMAGE_SIGNING_SECRET = 'secret';
    try {
      const urls = signImageUrls(['https://worker.example/image/DRIVEFILE0001', 'https://worker.example/image/DRIVEFILE0002?x=1'], 'user1', '64b7f0f2a1b2c3d4e5f60718');
      for (const url of urls) {
        assert.ok(url.startsWith('/api/image/DRIVEFILE000'), url);
        assert.ok(url.includes('pid=64b7f0f2a1b2c3d4e5f60718'), url);
        assert.ok(!url.includes('worker.example') && !url.includes('sig='), url);
      }
    } finally {
      for (const k of ENV_KEYS) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
    }
  });

  it('URL Worker ký server-to-server có TTL mặc định 120s và tối đa 600s', () => {
    delete process.env.IMAGE_SIGNED_URL_TTL_SECONDS;
    assert.equal(getImageSignedUrlTtlSeconds(), 120);
    process.env.IMAGE_SIGNED_URL_TTL_SECONDS = '86400';
    try {
      assert.equal(getImageSignedUrlTtlSeconds(), 600);
    } finally {
      if (saved.IMAGE_SIGNED_URL_TTL_SECONDS === undefined) delete process.env.IMAGE_SIGNED_URL_TTL_SECONDS;
      else process.env.IMAGE_SIGNED_URL_TTL_SECONDS = saved.IMAGE_SIGNED_URL_TTL_SECONDS;
    }
  });

  it('createSignedWorkerImageUrl vẫn tạo URL có exp/sub/sig cho luồng server-to-server', () => {
    process.env.IMAGE_SIGNING_SECRET = 'secret';
    try {
      const url = new URL(createSignedWorkerImageUrl({ workerBaseUrl: 'https://w.example', fileId: 'FILE123456', subject: 'u1' }));
      assert.deepEqual([...url.searchParams.keys()].sort(), ['exp', 'sig', 'sub']);
    } finally {
      if (saved.IMAGE_SIGNING_SECRET === undefined) delete process.env.IMAGE_SIGNING_SECRET;
      else process.env.IMAGE_SIGNING_SECRET = saved.IMAGE_SIGNING_SECRET;
    }
  });
});

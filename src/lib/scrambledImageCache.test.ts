import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getOrCreateScrambled,
  getCachedScrambled,
  clearScrambledImageCache,
  getScrambledImageCacheStats,
} from './scrambledImageCache';

const originalMax = process.env.SCRAMBLED_IMAGE_CACHE_MB;

describe('scrambledImageCache', () => {
  beforeEach(() => {
    clearScrambledImageCache();
    delete process.env.SCRAMBLED_IMAGE_CACHE_MB;
  });

  afterEach(() => {
    if (originalMax === undefined) delete process.env.SCRAMBLED_IMAGE_CACHE_MB;
    else process.env.SCRAMBLED_IMAGE_CACHE_MB = originalMax;
  });

  it('chỉ tính một lần cho nhiều request song song cùng ảnh (chống dồn tải khi ra chương mới)', async () => {
    let calls = 0;
    const produce = async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return Buffer.from('scrambled');
    };

    const results = await Promise.all(Array.from({ length: 25 }, () => getOrCreateScrambled('img-a', produce)));

    assert.equal(calls, 1);
    assert.ok(results.every((buf) => buf.toString() === 'scrambled'));
    assert.equal(getScrambledImageCacheStats().inflight, 0);
  });

  it('lần đọc sau lấy từ cache, không tính lại', async () => {
    let calls = 0;
    const produce = async () => {
      calls += 1;
      return Buffer.from('x');
    };

    await getOrCreateScrambled('img-b', produce);
    await getOrCreateScrambled('img-b', produce);

    assert.equal(calls, 1);
    assert.ok(getCachedScrambled('img-b'));
  });

  it('lỗi không bị cache: request sau được thử lại, và request đang chờ nhận cùng lỗi', async () => {
    let calls = 0;
    const failing = async (): Promise<Buffer> => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      throw new Error('boom');
    };

    const settled = await Promise.allSettled([
      getOrCreateScrambled('img-c', failing),
      getOrCreateScrambled('img-c', failing),
    ]);
    assert.equal(calls, 1);
    assert.ok(settled.every((r) => r.status === 'rejected'));
    assert.equal(getCachedScrambled('img-c'), null);

    const buf = await getOrCreateScrambled('img-c', async () => Buffer.from('ok'));
    assert.equal(buf.toString(), 'ok');
  });

  it('giới hạn dung lượng: loại ảnh lâu không dùng nhất trước (LRU)', async () => {
    process.env.SCRAMBLED_IMAGE_CACHE_MB = '1';
    const chunk = () => Buffer.alloc(400 * 1024, 1);

    await getOrCreateScrambled('one', async () => chunk());
    await getOrCreateScrambled('two', async () => chunk());
    getCachedScrambled('one'); // 'one' vừa dùng => 'two' thành mục cũ nhất
    await getOrCreateScrambled('three', async () => chunk());

    assert.ok(getCachedScrambled('one'));
    assert.equal(getCachedScrambled('two'), null);
    assert.ok(getCachedScrambled('three'));
    assert.ok(getScrambledImageCacheStats().bytes <= 1024 * 1024);
  });

  it('SCRAMBLED_IMAGE_CACHE_MB=0 tắt cache nhưng vẫn gộp request song song', async () => {
    process.env.SCRAMBLED_IMAGE_CACHE_MB = '0';
    let calls = 0;
    const produce = async () => {
      calls += 1;
      return Buffer.from('y');
    };

    await getOrCreateScrambled('img-d', produce);
    await getOrCreateScrambled('img-d', produce);

    assert.equal(calls, 2);
    assert.equal(getScrambledImageCacheStats().entries, 0);
  });
});

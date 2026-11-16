import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getRedisClient, isRedisAvailable, redisGet, redisSet, redisDel, redisDelByPattern, closeRedis } from './redis';
import { getApiCache, setApiCache, invalidateApiCache } from './api-cache';
import { checkRateLimit } from './memoryRateLimit';
import { revokeToken, isTokenRevoked } from './tokenBlacklist';

describe('Redis Module (Graceful Fallback)', () => {
  beforeEach(async () => {
    await closeRedis();
    delete process.env.REDIS_URL;
  });

  it('trả về null khi chưa cấu hình REDIS_URL', () => {
    assert.equal(getRedisClient(), null);
  });

  it('isRedisAvailable trả về false khi không có REDIS_URL', async () => {
    const available = await isRedisAvailable();
    assert.equal(available, false);
  });

  it('redisGet trả về null một cách an toàn khi không có Redis', async () => {
    const val = await redisGet('any_key');
    assert.equal(val, null);
  });

  it('redisSet trả về false một cách an toàn khi không có Redis', async () => {
    const success = await redisSet('any_key', 'value', 1000);
    assert.equal(success, false);
  });

  it('redisDel trả về 0 một cách an toàn khi không có Redis', async () => {
    const count = await redisDel('any_key');
    assert.equal(count, 0);
  });

  it('redisDelByPattern trả về 0 một cách an toàn khi không có Redis', async () => {
    const count = await redisDelByPattern('posts:*');
    assert.equal(count, 0);
  });
});

describe('API Cache (Two-tier with Fallback)', () => {
  it('lưu và đọc dữ liệu qua cache RAM khi không có Redis', async () => {
    const key = `test_cache_${Date.now()}`;
    await setApiCache(key, { message: 'hello' }, 5000);

    const val = await getApiCache<{ message: string }>(key);
    assert.deepEqual(val, { message: 'hello' });
  });

  it('xóa dữ liệu cache bằng invalidateApiCache', async () => {
    const prefix = `test_inv_${Date.now()}`;
    await setApiCache(`${prefix}:item1`, 123, 5000);
    await setApiCache(`${prefix}:item2`, 456, 5000);

    await invalidateApiCache(prefix);

    const val1 = await getApiCache(`${prefix}:item1`);
    const val2 = await getApiCache(`${prefix}:item2`);
    assert.equal(val1, null);
    assert.equal(val2, null);
  });
});

describe('checkRateLimit (Asynchronous Rate Limiting)', () => {
  it('hoạt động chính xác và chặn khi vượt quá hạn mức', async () => {
    const key = `rate_test_${Date.now()}`;
    const r1 = await checkRateLimit(key, 2, 60_000);
    const r2 = await checkRateLimit(key, 2, 60_000);
    const r3 = await checkRateLimit(key, 2, 60_000);

    assert.equal(r1.allowed, true);
    assert.equal(r2.allowed, true);
    assert.equal(r3.allowed, false);
    assert.ok(r3.retryAfter > 0);
  });
});

describe('Auth Token Revocation (Graceful Fallback)', () => {
  it('xử lý an toàn khi gọi revokeToken và isTokenRevoked lúc không có Redis', async () => {
    const token = 'sample-mock-jwt-token-for-test';
    await revokeToken(token);
    // Khi không có Redis, fallback về false (token không bị đánh dấu trong Redis blacklist)
    const revoked = await isTokenRevoked(token);
    assert.equal(revoked, false);
  });

  it('isTokenRevoked trả về true nếu token rỗng', async () => {
    assert.equal(await isTokenRevoked(''), true);
    assert.equal(await isTokenRevoked(null), true);
    assert.equal(await isTokenRevoked(undefined), true);
  });
});

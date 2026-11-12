import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isRetryableUpstreamStatus, isTransientNetworkError, withRetry } from './upstreamRetry';

const noSleep = async () => {};

describe('isTransientNetworkError', () => {
  it('nhận ra các lỗi mạng đã gặp trên production', () => {
    assert.equal(isTransientNetworkError(new TypeError('terminated')), true);
    assert.equal(isTransientNetworkError(new TypeError('fetch failed')), true);
    assert.equal(
      isTransientNetworkError(new TypeError('fetch failed', { cause: Object.assign(new Error('x'), { code: 'ECONNRESET' }) })),
      true
    );
    assert.equal(isTransientNetworkError(new DOMException('timeout', 'TimeoutError')), true);
  });

  it('không retry lỗi logic', () => {
    assert.equal(isTransientNetworkError(new Error('boom')), false);
    assert.equal(isTransientNetworkError(new TypeError('Cannot read properties of undefined')), false);
    assert.equal(isTransientNetworkError('terminated'), false);
  });
});

describe('isRetryableUpstreamStatus', () => {
  it('chỉ retry 408/429/5xx, không retry 403/404', () => {
    for (const status of [408, 429, 500, 502, 503, 504]) assert.equal(isRetryableUpstreamStatus(status), true);
    for (const status of [200, 400, 403, 404, 415]) assert.equal(isRetryableUpstreamStatus(status), false);
  });
});

describe('withRetry', () => {
  it('thử lại tới khi thành công', async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new TypeError('terminated');
        return 'ok';
      },
      { attempts: 3, baseDelayMs: 100, isRetryable: isTransientNetworkError, sleep: noSleep }
    );
    assert.equal(result, 'ok');
    assert.equal(calls, 3);
  });

  it('hết lượt thử thì ném lỗi cuối cùng', async () => {
    let calls = 0;
    await assert.rejects(
      withRetry(
        async () => {
          calls++;
          throw new TypeError('fetch failed');
        },
        { attempts: 3, baseDelayMs: 100, isRetryable: isTransientNetworkError, sleep: noSleep }
      ),
      /fetch failed/
    );
    assert.equal(calls, 3);
  });

  it('không retry lỗi không đáng thử lại', async () => {
    let calls = 0;
    await assert.rejects(
      withRetry(
        async () => {
          calls++;
          throw new Error('Image unavailable');
        },
        { attempts: 3, baseDelayMs: 100, isRetryable: isTransientNetworkError, sleep: noSleep }
      ),
      /Image unavailable/
    );
    assert.equal(calls, 1);
  });

  it('chờ theo backoff luỹ thừa giữa các lần thử', async () => {
    const delays: number[] = [];
    await assert.rejects(
      withRetry(
        async () => {
          throw new TypeError('terminated');
        },
        {
          attempts: 4,
          baseDelayMs: 200,
          isRetryable: isTransientNetworkError,
          sleep: async (ms) => {
            delays.push(ms);
          },
        }
      )
    );
    assert.deepEqual(delays, [200, 400, 800]);
  });
});

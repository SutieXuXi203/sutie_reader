import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatReadingDuration } from './trackAccess';
import { formatReadingTime } from '@/app/admin/types';

describe('formatReadingDuration — định dạng thời lượng phiên đọc cho Telegram', () => {
  it('định dạng đúng các mốc thời gian', () => {
    assert.equal(formatReadingDuration(0), '0 giây');
    assert.equal(formatReadingDuration(-5), '0 giây');
    assert.equal(formatReadingDuration(45), '45 giây');
    assert.equal(formatReadingDuration(60), '1 phút');
    assert.equal(formatReadingDuration(125), '2 phút 5 giây');
    assert.equal(formatReadingDuration(3600), '1 giờ');
    assert.equal(formatReadingDuration(3665), '1 giờ 1 phút 5 giây');
    assert.equal(formatReadingDuration(7200), '2 giờ');
  });
});

describe('formatReadingTime — định dạng thời gian đọc hiển thị trong bảng Admin', () => {
  it('định dạng ngắn gọn cho UI Admin', () => {
    assert.equal(formatReadingTime(0), 'Dưới 1 phút');
    assert.equal(formatReadingTime(undefined), 'Dưới 1 phút');
    assert.equal(formatReadingTime(45), '45s');
    assert.equal(formatReadingTime(60), '1m');
    assert.equal(formatReadingTime(125), '2m 5s');
    assert.equal(formatReadingTime(3600), '1h');
    assert.equal(formatReadingTime(3725), '1h 2m');
  });
});

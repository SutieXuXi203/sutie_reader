import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getPageItems } from './pagination';

describe('getPageItems', () => {
  it('trả về rỗng khi không có trang', () => {
    assert.deepEqual(getPageItems(1, 0), []);
  });

  it('hiện đủ mọi trang khi số trang ít', () => {
    assert.deepEqual(getPageItems(1, 1), [1]);
    assert.deepEqual(getPageItems(3, 7), [1, 2, 3, 4, 5, 6, 7]);
  });

  it('có dấu … ở cuối khi đang ở đầu danh sách', () => {
    assert.deepEqual(getPageItems(1, 20), [1, 2, 3, 4, 5, 'ellipsis-end', 20]);
    assert.deepEqual(getPageItems(3, 20), [1, 2, 3, 4, 5, 'ellipsis-end', 20]);
  });

  it('có dấu … ở đầu khi đang ở cuối danh sách', () => {
    assert.deepEqual(getPageItems(20, 20), [1, 'ellipsis-start', 16, 17, 18, 19, 20]);
    assert.deepEqual(getPageItems(18, 20), [1, 'ellipsis-start', 16, 17, 18, 19, 20]);
  });

  it('có dấu … hai bên khi ở giữa', () => {
    assert.deepEqual(getPageItems(10, 20), [1, 'ellipsis-start', 9, 10, 11, 'ellipsis-end', 20]);
  });

  it('luôn trả về cùng số ô khi nhiều trang để thanh không nhảy', () => {
    for (let p = 1; p <= 20; p++) {
      assert.equal(getPageItems(p, 20).length, 7, `page ${p}`);
    }
  });

  it('kẹp trang hiện tại về khoảng hợp lệ', () => {
    assert.deepEqual(getPageItems(99, 20), getPageItems(20, 20));
    assert.deepEqual(getPageItems(-5, 20), getPageItems(1, 20));
  });
});

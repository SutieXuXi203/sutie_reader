import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { collectImageIds } from './imageIds';

describe('collectImageIds', () => {
  it('gom id từ ảnh cấp bài và mọi chương, không trùng lặp, mọi dạng URL', () => {
    const ids = collectImageIds(
      ['https://w.example/image/COVERIMAGE001', 'COVERIMAGE001'],
      [
        { images: ['/api/image/PAGEIMAGE0002.webp?v=2&pid=abc', 'https://w.example/image/COVERIMAGE001'] },
        { images: ['https://drive.google.com/uc?id=DRIVEFILEID003&export=view'] },
        { title: 'không có ảnh' },
        null,
      ]
    );
    assert.deepEqual([...ids].sort(), ['COVERIMAGE001', 'DRIVEFILEID003', 'PAGEIMAGE0002']);
  });

  it('bỏ qua dữ liệu sai kiểu hoặc không nhận ra được id', () => {
    assert.deepEqual(collectImageIds(undefined, undefined), []);
    assert.deepEqual(collectImageIds('không phải mảng', 'cũng không'), []);
    assert.deepEqual(collectImageIds([42, null, '', 'ngắn', 'https://example.com/a.png'], [{ images: 'x' }]), []);
  });
});

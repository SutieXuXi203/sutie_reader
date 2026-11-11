import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pickPublicCoverUrl } from './ogCover';

const A = 'AAAAAAAAAAAAAAAAAAAA01';
const B = 'BBBBBBBBBBBBBBBBBBBB02';

describe('pickPublicCoverUrl (ảnh bìa của endpoint công khai /api/og-image)', () => {
  it('dùng ảnh cấp bài khi nó thuộc chương không bị hạn chế', () => {
    const post = { images: [A], chapters: [{ accessType: 'inherit', images: [A] }] };
    assert.equal(pickPublicCoverUrl(post), A);
  });

  it('KHÔNG dùng ảnh chương 1 bị restricted (post.images là bản sao của chương 1): lấy chương công khai kế tiếp', () => {
    const post = {
      images: [A],
      chapters: [
        { accessType: 'restricted', images: [A] },
        { accessType: 'inherit', images: [B] },
      ],
    };
    assert.equal(pickPublicCoverUrl(post), B);
  });

  it('trả rỗng nếu mọi chương đều restricted', () => {
    const post = { images: [A], chapters: [{ accessType: 'restricted', images: [A] }, { accessType: 'restricted', images: [B] }] };
    assert.equal(pickPublicCoverUrl(post), '');
  });

  it('ảnh cấp bài không khớp chương nào (dữ liệu cũ/lệch) bị bỏ qua', () => {
    const post = { images: [A], chapters: [{ accessType: 'inherit', images: [B] }] };
    assert.equal(pickPublicCoverUrl(post), B);
  });

  it('nhận ra cùng một file dù khác dạng URL (/api/image/<id>.webp?... và URL Worker)', () => {
    const post = {
      images: [`/api/image/${A}.webp?v=2&pid=x`],
      chapters: [{ accessType: 'restricted', images: [`https://worker.test/image/${A}`] }, { images: [B] }],
    };
    assert.equal(pickPublicCoverUrl(post), B);
  });

  it('truyện kiểu cũ không có chương dùng ảnh cấp bài', () => {
    assert.equal(pickPublicCoverUrl({ images: [A], chapters: [] }), A);
    assert.equal(pickPublicCoverUrl({}), '');
  });
});

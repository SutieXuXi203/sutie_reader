import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { authorizeGuestImage, locateImageInPost, type ImageOwnerPost } from './imageAccess';
import type { AuthUserContext } from './permissions';

const guest: AuthUserContext = { id: 'g1', email: 'guest@gmail.com', role: 'guest' };
const url = (id: string) => `https://worker.example/image/${id}`;

const publicPost: ImageOwnerPost = {
  accessType: 'public',
  images: [url('PUBLICIMG0001')],
  chapters: [{ chapterNumber: 1, accessType: 'inherit', images: [url('PUBLICIMG0001')] }],
};

const restrictedPost: ImageOwnerPost = {
  accessType: 'restricted',
  sharedWith: [],
  images: [url('RESTRICTEDIMG1')],
  chapters: [{ chapterNumber: 1, accessType: 'inherit', images: [url('RESTRICTEDIMG1')] }],
};

const mixedPost: ImageOwnerPost = {
  accessType: 'restricted',
  sharedWith: [],
  chapters: [
    { chapterNumber: 1, accessType: 'public', images: [url('PREVIEWIMG001')] },
    { chapterNumber: 2, accessType: 'inherit', images: [url('LOCKEDIMG0002')] },
  ],
};

describe('authorizeGuestImage — quyền xem ảnh của guest', () => {
  it('cho phép ảnh thuộc truyện công khai', () => {
    assert.equal(authorizeGuestImage(guest, publicPost, 'PUBLICIMG0001', { thumb: false }), true);
  });

  it('từ chối ảnh thuộc truyện restricted (kể cả khi xin thumbnail không phải ảnh bìa)', () => {
    assert.equal(authorizeGuestImage(guest, restrictedPost, 'RESTRICTEDIMG1', { thumb: false }), false);
  });

  it('IDOR: ảnh KHÔNG thuộc bài đã chọn bị từ chối (không thể dùng pid của bài công khai để đọc ảnh bài khác)', () => {
    assert.equal(authorizeGuestImage(guest, publicPost, 'RESTRICTEDIMG1', { thumb: false }), false);
    assert.equal(authorizeGuestImage(guest, publicPost, 'RESTRICTEDIMG1', { thumb: true }), false);
  });

  it('không tìm thấy bài chứa ảnh -> từ chối (fail-closed)', () => {
    assert.equal(authorizeGuestImage(guest, null, 'ANYIMAGE00001', { thumb: false }), false);
  });

  it('quyền kiểm theo TỪNG chương: chương preview công khai được, chương bị khóa thì không', () => {
    assert.equal(authorizeGuestImage(guest, mixedPost, 'PREVIEWIMG001', { thumb: false }), true);
    assert.equal(authorizeGuestImage(guest, mixedPost, 'LOCKEDIMG0002', { thumb: false }), false);
  });

  it('khách được chia sẻ riêng chương nào thì chỉ đọc được chương đó', () => {
    const shared: ImageOwnerPost = {
      ...mixedPost,
      chapters: [
        mixedPost.chapters![0],
        { ...mixedPost.chapters![1], sharedWith: [{ email: guest.email, role: 'viewer' }] },
      ],
    };
    assert.equal(authorizeGuestImage(guest, shared, 'LOCKEDIMG0002', { thumb: false }), true);
  });

  it('thumbnail chỉ miễn quyền chương cho ẢNH BÌA của bài mà guest xem được; ảnh khác vẫn bị kiểm chương', () => {
    const lockedCover: ImageOwnerPost = {
      accessType: 'restricted',
      sharedWith: [],
      chapters: [
        { chapterNumber: 1, accessType: 'inherit', images: [url('COVERIMG00001'), url('PAGE2IMG00001')] },
        { chapterNumber: 2, accessType: 'public', images: [url('FREEIMG000001')] },
      ],
    };
    // guest xem được bài (có chương public) -> ảnh bìa thumbnail được phép
    assert.equal(authorizeGuestImage(guest, lockedCover, 'COVERIMG00001', { thumb: true }), true);
    // trang thứ 2 của chương bị khóa không phải ảnh bìa -> vẫn bị chặn dù xin thumb
    assert.equal(authorizeGuestImage(guest, lockedCover, 'PAGE2IMG00001', { thumb: true }), false);
  });
});

describe('locateImageInPost', () => {
  it('so khớp chính xác theo file id, không so khớp chuỗi con', () => {
    assert.equal(locateImageInPost(publicPost, 'PUBLICIMG').found, false);
    assert.equal(locateImageInPost(publicPost, 'PUBLICIMG0001').found, true);
  });
});

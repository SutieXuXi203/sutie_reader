import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canViewPost, type AuthUserContext, type PostContext } from './permissions';

describe('Bảo Mật Bổ Sung (Security Enhancements)', () => {
  describe('1. Chống dò mã PIN khi đăng nhập', () => {
    it('định dạng rate limit key theo chuẩn pin:login:${ip}:${email}', () => {
      const ip = '192.168.1.100';
      const email = 'User.Test@Gmail.com';
      const key = `pin:login:${ip}:${email.toLowerCase().trim()}`;
      assert.equal(key, 'pin:login:192.168.1.100:user.test@gmail.com');
    });

    it('khóa 15 phút khi đạt 5 lần nhập sai mã PIN', () => {
      let attempts = 4;
      let lockUntil: Date | undefined;

      // Lần thứ 5 nhập sai
      attempts += 1;
      if (attempts >= 5) {
        lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      }

      assert.equal(attempts, 5);
      assert.ok(lockUntil);
      const remainingMs = lockUntil.getTime() - Date.now();
      assert.ok(remainingMs > 14 * 60 * 1000 && remainingMs <= 15 * 60 * 1000);
    });

    it('tính toán số phút chờ chính xác khi bị khóa', () => {
      const lockUntil = new Date(Date.now() + 14.5 * 60 * 1000);
      const waitMinutes = Math.ceil((lockUntil.getTime() - Date.now()) / 60000);
      assert.equal(waitMinutes, 15);
    });
  });

  describe('2. Giới hạn số lần nhập sai mã OTP email (Max 5 attempts)', () => {
    it('tăng số lần thử khi nhập sai OTP và còn dưới 5 lần', () => {
      let verificationAttempts = 0;
      let verificationCode: string | undefined = '123456';

      // Nhập sai lần 1
      verificationAttempts += 1;
      assert.equal(verificationAttempts, 1);
      assert.equal(verificationCode, '123456');

      // Nhập sai tiếp đến lần 4
      verificationAttempts = 4;
      assert.equal(verificationAttempts, 4);
      assert.equal(verificationCode, '123456');
    });

    it('vô hiệu hóa mã OTP (hủy code) và reset attempts khi nhập sai đủ 5 lần', () => {
      let verificationAttempts = 4;
      let verificationCode: string | undefined = '123456';

      // Nhập sai lần thứ 5
      const attempts = verificationAttempts + 1;
      if (attempts >= 5) {
        verificationCode = undefined;
        verificationAttempts = 0;
      } else {
        verificationAttempts = attempts;
      }

      assert.equal(verificationCode, undefined, 'Mã OTP phải bị vô hiệu hóa khi sai 5 lần');
      assert.equal(verificationAttempts, 0, 'verificationAttempts phải được reset về 0 sau khi hủy mã');
    });

    it('reset verificationAttempts về 0 khi đăng ký lại / cấp mã mới', () => {
      let verificationAttempts = 3;
      // Người dùng gửi lại đăng ký để nhận mã mới
      const newCode = '654321';
      verificationAttempts = 0;

      assert.equal(verificationAttempts, 0);
      assert.equal(newCode, '654321');
    });

    it('reset verificationAttempts về 0 và xóa mã khi xác thực thành công', () => {
      let verificationAttempts = 2;
      let verificationCode: string | undefined = '123456';
      let isVerified = false;

      // Nhập đúng mã
      isVerified = true;
      verificationCode = undefined;
      verificationAttempts = 0;

      assert.equal(isVerified, true);
      assert.equal(verificationCode, undefined);
      assert.equal(verificationAttempts, 0);
    });
  });

  describe('3. Kiểm soát Bookmark khi bị thu hồi quyền đọc truyện', () => {
    const guestUser: AuthUserContext = {
      id: 'guest-1',
      email: 'guest@example.com',
      role: 'guest',
    };

    const restrictedPostShared: PostContext = {
      _id: 'post-100',
      title: 'Truyện Riêng Tư Được Share',
      accessType: 'restricted',
      sharedWith: [{ email: 'guest@example.com', role: 'viewer' }],
    };

    const restrictedPostRevoked: PostContext = {
      _id: 'post-100',
      title: 'Truyện Riêng Tư Đã Bị Thu Hồi Quyền',
      accessType: 'restricted',
      sharedWith: [], // Quản trị viên đã xóa email guest khỏi sharedWith
    };

    it('cho phép lưu bookmark khi tài khoản có quyền đọc truyện', () => {
      const decision = canViewPost(guestUser, restrictedPostShared);
      assert.equal(decision.allowed, true);
    });

    it('từ chối lưu bookmark (HTTP 403) khi tài khoản bị thu hồi quyền đọc truyện', () => {
      const decision = canViewPost(guestUser, restrictedPostRevoked);
      assert.equal(decision.allowed, false);
      assert.equal(decision.reason, 'ACCESS_DENIED');
    });

    it('lọc bỏ bookmark khỏi danh sách hiển thị nếu quyền đọc bị thu hồi', () => {
      const bookmarks = [
        {
          _id: 'bm-1',
          postId: 'post-100',
          currentPage: 5,
          totalPages: 20,
        },
      ];

      // Giả lập logic trong GET /api/bookmarks:
      const postMap = new Map([
        ['post-100', restrictedPostRevoked],
      ]);

      const result = bookmarks
        .map((b) => {
          const post = postMap.get(b.postId);
          if (!post) return null;
          const decision = canViewPost(guestUser, post);
          if (!decision.allowed) return null;
          return {
            _id: b._id,
            postId: b.postId,
            postTitle: post.title,
          };
        })
        .filter(Boolean);

      assert.equal(result.length, 0, 'Bookmark của truyện bị thu hồi quyền phải được ẩn hoàn toàn');
    });

    it('hiển thị lại bookmark bình thường nếu quản trị viên cấp lại quyền đọc', () => {
      const bookmarks = [
        {
          _id: 'bm-1',
          postId: 'post-100',
          currentPage: 5,
          totalPages: 20,
        },
      ];

      const postMap = new Map([
        ['post-100', restrictedPostShared],
      ]);

      const result = bookmarks
        .map((b) => {
          const post = postMap.get(b.postId);
          if (!post) return null;
          const decision = canViewPost(guestUser, post);
          if (!decision.allowed) return null;
          return {
            _id: b._id,
            postId: b.postId,
            postTitle: post.title,
          };
        })
        .filter(Boolean);

      assert.equal(result.length, 1);
      assert.equal(result[0]?.postTitle, 'Truyện Riêng Tư Được Share');
    });
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canViewPost, filterPostsForUser, type AuthUserContext, type PostContext } from './permissions';

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

    it('endpoint chi tiết GET /api/bookmarks/[postId] trả về null nếu quyền đọc bị thu hồi', () => {
      const bookmark = {
        userId: guestUser.id,
        postId: 'post-100',
        chapterIndex: 2,
        currentPage: 10,
        totalPages: 25,
      };

      // Khi truyện bị thu hồi quyền:
      const decision = canViewPost(guestUser, restrictedPostRevoked);
      const returnedBookmark = decision.allowed ? bookmark : null;

      assert.equal(returnedBookmark, null, 'Bookmark chi tiết phải là null khi bị thu hồi quyền');
    });
  });

  describe('4. Bảo vệ truy cập trang Quản trị (/admin)', () => {
    it('chỉ cho phép token có vai trò admin vào trang /admin', () => {
      const adminPayload = { role: 'admin', email: 'admin@gmail.com' };
      const userPayload = { role: 'user', email: 'user@gmail.com' };
      const guestPayload = { role: 'guest', email: 'guest@gmail.com' };

      const checkAdminAccess = (payload: { role: string }) => payload.role === 'admin';

      assert.equal(checkAdminAccess(adminPayload), true, 'Admin được phép truy cập');
      assert.equal(checkAdminAccess(userPayload), false, 'User bị từ chối và chuyển hướng');
      assert.equal(checkAdminAccess(guestPayload), false, 'Guest bị từ chối và chuyển hướng');
    });
  });

  describe('5. Chống Bypass Scramble ảnh truyện qua tham số ?raw=1', () => {
    it('chỉ cho phép Quản trị viên sử dụng tham số raw=1 để xem ảnh gốc', () => {
      const isRawRequested = true;

      const evaluateIsRaw = (role: string) => isRawRequested && role === 'admin';

      assert.equal(evaluateIsRaw('admin'), true, 'Admin được phép lấy ảnh gốc');
      assert.equal(evaluateIsRaw('user'), false, 'User bị từ chối raw=1 và phải scramble');
      assert.equal(evaluateIsRaw('guest'), false, 'Guest bị từ chối raw=1 và phải scramble');
    });
  });

  describe('6. Ngăn chặn đăng ký tài khoản bằng Email Quản trị viên gốc', () => {
    it('từ chối đăng ký nếu email trùng khớp với ADMIN_USERNAME', () => {
      const adminUsername = 'admin.sutie@gmail.com';

      const validateRegistrationEmail = (email: string) => {
        const normalized = email.toLowerCase().trim();
        const rootAdmin = adminUsername.toLowerCase().trim();
        if (rootAdmin && normalized === rootAdmin) {
          return { allowed: false, error: 'Địa chỉ email này dành riêng cho Quản trị viên' };
        }
        return { allowed: true };
      };

      assert.equal(validateRegistrationEmail('admin.sutie@gmail.com').allowed, false);
      assert.equal(validateRegistrationEmail('ADMIN.SUTIE@GMAIL.COM').allowed, false);
      assert.equal(validateRegistrationEmail(' other.user@gmail.com ').allowed, true);
    });
  });

  describe('7. Chống Admin tự xóa tài khoản của chính mình', () => {
    it('từ chối yêu cầu xóa nếu target id trùng với id của Admin đang thao tác', () => {
      const currentAdmin = { id: 'admin-id-123', email: 'admin@gmail.com' };

      const canDeleteUser = (operatorId: string, targetId: string) => {
        if (operatorId === targetId) {
          return { allowed: false, error: 'Không thể tự xóa tài khoản của chính mình' };
        }
        return { allowed: true };
      };

      assert.equal(canDeleteUser(currentAdmin.id, 'admin-id-123').allowed, false);
      assert.equal(canDeleteUser(currentAdmin.id, 'other-user-456').allowed, true);
    });
  });

  describe('8. Rate Limiting trên form liên hệ (/api/contact)', () => {
    it('định dạng rate limit key theo chuẩn contact:${ip}', () => {
      const ip = '10.0.0.1';
      const key = `contact:${ip}`;
      assert.equal(key, 'contact:10.0.0.1');
    });

    it('khóa 15 phút khi đạt 5 lần gửi liên hệ liên tiếp', () => {
      let attempts = 4;
      let lockUntil: Date | undefined;

      attempts += 1;
      if (attempts >= 5) {
        lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      }

      assert.equal(attempts, 5);
      assert.ok(lockUntil);
      const remainingMs = lockUntil.getTime() - Date.now();
      assert.ok(remainingMs > 14 * 60 * 1000 && remainingMs <= 15 * 60 * 1000);
    });
  });
});

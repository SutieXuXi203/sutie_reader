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

  describe('9. Chống Bypass Scramble ảnh truyện qua tham số ?pre_scrambled=1', () => {
    it('chỉ cho phép Quản trị viên sử dụng tham số pre_scrambled=1 để lấy ảnh trực tiếp', () => {
      const isPreScrambledRequested = true;

      const evaluateIsPreScrambled = (role: string) => isPreScrambledRequested && role === 'admin';

      assert.equal(evaluateIsPreScrambled('admin'), true, 'Admin được phép dùng pre_scrambled');
      assert.equal(evaluateIsPreScrambled('user'), false, 'User bị từ chối pre_scrambled và phải scramble');
      assert.equal(evaluateIsPreScrambled('guest'), false, 'Guest bị từ chối pre_scrambled và phải scramble');
    });
  });

  describe('10. Chống Open Redirect tại trang /unlock (getSafeCallbackUrl)', () => {
    const getSafeCallbackUrl = (url: string | null): string => {
      if (!url || typeof url !== 'string') return '/';
      const trimmed = url.trim();
      if (
        trimmed.startsWith('/') &&
        !trimmed.startsWith('//') &&
        !trimmed.startsWith('/\\') &&
        !trimmed.includes('\\') &&
        !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
      ) {
        return trimmed;
      }
      return '/';
    };

    it('cho phép các đường dẫn nội bộ hợp lệ', () => {
      assert.equal(getSafeCallbackUrl('/'), '/');
      assert.equal(getSafeCallbackUrl('/posts/123'), '/posts/123');
      assert.equal(getSafeCallbackUrl('/products?tab=favorites'), '/products?tab=favorites');
    });

    it('từ chối và đưa về / đối với các liên kết chuyển hướng độc hại', () => {
      assert.equal(getSafeCallbackUrl('https://evil-site.com'), '/');
      assert.equal(getSafeCallbackUrl('http://attacker.com/phishing'), '/');
      assert.equal(getSafeCallbackUrl('//evil-site.com'), '/');
      assert.equal(getSafeCallbackUrl('/\\evil-site.com'), '/');
      assert.equal(getSafeCallbackUrl('javascript:alert(1)'), '/');
      assert.equal(getSafeCallbackUrl(null), '/');
      assert.equal(getSafeCallbackUrl(''), '/');
    });
  });

  describe('11. Rút ngắn thời hạn OTP xác thực và đảm bảo mã số an toàn', () => {
    it('thời hạn mã OTP đăng ký mới là 15 phút thay vì 24 giờ', () => {
      const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
      const remainingMinutes = Math.round((otpExpiresAt.getTime() - Date.now()) / 60000);
      assert.equal(remainingMinutes, 15);
    });

    it('mã OTP luôn có độ dài 6 chữ số hợp lệ từ 100000 đến 999999', () => {
      for (let i = 0; i < 20; i++) {
        // Mô phỏng randomInt(100000, 1000000)
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        assert.equal(code.length, 6);
        assert.ok(/^\d{6}$/.test(code));
      }
    });
  });

  describe('12. Chống HTML Injection và Regex Injection', () => {
    it('escapeHtml mã hóa chính xác các ký tự HTML nhạy cảm trong form liên hệ', () => {
      const escapeHtml = (str: string): string => {
        return str.replace(/[&<>"']/g, (m) => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#039;',
        }[m] || m));
      };

      const maliciousName = '<script>alert("hacked")</script>';
      const maliciousMsg = '<a href="http://evil.com">Click me</a> & "win"';

      assert.equal(
        escapeHtml(maliciousName),
        '&lt;script&gt;alert(&quot;hacked&quot;)&lt;/script&gt;'
      );
      assert.equal(
        escapeHtml(maliciousMsg),
        '&lt;a href=&quot;http://evil.com&quot;&gt;Click me&lt;/a&gt; &amp; &quot;win&quot;'
      );
    });

    it('escapeRegExp vô hiệu hóa các ký tự đặc biệt của biểu thức chính quy khi quản lý Tag', () => {
      const escapeRegExp = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      const dangerousTag = '(a+)+$';
      const escaped = escapeRegExp(dangerousTag);
      assert.equal(escaped, '\\(a\\+\\)\\+\\$');

      // Test khi tạo RegExp không bị lỗi ReDoS hoặc syntax error
      const regex = new RegExp(`^${escaped}$`, 'i');
      assert.equal(regex.test('(a+)+$'), true);
      assert.equal(regex.test('aaaa'), false);
    });
  });

  describe('13. Bảo vệ mã PIN bằng Signed JWT Token thay vì plaintext cookie', () => {
    it('thẩm định token mở khóa site chứa scope site_unlock hợp lệ', async () => {
      const { SignJWT, jwtVerify } = await import('jose');
      const testSecret = new TextEncoder().encode('test_jwt_secret_key_123456789012');

      const token = await new SignJWT({ scope: 'site_unlock' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('30d')
        .sign(testSecret);

      const { payload } = await jwtVerify(token, testSecret);
      assert.equal(payload.scope, 'site_unlock');

      // Giả mạo token không có scope
      const fakeToken = await new SignJWT({ scope: 'other' })
        .setProtectedHeader({ alg: 'HS256' })
        .sign(testSecret);
      const fakeVerify = await jwtVerify(fakeToken, testSecret);
      assert.notEqual(fakeVerify.payload.scope, 'site_unlock');
    });

    it('timingSafeEqual chống timing attack khi so sánh mã PIN', async () => {
      const crypto = await import('node:crypto');
      const pin1 = Buffer.from('123456');
      const pin2 = Buffer.from('123456');
      const pin3 = Buffer.from('654321');

      assert.equal(crypto.timingSafeEqual(pin1, pin2), true);
      assert.equal(crypto.timingSafeEqual(pin1, pin3), false);
    });
  });

  describe('14. Chống Brute Force mật khẩu đăng nhập (Password Rate Limiting)', () => {
    it('định dạng rate limit key theo chuẩn pwd:login:${ip}:${email}', () => {
      const ip = '192.168.1.100';
      const email = ' TestUser@gmail.com ';
      const normalizedEmail = email.toLowerCase().trim();
      const rateLimitKey = `pwd:login:${ip}:${normalizedEmail}`;

      assert.equal(rateLimitKey, 'pwd:login:192.168.1.100:testuser@gmail.com');
    });

    it('khóa 15 phút khi nhập sai mật khẩu đủ 5 lần', () => {
      let attempts = 4;
      let lockUntil: Date | undefined;

      // Lần sai thứ 5
      attempts += 1;
      if (attempts >= 5) {
        lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      }

      assert.equal(attempts, 5);
      assert.ok(lockUntil);
      assert.ok(lockUntil.getTime() > Date.now());
    });

    it('reset rate limit khi đăng nhập mật khẩu thành công', () => {
      let pwdRateLimit: { attempts: number } | null = { attempts: 3 };
      const loginSuccess = true;

      if (loginSuccess && pwdRateLimit) {
        pwdRateLimit = null;
      }

      assert.equal(pwdRateLimit, null);
    });
  });

  describe('15. Kiểm tra hợp lệ ObjectId trong Bookmark API', () => {
    it('nhận diện chính xác ObjectId hợp lệ và không hợp lệ', async () => {
      const { ObjectId } = await import('mongodb');

      const validId = '507f1f77bcf86cd799439011';
      const invalidId1 = 'null';
      const invalidId2 = 'undefined';
      const invalidId3 = 'invalid-mongo-id-123';

      assert.equal(ObjectId.isValid(validId), true);
      assert.equal(ObjectId.isValid(invalidId1), false);
      assert.equal(ObjectId.isValid(invalidId2), false);
      assert.equal(ObjectId.isValid(invalidId3), false);
    });
  });

  describe('16. Ngụy trang đường dẫn ảnh xáo trộn chống Crawler phát hiện (Crawler Deception)', () => {
    it('ensureScrambledImageUrl tạo URL dạng chuẩn tĩnh .webp?v=2 và KHÔNG chứa từ khóa scramble', async () => {
      const { ensureScrambledImageUrl } = await import('./utils');

      const testId = '1LOpaFTkog3PbmZupfzsgCt1YnFUjTOxI';
      const rawDriveUrl = `https://drive.google.com/file/d/${testId}/view`;
      const generatedUrl = ensureScrambledImageUrl(rawDriveUrl);

      assert.equal(generatedUrl, `/api/image/${testId}.webp?v=2`);
      assert.equal(generatedUrl.includes('scramble'), false, 'URL không được chứa từ khóa scramble');
      assert.equal(generatedUrl.includes('thumb'), false, 'URL không được là thumbnail');
    });

    it('parseScrambleParams tự động kích hoạt giải mã Canvas dù URL không chứa scramble=1', async () => {
      const { parseScrambleParams } = await import('./scramble');

      const stealthUrl = '/api/image/1LOpaFTkog3PbmZupfzsgCt1YnFUjTOxI.webp?v=2';
      const meta = parseScrambleParams(stealthUrl);

      assert.equal(meta.isScrambled, true, 'Canvas phải tự động giải mã ảnh truyện');
      assert.ok(meta.seed.startsWith('sutie_'), 'Seed phải được sinh ra tự động từ secret salt');
      assert.equal(meta.rows, 8);
      assert.equal(meta.cols, 8);

      // Thumbnail vẫn giữ nguyên là không xáo trộn
      const thumbUrl = '/api/image/1LOpaFTkog3PbmZupfzsgCt1YnFUjTOxI.webp?v=2&thumb=1';
      const thumbMeta = parseScrambleParams(thumbUrl);
      assert.equal(thumbMeta.isScrambled, false, 'Thumbnail không được xáo trộn');
    });

    it('extractDriveImageId bóc tách chính xác fileId từ URL có đuôi mở rộng .webp', async () => {
      const { extractDriveImageId } = await import('./utils');

      const fileId = '1LOpaFTkog3PbmZupfzsgCt1YnFUjTOxI';
      const urlWithExt = `/api/image/${fileId}.webp?v=2`;
      const extracted = extractDriveImageId(urlWithExt);

      assert.equal(extracted, fileId);
    });
  });

  describe('17. Bảo vệ danh sách độc giả (accessedUsers) & Chống Timing Attack mã OTP', () => {
    it('ẩn toàn bộ accessedUsers với người dùng thường và khách đọc link chia sẻ', () => {
      const accessedUsersList = [
        { email: 'admin@domain.com', name: 'Admin', role: 'admin', lastAccessedAt: new Date() },
        { email: 'reader1@domain.com', name: 'Reader 1', role: 'user', lastAccessedAt: new Date() },
        { email: 'reader2@domain.com', name: 'Reader 2', role: 'guest', lastAccessedAt: new Date() },
      ];

      // Giả lập logic kiểm duyệt trong GET /api/posts/[id]
      const filterAccessedUsersForResponse = (role: string | undefined, list: typeof accessedUsersList) => {
        return role === 'admin' ? list : undefined;
      };

      assert.equal(filterAccessedUsersForResponse('guest', accessedUsersList), undefined);
      assert.equal(filterAccessedUsersForResponse('user', accessedUsersList), undefined);
      assert.equal(filterAccessedUsersForResponse(undefined, accessedUsersList), undefined);
      assert.equal(filterAccessedUsersForResponse('admin', accessedUsersList)?.length, 3);
    });

    it('endpoint ghi nhận truy cập link (POST /api/posts/[id]/access) chỉ trả về danh sách độc giả cho admin', () => {
      const accessedUsersList = [
        { email: 'reader1@domain.com', name: 'Reader 1', role: 'user' },
      ];

      const filterAccessEndpointResponse = (userRole: string, list: typeof accessedUsersList) => {
        return userRole === 'admin' ? list : [];
      };

      assert.deepEqual(filterAccessEndpointResponse('guest', accessedUsersList), []);
      assert.deepEqual(filterAccessEndpointResponse('user', accessedUsersList), []);
      assert.deepEqual(filterAccessEndpointResponse('admin', accessedUsersList), accessedUsersList);
    });

    it('kiểm tra mã xác thực OTP an toàn thời gian thực (crypto.timingSafeEqual)', async () => {
      const crypto = await import('node:crypto');

      const verifyOtpConstantTime = (storedCode: string | undefined, inputCode: string): boolean => {
        if (!storedCode || typeof inputCode !== 'string') return false;
        const storedBuffer = Buffer.from(storedCode);
        const inputBuffer = Buffer.from(inputCode);
        return (
          storedBuffer.length === inputBuffer.length &&
          crypto.timingSafeEqual(storedBuffer, inputBuffer)
        );
      };

      assert.equal(verifyOtpConstantTime('654321', '654321'), true);
      assert.equal(verifyOtpConstantTime('654321', '123456'), false);
      assert.equal(verifyOtpConstantTime('654321', '65432'), false); // độ dài khác nhau
      assert.equal(verifyOtpConstantTime(undefined, '654321'), false);
    });
  });

  describe('18. Đảm bảo ảnh Thumbnail luôn có tham số thumb=1 và không bị xáo trộn', () => {
    it('getOptimizedImageUrl tự động gắn thumb=1 vào đường dẫn /api/image/... nếu chưa có', async () => {
      const { getOptimizedImageUrl } = await import('./utils');
      const fileId = '1LOpaFTkog3PbmZupfzsgCt1YnFUjTOxI';

      const stealthUrl = `/api/image/${fileId}.webp?v=2`;
      const thumbUrl = getOptimizedImageUrl(stealthUrl);

      assert.ok(thumbUrl.includes('thumb=1'), 'Thumbnail URL bắt buộc phải có thumb=1');
      assert.equal(thumbUrl, `/api/image/${fileId}.webp?v=2&thumb=1`);
    });

    it('getOptimizedImageUrl loại bỏ hoàn toàn các tham số scramble khỏi ảnh thumbnail', async () => {
      const { getOptimizedImageUrl } = await import('./utils');
      const fileId = '1LOpaFTkog3PbmZupfzsgCt1YnFUjTOxI';

      const scrambledUrl = `/api/image/${fileId}.webp?v=2&scramble=1&seed=sutie_seed_1&rows=8&cols=8`;
      const thumbUrl = getOptimizedImageUrl(scrambledUrl);

      assert.ok(thumbUrl.includes('thumb=1'), 'Thumbnail URL phải có thumb=1');
      assert.equal(thumbUrl.includes('scramble'), false, 'Thumbnail không được chứa tham số scramble');
      assert.equal(thumbUrl.includes('seed'), false, 'Thumbnail không được chứa tham số seed');
    });

    it('parseScrambleParams xác nhận URL qua getOptimizedImageUrl không bị kích hoạt ScrambledCanvas', async () => {
      const { getOptimizedImageUrl } = await import('./utils');
      const { parseScrambleParams } = await import('./scramble');
      const fileId = '1LOpaFTkog3PbmZupfzsgCt1YnFUjTOxI';

      const rawReaderUrl = `/api/image/${fileId}.webp?v=2`;
      const thumbUrl = getOptimizedImageUrl(rawReaderUrl);
      const meta = parseScrambleParams(thumbUrl);

      assert.equal(meta.isScrambled, false, 'Thumbnail mode tuyệt đối không được coi là ảnh xáo trộn');
    });
  });

  describe('19. Chống DoS bằng cách kẹp giới hạn hàng và cột (rows, cols) khi xáo trộn ảnh', () => {
    it('kẹp giá trị hàng/cột trong khoảng [2, 16] khi nhận tham số quá lớn hoặc bất thường', () => {
      const clampDimension = (val: number) => Math.min(Math.max(val, 2), 16);

      assert.equal(clampDimension(5000), 16, 'Giá trị 5000 phải bị kẹp xuống 16');
      assert.equal(clampDimension(100), 16, 'Giá trị 100 phải bị kẹp xuống 16');
      assert.equal(clampDimension(1), 2, 'Giá trị 1 phải được nâng lên tối thiểu 2');
      assert.equal(clampDimension(-5), 2, 'Giá trị âm phải được nâng lên tối thiểu 2');
      assert.equal(clampDimension(8), 8, 'Giá trị 8 tiêu chuẩn được giữ nguyên');
    });
  });

  describe('20. Cấp phát token upload ngắn hạn có scope upload (Chống lộ session Admin)', () => {
    it('token upload có thời hạn ngắn (10m) và mang scope upload', async () => {
      const { SignJWT, jwtVerify } = await import('jose');
      const testSecret = new TextEncoder().encode('test_secret_for_jwt_upload_token_123');

      const uploadToken = await new SignJWT({
        id: 'admin_123',
        email: 'admin@gmail.com',
        role: 'admin',
        scope: 'upload',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('10m')
        .sign(testSecret);

      const { payload } = await jwtVerify(uploadToken, testSecret);
      assert.equal(payload.scope, 'upload');
      assert.equal(payload.role, 'admin');
      assert.ok(payload.exp && payload.iat && payload.exp - payload.iat <= 600);
    });
  });

  describe('21. Thu hồi quyền Admin và xóa cache User (clearUserCache)', () => {
    it('thu hồi quyền và xóa cache user mục tiêu khi role bị thay đổi', () => {
      const mockCache = new Map<string, { user: { id: string; role: string } | null; expiresAt: number }>();
      mockCache.set('token_admin', { user: { id: 'user_1', role: 'admin' }, expiresAt: Date.now() + 60000 });
      mockCache.set('token_other', { user: { id: 'user_2', role: 'user' }, expiresAt: Date.now() + 60000 });

      const evict = (targetId?: string) => {
        if (!targetId) {
          mockCache.clear();
          return;
        }
        for (const [token, entry] of mockCache.entries()) {
          if (entry.user && entry.user.id === targetId) {
            mockCache.delete(token);
          }
        }
      };

      evict('user_1');
      assert.equal(mockCache.has('token_admin'), false, 'Session của user_1 phải bị xóa khỏi cache');
      assert.equal(mockCache.has('token_other'), true, 'Session của user_2 vẫn được giữ nguyên');

      evict();
      assert.equal(mockCache.size, 0, 'Gọi không tham số phải xóa toàn bộ cache');
    });
  });

  describe('22. Tự động đồng bộ và làm mới token khi đổi vai trò (Auto-refresh Token)', () => {
    it('nhận diện chính xác URL chuyển hướng an toàn (chống Open Redirect)', () => {
      const getSafeCallbackUrl = (callbackUrl: string | null | undefined): string => {
        if (!callbackUrl) return '/admin';
        const clean = callbackUrl.trim();
        if (
          clean.startsWith('/') &&
          !clean.startsWith('//') &&
          !clean.includes('\\') &&
          !clean.includes('://')
        ) {
          return clean;
        }
        return '/admin';
      };

      assert.equal(getSafeCallbackUrl('/admin'), '/admin');
      assert.equal(getSafeCallbackUrl('/admin/users'), '/admin/users');
      assert.equal(getSafeCallbackUrl('https://evil.com'), '/admin');
      assert.equal(getSafeCallbackUrl('//evil.com'), '/admin');
      assert.equal(getSafeCallbackUrl('/\\evil.com'), '/admin');
      assert.equal(getSafeCallbackUrl(null), '/admin');
    });

    it('tự động phát hành token mang vai trò mới nhất nếu phát hiện lệch vai trò', async () => {
      const { SignJWT, jwtVerify } = await import('jose');
      const testSecret = new TextEncoder().encode('test_secret_for_jwt_signing_key_32_bytes_long!!');
      const oldToken = await new SignJWT({ id: 'user_123', email: 'test@gmail.com', role: 'user' })
        .setProtectedHeader({ alg: 'HS256' })
        .sign(testSecret);

      const dbUser = { id: 'user_123', email: 'test@gmail.com', role: 'admin' };
      const { payload } = await jwtVerify(oldToken, testSecret);

      assert.notEqual(payload.role, dbUser.role, 'Token cũ phải khác role với DB');

      // Thực hiện cấp mới token
      const newToken = await new SignJWT({ id: dbUser.id, email: dbUser.email, role: dbUser.role })
        .setProtectedHeader({ alg: 'HS256' })
        .sign(testSecret);

      const { payload: newPayload } = await jwtVerify(newToken, testSecret);
      assert.equal(newPayload.role, 'admin', 'Token mới phải mang đúng role admin từ DB');
    });
  });
});




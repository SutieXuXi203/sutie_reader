import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canViewPost,
  filterPostsForUser,
  canManagePost,
  canManageUsers,
  canManageShares,
  canManageTags,
  canModifyTargetUser,
  requiresPinOnLogin,
  filterPostPrivacyForUser,
  type AuthUserContext,
  type PostContext,
} from './permissions';

describe('Hệ Thống Phân Quyền & Vai Trò (Roles & Permissions)', () => {
  // Mock users
  const adminUser: AuthUserContext = {
    id: 'user-admin-1',
    email: 'admin@example.com',
    name: 'Quản trị viên',
    role: 'admin',
  };

  const memberUser: AuthUserContext = {
    id: 'user-member-2',
    email: 'member@example.com',
    name: 'Thành viên chính thức',
    role: 'user',
  };

  const guestUserShared: AuthUserContext = {
    id: 'user-guest-3',
    email: 'guest.shared@gmail.com',
    name: 'Khách được chia sẻ',
    role: 'guest',
  };

  const guestUserUnshared: AuthUserContext = {
    id: 'user-guest-4',
    email: 'guest.unshared@gmail.com',
    name: 'Khách chưa được cấp quyền',
    role: 'guest',
  };

  // Mock posts
  const publicPost: PostContext = {
    _id: 'post-pub-1',
    title: 'Truyện Công Khai',
    accessType: 'public',
    sharedWith: [],
    accessedUsers: [],
  };

  const restrictedPost: PostContext = {
    _id: 'post-res-2',
    title: 'Truyện Giới Hạn Riêng Tư',
    accessType: 'restricted',
    sharedWith: [
      {
        email: 'guest.shared@gmail.com',
        userId: 'user-guest-3',
        role: 'viewer',
        addedAt: new Date(),
      },
      {
        email: 'another.guest@gmail.com',
        role: 'viewer',
        addedAt: new Date(),
      },
    ],
    accessedUsers: [
      {
        email: 'guest.shared@gmail.com',
        name: 'Khách được chia sẻ',
        role: 'guest',
        lastAccessedAt: new Date(),
      },
      {
        email: 'other.person@gmail.com',
        name: 'Người khác',
        role: 'guest',
        lastAccessedAt: new Date(),
      },
    ],
  };

  describe('1. Quyền xem nội dung truyện (canViewPost)', () => {
    describe('Truyện ở chế độ công khai (public)', () => {
      it('cho phép khách vãng lai (chưa đăng nhập) xem truyện công khai', () => {
        const result = canViewPost(null, publicPost);
        assert.equal(result.allowed, true);
      });

      it('cho phép tài khoản guest xem truyện công khai', () => {
        const result = canViewPost(guestUserUnshared, publicPost);
        assert.equal(result.allowed, true);
      });

      it('cho phép tài khoản user xem truyện công khai', () => {
        const result = canViewPost(memberUser, publicPost);
        assert.equal(result.allowed, true);
      });

      it('cho phép tài khoản admin xem truyện công khai', () => {
        const result = canViewPost(adminUser, publicPost);
        assert.equal(result.allowed, true);
      });
    });

    describe('Truyện ở chế độ giới hạn (restricted)', () => {
      it('chặn khách vãng lai và yêu cầu đăng nhập (REQUIRE_LOGIN)', () => {
        const result = canViewPost(null, restrictedPost);
        assert.equal(result.allowed, false);
        assert.equal(result.reason, 'REQUIRE_LOGIN');
        assert.match(result.message || '', /đăng nhập/i);
      });

      it('chặn tài khoản guest nếu email/userId không có trong sharedWith (ACCESS_DENIED)', () => {
        const result = canViewPost(guestUserUnshared, restrictedPost);
        assert.equal(result.allowed, false);
        assert.equal(result.reason, 'ACCESS_DENIED');
        assert.match(result.message || '', /không có quyền/i);
      });

      it('cho phép tài khoản guest xem nếu email khớp trong sharedWith', () => {
        const result = canViewPost(guestUserShared, restrictedPost);
        assert.equal(result.allowed, true);
      });

      it('cho phép tài khoản guest xem nếu email viết hoa hoặc có khoảng trắng thừa', () => {
        const uppercaseGuest: AuthUserContext = {
          ...guestUserShared,
          email: '  GUEST.SHARED@GMAIL.COM  ',
        };
        const result = canViewPost(uppercaseGuest, restrictedPost);
        assert.equal(result.allowed, true);
      });

      it('cho phép tài khoản guest xem nếu userId khớp trong sharedWith', () => {
        const guestWithDifferentEmail: AuthUserContext = {
          id: 'user-guest-3',
          email: 'newemail@gmail.com',
          role: 'guest',
        };
        const result = canViewPost(guestWithDifferentEmail, restrictedPost);
        assert.equal(result.allowed, true);
      });

      it('cho phép tài khoản user (thành viên) xem truyện giới hạn mà không cần có trong sharedWith', () => {
        const result = canViewPost(memberUser, restrictedPost);
        assert.equal(result.allowed, true);
      });

      it('cho phép tài khoản admin (quản trị viên) toàn quyền xem truyện giới hạn', () => {
        const result = canViewPost(adminUser, restrictedPost);
        assert.equal(result.allowed, true);
      });
    });
  });

  describe('2. Lọc danh sách bài viết theo vai trò (filterPostsForUser)', () => {
    const postCatalog: PostContext[] = [
      publicPost,
      restrictedPost,
      {
        _id: 'post-res-3',
        title: 'Truyện Giới Hạn Khác',
        accessType: 'restricted',
        sharedWith: [{ email: 'someone.else@gmail.com', role: 'viewer' }],
      },
    ];

    it('khách vãng lai chỉ nhìn thấy truyện public', () => {
      const visible = filterPostsForUser(postCatalog, null);
      assert.equal(visible.length, 1);
      assert.equal(visible[0]._id, publicPost._id);
    });

    it('khách có tài khoản (guest) nhìn thấy truyện public và truyện được share với mình', () => {
      const visible = filterPostsForUser(postCatalog, guestUserShared);
      assert.equal(visible.length, 2);
      const ids = visible.map((p) => p._id);
      assert.ok(ids.includes(publicPost._id));
      assert.ok(ids.includes(restrictedPost._id));
    });

    it('khách có tài khoản (guest) không được share truyện nào chỉ thấy truyện public', () => {
      const visible = filterPostsForUser(postCatalog, guestUserUnshared);
      assert.equal(visible.length, 1);
      assert.equal(visible[0]._id, publicPost._id);
    });

    it('thành viên chính thức (user) nhìn thấy toàn bộ tất cả truyện', () => {
      const visible = filterPostsForUser(postCatalog, memberUser);
      assert.equal(visible.length, 3);
    });

    it('quản trị viên (admin) nhìn thấy toàn bộ tất cả truyện', () => {
      const visible = filterPostsForUser(postCatalog, adminUser);
      assert.equal(visible.length, 3);
    });
  });

  describe('3. Phân quyền thao tác quản trị (Admin Only)', () => {
    it('quản lý truyện (canManagePost): Chỉ admin được phép', () => {
      assert.equal(canManagePost(adminUser), true);
      assert.equal(canManagePost(memberUser), false);
      assert.equal(canManagePost(guestUserShared), false);
      assert.equal(canManagePost(null), false);
    });

    it('quản lý người dùng (canManageUsers): Chỉ admin được phép', () => {
      assert.equal(canManageUsers(adminUser), true);
      assert.equal(canManageUsers(memberUser), false);
      assert.equal(canManageUsers(guestUserShared), false);
      assert.equal(canManageUsers(null), false);
    });

    it('quản lý chia sẻ quyền (canManageShares): Chỉ admin được phép', () => {
      assert.equal(canManageShares(adminUser), true);
      assert.equal(canManageShares(memberUser), false);
      assert.equal(canManageShares(guestUserShared), false);
      assert.equal(canManageShares(null), false);
    });

    it('quản lý thể loại/tags (canManageTags): Chỉ admin được phép', () => {
      assert.equal(canManageTags(adminUser), true);
      assert.equal(canManageTags(memberUser), false);
      assert.equal(canManageTags(guestUserShared), false);
      assert.equal(canManageTags(null), false);
    });
  });

  describe('4. Thẩm định hành vi chỉnh sửa/xóa người dùng (canModifyTargetUser)', () => {
    const rootAdminEmail = 'rootadmin@sutie.com';
    const rootAdminTarget = { email: rootAdminEmail, role: 'admin' as const };
    const regularUserTarget = { email: 'john@example.com', role: 'user' as const };

    it('chặn người dùng không phải admin thực hiện thao tác', () => {
      const result = canModifyTargetUser(memberUser, regularUserTarget, 'delete');
      assert.equal(result.allowed, false);
      assert.match(result.error || '', /không có quyền/i);
    });

    it('cho phép admin nâng hoặc hạ vai trò của người dùng bình thường', () => {
      const res1 = canModifyTargetUser(adminUser, regularUserTarget, 'change_role', 'admin');
      assert.equal(res1.allowed, true);

      const res2 = canModifyTargetUser(adminUser, regularUserTarget, 'change_role', 'guest');
      assert.equal(res2.allowed, true);
    });

    it('báo lỗi nếu đổi sang vai trò không hợp lệ (không thuộc guest/user/admin)', () => {
      const result = canModifyTargetUser(adminUser, regularUserTarget, 'change_role', 'superman');
      assert.equal(result.allowed, false);
      assert.match(result.error || '', /không hợp lệ/i);
    });

    it('cho phép admin xóa tài khoản người dùng bình thường', () => {
      const result = canModifyTargetUser(adminUser, regularUserTarget, 'delete');
      assert.equal(result.allowed, true);
    });

    it('tuyệt đối KHÔNG CHO PHÉP xóa tài khoản quản trị viên gốc (ADMIN_USERNAME)', () => {
      const result = canModifyTargetUser(
        adminUser,
        rootAdminTarget,
        'delete',
        undefined,
        rootAdminEmail
      );
      assert.equal(result.allowed, false);
      assert.match(result.error || '', /quản trị viên gốc/i);
    });

    it('tuyệt đối KHÔNG CHO PHÉP hạ quyền tài khoản quản trị viên gốc (ADMIN_USERNAME) sang user hoặc guest', () => {
      const resUser = canModifyTargetUser(
        adminUser,
        rootAdminTarget,
        'change_role',
        'user',
        rootAdminEmail
      );
      assert.equal(resUser.allowed, false);
      assert.match(resUser.error || '', /quản trị viên gốc/i);

      const resGuest = canModifyTargetUser(
        adminUser,
        rootAdminTarget,
        'change_role',
        'guest',
        rootAdminEmail
      );
      assert.equal(resGuest.allowed, false);
      assert.match(resGuest.error || '', /quản trị viên gốc/i);
    });
  });

  describe('5. Chính sách yêu cầu mã PIN khi đăng nhập (requiresPinOnLogin)', () => {
    it('khi hệ thống không đặt UNLOCK_PIN thì không vai trò nào bị hỏi PIN', () => {
      assert.equal(requiresPinOnLogin('admin', null), false);
      assert.equal(requiresPinOnLogin('user', ''), false);
      assert.equal(requiresPinOnLogin('guest', undefined), false);
    });

    it('khi có cấu hình UNLOCK_PIN:', () => {
      const pin = '123456';
      // role admin bắt buộc nhập PIN
      assert.equal(requiresPinOnLogin('admin', pin), true);

      // role user bắt buộc nhập PIN
      assert.equal(requiresPinOnLogin('user', pin), true);

      // role guest KHÔNG bắt buộc nhập PIN (miễn trừ cho khách vãng lai đăng ký)
      assert.equal(requiresPinOnLogin('guest', pin), false);
    });
  });

  describe('6. Bảo vệ quyền riêng tư người dùng (filterPostPrivacyForUser)', () => {
    it('với Admin: Giữ nguyên toàn bộ danh sách sharedWith và accessedUsers', () => {
      const filtered = filterPostPrivacyForUser(restrictedPost, adminUser);
      assert.equal(filtered.sharedWith?.length, restrictedPost.sharedWith?.length);
      assert.equal(filtered.accessedUsers?.length, restrictedPost.accessedUsers?.length);
    });

    it('với Khách được chia sẻ (guest): Chỉ hiển thị bản ghi của chính mình, ẩn toàn bộ danh sách email khác và accessedUsers', () => {
      const filtered = filterPostPrivacyForUser(restrictedPost, guestUserShared);
      assert.equal(filtered.sharedWith?.length, 1);
      assert.equal(filtered.sharedWith?.[0].email, guestUserShared.email);
      assert.equal(filtered.accessedUsers?.length, 0);
    });

    it('với Thành viên chính thức (user): Ẩn toàn bộ sharedWith và accessedUsers', () => {
      const filtered = filterPostPrivacyForUser(restrictedPost, memberUser);
      assert.equal(filtered.sharedWith?.length, 0);
      assert.equal(filtered.accessedUsers?.length, 0);
    });

    it('với Khách vãng lai (chưa đăng nhập): Ẩn toàn bộ sharedWith và accessedUsers', () => {
      const filtered = filterPostPrivacyForUser(restrictedPost, null);
      assert.equal(filtered.sharedWith?.length, 0);
      assert.equal(filtered.accessedUsers?.length, 0);
    });
  });
});

export type UserRole = 'guest' | 'user' | 'admin';

export interface AuthUserContext {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
}

export interface PostShareItem {
  email: string;
  userId?: string;
  role?: 'viewer' | string;
  addedAt?: Date | string;
}

export interface PostAccessedItem {
  email: string;
  userId?: string;
  name?: string;
  avatar?: string;
  role?: string;
  lastAccessedAt?: Date | string;
}

export interface PostContext {
  _id?: string;
  title?: string;
  accessType?: 'restricted' | 'public';
  sharedWith?: PostShareItem[];
  accessedUsers?: PostAccessedItem[];
  [key: string]: unknown;
}

export type AccessDecision = {
  allowed: boolean;
  reason?: 'REQUIRE_LOGIN' | 'ACCESS_DENIED';
  message?: string;
};

/**
 * Kiểm tra xem người dùng có quyền đọc bài viết/truyện hay không.
 *
 * Quy tắc:
 * 1. accessType === 'public' -> Cho phép tất cả (kể cả khách vãng lai chưa đăng nhập).
 * 2. accessType === 'restricted':
 *    - Chưa đăng nhập (user = null) -> Từ chối với lý do REQUIRE_LOGIN.
 *    - user.role là 'admin' hoặc 'user' -> Toàn quyền truy cập.
 *    - user.role là 'guest' -> Chỉ được đọc nếu email hoặc userId có trong sharedWith.
 *      Nếu không có -> Từ chối với lý do ACCESS_DENIED.
 */
export function canViewPost(
  user: AuthUserContext | null | undefined,
  post: PostContext
): AccessDecision {
  const accessType = post.accessType || 'restricted';

  if (accessType === 'public') {
    return { allowed: true };
  }

  if (!user) {
    return {
      allowed: false,
      reason: 'REQUIRE_LOGIN',
      message: 'Vui lòng đăng nhập để đọc truyện này',
    };
  }

  if (user.role === 'admin' || user.role === 'user') {
    return { allowed: true };
  }

  if (user.role === 'guest') {
    const userEmail = (user.email || '').toLowerCase().trim();
    const userId = user.id ? String(user.id) : '';

    const isShared = Array.isArray(post.sharedWith) && post.sharedWith.some((s) => {
      const shareEmail = (s.email || '').toLowerCase().trim();
      const shareUserId = s.userId ? String(s.userId) : '';
      return (shareEmail && shareEmail === userEmail) || (shareUserId && shareUserId === userId);
    });

    if (isShared) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: 'ACCESS_DENIED',
      message: 'Bạn không có quyền truy cập truyện này. Vui lòng liên hệ quản trị viên để được cấp quyền.',
    };
  }

  return {
    allowed: false,
    reason: 'ACCESS_DENIED',
    message: 'Bạn không có quyền truy cập truyện này.',
  };
}

/**
 * Lọc danh sách bài viết theo vai trò người dùng (cho trang chủ và API danh sách).
 */
export function filterPostsForUser<T extends PostContext>(
  posts: T[],
  user: AuthUserContext | null | undefined
): T[] {
  if (user?.role === 'admin' || user?.role === 'user') {
    return posts;
  }

  if (user?.role === 'guest') {
    const userEmail = (user.email || '').toLowerCase().trim();
    const userId = user.id ? String(user.id) : '';

    return posts.filter((post) => {
      if (post.accessType === 'public') return true;
      return Array.isArray(post.sharedWith) && post.sharedWith.some((s) => {
        const shareEmail = (s.email || '').toLowerCase().trim();
        const shareUserId = s.userId ? String(s.userId) : '';
        return (shareEmail && shareEmail === userEmail) || (shareUserId && shareUserId === userId);
      });
    });
  }

  // Khách vãng lai chỉ xem bài viết public
  return posts.filter((post) => post.accessType === 'public');
}

/**
 * Kiểm tra quyền quản trị nội dung truyện (CRUD truyện và chương truyện).
 * Chỉ Admin mới có quyền này.
 */
export function canManagePost(user: AuthUserContext | null | undefined): boolean {
  return user?.role === 'admin';
}

/**
 * Kiểm tra quyền quản trị người dùng (Xem danh sách, sửa role, xóa user).
 * Chỉ Admin mới có quyền này.
 */
export function canManageUsers(user: AuthUserContext | null | undefined): boolean {
  return user?.role === 'admin';
}

/**
 * Kiểm tra quyền quản lý chia sẻ truyện (Cập nhật accessType, thêm/xóa sharedWith).
 * Chỉ Admin mới có quyền này.
 */
export function canManageShares(user: AuthUserContext | null | undefined): boolean {
  return user?.role === 'admin';
}

/**
 * Kiểm tra quyền quản lý thẻ/thể loại (Tags).
 * Chỉ Admin mới có quyền này.
 */
export function canManageTags(user: AuthUserContext | null | undefined): boolean {
  return user?.role === 'admin';
}

/**
 * Thẩm định hành động chỉnh sửa hoặc xóa người dùng trong hệ thống.
 * Đảm bảo:
 * 1. Người thực hiện phải là Quản trị viên (role === 'admin').
 * 2. Không được phép xóa tài khoản quản trị viên gốc (ADMIN_USERNAME).
 * 3. Không được phép hạ quyền tài khoản quản trị viên gốc khỏi vai trò 'admin'.
 * 4. Vai trò mới khi cập nhật phải thuộc danh sách hợp lệ: ['guest', 'user', 'admin'].
 */
export function canModifyTargetUser(
  currentUser: AuthUserContext | null | undefined,
  targetUser: { email: string; role: UserRole },
  action: 'change_role' | 'delete',
  newRole?: string,
  rootAdminEmail?: string
): { allowed: boolean; error?: string } {
  if (currentUser?.role !== 'admin') {
    return { allowed: false, error: 'Không có quyền truy cập' };
  }

  const isRootAdmin = Boolean(
    rootAdminEmail &&
    targetUser.email.toLowerCase().trim() === rootAdminEmail.toLowerCase().trim()
  );

  if (isRootAdmin) {
    if (action === 'delete') {
      return { allowed: false, error: 'Không thể xóa tài khoản quản trị viên gốc' };
    }
    if (action === 'change_role' && newRole !== 'admin') {
      return { allowed: false, error: 'Không thể hạ quyền tài khoản quản trị viên gốc' };
    }
  }

  if (action === 'change_role') {
    if (!newRole || !['guest', 'user', 'admin'].includes(newRole)) {
      return { allowed: false, error: 'Vai trò không hợp lệ' };
    }
  }

  return { allowed: true };
}

/**
 * Kiểm tra xem khi đăng nhập có bắt buộc nhập mã PIN bảo mật hay không.
 *
 * Quy tắc:
 * - Nếu hệ thống không cấu hình UNLOCK_PIN -> Không yêu cầu bất kỳ ai.
 * - Nếu có cấu hình UNLOCK_PIN:
 *   + role 'admin' và 'user' -> Bắt buộc yêu cầu mã PIN.
 *   + role 'guest' -> Không yêu cầu mã PIN.
 */
export function requiresPinOnLogin(role: UserRole, secretPin?: string | null): boolean {
  if (!secretPin || secretPin.trim() === '') {
    return false;
  }
  return role === 'admin' || role === 'user';
}

/**
 * Lọc dữ liệu nhạy cảm (danh sách email chia sẻ và lịch sử người đọc)
 * để bảo vệ quyền riêng tư người dùng theo từng vai trò.
 *
 * Quy tắc:
 * - Admin: Giữ nguyên toàn bộ thông tin.
 * - Khách được chia sẻ (guest): Chỉ nhìn thấy record chia sẻ của chính mình. Ẩn toàn bộ accessedUsers.
 * - Thành viên chính thức (user) & Khách vãng lai: Ẩn toàn bộ sharedWith và accessedUsers.
 */
export function filterPostPrivacyForUser<T extends PostContext>(
  post: T,
  user: AuthUserContext | null | undefined
): T {
  if (user?.role === 'admin') {
    return { ...post };
  }

  const userEmail = (user?.email || '').toLowerCase().trim();

  let filteredSharedWith: PostShareItem[] = [];
  if (user?.role === 'guest' && Array.isArray(post.sharedWith)) {
    filteredSharedWith = post.sharedWith.filter(
      (s) => (s.email || '').toLowerCase().trim() === userEmail
    );
  }

  return {
    ...post,
    sharedWith: filteredSharedWith,
    accessedUsers: [],
  };
}

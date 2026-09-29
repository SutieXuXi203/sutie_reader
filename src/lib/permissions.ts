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

    const isSharedInPost = Array.isArray(post.sharedWith) && post.sharedWith.some((s) => {
      const shareEmail = (s.email || '').toLowerCase().trim();
      const shareUserId = s.userId ? String(s.userId) : '';
      return (shareEmail && shareEmail === userEmail) || (shareUserId && shareUserId === userId);
    });

    if (isSharedInPost) {
      return { allowed: true };
    }

    // Kiểm tra nếu người dùng được cấp quyền vào bất kỳ chương cụ thể nào (Phương án 2)
    const isSharedInAnyChapter = Array.isArray(post.chapters) && (post.chapters as any[]).some((ch) => {
      const isPublicChap = ch.accessType === 'public';
      const isSharedChap = Array.isArray(ch.sharedWith) && ch.sharedWith.some((s: any) => {
        const shareEmail = (s.email || '').toLowerCase().trim();
        const shareUserId = s.userId ? String(s.userId) : '';
        return (shareEmail && shareEmail === userEmail) || (shareUserId && shareUserId === userId);
      });
      return isPublicChap || isSharedChap;
    });

    if (isSharedInAnyChapter) {
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

export interface ChapterContext {
  _id?: string;
  chapterNumber?: number;
  title?: string;
  translator?: string;
  accessType?: 'inherit' | 'restricted' | 'public';
  sharedWith?: PostShareItem[];
  [key: string]: unknown;
}

/**
 * Kiểm tra xem người dùng có quyền trên toàn bộ truyện hay không.
 * Người có quyền toàn bộ truyện mới có thể kế thừa (inherit) quyền vào các chương truyện.
 */
export function hasWholePostAccess(
  user: AuthUserContext | null | undefined,
  post: PostContext
): boolean {
  if (user?.role === 'admin' || user?.role === 'user') {
    return true;
  }
  if (post.accessType === 'public') {
    return true;
  }
  if (!user) {
    return false;
  }
  const userEmail = (user.email || '').toLowerCase().trim();
  const userId = user.id ? String(user.id) : '';

  return (
    Array.isArray(post.sharedWith) &&
    post.sharedWith.some((s) => {
      const shareEmail = (s.email || '').toLowerCase().trim();
      const shareUserId = s.userId ? String(s.userId) : '';
      return (shareEmail && shareEmail === userEmail) || (shareUserId && shareUserId === userId);
    })
  );
}

/**
 * Kiểm tra xem người dùng có quyền đọc một chương cụ thể hay không (Phân quyền theo chương - Phương án 2).
 *
 * Quy tắc:
 * 1. Admin luôn có toàn quyền đọc mọi chương.
 * 2. Nếu chương có accessType === 'public': Cho phép tất cả người đọc (kể cả chưa đăng nhập).
 * 3. Kiểm tra chia sẻ riêng theo chương:
 *    - Nếu email/userId của user nằm trong chapter.sharedWith: Cho phép đọc chương này ngay lập tức.
 * 4. Nếu chương có accessType === 'restricted' (chương bị khóa riêng):
 *    - Chưa đăng nhập -> REQUIRE_LOGIN
 *    - Nếu không nằm trong chapter.sharedWith -> ACCESS_DENIED kèm thông báo đích danh dịch giả của chương.
 * 5. Nếu chương có accessType === 'inherit' (hoặc không khai báo):
 *    - Chỉ kế thừa nếu người dùng có quyền trên toàn bộ truyện (hasWholePostAccess).
 *    - Người dùng chỉ được share riêng 1 chương khác sẽ BỊ KHÓA chương này.
 */
export function canViewChapter(
  user: AuthUserContext | null | undefined,
  post: PostContext,
  chapter: ChapterContext
): AccessDecision {
  if (user?.role === 'admin') {
    return { allowed: true };
  }

  const chapterAccessType = chapter.accessType || 'inherit';

  // 1. Nếu chương đặt là public -> cho phép đọc
  if (chapterAccessType === 'public') {
    return { allowed: true };
  }

  // 2. Kiểm tra nếu user được cấp quyền riêng cho chương này (trong chapter.sharedWith)
  const userEmail = (user?.email || '').toLowerCase().trim();
  const userId = user?.id ? String(user.id) : '';

  const isSharedInChapter = Boolean(
    user &&
    Array.isArray(chapter.sharedWith) &&
    chapter.sharedWith.some((s) => {
      const shareEmail = (s.email || '').toLowerCase().trim();
      const shareUserId = s.userId ? String(s.userId) : '';
      return (shareEmail && shareEmail === userEmail) || (shareUserId && shareUserId === userId);
    })
  );

  if (isSharedInChapter) {
    return { allowed: true };
  }

  // 3. Nếu chương là restricted riêng biệt
  if (chapterAccessType === 'restricted') {
    if (!user) {
      return {
        allowed: false,
        reason: 'REQUIRE_LOGIN',
        message: 'Vui lòng đăng nhập để đọc chương này',
      };
    }
    const translatorName = chapter.translator || (post as any)?.translator || 'Dịch giả';
    return {
      allowed: false,
      reason: 'ACCESS_DENIED',
      message: `Chương ${chapter.chapterNumber || ''} do ${translatorName} dịch đang được giới hạn quyền xem.`,
    };
  }

  // 4. Nếu chương kế thừa từ bộ truyện (inherit):
  // Chỉ người dùng có quyền trên toàn bộ truyện mới được kế thừa.
  // Người chỉ được chia sẻ riêng chương khác sẽ bị khóa.
  if (hasWholePostAccess(user, post)) {
    return { allowed: true };
  }

  if (!user) {
    return {
      allowed: false,
      reason: 'REQUIRE_LOGIN',
      message: 'Vui lòng đăng nhập để đọc chương này',
    };
  }

  return {
    allowed: false,
    reason: 'ACCESS_DENIED',
    message: `Bạn chưa được cấp quyền đọc Chương ${chapter.chapterNumber || ''}.`,
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

      const isSharedInPost = Array.isArray(post.sharedWith) && post.sharedWith.some((s) => {
        const shareEmail = (s.email || '').toLowerCase().trim();
        const shareUserId = s.userId ? String(s.userId) : '';
        return (shareEmail && shareEmail === userEmail) || (shareUserId && shareUserId === userId);
      });
      if (isSharedInPost) return true;

      const isSharedInAnyChapter = Array.isArray(post.chapters) && (post.chapters as any[]).some((ch) => {
        return Array.isArray(ch.sharedWith) && ch.sharedWith.some((s: any) => {
          const shareEmail = (s.email || '').toLowerCase().trim();
          const shareUserId = s.userId ? String(s.userId) : '';
          return (shareEmail && shareEmail === userEmail) || (shareUserId && shareUserId === userId);
        });
      });
      return isSharedInAnyChapter;
    });
  }

  // Khách vãng lai chỉ xem bài viết public
  return posts.filter((post) => post.accessType === 'public');
}

export interface AccessibleChapterInfo {
  accessibleChapterNumbers: number[];
  accessibleChapterLabel: string;
  isPartialAccess: boolean;
}

/**
 * Tính toán danh sách chương mà người dùng có quyền đọc để hiển thị thông tin chương trên Trang chủ.
 */
export function getAccessibleChapterInfo(
  post: PostContext,
  user: AuthUserContext | null | undefined
): AccessibleChapterInfo {
  const chapters = Array.isArray(post.chapters) ? (post.chapters as ChapterContext[]) : [];
  const totalChapters = chapters.length > 0 ? chapters.length : (typeof post.chapterCount === 'number' ? post.chapterCount : 1);

  if (user?.role === 'admin' || user?.role === 'user') {
    const allNumbers = chapters.length > 0
      ? chapters.map((c, i) => c.chapterNumber ?? i + 1)
      : (totalChapters > 0 ? [1] : []);
    return {
      accessibleChapterNumbers: allNumbers,
      accessibleChapterLabel: totalChapters > 1 ? `${totalChapters} chương` : (totalChapters === 1 ? '1 chương' : ''),
      isPartialAccess: false,
    };
  }

  const userEmail = (user?.email || '').toLowerCase().trim();
  const userId = user?.id ? String(user.id) : '';

  const isWholePost = post.accessType === 'public' || Boolean(
    user &&
    Array.isArray(post.sharedWith) &&
    post.sharedWith.some((s) => {
      const shareEmail = (s.email || '').toLowerCase().trim();
      const shareUserId = s.userId ? String(s.userId) : '';
      return (shareEmail && shareEmail === userEmail) || (shareUserId && shareUserId === userId);
    })
  );

  if (isWholePost) {
    const allNumbers = chapters.length > 0
      ? chapters.map((c, i) => c.chapterNumber ?? i + 1)
      : (totalChapters > 0 ? [1] : []);
    return {
      accessibleChapterNumbers: allNumbers,
      accessibleChapterLabel: totalChapters > 1 ? `${totalChapters} chương` : (totalChapters === 1 ? '1 chương' : ''),
      isPartialAccess: false,
    };
  }

  // Khách chỉ được chia sẻ theo từng chương cụ thể
  const accessibleChapters = chapters.filter((ch, idx) => {
    if (ch.accessType === 'public') return true;
    if (!user) return false;
    return (
      Array.isArray(ch.sharedWith) &&
      ch.sharedWith.some((s) => {
        const shareEmail = (s.email || '').toLowerCase().trim();
        const shareUserId = s.userId ? String(s.userId) : '';
        return (shareEmail && shareEmail === userEmail) || (shareUserId && shareUserId === userId);
      })
    );
  });

  const accessibleNumbers = accessibleChapters.map((ch, idx) => ch.chapterNumber ?? idx + 1);

  let label = '';
  if (accessibleNumbers.length === 1) {
    label = `Chương ${accessibleNumbers[0]}`;
  } else if (accessibleNumbers.length > 1) {
    label = `Chương ${accessibleNumbers.slice(0, 3).join(', ')}${accessibleNumbers.length > 3 ? '...' : ''}`;
  }

  return {
    accessibleChapterNumbers: accessibleNumbers,
    accessibleChapterLabel: label,
    isPartialAccess: true,
  };
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
 *   + role 'guest' -> Không yêu cầu mã PIN, trừ khi là tài khoản kiểm thử chỉ định (testEmail).
 */
export function requiresPinOnLogin(
  role: UserRole,
  secretPin?: string | null,
  userEmail?: string,
  testEmail?: string
): boolean {
  if (!secretPin || secretPin.trim() === '') {
    return false;
  }
  if (testEmail && userEmail && userEmail.toLowerCase().trim() === testEmail.toLowerCase().trim()) {
    return true;
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

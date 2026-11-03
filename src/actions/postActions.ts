'use server';

import { ObjectId } from 'mongodb';
import { connectDB } from '@/lib/db';
import { Post } from '@/models/Post';
import { getCurrentUser } from '@/lib/server-auth';
import { canViewPost, type PostContext } from '@/lib/permissions';
import { logApiError } from '@/lib/telegramLogger';
import { recordPostAccess } from '@/lib/trackAccess';

export interface AccessedUserDto {
  userId?: string;
  email: string;
  name: string;
  avatar: string;
  role: string;
  lastAccessedAt: string;
}

export async function trackPostAccessAction(postId: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  accessedUsers?: AccessedUserDto[];
}> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Khách vãng lai truy cập' };
    }

    if (!ObjectId.isValid(postId)) {
      return { success: false, error: 'ID bài viết không hợp lệ' };
    }

    await connectDB();

    const postForCheck = await Post.findById(postId)
      .select('accessType sharedWith accessedUsers chapters')
      .lean();

    if (!postForCheck) {
      return { success: false, error: 'Không tìm thấy bài viết' };
    }

    const decision = canViewPost(user, postForCheck as unknown as PostContext);
    if (!decision.allowed) {
      return { success: false, error: decision.reason, message: decision.message };
    }

    await recordPostAccess(postId, user);

    let mappedAccessedUsers: AccessedUserDto[] | undefined;
    if (user.role === 'admin') {
      const updated = await Post.findById(postId).select('accessedUsers').lean();
      mappedAccessedUsers = (updated?.accessedUsers || []).map((u) => ({
        userId: u.userId ? u.userId.toString() : undefined,
        email: u.email,
        name: u.name || u.email.split('@')[0],
        avatar: u.avatar || '',
        role: u.role || 'guest',
        lastAccessedAt:
          u.lastAccessedAt instanceof Date
            ? u.lastAccessedAt.toISOString()
            : u.lastAccessedAt,
      }));
    }

    return {
      success: true,
      accessedUsers: mappedAccessedUsers,
    };
  } catch (error) {
    console.error('Lỗi khi ghi nhận truy cập qua Server Action:', error);
    void logApiError({
      module: 'trackPostAccessAction',
      error,
      statusCode: 500,
    });
    return { success: false, error: 'Lỗi máy chủ' };
  }
}

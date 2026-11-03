import { ObjectId } from 'mongodb';
import { Post } from '@/models/Post';
import type { AuthUserContext } from '@/lib/permissions';

export interface TrackedUser extends AuthUserContext {
  avatar?: string;
}

/**
 * Ghi nhận người đọc vào `accessedUsers` bằng các thao tác nguyên tử (không đọc-rồi-ghi) nên hai request đầu tiên
 * song song của cùng một người không tạo ra hai bản ghi trùng.
 */
export async function recordPostAccess(postId: string, user: TrackedUser): Promise<void> {
  const normalizedEmail = user.email.toLowerCase().trim();
  const now = new Date();
  const displayName = user.name || normalizedEmail.split('@')[0];
  const avatar = user.avatar || '';
  const role = user.role || 'guest';
  const userId = user.id && ObjectId.isValid(user.id) ? new ObjectId(user.id) : undefined;
  const _id = new ObjectId(postId);

  const updateExisting = () =>
    Post.updateOne(
      { _id, 'accessedUsers.email': normalizedEmail },
      {
        $set: {
          'accessedUsers.$.lastAccessedAt': now,
          'accessedUsers.$.name': displayName,
          'accessedUsers.$.avatar': avatar,
          'accessedUsers.$.role': role,
          ...(userId ? { 'accessedUsers.$.userId': userId } : {}),
        },
      }
    );

  const updated = await updateExisting();
  if (updated.matchedCount > 0) return;

  const newEntry = {
    ...(userId ? { userId } : {}),
    email: normalizedEmail,
    name: displayName,
    avatar,
    role,
    lastAccessedAt: now,
  };

  // Chỉ thêm khi chưa có email này; nếu request song song đã thêm trước thì cập nhật bản ghi đó
  const pushed = await Post.updateOne(
    { _id, 'accessedUsers.email': { $ne: normalizedEmail } },
    {
      $push: {
        accessedUsers: {
          $each: [newEntry],
          $sort: { lastAccessedAt: -1 },
          $slice: 50,
        },
      },
    }
  );

  if (pushed.matchedCount === 0) {
    await updateExisting();
  }
}

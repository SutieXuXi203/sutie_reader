import { ObjectId } from 'mongodb';
import { Post } from '@/models/Post';
import type { AuthUserContext } from '@/lib/permissions';
import { getRedisClient } from './redis';

export interface TrackedUser extends AuthUserContext {
  avatar?: string;
}

/**
 * Ghi nhận người đọc vào `accessedUsers` bằng các thao tác nguyên tử (không đọc-rồi-ghi) nên hai request đầu tiên
 * song song của cùng một người không tạo ra hai bản ghi trùng.
 * Khi có Redis: Debounce ghi nhận (15 phút / lần cho cùng 1 tài khoản trên 1 truyện) để giảm thiểu thao tác ghi MongoDB.
 */
export async function recordPostAccess(postId: string, user: TrackedUser): Promise<void> {
  const normalizedEmail = user.email.toLowerCase().trim();

  const redis = getRedisClient();
  if (redis) {
    try {
      // SET track:${postId}:${normalizedEmail} 1 EX 900 NX
      // Trả về 'OK' nếu là lượt truy cập đầu tiên trong 15 phút; null nếu đã ghi nhận trước đó
      const isFirstWithinWindow = await redis.set(`track:${postId}:${normalizedEmail}`, '1', 'EX', 900, 'NX');
      if (!isFirstWithinWindow) {
        return;
      }
    } catch {
      // Nếu Redis gặp sự cố tạm thời, tiếp tục ghi vào MongoDB bình thường (Graceful Fallback)
    }
  }

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

/**
 * Định dạng thời lượng đọc truyện sang chuỗi tiếng Việt dễ đọc
 */
export function formatReadingDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  if (safeSeconds === 0) return '0 giây';

  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remSeconds = safeSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} giờ`);
  if (minutes > 0) parts.push(`${minutes} phút`);
  if (remSeconds > 0 || parts.length === 0) parts.push(`${remSeconds} giây`);

  return parts.join(' ');
}

/**
 * Ghi nhận thời lượng phiên đọc vào `accessedUsers` và trả về tổng thời gian đọc tích lũy
 */
export async function recordReadingSession(
  postId: string,
  user: TrackedUser,
  durationSeconds: number
): Promise<{ totalReadingTime: number }> {
  const normalizedEmail = user.email.toLowerCase().trim();
  const safeDuration = Math.max(0, Math.floor(durationSeconds));
  const now = new Date();
  const displayName = user.name || normalizedEmail.split('@')[0];
  const avatar = user.avatar || '';
  const role = user.role || 'guest';
  const userId = user.id && ObjectId.isValid(user.id) ? new ObjectId(user.id) : undefined;
  const _id = new ObjectId(postId);

  // 1. Cập nhật tăng readingTime và lastAccessedAt nếu đã có bản ghi của user
  const updated = await Post.findOneAndUpdate(
    { _id, 'accessedUsers.email': normalizedEmail },
    {
      $inc: { 'accessedUsers.$.readingTime': safeDuration },
      $set: {
        'accessedUsers.$.lastAccessedAt': now,
        'accessedUsers.$.name': displayName,
        'accessedUsers.$.avatar': avatar,
        'accessedUsers.$.role': role,
        ...(userId ? { 'accessedUsers.$.userId': userId } : {}),
      },
    },
    { new: true, projection: { accessedUsers: { $elemMatch: { email: normalizedEmail } } } }
  ).lean<{ accessedUsers?: Array<{ readingTime?: number }> } | null>();

  if (updated?.accessedUsers && updated.accessedUsers.length > 0) {
    return {
      totalReadingTime: updated.accessedUsers[0].readingTime || safeDuration,
    };
  }

  // 2. Nếu chưa có, thêm mới vào mảng accessedUsers
  const newEntry = {
    ...(userId ? { userId } : {}),
    email: normalizedEmail,
    name: displayName,
    avatar,
    role,
    lastAccessedAt: now,
    readingTime: safeDuration,
  };

  const pushed = await Post.findOneAndUpdate(
    { _id, 'accessedUsers.email': { $ne: normalizedEmail } },
    {
      $push: {
        accessedUsers: {
          $each: [newEntry],
          $sort: { lastAccessedAt: -1 },
          $slice: 50,
        },
      },
    },
    { new: true }
  );

  if (!pushed) {
    const fallbackUpdated = await Post.findOneAndUpdate(
      { _id, 'accessedUsers.email': normalizedEmail },
      {
        $inc: { 'accessedUsers.$.readingTime': safeDuration },
        $set: { 'accessedUsers.$.lastAccessedAt': now },
      },
      { new: true, projection: { accessedUsers: { $elemMatch: { email: normalizedEmail } } } }
    ).lean<{ accessedUsers?: Array<{ readingTime?: number }> } | null>();

    return {
      totalReadingTime: fallbackUpdated?.accessedUsers?.[0]?.readingTime || safeDuration,
    };
  }

  return { totalReadingTime: safeDuration };
}

import { archiveAndDeleteExpiredUnverifiedUser } from '@/lib/archiveDeletedAccount';
import { type AutoDeletionTrigger } from '@/models/DeletedAccount';
import { type IUser, User } from '@/models/User';

const UNVERIFIED_USER_TTL_MS = 24 * 60 * 60 * 1000;

interface HandleExpiredResult {
  deleted: boolean;
  expiryBackfilled: boolean;
}

function getEffectiveVerificationExpiry(
  user: Pick<IUser, 'verificationExpiresAt' | 'createdAt'>
): Date {
  if (user.verificationExpiresAt instanceof Date) {
    return user.verificationExpiresAt;
  }

  return new Date(user.createdAt.getTime() + UNVERIFIED_USER_TTL_MS);
}

export async function handleExpiredUnverifiedUser(
  user: IUser,
  trigger: AutoDeletionTrigger
): Promise<HandleExpiredResult> {
  if (user.isVerified) {
    return { deleted: false, expiryBackfilled: false };
  }

  const effectiveVerificationExpiry = getEffectiveVerificationExpiry(user);
  const shouldBackfillExpiry = !user.verificationExpiresAt;

  if (effectiveVerificationExpiry.getTime() <= Date.now()) {
    if (shouldBackfillExpiry) {
      user.verificationExpiresAt = effectiveVerificationExpiry;
    }

    await archiveAndDeleteExpiredUnverifiedUser(user, trigger);
    return { deleted: true, expiryBackfilled: false };
  }

  if (shouldBackfillExpiry) {
    user.verificationExpiresAt = effectiveVerificationExpiry;
    await user.save();
    return { deleted: false, expiryBackfilled: true };
  }

  return { deleted: false, expiryBackfilled: false };
}

export async function cleanupExpiredUnverifiedUsers(
  trigger: AutoDeletionTrigger = 'system'
): Promise<{ deletedCount: number; backfilledCount: number }> {
  const unverifiedUsers = await User.find({ isVerified: false });
  let deletedCount = 0;
  let backfilledCount = 0;

  for (const user of unverifiedUsers) {
    const result = await handleExpiredUnverifiedUser(user, trigger);

    if (result.deleted) {
      deletedCount += 1;
    } else if (result.expiryBackfilled) {
      backfilledCount += 1;
    }
  }

  return { deletedCount, backfilledCount };
}

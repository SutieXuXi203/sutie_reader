import { type AutoDeletionTrigger, DeletedAccount } from '@/models/DeletedAccount';
import { type IUser, User } from '@/models/User';

export async function archiveAndDeleteExpiredUnverifiedUser(
  user: IUser,
  trigger: AutoDeletionTrigger
) {
  await DeletedAccount.create({
    originalUserId: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role,
    verificationExpiresAt: user.verificationExpiresAt,
    deletionReason: 'unverified_expired_24h',
    deletionTrigger: trigger,
    deletedAt: new Date(),
  });

  await User.deleteOne({ _id: user._id });
}

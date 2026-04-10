import mongoose, { Document, Schema } from 'mongoose';

export type AutoDeletionReason = 'unverified_expired_24h';
export type AutoDeletionTrigger = 'login' | 'verify' | 'system';

export interface IDeletedAccount extends Document {
  originalUserId?: string;
  email: string;
  name?: string;
  role?: 'user' | 'admin';
  verificationExpiresAt?: Date;
  deletionReason: AutoDeletionReason;
  deletionTrigger: AutoDeletionTrigger;
  deletedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DeletedAccountSchema = new Schema<IDeletedAccount>(
  {
    originalUserId: {
      type: String,
      default: undefined,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      default: '',
      trim: true,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    verificationExpiresAt: {
      type: Date,
      default: undefined,
    },
    deletionReason: {
      type: String,
      enum: ['unverified_expired_24h'],
      required: true,
    },
    deletionTrigger: {
      type: String,
      enum: ['login', 'verify', 'system'],
      required: true,
    },
    deletedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const DeletedAccount =
  mongoose.models.DeletedAccount ||
  mongoose.model<IDeletedAccount>('DeletedAccount', DeletedAccountSchema);

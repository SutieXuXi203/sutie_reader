import mongoose, { Schema } from 'mongoose';

/**
 * Danh sách thu hồi token BỀN VỮNG (không phụ thuộc Redis): mỗi bản ghi là hash của một JWT đã đăng xuất.
 * `expiresAt` = hạn của JWT; TTL index tự xóa bản ghi khi token vốn đã hết hạn nên collection không phình ra.
 */
export interface IRevokedToken {
  tokenHash: string;
  expiresAt: Date;
}

const RevokedTokenSchema = new Schema<IRevokedToken>(
  {
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'revoked_tokens', versionKey: false }
);

RevokedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RevokedToken =
  (mongoose.models.RevokedToken as mongoose.Model<IRevokedToken> | undefined) ||
  mongoose.model<IRevokedToken>('RevokedToken', RevokedTokenSchema);

import mongoose, { Schema, Document } from 'mongoose';

export interface IRateLimit extends Document {
  ip: string;
  attempts: number;
  lockUntil?: Date;
  createdAt: Date;
}

const RateLimitSchema = new Schema<IRateLimit>({
  ip: { type: String, required: true, index: true, unique: true },
  attempts: { type: Number, default: 1 },
  lockUntil: { type: Date },
  createdAt: { type: Date, default: Date.now, expires: 86400 } // Auto-delete after 24 hours
});

export const RateLimit = mongoose.models.RateLimit || mongoose.model<IRateLimit>('RateLimit', RateLimitSchema);

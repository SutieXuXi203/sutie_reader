import mongoose, { Schema, Document } from 'mongoose';

export interface IRole extends Document {
  name: 'guest' | 'user' | 'admin';
  displayName: string;
  description: string;
  isDefault?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RoleSchema = new Schema<IRole>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      enum: ['guest', 'user', 'admin'],
    },
    displayName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

if (mongoose.models.Role) {
  delete (mongoose.models as any).Role;
}

export const Role = mongoose.models.Role || mongoose.model<IRole>('Role', RoleSchema, 'roles');

import mongoose, { Schema, Document } from 'mongoose';
export interface IUser extends Document {
    email: string;
    password?: string;
    name: string;
    avatar?: string;
    role: 'user' | 'admin';
    isVerified: boolean;
    verificationCode?: string;
    verificationExpiresAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
const UserSchema = new Schema<IUser>(
    {
        email: {
            type: String,
            required: [true, 'Email là bắt buộc'],
            unique: true,
            lowercase: true,
            trim: true,
        },
        password: {
            type: String,
            required: [true, 'Mật khẩu là bắt buộc'],
            minlength: [6, 'Mật khẩu phải có ít nhất 6 ký tự'],
            select: false,
        },
        name: {
            type: String,
            required: [true, 'Tên là bắt buộc'],
            trim: true,
        },
        avatar: {
            type: String,
            default: '',
        },
        role: {
            type: String,
            enum: ['user', 'admin'],
            default: 'user',
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
        verificationCode: {
            type: String,
        },
        verificationExpiresAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

UserSchema.pre('save', function (this: IUser) {
    if (this.isVerified) {
        this.verificationExpiresAt = undefined;
        return;
    }

    if (!this.verificationExpiresAt) {
        this.verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
});

UserSchema.index(
    { verificationExpiresAt: 1 },
    {
        name: 'unverified_user_ttl_24h',
        expireAfterSeconds: 0,
        partialFilterExpression: {
            isVerified: false,
            verificationExpiresAt: { $exists: true },
        },
    }
);

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

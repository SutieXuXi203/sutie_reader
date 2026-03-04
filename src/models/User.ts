import mongoose, { Schema, Document } from 'mongoose';
export interface IUser extends Document {
    email: string;
    password?: string;
    name: string;
    avatar?: string;
    role: 'user' | 'admin';
    isVerified: boolean;
    verificationCode?: string;
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
    },
    {
        timestamps: true,
    }
);
export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

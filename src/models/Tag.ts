import mongoose, { Schema, Document } from 'mongoose';

export interface ITag extends Document {
    name: string;
    createdAt: Date;
}

const TagSchema: Schema = new Schema({
    name: {
        type: String,
        required: [true, 'Tên tag không được để trống'],
        unique: true,
        trim: true,
        maxlength: [30, 'Tên tag không được vượt quá 30 ký tự'],
        set: (v: string) => v.toLowerCase()
    },
    createdAt: { type: Date, default: Date.now }
});

export const Tag = mongoose.models.Tag || mongoose.model<ITag>('Tag', TagSchema);

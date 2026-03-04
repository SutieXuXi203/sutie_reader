import mongoose, { Schema, Document } from 'mongoose';

export interface IBookmark extends Document {
    userId: string;
    postId: mongoose.Types.ObjectId;
    currentPage: number;
    totalPages: number;
    createdAt: Date;
    updatedAt: Date;
}

const BookmarkSchema = new Schema<IBookmark>(
    {
        userId: {
            type: String,
            required: true,
            index: true,
        },
        postId: {
            type: Schema.Types.ObjectId,
            ref: 'Post',
            required: true,
        },
        currentPage: {
            type: Number,
            required: true,
            default: 0,
        },
        totalPages: {
            type: Number,
            required: true,
            default: 0,
        },
    },
    { timestamps: true }
);

// Unique compound index: one bookmark per user per post
BookmarkSchema.index({ userId: 1, postId: 1 }, { unique: true });

// Clear HMR cache
if (mongoose.models.Bookmark) {
    delete mongoose.models.Bookmark;
}

export const Bookmark = mongoose.model<IBookmark>('Bookmark', BookmarkSchema);

import mongoose, { Schema, Document } from 'mongoose';

export interface IPost extends Document {
  title: string;
  description: string;
  content: string;
  images: string[];
  author: string;
  createdAt: Date;
  updatedAt: Date;
}

const PostSchema = new Schema<IPost>(
  {
    title: {
      type: String,
      required: true,
      maxlength: 100,
    },
    description: {
      type: String,
      default: '',
      maxlength: 300,
    },
    content: {
      type: String,
      required: true,
    },
    images: {
      type: [String],
      required: true,
    },
    author: {
      type: String,
      default: 'Không rõ tác giả',
    },
  },
  { timestamps: true }
);

export const Post = mongoose.models.Post || mongoose.model<IPost>('Post', PostSchema);

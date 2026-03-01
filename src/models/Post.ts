import mongoose, { Schema, Document } from 'mongoose';

export interface IPost extends Document {
  title: string;
  description: string;
  tags: string[];
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
    tags: {
      type: [String],
      default: [],
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
// Xóa cache model cũ để tránh lỗi validation do Next.js HMR
if (mongoose.models.Post) {
  delete mongoose.models.Post;
}

export const Post = mongoose.model<IPost>('Post', PostSchema);

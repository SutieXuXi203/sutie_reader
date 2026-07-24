import mongoose, { Schema, Document } from 'mongoose';

export interface IPostChapter {
  title: string;
  chapterNumber: number;
  content: string;
  images: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPost extends Document {
  title: string;
  description: string;
  tags: string[];
  content: string;
  images: string[];
  chapters: IPostChapter[];
  author: string;
  createdAt: Date;
  updatedAt: Date;
}

const ChapterSchema = new Schema<IPostChapter>(
  {
    title: {
      type: String,
      required: true,
      maxlength: 120,
    },
    chapterNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    content: {
      type: String,
      default: '',
    },
    images: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

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
      default: '',
    },
    images: {
      type: [String],
      default: [],
    },
    chapters: {
      type: [ChapterSchema],
      default: [],
    },
    author: {
      type: String,
      default: 'Không rõ tác giả',
    },
  },
  { timestamps: true }
);

PostSchema.index({ createdAt: -1 });
PostSchema.index({ tags: 1 });

if (mongoose.models.Post) {
  delete mongoose.models.Post;
}

export const Post = mongoose.model<IPost>('Post', PostSchema);


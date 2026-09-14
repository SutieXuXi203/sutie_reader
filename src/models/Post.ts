import mongoose, { Schema, Document } from 'mongoose';

export interface IPostChapter {
  title: string;
  chapterNumber: number;
  content: string;
  images: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPostShareUser {
  userId?: mongoose.Types.ObjectId;
  email: string;
  role: 'viewer';
  addedAt: Date;
}

export interface IPostAccessedUser {
  userId?: mongoose.Types.ObjectId;
  email: string;
  name: string;
  avatar?: string;
  role?: string;
  lastAccessedAt: Date;
}

export interface IPost extends Document {
  title: string;
  description: string;
  tags: string[];
  content: string;
  images: string[];
  chapters: IPostChapter[];
  author: string;
  translator?: string;
  accessType: 'restricted' | 'public';
  sharedWith: IPostShareUser[];
  accessedUsers: IPostAccessedUser[];
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
    translator: {
      type: String,
      default: '',
      maxlength: 100,
    },
    accessType: {
      type: String,
      enum: ['restricted', 'public'],
      default: 'restricted',
    },
    sharedWith: {
      type: [
        new Schema<IPostShareUser>(
          {
            userId: { type: Schema.Types.ObjectId, ref: 'User' },
            email: { type: String, required: true, lowercase: true, trim: true },
            role: { type: String, enum: ['viewer'], default: 'viewer' },
            addedAt: { type: Date, default: Date.now },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    accessedUsers: {
      type: [
        new Schema<IPostAccessedUser>(
          {
            userId: { type: Schema.Types.ObjectId, ref: 'User' },
            email: { type: String, required: true, lowercase: true, trim: true },
            name: { type: String, default: '' },
            avatar: { type: String, default: '' },
            role: { type: String, default: 'guest' },
            lastAccessedAt: { type: Date, default: Date.now },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true, collection: 'comics' }
);

PostSchema.index({ createdAt: -1 });
PostSchema.index({ tags: 1 });
PostSchema.index({ accessType: 1 });
PostSchema.index({ 'sharedWith.email': 1 });
PostSchema.index({ 'accessedUsers.email': 1 });

if (process.env.NODE_ENV !== 'production' && mongoose.models && mongoose.models.Post) {
  delete (mongoose.models as Record<string, unknown>).Post;
}

export const Post =
  (mongoose.models.Post as mongoose.Model<IPost> | undefined) ||
  mongoose.model<IPost>('Post', PostSchema);

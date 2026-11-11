import mongoose, { Schema, Document } from 'mongoose';
import { collectImageIds } from '@/lib/imageIds';

export interface IPostShareUser {
  userId?: mongoose.Types.ObjectId;
  email: string;
  role: 'viewer';
  addedAt: Date;
}

export interface IPostChapter {
  _id?: mongoose.Types.ObjectId | string;
  title: string;
  chapterNumber: number;
  content: string;
  images: string[];
  translator?: string;
  accessType?: 'inherit' | 'restricted' | 'public';
  sharedWith?: IPostShareUser[];
  createdAt?: Date;
  updatedAt?: Date;
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
  imageIds?: string[];
  author: string;
  translator?: string;
  accessType: 'restricted' | 'public';
  sharedWith: IPostShareUser[];
  accessedUsers: IPostAccessedUser[];
  createdAt: Date;
  updatedAt: Date;
}

const ShareUserSchema = new Schema<IPostShareUser>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ['viewer'], default: 'viewer' },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

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
    translator: {
      type: String,
      default: '',
      maxlength: 100,
    },
    accessType: {
      type: String,
      enum: ['inherit', 'restricted', 'public'],
      default: 'inherit',
    },
    sharedWith: {
      type: [ShareUserSchema],
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
      type: [ShareUserSchema],
      default: [],
    },
    // Id file Drive của mọi ảnh trong bài (ảnh cấp bài + các chương): chỉ phục vụ tra cứu "ảnh thuộc bài nào" bằng index.
    // Được duy trì bởi pre('save'), PUT/POST /api/posts..., và `backfillImageIds` cho dữ liệu cũ. Không bao giờ trả ra client.
    imageIds: {
      type: [String],
      select: false,
      default: undefined,
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
PostSchema.index({ imageIds: 1 });

PostSchema.pre('save', function (this: IPost) {
  // Chỉ tính lại khi đã tải đủ dữ liệu ảnh (tránh ghi đè bằng mảng rỗng khi bài được tải một phần bằng .select())
  if (this.isSelected('images') && this.isSelected('chapters')) {
    this.set('imageIds', collectImageIds(this.images, this.chapters));
  }
});

if (process.env.NODE_ENV !== 'production' && mongoose.models && mongoose.models.Post) {
  delete (mongoose.models as Record<string, unknown>).Post;
}

export const Post =
  (mongoose.models.Post as mongoose.Model<IPost> | undefined) ||
  mongoose.model<IPost>('Post', PostSchema);

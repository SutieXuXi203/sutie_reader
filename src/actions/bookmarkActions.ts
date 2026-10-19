'use server';

import { ObjectId } from 'mongodb';
import { connectDB } from '@/lib/db';
import { Bookmark } from '@/models/Bookmark';
import { Post } from '@/models/Post';
import { getCurrentUser } from '@/lib/server-auth';
import { canViewPost, canViewChapter } from '@/lib/permissions';
import { logApiError } from '@/lib/telegramLogger';

export interface SaveBookmarkInput {
  postId: string;
  chapterIndex?: number;
  currentPage: number;
  totalPages: number;
}

export async function saveBookmarkAction(input: SaveBookmarkInput) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const { postId, chapterIndex = 0, currentPage, totalPages } = input;
    if (!postId || !ObjectId.isValid(postId) || currentPage === undefined || totalPages === undefined) {
      return { success: false, error: 'Missing or invalid required fields' };
    }

    const normalizedChapterIndex =
      typeof chapterIndex === 'number' && Number.isFinite(chapterIndex) && chapterIndex >= 0
        ? Math.floor(chapterIndex)
        : 0;

    await connectDB();
    const post = await Post.findById(postId).select('accessType sharedWith chapters').lean();
    if (!post) {
      return { success: false, error: 'Post not found' };
    }

    const decision = canViewPost(user as any, post as any);
    if (!decision.allowed) {
      return { success: false, error: decision.message || 'Forbidden' };
    }

    if (Array.isArray(post.chapters) && post.chapters[normalizedChapterIndex]) {
      const chapDecision = canViewChapter(user as any, post as any, post.chapters[normalizedChapterIndex] as any);
      if (!chapDecision.allowed) {
        return { success: false, error: chapDecision.message || 'Forbidden' };
      }
    }

    const bookmark = await Bookmark.findOneAndUpdate(
      { userId: user.id, postId },
      { chapterIndex: normalizedChapterIndex, currentPage, totalPages },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    return {
      success: true,
      bookmark: bookmark
        ? {
            _id: String(bookmark._id),
            postId: String(bookmark.postId),
            chapterIndex: bookmark.chapterIndex ?? 0,
            currentPage: bookmark.currentPage,
            totalPages: bookmark.totalPages,
          }
        : null,
    };
  } catch (error) {
    console.error('Error saving bookmark via Server Action:', error);
    void logApiError({
      module: 'saveBookmarkAction',
      error,
      statusCode: 500,
    });
    return { success: false, error: 'Internal server error' };
  }
}

export async function getBookmarkAction(postId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return null;
    }

    if (!postId || !ObjectId.isValid(postId)) {
      return null;
    }

    await connectDB();
    const post = await Post.findById(postId).select('accessType sharedWith chapters').lean();
    if (!post) {
      return null;
    }

    const decision = canViewPost(user as any, post as any);
    if (!decision.allowed) {
      return null;
    }

    const bookmark = await Bookmark.findOne({
      userId: user.id,
      postId,
    }).lean();

    if (!bookmark) {
      return null;
    }

    return {
      _id: String(bookmark._id),
      postId: String(bookmark.postId),
      chapterIndex: typeof (bookmark as any).chapterIndex === 'number' ? (bookmark as any).chapterIndex : 0,
      currentPage: (bookmark as any).currentPage,
      totalPages: (bookmark as any).totalPages,
    };
  } catch (error) {
    console.error('Error getting bookmark via Server Action:', error);
    void logApiError({
      module: 'getBookmarkAction',
      error,
      statusCode: 500,
    });
    return null;
  }
}

export async function deleteBookmarkAction(postId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    if (!postId || !ObjectId.isValid(postId)) {
      return { success: false, error: 'ID bài viết không hợp lệ' };
    }

    await connectDB();
    await Bookmark.findOneAndDelete({
      userId: user.id,
      postId,
    });

    return { success: true };
  } catch (error) {
    console.error('Error deleting bookmark via Server Action:', error);
    void logApiError({
      module: 'deleteBookmarkAction',
      error,
      statusCode: 500,
    });
    return { success: false, error: 'Internal server error' };
  }
}

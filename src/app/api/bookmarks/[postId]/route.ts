import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { Bookmark } from '@/models/Bookmark';
import { canViewPost } from '@/lib/permissions';
import { logApiError } from '@/lib/telegramLogger';

type BookmarkLean = {
    chapterIndex?: number;
} & Record<string, unknown>;

import { ObjectId } from 'mongodb';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ postId: string }> }
) {
    try {
        const user = await getAuthUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { postId } = await params;
        if (!postId || !ObjectId.isValid(postId)) {
            return NextResponse.json(null);
        }
        await connectDB();
        const { Post } = await import('@/models/Post');
        const post = await Post.findById(postId).select('accessType sharedWith').lean();
        if (!post) {
            return NextResponse.json(null);
        }
        const decision = canViewPost(user, post as any);
        if (!decision.allowed) {
            return NextResponse.json(null);
        }
        const bookmark = await Bookmark.findOne({
            userId: user.id,
            postId,
        }).lean();
        if (!bookmark) {
            return NextResponse.json(null);
        }
        const bookmarkData = bookmark as unknown as BookmarkLean;
        return NextResponse.json({
            ...bookmarkData,
            chapterIndex: typeof bookmarkData.chapterIndex === 'number' ? bookmarkData.chapterIndex : 0,
        });
    } catch (error) {
        console.error('Error fetching bookmark:', error);
        void logApiError({
            module: '[GET] /api/bookmarks/[postId]',
            error,
            request,
            statusCode: 500,
        });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ postId: string }> }
) {
    try {
        const user = await getAuthUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { postId } = await params;
        if (!postId || !ObjectId.isValid(postId)) {
            return NextResponse.json({ error: 'ID bài viết không hợp lệ' }, { status: 400 });
        }
        await connectDB();
        await Bookmark.findOneAndDelete({
            userId: user.id,
            postId,
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting bookmark:', error);
        void logApiError({
            module: '[DELETE] /api/bookmarks/[postId]',
            error,
            request,
            statusCode: 500,
        });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

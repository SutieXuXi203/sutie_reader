import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { Bookmark } from '@/models/Bookmark';

type BookmarkLean = {
    _id: unknown;
    postId: { toString: () => string } | string;
    chapterIndex?: number;
    currentPage: number;
    totalPages: number;
    updatedAt: unknown;
};

type PostLean = {
    _id: { toString: () => string } | string;
    title?: string;
    images?: string[];
    author?: string;
    tags?: string[];
};

export async function POST(request: NextRequest) {
    try {
        const user = await getAuthUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { postId, chapterIndex = 0, currentPage, totalPages } = await request.json();
        if (!postId || currentPage === undefined || totalPages === undefined) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        const normalizedChapterIndex =
            typeof chapterIndex === 'number' && Number.isFinite(chapterIndex) && chapterIndex >= 0
                ? Math.floor(chapterIndex)
                : 0;
        await connectDB();
        const bookmark = await Bookmark.findOneAndUpdate(
            { userId: user.id, postId },
            { chapterIndex: normalizedChapterIndex, currentPage, totalPages },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );
        return NextResponse.json(bookmark);
    } catch (error) {
        console.error('Error saving bookmark:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
export async function GET(request: NextRequest) {
    try {
        const user = await getAuthUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        await connectDB();
        const bookmarks = (await Bookmark.find({ userId: user.id })
            .sort({ updatedAt: -1 })
            .lean()) as BookmarkLean[];
        const { Post } = await import('@/models/Post');
        const postIds = bookmarks.map((b) => b.postId.toString());
        const posts = (await Post.find({ _id: { $in: postIds } })
            .select('title images author tags')
            .lean()) as PostLean[];
        const postMap = new Map(posts.map((p) => [p._id.toString(), p]));
        const result = bookmarks
            .map((b) => {
                const post = postMap.get(b.postId.toString());
                if (!post) return null;
                return {
                    _id: b._id,
                    postId: b.postId,
                    chapterIndex: b.chapterIndex ?? 0,
                    currentPage: b.currentPage,
                    totalPages: b.totalPages,
                    updatedAt: b.updatedAt,
                    post: {
                        _id: post._id,
                        title: post.title,
                        images: post.images,
                        author: post.author,
                        tags: post.tags,
                    },
                };
            })
            .filter(Boolean);
        return NextResponse.json(result);
    } catch (error) {
        console.error('Error fetching bookmarks:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

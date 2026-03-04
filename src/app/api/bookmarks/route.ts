import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { Bookmark } from '@/models/Bookmark';
export async function POST(request: NextRequest) {
    try {
        const user = await getAuthUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { postId, currentPage, totalPages } = await request.json();
        if (!postId || currentPage === undefined || totalPages === undefined) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        await connectDB();
        const bookmark = await Bookmark.findOneAndUpdate(
            { userId: user.id, postId },
            { currentPage, totalPages },
            { upsert: true, new: true, setDefaultsOnInsert: true }
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
        const bookmarks = await Bookmark.find({ userId: user.id })
            .sort({ updatedAt: -1 })
            .lean();
        const { Post } = await import('@/models/Post');
        const postIds = bookmarks.map((b) => b.postId);
        const posts = await Post.find({ _id: { $in: postIds } })
            .select('title images author tags')
            .lean();
        const postMap = new Map(posts.map((p: any) => [p._id.toString(), p]));
        const result = bookmarks
            .map((b: any) => {
                const post = postMap.get(b.postId.toString());
                if (!post) return null;
                return {
                    _id: b._id,
                    postId: b.postId,
                    currentPage: b.currentPage,
                    totalPages: b.totalPages,
                    updatedAt: b.updatedAt,
                    post: {
                        _id: (post as any)._id,
                        title: (post as any).title,
                        images: (post as any).images,
                        author: (post as any).author,
                        tags: (post as any).tags,
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

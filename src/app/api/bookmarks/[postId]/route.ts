import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { Bookmark } from '@/models/Bookmark';

type BookmarkLean = {
    chapterIndex?: number;
} & Record<string, unknown>;

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
        await connectDB();
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
        await connectDB();
        await Bookmark.findOneAndDelete({
            userId: user.id,
            postId,
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting bookmark:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

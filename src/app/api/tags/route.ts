import { connectDB } from '@/lib/db';
import { Post } from '@/models/Post';
import { Tag } from '@/models/Tag';
import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
export const maxDuration = 60;
const normalizeTag = (value: string): string => value.trim().replace(/\s+/g, ' ').toLowerCase();
export async function GET(request: NextRequest) {
    try {
        await connectDB();
        const tags = await Tag.find({}).sort({ name: 1 }).lean();
        return NextResponse.json(tags);
    } catch (error) {
        console.error('Lỗi khi lấy danh sách tag:', error);
        return NextResponse.json({ error: 'Không thể lấy danh sách tag' }, { status: 500 });
    }
}
export async function POST(request: NextRequest) {
    try {
        if (!(await isAdmin(request))) {
            return NextResponse.json({ error: 'Bạn không có quyền thực hiện hành động này' }, { status: 403 });
        }
        await connectDB();
        const { name } = await request.json();
        if (!name || typeof name !== 'string') {
            return NextResponse.json({ error: 'Tên tag không hợp lệ' }, { status: 400 });
        }
        const normalizedName = normalizeTag(name);
        if (normalizedName.length > 30) {
            return NextResponse.json({ error: 'Tag không được dài quá 30 ký tự.' }, { status: 400 });
        }
        const existingTag = await Tag.findOne({ name: normalizedName });
        if (existingTag) {
            return NextResponse.json({ error: 'Tag này đã tồn tại.' }, { status: 409 });
        }
        const newTag = await Tag.create({ name: normalizedName });
        return NextResponse.json({ message: 'Tạo tag thành công', tag: newTag }, { status: 201 });
    } catch (error: any) {
        console.error('Lỗi khi tạo tag:', error);
        if (error.code === 11000) {
            return NextResponse.json({ error: 'Tag này đã tồn tại.' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Tạo tag không thành công', details: error.message }, { status: 500 });
    }
}
export async function PUT(request: NextRequest) {
    try {
        if (!(await isAdmin(request))) {
            return NextResponse.json({ error: 'Bạn không có quyền thực hiện hành động này' }, { status: 403 });
        }
        await connectDB();
        const { oldTag, newTag } = await request.json();
        if (!oldTag || !newTag || typeof oldTag !== 'string' || typeof newTag !== 'string') {
            return NextResponse.json(
                { error: 'Yêu cầu không hợp lệ. Cần có tag cũ và tag mới.' },
                { status: 400 }
            );
        }
        const nOldTag = normalizeTag(oldTag);
        const nNewTag = normalizeTag(newTag);
        if (nOldTag === nNewTag) {
            return NextResponse.json(
                { error: 'Tag mới không được giống tag cũ.' },
                { status: 400 }
            );
        }
        if (nNewTag.length > 30) {
            return NextResponse.json(
                { error: 'Tag không được dài quá 30 ký tự.' },
                { status: 400 }
            );
        }
        const result = await Post.updateMany(
            { tags: { $regex: new RegExp(`^${nOldTag}$`, 'i') } },
            {
                $pull: { tags: { $regex: new RegExp(`^${nOldTag}$`, 'i') } },
            }
        );
        const currentTag = await Tag.findOne({ name: nOldTag });
        if (currentTag) {
            currentTag.name = nNewTag;
            await currentTag.save();
        } else {
            await Tag.updateOne({ name: nNewTag }, { $set: { name: nNewTag } }, { upsert: true });
        }
        const postsWithOldTag = await Post.find({ tags: { $regex: new RegExp(`^${nOldTag}$`, 'i') } });
        let updatedCount = 0;
        for (const post of postsWithOldTag) {
            const updatedTags = post.tags?.filter(t => t.toLowerCase() !== nOldTag) || [];
            if (!updatedTags.some(t => t.toLowerCase() === nNewTag)) {
                updatedTags.push(nNewTag);
            }
            post.tags = updatedTags;
            await post.save();
            updatedCount++;
        }
        return NextResponse.json({ message: `Đã cập nhật tên tag đổi thành ${nNewTag}, và sửa trên ${updatedCount} bài viết.` });
    } catch (error) {
        console.error('Lỗi khi sửa tag:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: 'Cập nhật tag không thành công', details: message }, { status: 500 });
    }
}
export async function DELETE(request: NextRequest) {
    try {
        if (!(await isAdmin(request))) {
            return NextResponse.json({ error: 'Bạn không có quyền thực hiện hành động này' }, { status: 403 });
        }
        await connectDB();
        const url = new URL(request.url);
        const tagToRemove = url.searchParams.get('tag');
        if (!tagToRemove || typeof tagToRemove !== 'string') {
            return NextResponse.json(
                { error: 'Yêu cầu không hợp lệ. Cần cung cấp tag để xóa.' },
                { status: 400 }
            );
        }
        const nTag = normalizeTag(tagToRemove);
        await Tag.deleteOne({ name: nTag });
        const postsWithTag = await Post.find({ tags: { $regex: new RegExp(`^${nTag}$`, 'i') } });
        let updatedCount = 0;
        for (const post of postsWithTag) {
            post.tags = post.tags?.filter(t => t.toLowerCase() !== nTag) || [];
            await post.save();
            updatedCount++;
        }
        return NextResponse.json({ message: `Đã xóa tag và gỡ khỏi ${updatedCount} bài viết.` });
    } catch (error) {
        console.error('Lỗi khi xóa tag:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: 'Xóa tag không thành công', details: message }, { status: 500 });
    }
}

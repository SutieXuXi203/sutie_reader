import { connectDB } from '@/lib/db';
import { Post } from '@/models/Post';
import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { isAdmin } from '@/lib/auth';
import { google } from 'googleapis';

// Limit body size for Next.js 15+ App Router
export const maxDuration = 60;

const normalizeTags = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const tags: string[] = [];

  for (const rawTag of value) {
    if (typeof rawTag !== 'string') continue;
    const tag = rawTag.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!tag || tag.length > 30) continue;

    const key = tag.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    tags.push(tag);
    if (tags.length >= 20) break;
  }

  return tags;
};

async function getDriveService() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) return null;

  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, 'https://developers.google.com/oauthplayground');
  oAuth2Client.setCredentials({ refresh_token: refreshToken });
  return google.drive({ version: 'v3', auth: oAuth2Client });
}

async function deleteDriveFolder(postTitle: string) {
  try {
    const drive = await getDriveService();
    if (!drive) return;

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) return;

    // Find the folder by post title
    const searchRes = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${postTitle.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (searchRes.data.files && searchRes.data.files.length > 0) {
      const targetFolderId = searchRes.data.files[0].id!;
      await drive.files.delete({ fileId: targetFolderId });
      console.log(`Đã xóa folder Drive "${postTitle}" (${targetFolderId})`);
    }
  } catch (err) {
    console.warn(`Không thể xóa folder Drive cho bài "${postTitle}":`, err);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ID bài viết không hợp lệ' }, { status: 400 });
    }

    const post = await Post.findById(id);

    if (!post) {
      return NextResponse.json({ error: 'Không tìm thấy bài viết' }, { status: 404 });
    }

    return NextResponse.json(post);
  } catch (error) {
    console.error('Lỗi khi tải bài viết:', error);
    return NextResponse.json({ error: 'Tải bài viết không thành công' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json({ error: 'Bạn không có quyền thực hiện hành động này' }, { status: 403 });
    }
    await connectDB();
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ID bài viết không hợp lệ' }, { status: 400 });
    }

    const { title, description, tags, content, author, images } = await request.json();
    const normalizedTags = normalizeTags(tags);

    if (!title || !content) {
      return NextResponse.json({ error: 'Các trường bắt buộc bị thiếu' }, { status: 400 });
    }

    if (!Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: 'Cần có ít nhất một hình ảnh' }, { status: 400 });
    }

    const updatePayload: {
      title: string;
      tags: string[];
      content: string;
      author: string;
      images: string[];
      description?: string;
    } = {
      title,
      tags: normalizedTags,
      content,
      author: author || 'Không rõ tác giả',
      images,
    };

    if (typeof description === 'string') {
      updatePayload.description = description.trim().slice(0, 300);
    }

    const updated = await Post.findByIdAndUpdate(id, updatePayload, { new: true, runValidators: true });

    if (!updated) {
      return NextResponse.json({ error: 'Không tìm thấy bài viết' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Lỗi khi cập nhật bài viết:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Cập nhật bài viết không thành công', details: message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ID bài viết không hợp lệ' }, { status: 400 });
    }

    const deletedPost = await Post.findByIdAndDelete(id);

    if (!deletedPost) {
      return NextResponse.json({ error: 'Không tìm thấy bài viết' }, { status: 404 });
    }

    // Xóa folder trên Google Drive (best-effort, không block response)
    deleteDriveFolder(deletedPost.title).catch((err) =>
      console.warn('Lỗi khi xóa folder Drive:', err)
    );

    return NextResponse.json({ message: 'Bài viết đã được xóa thành công' });
  } catch (error) {
    console.error('Lỗi khi xóa bài viết:', error);
    return NextResponse.json({ error: 'Xóa bài viết không thành công' }, { status: 500 });
  }
}


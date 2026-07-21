import { connectDB } from '@/lib/db';
import { Post } from '@/models/Post';
import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { isAdmin } from '@/lib/auth';
import { google } from 'googleapis';
import { getPostChapters, type NormalizedPostChapter } from '@/lib/utils';

export const maxDuration = 60;

type IncomingChapter = {
  title?: unknown;
  chapterNumber?: unknown;
  content?: unknown;
  images?: unknown;
};

const normalizeTags = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const rawTag of value) {
    if (typeof rawTag !== 'string') continue;
    const tag = rawTag.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!tag || tag.length > 30) continue;
    if (seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= 20) break;
  }
  return tags;
};

const normalizeImages = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((img): img is string => typeof img === 'string')
    .map((img) => img.trim())
    .filter(Boolean);
};

const normalizeChapter = (
  raw: IncomingChapter,
  index: number
): NormalizedPostChapter | null => {
  const content = typeof raw.content === 'string' ? raw.content.trim() : '';
  const images = normalizeImages(raw.images);

  if (!content && images.length === 0) {
    return null;
  }

  const rawNumber =
    typeof raw.chapterNumber === 'number' && Number.isFinite(raw.chapterNumber)
      ? Math.floor(raw.chapterNumber)
      : index + 1;
  const chapterNumber = rawNumber > 0 ? rawNumber : index + 1;
  const fallbackTitle = `Chuong ${chapterNumber}`;
  const title =
    typeof raw.title === 'string' && raw.title.trim()
      ? raw.title.trim().slice(0, 120)
      : fallbackTitle;

  return {
    title,
    chapterNumber,
    content,
    images,
  };
};

const dedupeAndSortChapters = (
  chapters: NormalizedPostChapter[]
): NormalizedPostChapter[] => {
  const sorted = [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber);
  const usedNumbers = new Set<number>();
  return sorted.map((chapter) => {
    let chapterNumber = chapter.chapterNumber;
    while (usedNumbers.has(chapterNumber)) {
      chapterNumber += 1;
    }
    usedNumbers.add(chapterNumber);
    return {
      ...chapter,
      chapterNumber,
    };
  });
};

const toPlainPost = (postDoc: unknown): Record<string, unknown> => {
  if (postDoc && typeof postDoc === 'object') {
    const maybeDocument = postDoc as { toObject?: unknown };
    if (typeof maybeDocument.toObject === 'function') {
      return (maybeDocument.toObject as () => Record<string, unknown>)();
    }
    return postDoc as Record<string, unknown>;
  }
  return {};
};

const serializePost = (postDoc: unknown) => {
  const post = toPlainPost(postDoc);
  const chapters = getPostChapters(post);
  const firstChapter = chapters[0];

  return {
    ...post,
    chapters,
    chapterCount: chapters.length,
    content: firstChapter?.content || '',
    images: firstChapter?.images || [],
  };
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
    const searchRes = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${postTitle.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    if (searchRes.data.files && searchRes.data.files.length > 0) {
      const targetFolderId = searchRes.data.files[0].id!;
      await drive.files.delete({
        fileId: targetFolderId,
        supportsAllDrives: true,
      });
      console.log(`Đã xóa folder Drive "${postTitle}" (${targetFolderId})`);
    }
  } catch (err: unknown) {
    const errorObj = err as { code?: number; status?: number };
    if (errorObj?.code === 404 || errorObj?.status === 404) {
      console.log(`Folder Drive cho bài "${postTitle}" không tồn tại hoặc đã bị xóa trước đó.`);
    } else {
      console.warn(`Không thể xóa folder Drive cho bài "${postTitle}":`, err);
    }
  }
}

async function renameDriveFolder(oldTitle: string, newTitle: string) {
  try {
    const drive = await getDriveService();
    if (!drive) return;
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) return;
    const searchRes = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${oldTitle.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    if (searchRes.data.files && searchRes.data.files.length > 0) {
      const targetFolderId = searchRes.data.files[0].id!;
      await drive.files.update({
        fileId: targetFolderId,
        requestBody: { name: newTitle },
        supportsAllDrives: true,
      });
      console.log(`Đã đổi tên folder Drive từ "${oldTitle}" thành "${newTitle}" (${targetFolderId})`);
    } else {
      console.log(`Không tìm thấy folder Drive cũ "${oldTitle}" để đổi tên thành "${newTitle}"`);
    }
  } catch (err) {
    console.warn(`Không thể đổi tên folder Drive từ "${oldTitle}" thành "${newTitle}":`, err);
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
    return NextResponse.json(serializePost(post));
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

    const payload = await request.json();
    const rawTitle = typeof payload?.title === 'string' ? payload.title.trim() : '';
    const title = rawTitle.slice(0, 100);
    if (!title) {
      return NextResponse.json({ error: 'Tiêu đề là bắt buộc' }, { status: 400 });
    }

    const existingPost = await Post.findById(id);
    if (!existingPost) {
      return NextResponse.json({ error: 'Không tìm thấy bài viết' }, { status: 404 });
    }

    const normalizedTags = normalizeTags(payload?.tags);
    const normalizedAuthor =
      typeof payload?.author === 'string' && payload.author.trim()
        ? payload.author.trim()
        : 'Không rõ tác giả';
    const currentChapters = getPostChapters(existingPost.toObject());
    let nextChapters = [...currentChapters];

    if (Array.isArray(payload?.chapters)) {
      const normalizedIncoming = payload.chapters
        .map((chapter: IncomingChapter, index: number) =>
          normalizeChapter(chapter, index)
        )
        .filter((chapter: NormalizedPostChapter | null): chapter is NormalizedPostChapter => chapter !== null);

      if (normalizedIncoming.length === 0) {
        return NextResponse.json(
          { error: 'Danh sách chương không hợp lệ hoặc không có nội dung.' },
          { status: 400 }
        );
      }

      nextChapters = dedupeAndSortChapters(normalizedIncoming);
    }

    const hasLegacyPayload =
      typeof payload?.content === 'string' || Array.isArray(payload?.images);
    if (hasLegacyPayload) {
      const firstChapterNumber = nextChapters[0]?.chapterNumber || 1;
      const firstChapterTitle = nextChapters[0]?.title || `Chuong ${firstChapterNumber}`;
      const mergedFirstChapter = normalizeChapter(
        {
          title: firstChapterTitle,
          chapterNumber: firstChapterNumber,
          content: payload?.content,
          images: payload?.images,
        },
        0
      );

      if (!mergedFirstChapter) {
        return NextResponse.json(
          { error: 'Nội dung chương đầu và ảnh là bắt buộc.' },
          { status: 400 }
        );
      }

      if (nextChapters.length === 0) {
        nextChapters = [mergedFirstChapter];
      } else {
        nextChapters = [mergedFirstChapter, ...nextChapters.slice(1)];
      }
    }

    nextChapters = dedupeAndSortChapters(nextChapters);
    const firstChapter = nextChapters[0];
    const titleChanged = existingPost.title !== title;

    const updatePayload: {
      title: string;
      tags: string[];
      author: string;
      chapters: NormalizedPostChapter[];
      content: string;
      images: string[];
      description?: string;
    } = {
      title,
      tags: normalizedTags,
      author: normalizedAuthor,
      chapters: nextChapters,
      content: firstChapter?.content || '',
      images: firstChapter?.images || [],
    };

    if (typeof payload?.description === 'string') {
      updatePayload.description = payload.description.trim().slice(0, 300);
    }

    const updated = await Post.findByIdAndUpdate(id, updatePayload, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Không tìm thấy bài viết' }, { status: 404 });
    }

    if (titleChanged) {
      console.log(`Bắt đầu đổi tên folder Drive từ "${existingPost.title}" sang "${title}"...`);
      try {
        await renameDriveFolder(existingPost.title, title);
      } catch (err) {
        console.warn('Lỗi khi đổi tên folder Drive:', err);
      }
    }

    return NextResponse.json(serializePost(updated));
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
    deleteDriveFolder(deletedPost.title).catch((err) =>
      console.warn('Lỗi khi xóa folder Drive:', err)
    );
    return NextResponse.json({ message: 'Bài viết đã được xóa thành công' });
  } catch (error) {
    console.error('Lỗi khi xóa bài viết:', error);
    return NextResponse.json({ error: 'Xóa bài viết không thành công' }, { status: 500 });
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Post } from '@/models/Post';
import { ObjectId } from 'mongodb';
import { extractDriveImageId } from '@/lib/utils';
import { createSignedWorkerImageUrl } from '@/lib/image-signing';
import sharp from 'sharp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const DRIVE_FILE_ID_PATTERN = /^[a-zA-Z0-9_-]{10,}$/;

function getWorkerBaseUrl(): string {
  return (
    process.env.CLOUDFLARE_WORKER_URL ||
    process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_URL ||
    ''
  ).replace(/\/+$/, '');
}

/**
 * Serve ảnh bìa truyện dưới dạng thumbnail cho OG / social media crawlers.
 * KHÔNG yêu cầu auth — chỉ serve ảnh bìa (chương đầu) ở chất lượng thấp.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ postId: string }> }
) {
  const { postId } = await context.params;

  if (!ObjectId.isValid(postId)) {
    return NextResponse.json({ error: 'Invalid post id' }, { status: 400 });
  }

  try {
    await connectDB();
    const post = await Post.findById(postId)
      .select('images chapters.images')
      .lean();

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Tìm ảnh bìa: post.images[0] → chapters[0].images[0]
    const postImages = (post as any).images || [];
    const chapters = (post as any).chapters || [];
    let coverUrl =
      (postImages[0] && typeof postImages[0] === 'string' && postImages[0].trim()) || '';
    if (!coverUrl && chapters.length > 0) {
      const firstChapterImages = chapters[0]?.images || [];
      coverUrl =
        (firstChapterImages[0] && typeof firstChapterImages[0] === 'string' && firstChapterImages[0].trim()) || '';
    }

    if (!coverUrl) {
      return NextResponse.json({ error: 'No cover image' }, { status: 404 });
    }

    // Trích fileId từ URL (Google Drive hoặc internal)
    let fileId = extractDriveImageId(coverUrl);
    if (!fileId) {
      // Thử parse từ /api/image/[id] path
      const match = coverUrl.match(/\/api\/image\/([a-zA-Z0-9_-]+)/);
      if (match) {
        fileId = match[1];
      }
    }

    if (!fileId || !DRIVE_FILE_ID_PATTERN.test(fileId)) {
      // Nếu là URL trực tiếp, redirect
      if (coverUrl.startsWith('http')) {
        return NextResponse.redirect(coverUrl, 302);
      }
      return NextResponse.json({ error: 'Cannot resolve cover image' }, { status: 404 });
    }

    // Fetch ảnh từ Cloudflare Worker với signed URL (dùng system subject)
    const signedUrl = createSignedWorkerImageUrl({
      workerBaseUrl: getWorkerBaseUrl(),
      fileId,
      subject: 'og-image-bot',
    });

    const upstream = await fetch(signedUrl, {
      headers: {
        'Accept': 'image/webp,image/jpeg,image/*',
        'X-Sutie-Image-Proxy': 'og-image',
      },
      cache: 'no-store',
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: 'Failed to fetch cover image' }, { status: 502 });
    }

    // Resize nhỏ cho OG: 600px width, WebP quality 75
    const rawBuffer = Buffer.from(await upstream.arrayBuffer());
    const ogBuffer = await sharp(rawBuffer)
      .resize({ width: 600, withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();

    return new NextResponse(new Uint8Array(ogBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    console.error('[og-image] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

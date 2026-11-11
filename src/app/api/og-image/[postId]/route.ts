import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Post } from '@/models/Post';
import { ObjectId } from 'mongodb';
import { extractDriveImageId } from '@/lib/utils';
import { createSignedWorkerImageUrl } from '@/lib/image-signing';
import { checkRateLimit } from '@/lib/memoryRateLimit';
import { getClientIp } from '@/lib/clientIp';
import { pickPublicCoverUrl } from '@/lib/ogCover';
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
 * KHÔNG yêu cầu auth nên CHỈ phục vụ truyện công khai (accessType = public), ảnh bìa lấy từ chương không bị hạn chế,
 * chất lượng thấp (600px) và có giới hạn tần suất theo IP (mỗi request tải ảnh và xử lý bằng sharp).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ postId: string }> }
) {
  const { postId } = await context.params;

  const limit = await checkRateLimit(`og:${getClientIp(request.headers)}`, 30, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    );
  }

  if (!ObjectId.isValid(postId)) {
    return NextResponse.json({ error: 'Invalid post id' }, { status: 400 });
  }

  try {
    await connectDB();
    const post = await Post.findById(postId)
      .select('accessType images chapters.images chapters.accessType')
      .lean();

    if (!post || (post as { accessType?: string }).accessType !== 'public') {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Chỉ lấy ảnh bìa thuộc chương KHÔNG bị hạn chế (post.images là bản sao chương 1, có thể đang bị khóa)
    const coverUrl = pickPublicCoverUrl(
      post as { images?: unknown[]; chapters?: { images?: unknown[]; accessType?: string }[] }
    );

    if (!coverUrl) {
      return NextResponse.json({ error: 'No cover image' }, { status: 404 });
    }

    // Trích fileId từ URL (Google Drive hoặc internal)
    const fileId = extractDriveImageId(coverUrl);

    if (!fileId || !DRIVE_FILE_ID_PATTERN.test(fileId)) {
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
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    console.error('[og-image] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

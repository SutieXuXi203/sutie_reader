import { detectImageType, IMAGE_MIME_BY_TYPE } from './imageMagic';

let cachedDriveService: any = null;

export function isDirectDriveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  );
}

export async function getDirectDriveService() {
  if (cachedDriveService) return cachedDriveService;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) return null;

  const { google } = await import('googleapis');
  const oAuth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'https://developers.google.com/oauthplayground'
  );
  oAuth2Client.setCredentials({ refresh_token: refreshToken });

  cachedDriveService = google.drive({ version: 'v3', auth: oAuth2Client });
  return cachedDriveService;
}

export type DirectDriveImageResult = {
  rawBuffer: Buffer;
  upstreamType: string;
};

/**
 * Tải trực tiếp file ảnh từ Google Drive API qua OAuth2.
 * Dùng làm lớp cứu cánh (fallback) tin cậy cao khi Cloudflare Worker gặp sự cố mạng hoặc timeout.
 */
export async function fetchDirectDriveImageBuffer(
  fileId: string,
  options: { timeoutMs?: number; maxBytes?: number; driveInstance?: any } = {}
): Promise<DirectDriveImageResult | null> {
  const drive = options.driveInstance || (await getDirectDriveService());
  if (!drive) return null;

  const timeoutMs = options.timeoutMs ?? 15_000;
  const maxBytes = options.maxBytes ?? 25 * 1024 * 1024;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer', signal: controller.signal }
    );

    const rawBuffer = Buffer.from(res.data as ArrayBuffer);
    if (rawBuffer.length > maxBytes) {
      const err = new Error('Image too large');
      (err as any).status = 413;
      throw err;
    }

    const detected = detectImageType(rawBuffer);
    if (!detected) {
      const err = new Error('Unsupported media type');
      (err as any).status = 415;
      throw err;
    }

    return {
      rawBuffer,
      upstreamType: IMAGE_MIME_BY_TYPE[detected] || 'image/webp',
    };
  } catch (error: any) {
    if (error?.status === 404 || error?.code === 404) {
      const notFoundErr = new Error('Image not found');
      (notFoundErr as any).status = 404;
      throw notFoundErr;
    }
    if (error?.status === 413 || error?.status === 415) {
      throw error;
    }
    console.warn(`[DirectDrive] Direct fetch failed for ${fileId}:`, error?.message || error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

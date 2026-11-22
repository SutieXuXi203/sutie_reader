import type { drive_v3 } from 'googleapis';
import { detectImageType, IMAGE_MIME_BY_TYPE } from './imageMagic';

export interface DirectDriveClient {
  files: {
    get(
      params: { fileId: string; alt: 'media'; supportsAllDrives: boolean },
      options: { responseType: 'arraybuffer'; signal?: AbortSignal }
    ): Promise<{ data: unknown }>;
  };
}

export interface DirectDriveError extends Error {
  status?: number;
  code?: number;
}

function createDirectDriveError(message: string, status: number): DirectDriveError {
  const err: DirectDriveError = new Error(message);
  err.status = status;
  return err;
}

let cachedDriveService: drive_v3.Drive | null = null;

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
  options: { timeoutMs?: number; maxBytes?: number; driveInstance?: DirectDriveClient } = {}
): Promise<DirectDriveImageResult | null> {
  const drive: DirectDriveClient | null = options.driveInstance || (await getDirectDriveService());
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

    const rawBuffer = Buffer.isBuffer(res.data)
      ? res.data
      : Buffer.from(res.data as ArrayBuffer);
    if (rawBuffer.length > maxBytes) {
      throw createDirectDriveError('Image too large', 413);
    }

    const detected = detectImageType(rawBuffer);
    if (!detected) {
      throw createDirectDriveError('Unsupported media type', 415);
    }

    return {
      rawBuffer,
      upstreamType: IMAGE_MIME_BY_TYPE[detected] || 'image/webp',
    };
  } catch (error: unknown) {
    const driveErr = error as { status?: number; code?: number; message?: string } | null;
    if (driveErr?.status === 404 || driveErr?.code === 404) {
      throw createDirectDriveError('Image not found', 404);
    }
    if (driveErr?.status === 413 || driveErr?.status === 415) {
      throw error;
    }
    console.warn(`[DirectDrive] Direct fetch failed for ${fileId}:`, driveErr?.message || error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import type { Readable } from 'node:stream';
async function getDriveService() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('Thiếu thông tin xác thực OAuth2 (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, hoặc GOOGLE_REFRESH_TOKEN)');
    }
    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, 'https://developers.google.com/oauthplayground');
    oAuth2Client.setCredentials({ refresh_token: refreshToken });
    return google.drive({ version: 'v3', auth: oAuth2Client });
}
export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params;
    if (!id) {
        return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }
    try {
        const drive = await getDriveService();
        const metaRes = await drive.files.get({ fileId: id, fields: 'mimeType, name' });
        const mimeType = metaRes.data.mimeType || 'application/octet-stream';
        const filename = metaRes.data.name || 'image';
        const response = await drive.files.get(
            { fileId: id, alt: 'media' },
            { responseType: 'stream' }
        );
        const nodeStream = response.data as Readable;
        const webStream = new ReadableStream<Uint8Array>({
            start(controller) {
                nodeStream.on('data', (chunk: Buffer | string) =>
                    controller.enqueue(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
                );
                nodeStream.on('end', () => controller.close());
                nodeStream.on('error', (err: Error) => controller.error(err));
            }
        });
        return new NextResponse(webStream, {
            headers: {
                'Content-Type': mimeType,
                'Cache-Control': 'public, max-age=31536000, immutable',
                'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Error serving image from Drive:', message);
        return NextResponse.json({ error: 'Lỗi tải ảnh' }, { status: 500 });
    }
}

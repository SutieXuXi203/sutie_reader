import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

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
    context: { params: Promise<{ id: string }> } // or standard params object based on Next version
) {
    // Next 15+ has asynchronous params. Need to await them.
    const { id } = await context.params;

    if (!id) {
        return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    try {
        const drive = await getDriveService();

        // Fetch file metadata to get correct MIME type and filename
        const metaRes = await drive.files.get({ fileId: id, fields: 'mimeType, name' });
        const mimeType = metaRes.data.mimeType || 'application/octet-stream';
        const filename = metaRes.data.name || 'image';

        // Fetch the file media stream
        const response = await drive.files.get(
            { fileId: id, alt: 'media' },
            { responseType: 'stream' }
        );

        // Define stream type properly to avoid TS errors
        const nodeStream = response.data as any;

        // Convert Node.js Readable stream to Web ReadableStream for Next.js
        const webStream = new ReadableStream({
            start(controller) {
                nodeStream.on('data', (chunk: Buffer) => controller.enqueue(chunk));
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
    } catch (error: any) {
        console.error('Error serving image from Drive:', error.message || error);
        return NextResponse.json({ error: 'Lỗi tải ảnh' }, { status: 500 });
    }
}

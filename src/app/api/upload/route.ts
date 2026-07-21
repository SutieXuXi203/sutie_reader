import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'stream';
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
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
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const files = formData.getAll('files') as File[];
        const title = formData.get('title') as string || 'Untitled';
        if (!files.length) {
            return NextResponse.json({ error: 'Không có file nào được gửi' }, { status: 400 });
        }
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        if (!folderId) {
            throw new Error('Chưa cấu hình GOOGLE_DRIVE_FOLDER_ID');
        }
        const drive = await getDriveService();
        let targetFolderId = folderId;
        const searchRes = await drive.files.list({
            q: `mimeType='application/vnd.google-apps.folder' and name='${title.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
        });
        if (searchRes.data.files && searchRes.data.files.length > 0) {
            targetFolderId = searchRes.data.files[0].id!;
        } else {
            const folderMetadata = {
                name: title,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [folderId],
            };
            const folder = await drive.files.create({
                requestBody: folderMetadata,
                fields: 'id',
                supportsAllDrives: true,
            });
            targetFolderId = folder.data.id!;
            try {
                await drive.permissions.create({
                    fileId: targetFolderId,
                    requestBody: {
                        role: 'reader',
                        type: 'anyone',
                    },
                    supportsAllDrives: true,
                });
            } catch (err) {
                console.warn(`Không thể set quyền public cho folder mới ${targetFolderId}:`, err);
            }
        }
        const uploadPromises = files.map(async (file) => {
            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);
            const filename = file.name || 'khong_ten.jpg';
            const stream = new Readable();
            stream.push(buffer);
            stream.push(null);
            const fileMetadata = {
                name: filename,
                parents: [targetFolderId],
            };
            const media = {
                mimeType: file.type,
                body: stream,
            };
            const response = await drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id, webViewLink, webContentLink',
                supportsAllDrives: true,
            });
            const fileId = response.data.id;
            if (fileId) {
                try {
                    await drive.permissions.create({
                        fileId: fileId,
                        requestBody: {
                            role: 'reader',
                            type: 'anyone',
                        },
                        supportsAllDrives: true,
                    });
                } catch (permError) {
                    console.warn(`Không thể set quyền public cho file ${fileId} (có thể do lỗi Quota policy):`, permError);
                }
                return `/api/image/${fileId}`;
            }
            return null;
        });
        const results = await Promise.all(uploadPromises);
        const urls = results.filter((url): url is string => url !== null);
        return NextResponse.json({ urls });
    } catch (error) {
        console.error('Lỗi khi upload ảnh lên Drive:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: 'Upload thất bại', details: message }, { status: 500 });
    }
}

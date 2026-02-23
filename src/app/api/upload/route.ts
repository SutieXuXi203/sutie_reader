import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const files = formData.getAll('files') as File[];

        if (!files.length) {
            return NextResponse.json({ error: 'Không có file nào được gửi' }, { status: 400 });
        }

        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        await mkdir(uploadDir, { recursive: true });

        const urls: string[] = [];

        for (const file of files) {
            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);

            const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
            const filename = `${randomUUID()}.${ext}`;
            const filepath = path.join(uploadDir, filename);

            await writeFile(filepath, buffer);
            urls.push(`/uploads/${filename}`);
        }

        return NextResponse.json({ urls });
    } catch (error) {
        console.error('Lỗi khi upload ảnh:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: 'Upload thất bại', details: message }, { status: 500 });
    }
}

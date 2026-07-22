import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';

const MAX_FILES_PER_REQUEST = 10;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
    try {
        if (!(await isAdmin(request))) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const formData = await request.formData();
        const fileEntries = formData.getAll('files');
        const rawFiles = fileEntries.filter((file): file is File => file instanceof File);
        const rawTitle = formData.get('title');
        const rawPostId = formData.get('postId');
        const title = typeof rawTitle === 'string' && rawTitle.trim() ? rawTitle.trim() : 'Untitled';
        const postId = typeof rawPostId === 'string' ? rawPostId.trim() : '';

        if (!rawFiles.length) {
            return NextResponse.json({ error: 'Không có file nào được gửi' }, { status: 400 });
        }

        if (rawFiles.length !== fileEntries.length) {
            return NextResponse.json({ error: 'Payload file khong hop le' }, { status: 400 });
        }

        if (rawFiles.length > MAX_FILES_PER_REQUEST) {
            return NextResponse.json({ error: `Chi duoc upload toi da ${MAX_FILES_PER_REQUEST} file moi lan` }, { status: 400 });
        }

        if (postId && !/^[a-f\d]{24}$/i.test(postId)) {
            return NextResponse.json({ error: 'Post ID khong hop le' }, { status: 400 });
        }

        const invalidFile = rawFiles.find((file) => !file.type.startsWith('image/') || file.size > MAX_FILE_SIZE_BYTES);
        if (invalidFile) {
            return NextResponse.json(
                { error: `File "${invalidFile.name}" khong phai anh hoac vuot qua 10MB` },
                { status: 400 }
            );
        }

        const files = rawFiles.sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );

        console.log(`[API UPLOAD] 📥 Nhận ${files.length} ảnh upload cho tiêu đề: "${title}"`);

        const workerUrl = process.env.CLOUDFLARE_WORKER_URL?.replace(/\/+$/, '');
        const uploadSecret = process.env.CLOUDFLARE_UPLOAD_SECRET;

        if (!workerUrl || !uploadSecret) {
            console.error('[API UPLOAD] ❌ Thiếu cấu hình CLOUDFLARE_WORKER_URL hoặc CLOUDFLARE_UPLOAD_SECRET');
            return NextResponse.json(
                { error: 'Chưa cấu hình Cloudflare Worker URL hoặc Secret trong biến môi trường (.env).' },
                { status: 500 }
            );
        }

        console.log(`[API UPLOAD] 🚀 Chuyển tiếp ${files.length} ảnh tới Cloudflare Worker: ${workerUrl}/upload`);

        const workerFormData = new FormData();
        workerFormData.append('title', title);
        if (postId) workerFormData.append('postId', postId);
        files.forEach((file) => workerFormData.append('files', file, file.name));

        const res = await fetch(`${workerUrl}/upload`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${uploadSecret.trim()}`,
            },
            body: workerFormData,
        });

        const responseText = await res.text();

        let data: { urls?: string[]; error?: string; details?: string } = {};
        try {
            data = JSON.parse(responseText);
        } catch {
            console.error('[API UPLOAD] ❌ Cloudflare Worker trả về định dạng không phải JSON:', responseText);
            return NextResponse.json(
                {
                    error: 'Cloudflare Worker trả về phản hồi không hợp lệ.',
                    details: `Nội dung phản hồi từ Worker: "${responseText.substring(0, 100)}". Vui lòng kiểm tra lại mã nguồn đã được dán và Save & Deploy trên Cloudflare Dashboard chưa.`,
                },
                { status: 502 }
            );
        }

        if (!res.ok) {
            console.error(`[API UPLOAD] ❌ Cloudflare Worker trả về lỗi ${res.status}:`, data);
            return NextResponse.json(
                { error: data.error || 'Upload qua Cloudflare Worker thất bại', details: data.details || responseText },
                { status: res.status }
            );
        }

        if (data.urls && Array.isArray(data.urls)) {
            console.log(`[API UPLOAD] Cloudflare Worker upload THÀNH CÔNG! Trả về ${data.urls.length} URLs.`);
            return NextResponse.json({ urls: data.urls });
        }

        return NextResponse.json({ error: 'Không nhận được danh sách URL từ Cloudflare Worker' }, { status: 500 });
    } catch (error) {
        console.error('Lỗi khi gửi yêu cầu upload tới Cloudflare Worker:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: 'Upload thất bại', details: message }, { status: 500 });
    }
}

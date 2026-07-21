import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const rawFiles = formData.getAll('files') as File[];
        const title = (formData.get('title') as string) || 'Untitled';

        if (!rawFiles.length) {
            return NextResponse.json({ error: 'Không có file nào được gửi' }, { status: 400 });
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
        files.forEach((file) => workerFormData.append('files', file, file.name));

        const res = await fetch(`${workerUrl}/upload`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${uploadSecret}`,
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
            console.log(`[API UPLOAD] ✅ Cloudflare Worker upload THÀNH CÔNG! Trả về ${data.urls.length} URLs.`);
            return NextResponse.json({ urls: data.urls });
        }

        return NextResponse.json({ error: 'Không nhận được danh sách URL từ Cloudflare Worker' }, { status: 500 });
    } catch (error) {
        console.error('Lỗi khi gửi yêu cầu upload tới Cloudflare Worker:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: 'Upload thất bại', details: message }, { status: 500 });
    }
}

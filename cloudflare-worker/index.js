async function getAccessToken(env) {
  console.log('[CF WORKER] 🔑 Đang xin Google Access Token từ OAuth2 Refresh Token...');
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    refresh_token: env.GOOGLE_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('[CF WORKER] ❌ Lỗi lấy Access Token:', data);
    throw new Error(data.error_description || 'Không thể lấy Google Access Token');
  }
  console.log('[CF WORKER] ✅ Lấy Access Token thành công.');
  return data.access_token;
}

async function getOrCreateFolder(accessToken, parentFolderId, title) {
  const cleanTitle = title.replace(/'/g, "\\'");
  const q = `mimeType='application/vnd.google-apps.folder' and name='${cleanTitle}' and '${parentFolderId}' in parents and trashed=false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&supportsAllDrives=true&includeItemsFromAllDrives=true`;

  console.log(`[CF WORKER] 📁 Tìm thư mục bài viết "${title}" trong folder cha ${parentFolderId}...`);
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    const existingId = searchData.files[0].id;
    console.log(`[CF WORKER] 📁 Đã tìm thấy thư mục cũ ID: ${existingId}`);
    return existingId;
  }

  console.log(`[CF WORKER] 📁 Không tìm thấy thư mục cũ. Đang tạo thư mục mới "${title}"...`);
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: title,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    }),
  });

  const folderData = await createRes.json();
  console.log(`[CF WORKER] 📁 Tạo thư mục mới THÀNH CÔNG, ID: ${folderData.id}`);
  return folderData.id;
}

async function uploadFileToDrive(accessToken, folderId, file, index, total) {
  console.log(`[CF WORKER] 📤 Uploading (${index + 1}/${total}): ${file.name} (${Math.round(file.size / 1024)} KB)...`);
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const close_delim = `\r\n--${boundary}--`;

  const metadata = {
    name: file.name || 'image.jpg',
    parents: [folderId],
  };

  const arrayBuffer = await file.arrayBuffer();
  const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
  const fileBlob = new Blob([arrayBuffer], { type: file.type || 'image/jpeg' });

  const multipartBody = new Blob([
    delimiter,
    'Content-Type: application/json; charset=UTF-8\r\n\r\n',
    metadataBlob,
    delimiter,
    `Content-Type: ${file.type || 'image/jpeg'}\r\n\r\n`,
    fileBlob,
    close_delim,
  ]);

  const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  const fileData = await uploadRes.json();
  if (!fileData.id) {
    console.error(`[CF WORKER] ❌ Lỗi upload file ${file.name}:`, fileData);
    throw new Error(fileData.error?.message || 'Upload Google Drive thất bại');
  }

  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileData.id}/permissions?supportsAllDrives=true`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    });
  } catch (permErr) {
    console.warn(`[CF WORKER] ⚠️ Không thể cấp quyền public cho file ${fileData.id}:`, permErr);
  }

  console.log(`[CF WORKER] ✅ Upload xong (${index + 1}/${total}): ${file.name} -> Drive File ID: ${fileData.id}`);
  return fileData.id;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === 'GET' && url.pathname.startsWith('/image/')) {
      const fileId = url.pathname.replace('/image/', '');
      console.log(`[CF WORKER] 🖼️ Serving image request for file ID: ${fileId}`);
      try {
        const accessToken = await getAccessToken(env);
        const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!driveRes.ok) {
          console.warn(`[CF WORKER] ⚠️ Ảnh ID ${fileId} không tồn tại trên Drive.`);
          return new Response('Không tìm thấy ảnh trên Drive', { status: 404, headers: corsHeaders });
        }

        const headers = new Headers(corsHeaders);
        headers.set('Content-Type', driveRes.headers.get('content-type') || 'image/jpeg');
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');

        return new Response(driveRes.body, { status: 200, headers });
      } catch (err) {
        console.error(`[CF WORKER] ❌ Lỗi khi stream ảnh ID ${fileId}:`, err);
        return new Response('Lỗi tải ảnh', { status: 500, headers: corsHeaders });
      }
    }

    if (request.method === 'POST' && url.pathname === '/upload') {
      console.log('[CF WORKER] 📥 Nhận request POST /upload');

      const authHeader = (request.headers.get('Authorization') || '').trim();
      const expectedSecret = (env.UPLOAD_SECRET || '').trim();

      if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
        console.warn(`[CF WORKER] ⛔ Từ chối 401. Token gửi sang: "${authHeader}", Mật khẩu yêu cầu: "Bearer ${expectedSecret}"`);
        return new Response(
          JSON.stringify({
            error: 'Unauthorized',
            details: `Mã xác thực không hợp lệ. Vui lòng kiểm tra lại CLOUDFLARE_UPLOAD_SECRET trên Vercel và UPLOAD_SECRET trên Cloudflare Worker.`,
          }),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      try {
        const formData = await request.formData();
        const files = formData.getAll('files');
        const title = formData.get('title') || 'Untitled';

        if (!files || files.length === 0) {
          console.warn('[CF WORKER] ⚠️ Không có file nào trong payload request.');
          return new Response(JSON.stringify({ error: 'Không có file' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log(`[CF WORKER] 🚀 Bắt đầu xử lý ${files.length} ảnh cho bài viết "${title}"...`);

        const accessToken = await getAccessToken(env);
        const rawFolderId = env.GOOGLE_DRIVE_FOLDER_ID || '';
        const matchFolder = rawFolderId.match(/(?:folders\/|id=)([a-zA-Z0-9_-]+)/);
        const parentFolderId = matchFolder ? matchFolder[1] : rawFolderId.trim();

        const targetFolderId = await getOrCreateFolder(accessToken, parentFolderId, title);

        const uploadedUrls = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (!(file instanceof File)) continue;
          const fileId = await uploadFileToDrive(accessToken, targetFolderId, file, i, files.length);
          uploadedUrls.push(`/api/image/${fileId}`);
        }

        console.log(`[CF WORKER] 🎉 Upload HOÀN TẤT ${uploadedUrls.length}/${files.length} ảnh lên Google Drive!`);

        return new Response(JSON.stringify({ urls: uploadedUrls }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        console.error('[CF WORKER] 💥 Lỗi hệ thống trong quá trình upload:', err);
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response('Sutie Reader Google Drive Worker Active', { status: 200, headers: corsHeaders });
  },
};

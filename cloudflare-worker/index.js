const DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const MAX_FILES_PER_REQUEST = 10;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const IMAGE_SIGNATURE_VERSION = 'v1';
const IMAGE_SIGNATURE_MAX_FUTURE_SECONDS = 600;
const MAX_TOTAL_UPLOAD_BYTES = 40 * 1024 * 1024;
const MAX_UPLOAD_TOKEN_LIFETIME_SECONDS = 15 * 60;
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']);
const CLIENT_IMAGE_CACHE_SECONDS = 2592000; // 30 ngày
const EDGE_IMAGE_CACHE_SECONDS = 31536000; // 1 năm

let cachedAccessToken = null;
let tokenExpiry = 0;
const metadataCache = new Map();

function jsonResponse(payload, status, corsHeaders) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : 'Unknown error';
}

function getErrorStatus(error) {
  return error && typeof error === 'object' && typeof error.status === 'number' ? error.status : 500;
}

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function escapeDriveQueryValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function getRequiredEnv(env, key) {
  const value = env[key];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return String(value).trim();
}

function getRootFolderId(env) {
  const rawFolderId = getRequiredEnv(env, 'GOOGLE_DRIVE_FOLDER_ID');
  const matchFolder = rawFolderId.match(/(?:folders\/|id=)([a-zA-Z0-9_-]+)/);
  return matchFolder ? matchFolder[1] : rawFolderId;
}

function isValidDriveFileId(fileId) {
  return /^[a-zA-Z0-9_-]{10,}$/.test(fileId);
}

function isValidPostId(postId) {
  return /^[a-f\d]{24}$/i.test(postId);
}

function detectImageMime(bytes) {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'image/gif';
  const ascii = (start, end) => String.fromCharCode(...bytes.subarray(start, end));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (ascii(4, 8) === 'ftyp' && (ascii(8, 12) === 'avif' || ascii(8, 12) === 'avis')) return 'image/avif';
  return null;
}

function getOptionalEnv(env, keys) {
  for (const key of keys) {
    const value = env[key];
    if (value && String(value).trim()) {
      return String(value).trim();
    }
  }
  return '';
}

function base64UrlEncode(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function getImageSignaturePayload(method, fileId, expiresAt, subject) {
  return [
    IMAGE_SIGNATURE_VERSION,
    method.toUpperCase(),
    `/image/${fileId}`,
    String(expiresAt),
    subject,
  ].join('\n');
}

async function signImageRequest(method, fileId, expiresAt, subject, secretStr) {
  const encoder = new TextEncoder();
  const secretKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretStr),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    secretKey,
    encoder.encode(getImageSignaturePayload(method, fileId, expiresAt, subject))
  );

  return base64UrlEncode(new Uint8Array(signature));
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function verifyImageRequestSignature(request, url, fileId, env) {
  const secret = getOptionalEnv(env, ['IMAGE_SIGNING_SECRET', 'UPLOAD_SECRET', 'JWT_SECRET']);
  if (!secret) {
    throw httpError('Image signing is not configured', 500);
  }

  const expiresAtRaw = url.searchParams.get('exp') || '';
  const subject = url.searchParams.get('sub') || '';
  const signature = url.searchParams.get('sig') || '';

  if (
    !/^\d{1,12}$/.test(expiresAtRaw) ||
    subject.length < 1 ||
    subject.length > 200 ||
    !/^[a-zA-Z0-9_-]{32,128}$/.test(signature)
  ) {
    throw httpError('Unauthorized image request', 401);
  }

  const expiresAt = Number(expiresAtRaw);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(expiresAt) || expiresAt < now) {
    throw httpError('Expired image request', 403);
  }

  if (expiresAt > now + IMAGE_SIGNATURE_MAX_FUTURE_SECONDS) {
    throw httpError('Image request expiry is too far in the future', 403);
  }

  const expectedSignature = await signImageRequest(
    request.method,
    fileId,
    expiresAt,
    subject,
    secret
  );

  if (!constantTimeEqual(signature, expectedSignature)) {
    throw httpError('Invalid image signature', 403);
  }

  return { subject };
}

function createImageCacheKey(request) {
  const cacheUrl = new URL(request.url);
  cacheUrl.search = '';
  return new Request(cacheUrl.toString(), { method: 'GET' });
}

function imageResponseForClient(response, corsHeaders) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }
  headers.set('Cache-Control', `public, max-age=${CLIENT_IMAGE_CACHE_SECONDS}, immutable`);
  headers.set('ETag', `"${response.headers.get('ETag') || 'static-image'}"`);
  headers.delete('Vary');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function sanitizeFileName(name) {
  return (name || 'image.jpg').replace(/[\\/]/g, '_').slice(0, 180) || 'image.jpg';
}

async function readJson(res, context) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.message || data?.error_description || data?.error || `${context} failed`;
    console.error(`[CF WORKER] ${context} failed with status ${res.status}:`, message);
    throw httpError(message, res.status);
  }
  return data;
}

async function getAccessToken(env) {
  const now = Date.now();
  if (cachedAccessToken && tokenExpiry > now + 60000) {
    return cachedAccessToken;
  }

  const params = new URLSearchParams({
    client_id: getRequiredEnv(env, 'GOOGLE_CLIENT_ID'),
    client_secret: getRequiredEnv(env, 'GOOGLE_CLIENT_SECRET'),
    refresh_token: getRequiredEnv(env, 'GOOGLE_REFRESH_TOKEN'),
    grant_type: 'refresh_token',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = await readJson(res, 'Google OAuth token request');
  if (!data.access_token) {
    throw new Error('Google OAuth response did not include an access token');
  }
  
  cachedAccessToken = data.access_token;
  tokenExpiry = now + ((data.expires_in || 3600) * 1000);
  return cachedAccessToken;
}

async function driveFetch(accessToken, url, init = {}, context = 'Google Drive request') {
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${accessToken}`);
  return fetch(url, { ...init, headers }).then((res) => readJson(res, context));
}

async function getFileMetadata(accessToken, fileId, fields) {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`);
  url.searchParams.set('fields', fields);
  url.searchParams.set('supportsAllDrives', 'true');
  return driveFetch(accessToken, url.toString(), {}, `Get Drive file metadata ${fileId}`);
}

async function findFolderByPostId(accessToken, parentFolderId, postId) {
  const q = [
    `mimeType='${DRIVE_FOLDER_MIME_TYPE}'`,
    `'${escapeDriveQueryValue(parentFolderId)}' in parents`,
    `appProperties has { key='sutiePostId' and value='${escapeDriveQueryValue(postId)}' }`,
    'trashed=false',
  ].join(' and ');

  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', q);
  url.searchParams.set('fields', 'files(id,name)');
  url.searchParams.set('pageSize', '1');
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');

  const data = await driveFetch(accessToken, url.toString(), {}, 'Find Drive folder by postId');
  return data.files?.[0] || null;
}

async function findFolderByTitle(accessToken, parentFolderId, title, postId) {
  const q = [
    `mimeType='${DRIVE_FOLDER_MIME_TYPE}'`,
    `name='${escapeDriveQueryValue(title)}'`,
    `'${escapeDriveQueryValue(parentFolderId)}' in parents`,
    'trashed=false',
  ].join(' and ');

  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', q);
  url.searchParams.set('fields', 'files(id,name,appProperties)');
  url.searchParams.set('pageSize', '10');
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');

  const data = await driveFetch(accessToken, url.toString(), {}, 'Find Drive folder by title');
  // Không dùng chung thư mục với truyện khác trùng tên: chỉ nhận thư mục chưa gắn postId (dữ liệu cũ) hoặc đúng postId này
  return (
    (data.files || []).find((file) => {
      const ownerId = file.appProperties?.sutiePostId;
      return !ownerId || !postId || ownerId === postId;
    }) || null
  );
}

async function getOrCreateFolder(accessToken, parentFolderId, title, postId) {
  const folderTitle = title.trim().slice(0, 100) || 'Untitled';

  let folder = postId ? await findFolderByPostId(accessToken, parentFolderId, postId) : null;
  if (!folder) {
    folder = await findFolderByTitle(accessToken, parentFolderId, folderTitle, postId);
  }

  if (folder?.id) {
    console.log(`[CF WORKER] Using Drive folder ${folder.id} for post ${postId || folderTitle}`);
    return folder.id;
  }

  const metadata = {
    name: folderTitle,
    mimeType: DRIVE_FOLDER_MIME_TYPE,
    parents: [parentFolderId],
    ...(postId ? { appProperties: { sutiePostId: postId } } : {}),
  };

  const data = await driveFetch(
    accessToken,
    'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    },
    'Create Drive folder'
  );

  if (!data.id) {
    throw new Error('Google Drive did not return a folder id');
  }

  console.log(`[CF WORKER] Created Drive folder ${data.id} for post ${postId || folderTitle}`);
  return data.id;
}

async function uploadFileToDrive(accessToken, folderId, postId, file, index, total) {
  console.log(`[CF WORKER] Uploading image ${index + 1}/${total}: ${file.name} (${Math.round(file.size / 1024)} KB)`);

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;
  const contentType = file.type || 'image/jpeg';
  const metadata = {
    name: sanitizeFileName(file.name),
    parents: [folderId],
    ...(postId ? { appProperties: { sutiePostId: postId } } : {}),
  };

  const arrayBuffer = await file.arrayBuffer();
  const multipartBody = new Blob([
    delimiter,
    'Content-Type: application/json; charset=UTF-8\r\n\r\n',
    JSON.stringify(metadata),
    delimiter,
    `Content-Type: ${contentType}\r\n\r\n`,
    arrayBuffer,
    closeDelim,
  ]);

  const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  const fileData = await readJson(uploadRes, `Upload Drive file ${file.name}`);
  if (!fileData.id) {
    throw new Error('Google Drive did not return a file id');
  }

  // Không cấp quyền public (anyone: reader) trên Google Drive để bảo vệ bản quyền ảnh gốc,
  // Cloudflare Worker và Next.js sẽ truy cập qua OAuth2 access token có kiểm tra chữ ký HMAC.

  console.log(`[CF WORKER] Uploaded image ${index + 1}/${total}: ${file.name} -> ${fileData.id}`);
  return fileData.id;
}

async function fileIsInAllowedFolder(accessToken, rootFolderId, metadata, maxDepth = 3, currentDepth = 1) {
  const parents = Array.isArray(metadata.parents) ? metadata.parents : [];
  if (parents.includes(rootFolderId)) return true;

  if (currentDepth >= maxDepth) return false;

  for (const parentId of parents) {
    const parent = await getFileMetadata(accessToken, parentId, 'id,mimeType,parents,trashed').catch(() => null);
    if (parent && !parent.trashed && parent.mimeType === DRIVE_FOLDER_MIME_TYPE) {
      if (await fileIsInAllowedFolder(accessToken, rootFolderId, parent, maxDepth, currentDepth + 1)) {
        return true;
      }
    }
  }

  return false;
}

async function assertImageCanBeServed(accessToken, rootFolderId, fileId) {
  if (metadataCache.has(fileId)) {
    return metadataCache.get(fileId);
  }

  const metadata = await getFileMetadata(accessToken, fileId, 'id,name,mimeType,parents,trashed');

  if (metadata.trashed) {
    throw httpError('Image not found', 404);
  }

  if (!metadata.mimeType || !ALLOWED_IMAGE_MIME_TYPES.has(metadata.mimeType)) {
    throw httpError('Drive file is not an image', 415);
  }

  const allowed = await fileIsInAllowedFolder(accessToken, rootFolderId, metadata);
  if (!allowed) {
    throw httpError('Image is outside the allowed Drive folder', 403);
  }

  metadataCache.set(fileId, metadata);
  if (metadataCache.size > 2000) {
    metadataCache.delete(metadataCache.keys().next().value);
  }

  return metadata;
}

async function validateUploadFiles(files) {
  if (!files.length) {
    throw httpError('No files provided', 400);
  }

  if (files.length > MAX_FILES_PER_REQUEST) {
    throw httpError(`Too many files. Max ${MAX_FILES_PER_REQUEST} per request`, 400);
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_TOTAL_UPLOAD_BYTES) {
    throw httpError('Upload too large', 413);
  }

  for (const file of files) {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type) || file.size > MAX_FILE_SIZE_BYTES) {
      throw httpError(`Invalid image file: ${file.name}`, 400);
    }
    // Không tin Content-Type do client khai báo (SVG/HTML giả dạng ảnh): kiểm tra chữ ký byte thực tế
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (detectImageMime(head) !== file.type) {
      throw httpError(`Invalid image content: ${file.name}`, 400);
    }
  }
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function verifyJwtToken(token, secretStr) {
  if (!token || !secretStr) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, sigB64] = parts;
  const encoder = new TextEncoder();

  try {
    const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerB64)));
    if (header.alg !== 'HS256') return null;
  } catch {
    return null;
  }
  const secretKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretStr),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const dataToVerify = encoder.encode(`${headerB64}.${payloadB64}`);
  const signatureBytes = base64UrlDecode(sigB64);

  const isValid = await crypto.subtle.verify('HMAC', secretKey, signatureBytes, dataToVerify);
  if (!isValid) return null;

  const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
  const payload = JSON.parse(payloadJson);

  // Bắt buộc có hạn dùng và hạn dùng phải ngắn: token không có `exp` sẽ có hiệu lực vĩnh viễn
  if (typeof payload.exp !== 'number') return null;
  const nowInSec = Math.floor(Date.now() / 1000);
  if (nowInSec > payload.exp) return null;
  if (payload.exp - nowInSec > MAX_UPLOAD_TOKEN_LIFETIME_SECONDS) return null;

  return payload;
}

function authMatches(authHeader, expectedSecret) {
  const expected = `Bearer ${expectedSecret}`;
  if (authHeader.length !== expected.length) return false;

  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= authHeader.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Quyền upload/sync: bí mật dùng chung (server-to-server) HOẶC token ngắn hạn `scope: 'upload'` do /api/auth/token cấp cho admin.
 * Token phiên đăng nhập thông thường (chỉ có `role: admin`) KHÔNG được chấp nhận: nó không bị thu hồi khi admin bị hạ quyền.
 */
async function isUploadAuthorized(request, env) {
  const authHeader = (request.headers.get('Authorization') || '').trim();
  const expectedSecret = (env.UPLOAD_SECRET || '').trim();
  const jwtSecret = (env.UPLOAD_JWT_SECRET || env.JWT_SECRET || '').trim();

  if (expectedSecret && authMatches(authHeader, expectedSecret)) {
    return true;
  }

  if (authHeader.startsWith('Bearer ')) {
    try {
      const payload = await verifyJwtToken(authHeader.slice(7).trim(), jwtSecret);
      return Boolean(payload && payload.scope === 'upload' && payload.role === 'admin');
    } catch (jwtErr) {
      console.warn('[CF WORKER] JWT verify error:', jwtErr);
    }
  }

  return false;
}

const worker = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cross-Origin-Resource-Policy': 'cross-origin',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === 'GET' && url.pathname.startsWith('/avatar/')) {
      const fileId = url.pathname.slice('/avatar/'.length).trim();
      if (!isValidDriveFileId(fileId)) {
        return new Response('Invalid avatar id', { status: 400, headers: corsHeaders });
      }

      try {
        const cache = caches.default;
        const cacheKey = createImageCacheKey(request);
        const cachedResponse = await cache.match(cacheKey);
        if (cachedResponse) {
          return imageResponseForClient(cachedResponse, corsHeaders);
        }

        const accessToken = await getAccessToken(env);
        // Chỉ phục vụ file ảnh nằm trong thư mục Drive được phép (không cho đọc file bất kỳ của tài khoản OAuth)
        await assertImageCanBeServed(accessToken, getRootFolderId(env), fileId);
        const driveRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!driveRes.ok) {
          throw httpError('Avatar not found', driveRes.status);
        }

        const edgeHeaders = new Headers(corsHeaders);
        const contentType = (driveRes.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        if (!ALLOWED_IMAGE_MIME_TYPES.has(contentType)) {
          throw httpError('Unsupported media type', 415);
        }
        edgeHeaders.set('Content-Type', contentType);
        edgeHeaders.set('Cache-Control', `public, max-age=${EDGE_IMAGE_CACHE_SECONDS}, immutable`);
        edgeHeaders.set('Content-Disposition', 'inline; filename="avatar.webp"');

        const response = new Response(driveRes.body, { status: 200, headers: edgeHeaders });
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
        return imageResponseForClient(response, corsHeaders);
      } catch (error) {
        const status = getErrorStatus(error);
        const message = status === 404 ? 'Avatar not found' : 'Error loading avatar';
        console.error('[CF WORKER] Avatar request failed:', getErrorMessage(error));
        return new Response(message, { status, headers: corsHeaders });
      }
    }

    if (request.method === 'GET' && url.pathname.startsWith('/image/')) {
      const fileId = url.pathname.slice('/image/'.length);
      if (!isValidDriveFileId(fileId)) {
        return new Response('Invalid image id', { status: 400, headers: corsHeaders });
      }

      try {
        await verifyImageRequestSignature(request, url, fileId, env);

        const cache = caches.default;
        const cacheKey = createImageCacheKey(request);
        const cachedResponse = await cache.match(cacheKey);
        if (cachedResponse) {
          return imageResponseForClient(cachedResponse, corsHeaders);
        }

        const accessToken = await getAccessToken(env);
        // Chỉ phục vụ file ảnh nằm trong thư mục Drive được phép (không cho đọc file bất kỳ của tài khoản OAuth)
        await assertImageCanBeServed(accessToken, getRootFolderId(env), fileId);
        const driveRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!driveRes.ok) {
          throw httpError('Image not found', driveRes.status);
        }

        const edgeHeaders = new Headers(corsHeaders);
        const contentType = (driveRes.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        if (!ALLOWED_IMAGE_MIME_TYPES.has(contentType)) {
          throw httpError('Unsupported media type', 415);
        }
        edgeHeaders.set('Content-Type', contentType);
        edgeHeaders.set('Cache-Control', `public, max-age=${EDGE_IMAGE_CACHE_SECONDS}, immutable`);
        edgeHeaders.set('Content-Disposition', 'inline; filename="image"');

        const response = new Response(driveRes.body, { status: 200, headers: edgeHeaders });
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
        return imageResponseForClient(response, corsHeaders);
      } catch (error) {
        const status = getErrorStatus(error);
        const message = status === 401 ? 'Unauthorized' : status === 404 ? 'Image not found' : status === 403 ? 'Forbidden' : status === 415 ? 'Unsupported media type' : 'Error loading image';
        console.error('[CF WORKER] Image request failed:', getErrorMessage(error));
        return new Response(message, { status, headers: corsHeaders });
      }
    }

    if (request.method === 'POST' && url.pathname === '/upload') {
      const isAuthorized = await isUploadAuthorized(request, env);

      if (!isAuthorized) {
        console.warn('[CF WORKER] Unauthorized upload request');
        return jsonResponse({ error: 'Unauthorized: Quyền truy cập bị từ chối' }, 401, corsHeaders);
      }

      try {
        const formData = await request.formData();
        const entries = formData.getAll('files');
        const files = entries.filter((entry) => entry instanceof File);
        const rawTitle = formData.get('title');
        const rawPostId = formData.get('postId');
        const rawChapter = formData.get('chapter');
        const title = typeof rawTitle === 'string' && rawTitle.trim() ? rawTitle.trim() : 'Untitled';
        const postId = typeof rawPostId === 'string' ? rawPostId.trim() : '';
        const chapter = typeof rawChapter === 'string' ? rawChapter.trim() : '';
        const isAvatar = formData.get('isAvatar') === 'true' || title.toLowerCase() === 'avatars';

        if (files.length !== entries.length) {
          return jsonResponse({ error: 'Invalid file payload' }, 400, corsHeaders);
        }

        if (postId && !isValidPostId(postId)) {
          return jsonResponse({ error: 'Invalid postId' }, 400, corsHeaders);
        }

        await validateUploadFiles(files);

        const accessToken = await getAccessToken(env);
        const parentFolderId = getRootFolderId(env);
        const storyFolderId = await getOrCreateFolder(accessToken, parentFolderId, title, postId);
        
        let targetFolderId = storyFolderId;
        if (chapter) {
          targetFolderId = await getOrCreateFolder(accessToken, storyFolderId, chapter, null);
        }

        const imageBaseUrl = (env.PUBLIC_IMAGE_BASE_URL || url.origin).replace(/\/+$/, '');

        // Tải lần lượt (không Promise.all) để không giữ nhiều file lớn trong bộ nhớ Worker (giới hạn 128MB) cùng lúc
        const uploadedUrls = [];
        for (let i = 0; i < files.length; i++) {
          const fileId = await uploadFileToDrive(accessToken, targetFolderId, postId, files[i], i, files.length);
          if (!isAvatar) {
            await assertImageCanBeServed(accessToken, parentFolderId, fileId);
          }
          uploadedUrls.push(isAvatar ? `${imageBaseUrl}/avatar/${fileId}` : `${imageBaseUrl}/image/${fileId}`);
        }

        console.log(`[CF WORKER] Uploaded ${uploadedUrls.length}/${files.length} image(s)`);
        return jsonResponse({ urls: uploadedUrls }, 200, corsHeaders);
      } catch (error) {
        const errorStatus = getErrorStatus(error);
        const status = errorStatus >= 400 && errorStatus < 500 ? errorStatus : 500;
        console.error('[CF WORKER] Upload request failed:', getErrorMessage(error));
        return jsonResponse({ error: getErrorMessage(error) }, status, corsHeaders);
      }
    }

    if (request.method === 'GET' && url.pathname === '/sync') {
      const isAuthorized = await isUploadAuthorized(request, env);

      if (!isAuthorized) {
        console.warn('[CF WORKER] Unauthorized sync request');
        return jsonResponse({ error: 'Unauthorized: Quyền truy cập bị từ chối' }, 401, corsHeaders);
      }

      try {
        const title = url.searchParams.get('title') || 'Untitled';
        const postId = url.searchParams.get('postId') || '';
        const chapter = url.searchParams.get('chapter') || '';

        if (postId && !isValidPostId(postId)) {
          return jsonResponse({ error: 'Invalid postId' }, 400, corsHeaders);
        }

        const accessToken = await getAccessToken(env);
        const parentFolderId = getRootFolderId(env);
        const storyFolderId = await getOrCreateFolder(accessToken, parentFolderId, title, postId);
        
        let targetFolderId = storyFolderId;
        if (chapter) {
          targetFolderId = await getOrCreateFolder(accessToken, storyFolderId, chapter, null);
        }

        const imageBaseUrl = (env.PUBLIC_IMAGE_BASE_URL || url.origin).replace(/\/+$/, '');

        const q = [
          `'${escapeDriveQueryValue(targetFolderId)}' in parents`,
          "mimeType contains 'image/'",
          "trashed=false"
        ].join(' and ');

        const listUrl = new URL('https://www.googleapis.com/drive/v3/files');
        listUrl.searchParams.set('q', q);
        listUrl.searchParams.set('fields', 'files(id,name)');
        listUrl.searchParams.set('pageSize', '1000');
        listUrl.searchParams.set('supportsAllDrives', 'true');
        listUrl.searchParams.set('includeItemsFromAllDrives', 'true');
        listUrl.searchParams.set('orderBy', 'name_natural');

        const data = await driveFetch(accessToken, listUrl.toString(), {}, 'List Drive files for sync');
        const files = data.files || [];
        files.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' }));

        const syncedUrls = files.map(f => `${imageBaseUrl}/image/${f.id}`);

        console.log(`[CF WORKER] Synced ${syncedUrls.length} image(s) for post ${postId}`);
        return jsonResponse({ urls: syncedUrls }, 200, corsHeaders);
      } catch (error) {
        const errorStatus = getErrorStatus(error);
        const status = errorStatus >= 400 && errorStatus < 500 ? errorStatus : 500;
        console.error('[CF WORKER] Sync request failed:', getErrorMessage(error));
        return jsonResponse({ error: getErrorMessage(error) }, status, corsHeaders);
      }
    }

    return new Response('Sutie Reader Google Drive Worker Active', { status: 200, headers: corsHeaders });
  },
};

export default worker;

const DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const MAX_FILES_PER_REQUEST = 10;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

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
  return data.access_token;
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

async function findFolderByTitle(accessToken, parentFolderId, title) {
  const q = [
    `mimeType='${DRIVE_FOLDER_MIME_TYPE}'`,
    `name='${escapeDriveQueryValue(title)}'`,
    `'${escapeDriveQueryValue(parentFolderId)}' in parents`,
    'trashed=false',
  ].join(' and ');

  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', q);
  url.searchParams.set('fields', 'files(id,name)');
  url.searchParams.set('pageSize', '1');
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');

  const data = await driveFetch(accessToken, url.toString(), {}, 'Find Drive folder by title');
  return data.files?.[0] || null;
}

async function setFolderPostId(accessToken, folderId, postId) {
  await driveFetch(
    accessToken,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?supportsAllDrives=true`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appProperties: { sutiePostId: postId } }),
    },
    'Set Drive folder postId'
  );
}

async function getOrCreateFolder(accessToken, parentFolderId, title, postId) {
  const folderTitle = title.trim().slice(0, 100) || 'Untitled';

  let folder = postId ? await findFolderByPostId(accessToken, parentFolderId, postId) : null;
  if (!folder) {
    folder = await findFolderByTitle(accessToken, parentFolderId, folderTitle);
    if (folder && postId) {
      await setFolderPostId(accessToken, folder.id, postId).catch((error) => {
        console.warn('[CF WORKER] Could not tag legacy Drive folder with postId:', getErrorMessage(error));
      });
    }
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

  const permissionRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileData.id}/permissions?supportsAllDrives=true`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });

  if (!permissionRes.ok) {
    console.warn(`[CF WORKER] Could not make Drive file public: ${fileData.id}`);
  }

  console.log(`[CF WORKER] Uploaded image ${index + 1}/${total}: ${file.name} -> ${fileData.id}`);
  return fileData.id;
}

async function fileIsInAllowedFolder(accessToken, rootFolderId, metadata) {
  const parents = Array.isArray(metadata.parents) ? metadata.parents : [];
  if (parents.includes(rootFolderId)) return true;

  for (const parentId of parents) {
    const parent = await getFileMetadata(accessToken, parentId, 'id,mimeType,parents,trashed').catch(() => null);
    if (
      parent &&
      !parent.trashed &&
      parent.mimeType === DRIVE_FOLDER_MIME_TYPE &&
      Array.isArray(parent.parents) &&
      parent.parents.includes(rootFolderId)
    ) {
      return true;
    }
  }

  return false;
}

async function assertImageCanBeServed(accessToken, rootFolderId, fileId) {
  const metadata = await getFileMetadata(accessToken, fileId, 'id,name,mimeType,parents,trashed');

  if (metadata.trashed) {
    throw httpError('Image not found', 404);
  }

  if (!metadata.mimeType || !metadata.mimeType.startsWith('image/')) {
    throw httpError('Drive file is not an image', 415);
  }

  const allowed = await fileIsInAllowedFolder(accessToken, rootFolderId, metadata);
  if (!allowed) {
    throw httpError('Image is outside the allowed Drive folder', 403);
  }

  return metadata;
}

function validateUploadFiles(files) {
  if (!files.length) {
    throw httpError('No files provided', 400);
  }

  if (files.length > MAX_FILES_PER_REQUEST) {
    throw httpError(`Too many files. Max ${MAX_FILES_PER_REQUEST} per request`, 400);
  }

  const invalidFile = files.find((file) => !file.type.startsWith('image/') || file.size > MAX_FILE_SIZE_BYTES);
  if (invalidFile) {
    throw httpError(`Invalid image file: ${invalidFile.name}`, 400);
  }
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

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'X-Content-Type-Options': 'nosniff',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === 'GET' && url.pathname.startsWith('/image/')) {
      const fileId = url.pathname.slice('/image/'.length);
      if (!isValidDriveFileId(fileId)) {
        return new Response('Invalid image id', { status: 400, headers: corsHeaders });
      }

      try {
        const accessToken = await getAccessToken(env);
        const rootFolderId = getRootFolderId(env);
        const metadata = await assertImageCanBeServed(accessToken, rootFolderId, fileId);
        const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!driveRes.ok) {
          throw httpError('Image not found', driveRes.status);
        }

        const headers = new Headers(corsHeaders);
        headers.set('Content-Type', metadata.mimeType || driveRes.headers.get('content-type') || 'image/jpeg');
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        headers.set('Content-Disposition', `inline; filename="${encodeURIComponent(metadata.name || 'image')}"`);

        return new Response(driveRes.body, { status: 200, headers });
      } catch (error) {
        const status = getErrorStatus(error);
        const message = status === 404 ? 'Image not found' : status === 403 ? 'Forbidden' : 'Error loading image';
        console.error('[CF WORKER] Image request failed:', getErrorMessage(error));
        return new Response(message, { status, headers: corsHeaders });
      }
    }

    if (request.method === 'POST' && url.pathname === '/upload') {
      const authHeader = (request.headers.get('Authorization') || '').trim();
      const expectedSecret = (env.UPLOAD_SECRET || '').trim();

      if (!expectedSecret || !authMatches(authHeader, expectedSecret)) {
        console.warn('[CF WORKER] Unauthorized upload request');
        return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders);
      }

      try {
        const formData = await request.formData();
        const entries = formData.getAll('files');
        const files = entries.filter((entry) => entry instanceof File);
        const rawTitle = formData.get('title');
        const rawPostId = formData.get('postId');
        const title = typeof rawTitle === 'string' && rawTitle.trim() ? rawTitle.trim() : 'Untitled';
        const postId = typeof rawPostId === 'string' ? rawPostId.trim() : '';

        if (files.length !== entries.length) {
          return jsonResponse({ error: 'Invalid file payload' }, 400, corsHeaders);
        }

        if (postId && !isValidPostId(postId)) {
          return jsonResponse({ error: 'Invalid postId' }, 400, corsHeaders);
        }

        validateUploadFiles(files);

        const accessToken = await getAccessToken(env);
        const parentFolderId = getRootFolderId(env);
        const targetFolderId = await getOrCreateFolder(accessToken, parentFolderId, title, postId);
        const imageBaseUrl = (env.PUBLIC_IMAGE_BASE_URL || url.origin).replace(/\/+$/, '');

        const uploadedUrls = [];
        for (let i = 0; i < files.length; i++) {
          const fileId = await uploadFileToDrive(accessToken, targetFolderId, postId, files[i], i, files.length);
          await assertImageCanBeServed(accessToken, parentFolderId, fileId);
          uploadedUrls.push(`${imageBaseUrl}/image/${fileId}`);
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

    return new Response('Sutie Reader Google Drive Worker Active', { status: 200, headers: corsHeaders });
  },
};

export default worker;

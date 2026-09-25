import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';
import { getCurrentUserFromToken, getJwtSecret, createSiteAccessToken } from '@/lib/server-auth';
import { logApiError, logApiAction } from '@/lib/telegramLogger';
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function getDataUrlByteSize(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) return 0;

  const base64 = dataUrl.slice(commaIndex + 1);
  const paddingMatch = base64.match(/=*$/);
  const padding = paddingMatch ? paddingMatch[0].length : 0;

  return Math.ceil((base64.length * 3) / 4) - padding;
}

async function uploadAvatarToCloudflareWorker(dataUrl: string, userId: string): Promise<string> {
  const workerUrl = (
    process.env.CLOUDFLARE_WORKER_URL ||
    process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_URL ||
    ''
  ).replace(/\/+$/, '');
  const uploadSecret = process.env.CLOUDFLARE_UPLOAD_SECRET;

  if (!workerUrl || !uploadSecret) {
    console.warn('[AVATAR UPLOAD] Worker URL or upload secret not configured, fallback to dataUrl');
    return dataUrl;
  }

  const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    return dataUrl;
  }

  const mimeType = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  const extension = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
  const fileName = `avatar-${userId}-${Date.now()}.${extension}`;

  const blob = new Blob([buffer], { type: mimeType });
  const formData = new FormData();
  formData.append('title', 'Avatars');
  formData.append('isAvatar', 'true');
  formData.append('files', blob, fileName);

  const res = await fetch(`${workerUrl}/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${uploadSecret}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    console.error('[AVATAR UPLOAD] Worker upload error:', errData);
    throw new Error(errData?.error || 'Lỗi khi tải ảnh đại diện lên Cloudflare');
  }

  const data = await res.json();
  if (Array.isArray(data.urls) && data.urls.length > 0) {
    return data.urls[0];
  }

  throw new Error('Không nhận được URL ảnh từ máy chủ');
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ user: null });
    }

    const user = await getCurrentUserFromToken(token);
    if (!user) {
      return NextResponse.json({ user: null });
    }

    const response = NextResponse.json({ user });

    // Kiểm tra xem vai trò (role) trong token có bị lệch so với dữ liệu mới nhất trong Database hay không
    try {
      const { payload } = await jwtVerify(token, getJwtSecret());
      if (payload && (payload.role !== user.role || payload.name !== user.name)) {
        const newToken = await new SignJWT({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        })
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt()
          .setExpirationTime('7d')
          .sign(getJwtSecret());

        const cookieOptions = {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax' as const,
          path: '/' as const,
          maxAge: 60 * 60 * 24 * 7,
        };

        response.cookies.set('token', newToken, cookieOptions);

        if ((user.role === 'admin' || user.role === 'user') && process.env.UNLOCK_PIN) {
          const siteToken = await createSiteAccessToken();
          response.cookies.set('site_access_token', siteToken, cookieOptions);
        }
      }
    } catch {
      // Bỏ qua lỗi verify token phụ, vẫn trả về user hợp lệ
    }

    return response;
  } catch (error) {
    console.error('Loi kiem tra phien dang nhap:', error);
    return NextResponse.json({ user: null });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Chua xac thuc' }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, getJwtSecret());
    if (!payload || !payload.id) {
      return NextResponse.json({ error: 'Token khong hop le' }, { status: 401 });
    }

    await connectDB();

    const body = (await request.json().catch(() => ({}))) as {
      name?: unknown;
      avatar?: unknown;
    };

    if (typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'Ten khong duoc de trong' }, { status: 400 });
    }

    if (
      body.avatar !== undefined &&
      body.avatar !== null &&
      typeof body.avatar !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Du lieu anh dai dien khong hop le' },
        { status: 400 }
      );
    }

    if (typeof body.avatar === 'string' && body.avatar.startsWith('data:image')) {
      const avatarBytes = getDataUrlByteSize(body.avatar);
      if (avatarBytes > MAX_AVATAR_BYTES) {
        return NextResponse.json(
          {
            error:
              'Anh dai dien sau khi cat vuot qua 2MB, vui long chon vung anh nho hon.',
          },
          { status: 413 }
        );
      }
    }

    const user = await User.findById(payload.id);
    if (!user) {
      return NextResponse.json({ error: 'Khong tim thay nguoi dung' }, { status: 404 });
    }

    user.name = body.name.trim();

    if (body.avatar !== undefined) {
      if (typeof body.avatar === 'string' && body.avatar.startsWith('data:image')) {
        try {
          user.avatar = await uploadAvatarToCloudflareWorker(body.avatar, user._id.toString());
        } catch (uploadError) {
          console.error('Lỗi upload avatar lên Cloudflare Worker:', uploadError);
          void logApiError({
            module: '[PUT] /api/auth/me (Upload Avatar Cloudflare)',
            error: uploadError,
            request,
            user: { email: user.email, id: user._id.toString(), role: user.role, name: user.name },
            statusCode: 500,
          });
          return NextResponse.json(
            { error: uploadError instanceof Error ? uploadError.message : 'Không thể tải ảnh lên Cloudflare' },
            { status: 500 }
          );
        }
      } else {
        user.avatar = typeof body.avatar === 'string' ? body.avatar : '';
      }
    }

    await user.save();

    const response = NextResponse.json({
      message: 'Cap nhat thanh cong',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
      },
    });

    const tokenMaxAge =
      typeof payload.exp === 'number'
        ? Math.max(0, payload.exp - Math.floor(Date.now() / 1000))
        : undefined;
    const nextToken = await new SignJWT({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(tokenMaxAge ? `${tokenMaxAge}s` : '24h')
      .sign(getJwtSecret());

    response.cookies.set('token', nextToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      ...(tokenMaxAge ? { maxAge: tokenMaxAge } : {}),
    });

    // Ghi nhận log cập nhật thông tin tài khoản
    void logApiAction({
      module: 'Tài khoản cá nhân (Profile)',
      action: 'Cập nhật thông tin tài khoản',
      request,
      user: { email: user.email, id: user._id.toString(), role: user.role, name: user.name },
      details: {
        'Tên mới': user.name,
        'Cập nhật avatar': body.avatar !== undefined ? 'Có' : 'Không',
      },
      level: 'info',
    });

    return response;
  } catch (error) {
    const details = error instanceof Error ? error.message : 'Unknown error';
    console.error('Loi cap nhat ho so:', error);
    void logApiError({
      module: '[PUT] /api/auth/me',
      error,
      request,
      statusCode: 500,
    });
    return NextResponse.json(
      { error: 'Cap nhat khong thanh cong', details },
      { status: 500 }
    );
  }
}

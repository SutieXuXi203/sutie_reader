import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';
import { getCurrentUserFromToken, getJwtSecret, clearUserCache, isTokenRevoked } from '@/lib/server-auth';
import { logApiError, logApiAction } from '@/lib/telegramLogger';
import { checkRateLimit } from '@/lib/memoryRateLimit';
import { isAllowedAvatarUrl } from '@/lib/validations';
import { detectImageType, IMAGE_MIME_BY_TYPE, type DetectedImageType } from '@/lib/imageMagic';
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const MAX_NAME_LENGTH = 50;
const DATA_URL_PATTERN = /^data:image[/](?:png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

class AvatarValidationError extends Error {}

/** Giải mã và xác thực avatar dạng data URL: chỉ png/jpeg/webp, kiểm magic bytes, tối đa 2MB (SVG bị từ chối). */
function decodeAvatarDataUrl(dataUrl: string): { buffer: Buffer; type: DetectedImageType } {
  const match = dataUrl.match(DATA_URL_PATTERN);
  if (!match) {
    throw new AvatarValidationError('Du lieu anh dai dien khong hop le');
  }

  // Ước lượng kích thước trước khi giải mã để tránh cấp phát bộ nhớ lớn
  const estimatedBytes = Math.ceil((match[1].length * 3) / 4);
  if (estimatedBytes > MAX_AVATAR_BYTES) {
    throw new AvatarValidationError('Anh dai dien sau khi cat vuot qua 2MB, vui long chon vung anh nho hon.');
  }

  const buffer = Buffer.from(match[1], 'base64');
  const type = detectImageType(buffer);
  if (!type || type === 'gif') {
    throw new AvatarValidationError('Du lieu anh dai dien khong hop le');
  }
  return { buffer, type };
}

async function uploadAvatarToCloudflareWorker(
  image: { buffer: Buffer; type: DetectedImageType },
  userId: string
): Promise<string> {
  const workerUrl = (
    process.env.CLOUDFLARE_WORKER_URL ||
    process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_URL ||
    ''
  ).replace(/[/]+$/, '');
  const uploadSecret = process.env.CLOUDFLARE_UPLOAD_SECRET;

  if (!workerUrl || !uploadSecret) {
    throw new Error('Chua cau hinh luu tru anh dai dien');
  }

  const mimeType = IMAGE_MIME_BY_TYPE[image.type];
  const extension = image.type === 'jpeg' ? 'jpg' : image.type;
  const fileName = `avatar-${userId}-${Date.now()}.${extension}`;

  const blob = new Blob([new Uint8Array(image.buffer)], { type: mimeType });
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
    throw new Error('Lỗi khi tải ảnh đại diện lên Cloudflare');
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
        // Xóa cache của token cũ ngay lập tức để tránh trả về role lỗi thời
        clearUserCache(user.id);

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

    // Token đã đăng xuất/bị thu hồi không được dùng để sửa hồ sơ hay đúc token mới
    if (await isTokenRevoked(token, { durable: true })) {
      return NextResponse.json({ error: 'Phien dang nhap da het han' }, { status: 401 });
    }

    // Mỗi lần đổi avatar có thể tải file lên Drive: giới hạn 10 lần / 10 phút cho mỗi tài khoản
    const profileLimit = await checkRateLimit(`profile-update:${String(payload.id)}`, 10, 10 * 60_000);
    if (!profileLimit.allowed) {
      return NextResponse.json(
        { error: 'Ban thao tac qua nhanh, vui long thu lai sau.' },
        { status: 429, headers: { 'Retry-After': String(profileLimit.retryAfter) } }
      );
    }

    await connectDB();

    const body = (await request.json().catch(() => ({}))) as {
      name?: unknown;
      avatar?: unknown;
    };

    if (typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'Ten khong duoc de trong' }, { status: 400 });
    }
    if (body.name.trim().length > MAX_NAME_LENGTH) {
      return NextResponse.json({ error: 'Ten khong duoc vuot qua 50 ky tu' }, { status: 400 });
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

    const user = await User.findById(payload.id);
    if (!user) {
      return NextResponse.json({ error: 'Khong tim thay nguoi dung' }, { status: 404 });
    }

    user.name = body.name.trim();

    if (body.avatar !== undefined) {
      const nextAvatar = typeof body.avatar === 'string' ? body.avatar : '';

      if (nextAvatar.startsWith('data:')) {
        const decoded = decodeAvatarDataUrl(nextAvatar);
        try {
          user.avatar = await uploadAvatarToCloudflareWorker(decoded, user._id.toString());
        } catch (uploadError) {
          console.error('Lỗi upload avatar lên Cloudflare Worker:', uploadError);
          void logApiError({
            module: '[PUT] /api/auth/me (Upload Avatar Cloudflare)',
            error: uploadError,
            request,
            user: { email: user.email, id: user._id.toString(), role: user.role, name: user.name },
            statusCode: 500,
          });
          return NextResponse.json({ error: 'Không thể tải ảnh lên Cloudflare' }, { status: 500 });
        }
      } else if (nextAvatar === '' || nextAvatar === user.avatar || isAllowedAvatarUrl(nextAvatar)) {
        user.avatar = nextAvatar;
      } else {
        return NextResponse.json({ error: 'Du lieu anh dai dien khong hop le' }, { status: 400 });
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
    if (error instanceof AvatarValidationError) {
      const status = error.message.includes('2MB') ? 413 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error('Loi cap nhat ho so:', error);
    void logApiError({
      module: '[PUT] /api/auth/me',
      error,
      request,
      statusCode: 500,
    });
    return NextResponse.json(
      { error: 'Cap nhat khong thanh cong' },
      { status: 500 }
    );
  }
}

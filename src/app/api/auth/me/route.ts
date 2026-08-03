import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';
import { getCurrentUserFromToken, getJwtSecret } from '@/lib/server-auth';
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function getDataUrlByteSize(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) return 0;

  const base64 = dataUrl.slice(commaIndex + 1);
  const paddingMatch = base64.match(/=*$/);
  const padding = paddingMatch ? paddingMatch[0].length : 0;

  return Math.ceil((base64.length * 3) / 4) - padding;
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    const user = await getCurrentUserFromToken(token);
    return NextResponse.json({ user });
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

    const body = (await request.json()) as {
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
      user.avatar = typeof body.avatar === 'string' ? body.avatar : '';
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

    return response;
  } catch (error) {
    const details = error instanceof Error ? error.message : 'Unknown error';
    console.error('Loi cap nhat ho so:', error);
    return NextResponse.json(
      { error: 'Cap nhat khong thanh cong', details },
      { status: 500 }
    );
  }
}

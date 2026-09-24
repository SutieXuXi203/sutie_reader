import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, isAdmin } from '@/lib/auth';
import { SignJWT } from 'jose';
import { getJwtSecret } from '@/lib/server-auth';
import { logApiError } from '@/lib/telegramLogger';

export async function GET(request: NextRequest) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'No active session token' }, { status: 401 });
    }

    // Cấp phát token upload ngắn hạn (10 phút) thay vì làm lộ session token 7 ngày của Admin
    const uploadToken = await new SignJWT({
      id: user.id,
      email: user.email,
      name: user.name,
      role: 'admin',
      scope: 'upload',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(getJwtSecret());

    return NextResponse.json({ token: uploadToken });
  } catch (error) {
    console.error('Error generating upload token:', error);
    void logApiError({
      module: '[GET] /api/auth/token',
      error,
      request,
      statusCode: 500,
    });
    return NextResponse.json({ error: 'Failed to retrieve auth token' }, { status: 500 });
  }
}

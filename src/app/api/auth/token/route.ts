import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const token = request.cookies.get('token')?.value;
    const uploadSecret = process.env.CLOUDFLARE_UPLOAD_SECRET;
    const activeToken = uploadSecret || token;

    if (!activeToken) {
      return NextResponse.json({ error: 'No active session token' }, { status: 401 });
    }

    return NextResponse.json({ token: activeToken });
  } catch (error) {
    console.error('Error fetching auth token:', error);
    return NextResponse.json({ error: 'Failed to retrieve auth token' }, { status: 500 });
  }
}

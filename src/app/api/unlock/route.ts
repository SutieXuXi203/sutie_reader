import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { RateLimit } from '@/models/RateLimit';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pin } = body;

    const SECRET_TOKEN = process.env.UNLOCK_PIN || '123456';
    const ACCESS_COOKIE_NAME = 'site_access_token';

    // 1. Get client IP
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : (realIp || 'unknown');

    // 2. Connect to DB and check Rate Limit
    await connectDB();
    let rateLimit = await RateLimit.findOne({ ip });

    if (rateLimit && rateLimit.lockUntil && rateLimit.lockUntil > new Date()) {
      const waitMinutes = Math.ceil((rateLimit.lockUntil.getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { success: false, error: `Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau ${waitMinutes} phút.` },
        { status: 429 }
      );
    }

    // 3. Artificial Delay (Tarpit) to slow down brute force
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 4. Check PIN
    if (pin === SECRET_TOKEN) {
      // Clear rate limit on success
      if (rateLimit) {
        await RateLimit.deleteOne({ ip });
      }

      const response = NextResponse.json({ success: true });
      
      // Set the session cookie (expires when browser closes)
      response.cookies.set(ACCESS_COOKIE_NAME, SECRET_TOKEN, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });

      return response;
    }

    // 5. Handle failure
    if (!rateLimit) {
      rateLimit = new RateLimit({ ip, attempts: 1 });
    } else {
      rateLimit.attempts += 1;
      if (rateLimit.attempts >= 5) {
        // Lock for 15 minutes
        rateLimit.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
    }
    await rateLimit.save();

    if (rateLimit.attempts >= 5) {
      return NextResponse.json(
        { success: false, error: 'Bạn đã nhập sai quá 5 lần. Vui lòng thử lại sau 15 phút.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { success: false, error: `Mã PIN không chính xác (còn ${5 - rateLimit.attempts} lần thử)` },
      { status: 401 }
    );
  } catch (error) {
    console.error('Unlock error:', error);
    return NextResponse.json(
      { success: false, error: 'Đã xảy ra lỗi' },
      { status: 500 }
    );
  }
}

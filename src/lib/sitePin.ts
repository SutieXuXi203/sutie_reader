import { connectDB } from '@/lib/db';
import { consumeAttempt, resetAttempts } from '@/lib/rateLimit';
import { safeEqual } from '@/lib/password';
import { logApiAction } from '@/lib/telegramLogger';

export type SitePinResult =
  | { success: true }
  | { success: false; status: 400 | 401 | 429; error: string };

/**
 * Kiểm tra mã PIN mở khóa toàn site. Dùng chung cho route `/api/unlock` và Server Action `unlockSiteAction`
 * để hai đường vào luôn có cùng một bộ đếm khóa brute-force (khóa theo IP, tối đa 5 lần / 15 phút).
 */
export async function verifySitePin(pin: unknown, ip: string): Promise<SitePinResult> {
  const secretPin = process.env.UNLOCK_PIN?.trim();
  if (!secretPin) {
    return { success: true };
  }

  if (!pin || typeof pin !== 'string' || pin.length > 32) {
    return { success: false, status: 400, error: 'Vui lòng cung cấp mã PIN hợp lệ' };
  }

  await connectDB();
  const key = `site-pin:${ip}`;
  const attempt = await consumeAttempt(key);

  if (!attempt.allowed) {
    return {
      success: false,
      status: 429,
      error: `Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau ${attempt.retryAfterMinutes} phút.`,
    };
  }

  if (safeEqual(pin.trim(), secretPin)) {
    await resetAttempts(key);
    return { success: true };
  }

  if (attempt.locked) {
    void logApiAction({
      module: 'Bảo mật site (Unlock PIN)',
      action: 'Khóa mở trang do nhập sai mã PIN quá 5 lần',
      details: { 'Client IP': ip, 'Thời gian khóa': '15 phút' },
      level: 'warn',
    });
    return {
      success: false,
      status: 429,
      error: 'Bạn đã nhập sai quá 5 lần. Vui lòng thử lại sau 15 phút.',
    };
  }

  return {
    success: false,
    status: 401,
    error: `Mã PIN không chính xác (còn ${attempt.remaining} lần thử)`,
  };
}

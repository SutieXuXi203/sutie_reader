import https from 'https';
import type { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';

/**
 * Lấy cấu hình Telegram từ biến môi trường
 */
export const getTelegramConfig = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  return { token, chatId };
};

export const isTelegramConfigured = (): boolean => {
  const { token, chatId } = getTelegramConfig();
  return Boolean(token && chatId);
};

interface TelegramApiResponse {
  ok: boolean;
  result?: {
    message_id: number;
    [key: string]: unknown;
  };
  description?: string;
  error_code?: number;
}

/**
 * Gọi API Telegram qua native HTTPS với timeout an toàn
 */
export const callTelegramApi = (
  endpoint: string,
  payload: Record<string, unknown>
): Promise<TelegramApiResponse> => {
  return new Promise((resolve, reject) => {
    const { token } = getTelegramConfig();
    if (!token) {
      return reject(new Error('TELEGRAM_BOT_TOKEN is not configured'));
    }

    const data = JSON.stringify(payload);
    const req = https.request(
      `https://api.telegram.org/bot${token}/${endpoint}`,
      {
        method: 'POST',
        family: 4,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(data, 'utf8'),
          'User-Agent': 'SutieReader-Logger/1.0',
        },
        timeout: 10000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body) as TelegramApiResponse;
            resolve(parsed);
          } catch {
            reject(new Error(`Failed to parse Telegram response: ${body}`));
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Telegram API request timed out'));
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(data, 'utf8');
    req.end();
  });
};

/**
 * Gửi tin nhắn Telegram an toàn (tự động cắt ngắn nếu vượt quá 4096 ký tự)
 */
export const sendTelegramMessage = async (
  text: string
): Promise<{ success: boolean; messageId?: number; error?: string }> => {
  const { chatId } = getTelegramConfig();
  if (!isTelegramConfigured() || !chatId) {
    return { success: false, error: 'Telegram credentials missing' };
  }

  // Telegram giới hạn 4096 ký tự
  let safeText = text.trim();
  if (safeText.length > 3900) {
    safeText = safeText.slice(0, 3900) + '\n\n... ⚠️ [Nội dung đã được cắt bớt do giới hạn độ dài Telegram]';
  }

  try {
    const response = await callTelegramApi('sendMessage', {
      chat_id: chatId,
      text: safeText,
      disable_web_page_preview: true,
    });

    if (!response.ok) {
      console.warn('[TELEGRAM LOG] sendMessage failed:', response.description);
      return { success: false, error: response.description };
    }

    return {
      success: true,
      messageId: response.result?.message_id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Telegram error';
    console.warn('[TELEGRAM LOG] Error calling Telegram sendMessage:', message);
    return { success: false, error: message };
  }
};

/**
 * Chỉnh sửa tin nhắn Telegram đã gửi
 */
export const editTelegramMessage = async (
  messageId: number,
  text: string
): Promise<{ success: boolean; error?: string }> => {
  const { chatId } = getTelegramConfig();
  if (!isTelegramConfigured() || !chatId) {
    return { success: false, error: 'Telegram credentials missing' };
  }

  let safeText = text.trim();
  if (safeText.length > 3900) {
    safeText = safeText.slice(0, 3900) + '\n\n... ⚠️ [Nội dung đã được cắt bớt]';
  }

  try {
    const response = await callTelegramApi('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: safeText,
      disable_web_page_preview: true,
    });

    if (!response.ok) {
      if (response.description?.includes('message is not modified')) {
        return { success: true };
      }
      console.warn('[TELEGRAM LOG] editMessageText failed:', response.description);
      return { success: false, error: response.description };
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Telegram error';
    console.warn('[TELEGRAM LOG] Error calling editMessageText:', message);
    return { success: false, error: message };
  }
};

/**
 * Định dạng thời gian theo múi giờ Việt Nam (UTC+7)
 */
export const getVietnamTimeString = (date = new Date()): string => {
  const timeStr = date.toLocaleTimeString('vi-VN', {
    hour12: false,
    timeZone: 'Asia/Ho_Chi_Minh',
  });
  const dateStr = date.toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
  });
  return `${timeStr} ngày ${dateStr}`;
};

/**
 * Lấy IP của Client từ Request
 */
export const extractClientIp = (request?: Request | NextRequest | null): string => {
  if (!request) return 'N/A';
  const headers = request.headers;
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  return headers.get('x-real-ip') || headers.get('cf-connecting-ip') || 'unknown';
};

/**
 * Xóa thông tin nhạy cảm khỏi payload/params trước khi gửi lên Telegram
 */
export const sanitizeData = (data: unknown): unknown => {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item));
  }

  const sensitiveKeys = new Set([
    'password',
    'pin',
    'token',
    'secret',
    'authorization',
    'cookie',
    'jwt',
    'key',
    'verificationcode',
    'email_pass',
  ]);

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (sensitiveKeys.has(key.toLowerCase())) {
      sanitized[key] = '******';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

// Cơ chế chống flood tin nhắn lỗi trùng lặp liên tục trong 30 giây
interface ThrottledErrorRecord {
  lastSent: number;
  count: number;
}
const errorThrottles = new Map<string, ThrottledErrorRecord>();

const isThrottled = (key: string, cooldownMs = 30_000): boolean => {
  const now = Date.now();
  const record = errorThrottles.get(key);

  if (!record || now - record.lastSent > cooldownMs) {
    errorThrottles.set(key, { lastSent: now, count: 1 });
    return false;
  }

  record.count += 1;
  return true;
};

// Dọn dẹp throttle map định kỳ để tránh memory leak
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of errorThrottles.entries()) {
      if (now - record.lastSent > 120_000) {
        errorThrottles.delete(key);
      }
    }
  }, 120_000).unref?.();
}

export interface ApiErrorLogOptions {
  module: string;
  error: unknown;
  request?: NextRequest | Request | null;
  user?: { email?: string; id?: string; role?: string; name?: string } | null;
  metadata?: Record<string, unknown>;
  statusCode?: number;
}

/**
 * Ghi nhận và thông báo lỗi API trực tiếp về Telegram BOT
 */
export const logApiError = async ({
  module,
  error,
  request,
  user,
  metadata,
  statusCode = 500,
}: ApiErrorLogOptions): Promise<void> => {
  try {
    const errObj = error instanceof Error ? error : new Error(typeof error === 'string' ? error : JSON.stringify(error));
    const errorMessage = errObj.message || 'Lỗi không xác định';
    const errorStack = errObj.stack;

    // Throttle kiểm tra nếu lỗi tương tự liên tục xuất hiện
    const throttleKey = `${module}:${errorMessage}`;
    if (isThrottled(throttleKey, 30_000)) {
      console.warn(`[THROTTLED ERROR TO TELEGRAM] ${module}: ${errorMessage}`);
      return;
    }

    const time = getVietnamTimeString();
    const ip = extractClientIp(request);
    let url = 'N/A';
    let method = 'N/A';
    if (request) {
      method = request.method || 'N/A';
      if ('nextUrl' in request && (request as any).nextUrl) {
        url = (request as any).nextUrl.toString();
      } else if (request.url) {
        url = request.url;
      }
    }

    let userInfo = 'Khách vãng lai';
    if (user?.email) {
      userInfo = `${user.email} (${user.role || 'user'})`;
    }

    const isSecurityError = statusCode === 401 || statusCode === 403 || statusCode === 429;
    const header = isSecurityError ? '[CẢNH BÁO BẢO MẬT]' : '[LỖI HỆ THỐNG / API ERROR]';

    const lines: string[] = [
      header,
      `Module: ${module}`,
      `Request: ${method} ${url}`,
      `Người dùng: ${userInfo}`,
      `Client IP: ${ip}`,
      `HTTP Status: ${statusCode}`,
      `Thời gian: ${time}`,
      '',
      'Chi tiết lỗi:',
      errorMessage,
    ];

    if (metadata && Object.keys(metadata).length > 0) {
      const sanitizedMeta = sanitizeData(metadata);
      lines.push('');
      lines.push(`Thông tin phụ: ${JSON.stringify(sanitizedMeta, null, 2)}`);
    }

    if (errorStack && !isSecurityError) {
      const cleanStack = errorStack
        .split('\n')
        .slice(0, 8)
        .join('\n');
      lines.push('');
      lines.push(`Stack Trace:\n${cleanStack}`);
    }

    await sendTelegramMessage(lines.join('\n'));
  } catch (tgError) {
    console.error('[TELEGRAM LOGGER FAILED]', tgError);
  }
};

export interface ApiActionLogOptions {
  module: string;
  action: string;
  request?: NextRequest | Request | null;
  user?: { email?: string; id?: string; role?: string; name?: string } | null;
  details?: Record<string, unknown> | string[] | string;
  level?: 'info' | 'success' | 'warn';
}

/**
 * Ghi nhận nhật ký sự kiện/hoạt động quan trọng của project về Telegram BOT
 */
export const logApiAction = async ({
  module,
  action,
  request,
  user,
  details,
  level = 'info',
}: ApiActionLogOptions): Promise<void> => {
  try {
    const time = getVietnamTimeString();
    const ip = extractClientIp(request);
    
    let userInfo = 'Hệ thống';
    if (user?.email) {
      userInfo = `${user.email} (${user.role || 'user'})`;
    }

    let header = '[HOẠT ĐỘNG]';
    if (level === 'success') header = '[THÀNH CÔNG]';
    if (level === 'warn') header = '[CẢNH BÁO]';

    const lines: string[] = [
      header,
      `Phân hệ: ${module}`,
      `Hành động: ${action}`,
      `Người thực hiện: ${userInfo}`,
      `Client IP: ${ip}`,
      `Thời gian: ${time}`,
    ];

    if (details) {
      lines.push('');
      lines.push('Chi tiết:');
      if (typeof details === 'string') {
        lines.push(details);
      } else if (Array.isArray(details)) {
        details.forEach((item) => lines.push(`- ${item}`));
      } else if (typeof details === 'object') {
        const sanitized = sanitizeData(details);
        for (const [k, v] of Object.entries(sanitized as Record<string, unknown>)) {
          lines.push(`- ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
        }
      }
    }

    await sendTelegramMessage(lines.join('\n'));
  } catch (tgError) {
    console.error('[TELEGRAM ACTION LOGGER FAILED]', tgError);
  }
};

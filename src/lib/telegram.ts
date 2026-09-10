import https from 'https';

const getEnvConfig = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  return { token, chatId };
};

export const isTelegramConfigured = (): boolean => {
  const { token, chatId } = getEnvConfig();
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
 * Sends a request to the Telegram Bot API via native https to ensure maximum stability.
 */
const callTelegramApi = (
  endpoint: string,
  payload: Record<string, unknown>
): Promise<TelegramApiResponse> => {
  return new Promise((resolve, reject) => {
    const { token } = getEnvConfig();
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
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
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
 * Sends a new message to the configured Telegram chat.
 */
export const sendTelegramMessage = async (
  text: string
): Promise<{ success: boolean; messageId?: number; error?: string }> => {
  const { chatId } = getEnvConfig();
  if (!isTelegramConfigured() || !chatId) {
    return { success: false, error: 'Telegram credentials missing' };
  }

  try {
    const response = await callTelegramApi('sendMessage', {
      chat_id: chatId,
      text,
    });

    if (!response.ok) {
      console.warn('Telegram sendMessage failed:', response.description);
      return { success: false, error: response.description };
    }

    return {
      success: true,
      messageId: response.result?.message_id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Telegram error';
    console.warn('Error calling Telegram sendMessage:', message);
    return { success: false, error: message };
  }
};

/**
 * Edits an existing message by its message_id.
 */
export const editTelegramMessage = async (
  messageId: number,
  text: string
): Promise<{ success: boolean; error?: string }> => {
  const { chatId } = getEnvConfig();
  if (!isTelegramConfigured() || !chatId) {
    return { success: false, error: 'Telegram credentials missing' };
  }

  try {
    const response = await callTelegramApi('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
    });

    if (!response.ok) {
      // If the message content wasn't modified, Telegram returns an error that can be safely ignored
      if (response.description?.includes('message is not modified')) {
        return { success: true };
      }
      console.warn('Telegram editMessageText failed:', response.description);
      return { success: false, error: response.description };
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Telegram error';
    console.warn('Error calling Telegram editMessageText:', message);
    return { success: false, error: message };
  }
};

// Formatter helpers (Bổ sung icon trực quan, sinh động theo yêu cầu người dùng)
export const formatters = {
  start: (title: string, total: number) => {
    return [
      '📤 [BẮT ĐẦU TẢI LÊN]',
      `📖 Tiêu đề: ${title}`,
      `🖼️ Tổng số ảnh: ${total} ảnh`,
      '⏳ Trạng thái: Bắt đầu xử lý...',
    ].join('\n');
  },

  progress: (
    title: string,
    completed: number,
    total: number,
    status: 'uploading' | 'saving'
  ) => {
    const percent = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
    const isSaving = status === 'saving';
    const header = isSaving ? '🔄 [ĐANG CẬP NHẬT]' : '📤 [ĐANG TẢI LÊN]';
    const statusText = isSaving
      ? 'Đang lưu nội dung chương vào hệ thống...'
      : `Đang tải lên ảnh (${completed}/${total})...`;

    return [
      header,
      `📖 Tiêu đề: ${title}`,
      `📊 Tiến trình: ${completed}/${total} ảnh (${percent}%)`,
      `⏳ Trạng thái: ${statusText}`,
    ].join('\n');
  },

  success: (title: string, total: number) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', { hour12: false });
    const dateStr = now.toLocaleDateString('vi-VN');

    return [
      '✅ [TẢI LÊN & LƯU THÀNH CÔNG]',
      `📖 Tiêu đề: ${title}`,
      `🖼️ Tổng số ảnh: ${total}/${total} ảnh`,
      '🎉 Trạng thái: Tải lên & Lưu thành công!',
      `⏰ Thời gian: ${timeStr} ngày ${dateStr}`,
    ].join('\n');
  },

  delete: (title: string, author?: string, chapterCount?: number) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', { hour12: false });
    const dateStr = now.toLocaleDateString('vi-VN');

    const lines = [
      '🗑️ [XÓA BỘ TRUYỆN]',
      `📖 Tiêu đề: ${title}`,
    ];

    if (author) {
      lines.push(`👤 Tác giả: ${author}`);
    }

    if (typeof chapterCount === 'number') {
      lines.push(`📑 Quy mô: ${chapterCount} chương`);
    }

    lines.push('⚠️ Trạng thái: Đã xóa hoàn toàn khỏi hệ thống!');
    lines.push(`⏰ Thời gian: ${timeStr} ngày ${dateStr}`);

    return lines.join('\n');
  },

  error: (title: string, errorMessage?: string) => {
    return [
      '❌ [TẢI LÊN THẤT BẠI]',
      `📖 Tiêu đề: ${title}`,
      `⚠️ Lỗi: ${errorMessage || 'Không rõ nguyên nhân'}`,
    ].join('\n');
  },
};

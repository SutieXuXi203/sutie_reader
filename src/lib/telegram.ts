import {
  sendTelegramMessage,
  editTelegramMessage,
  isTelegramConfigured,
  callTelegramApi,
  getTelegramConfig,
  getVietnamTimeString,
  logApiError,
  logApiAction,
  extractClientIp,
  sanitizeData,
  type ApiErrorLogOptions,
  type ApiActionLogOptions,
} from './telegramLogger';

export {
  sendTelegramMessage,
  editTelegramMessage,
  isTelegramConfigured,
  callTelegramApi,
  getTelegramConfig,
  getVietnamTimeString,
  logApiError,
  logApiAction,
  extractClientIp,
  sanitizeData,
  type ApiErrorLogOptions,
  type ApiActionLogOptions,
};

const getVietnamTimeStrings = (date = new Date()) => {
  const timeStr = date.toLocaleTimeString('vi-VN', {
    hour12: false,
    timeZone: 'Asia/Ho_Chi_Minh',
  });
  const dateStr = date.toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
  });
  return { timeStr, dateStr };
};

export const formatters = {
  start: (title: string, total: number) => {
    const isUpdate = title.toLowerCase().includes('cập nhật');
    const header = isUpdate ? '[BẮT ĐẦU CẬP NHẬT]' : '[BẮT ĐẦU TẢI LÊN]';
    const cleanTitle = title.replace(/^Đang cập nhật ["“']?([^"”']+)["”']?$/i, '$1').trim();
    const lines = [
      header,
      `Tiêu đề: ${cleanTitle}`,
    ];
    if (total > 0) {
      lines.push(`Tổng số ảnh: ${total} ảnh`);
    }
    lines.push('Trạng thái: Bắt đầu xử lý...');
    return lines.join('\n');
  },

  progress: (
    title: string,
    completed: number,
    total: number,
    status: 'uploading' | 'saving'
  ) => {
    const percent = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
    const isSaving = status === 'saving';
    const isUpdate = title.toLowerCase().includes('cập nhật') || isSaving;
    const header = isUpdate ? '[ĐANG CẬP NHẬT]' : '[ĐANG TẢI LÊN]';
    const cleanTitle = title.replace(/^Đang cập nhật ["“']?([^"”']+)["”']?$/i, '$1').trim();
    const statusText = isSaving
      ? 'Đang lưu nội dung chương vào hệ thống...'
      : `Đang tải lên ảnh (${completed}/${total})...`;

    const lines = [
      header,
      `Tiêu đề: ${cleanTitle}`,
    ];
    if (total > 0) {
      lines.push(`Tiến trình: ${completed}/${total} ảnh (${percent}%)`);
    }
    lines.push(`Trạng thái: ${statusText}`);
    return lines.join('\n');
  },

  success: (title: string, total: number) => {
    const { timeStr, dateStr } = getVietnamTimeStrings();
    const isUpdate = title.toLowerCase().includes('cập nhật');
    const header = isUpdate ? '[CẬP NHẬT THÀNH CÔNG]' : '[TẢI LÊN THÀNH CÔNG]';
    const cleanTitle = title.replace(/^Đang cập nhật ["“']?([^"”']+)["”']?$/i, '$1').trim();

    const lines = [
      header,
      `Tiêu đề: ${cleanTitle}`,
    ];
    if (total > 0) {
      lines.push(`Tổng số ảnh: ${total}/${total} ảnh`);
    }
    lines.push(isUpdate ? 'Trạng thái: Cập nhật thành công!' : 'Trạng thái: Tải lên & Lưu thành công!');
    lines.push(`Thời gian: ${timeStr} ngày ${dateStr}`);

    return lines.join('\n');
  },

  update: (title: string, details?: string[] | string, author?: string) => {
    const { timeStr, dateStr } = getVietnamTimeStrings();
    const cleanTitle = title.replace(/^Đang cập nhật ["“']?([^"”']+)["”']?$/i, '$1').trim();

    const lines = [
      '[CẬP NHẬT TRUYỆN]',
      `Tiêu đề: ${cleanTitle}`,
    ];

    if (author) {
      lines.push(`Tác giả: ${author}`);
    }

    if (Array.isArray(details) && details.length > 0) {
      lines.push('Nội dung thay đổi:');
      details.forEach((item) => {
        lines.push(`- ${item}`);
      });
    } else if (typeof details === 'string' && details.trim()) {
      lines.push(`Nội dung thay đổi: ${details.trim()}`);
    } else {
      lines.push('Nội dung thay đổi: Cập nhật thông tin truyện');
    }

    lines.push('Trạng thái: Cập nhật thành công!');
    lines.push(`Thời gian: ${timeStr} ngày ${dateStr}`);

    return lines.join('\n');
  },

  delete: (title: string, author?: string, chapterCount?: number) => {
    const { timeStr, dateStr } = getVietnamTimeStrings();

    const lines = [
      '[XÓA TRUYỆN]',
      `Tiêu đề: ${title}`,
    ];

    if (author) {
      lines.push(`Tác giả: ${author}`);
    }

    if (typeof chapterCount === 'number') {
      lines.push(`Quy mô: ${chapterCount} chương`);
    }

    lines.push('Trạng thái: Đã xóa hoàn toàn khỏi hệ thống!');
    lines.push(`Thời gian: ${timeStr} ngày ${dateStr}`);

    return lines.join('\n');
  },

  error: (title: string, errorMessage?: string) => {
    const { timeStr, dateStr } = getVietnamTimeStrings();
    const cleanTitle = title.replace(/^Đang cập nhật ["“']?([^"”']+)["”']?$/i, '$1').trim();
    return [
      '[TẢI LÊN THẤT BẠI]',
      `Tiêu đề: ${cleanTitle}`,
      `Lỗi: ${errorMessage || 'Không rõ nguyên nhân'}`,
      `Thời gian: ${timeStr} ngày ${dateStr}`,
    ].join('\n');
  },
};

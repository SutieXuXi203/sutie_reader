import { z } from 'zod';

const ALLOWED_AVATAR_HOSTS = ['api.dicebear.com', 'lh3.googleusercontent.com'];

/** Avatar dạng URL chỉ được trỏ tới https và tên miền đã biết (không cho URL tùy ý / theo dõi / scheme nguy hiểm). */
export function isAllowedAvatarUrl(value: string): boolean {
  if (value.length > 500) return false;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') return false;

    const host = parsed.hostname.toLowerCase();
    if (ALLOWED_AVATAR_HOSTS.includes(host) || host.endsWith('.workers.dev')) return true;

    const workerUrl = process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_URL;
    if (workerUrl) {
      try {
        return host === new URL(workerUrl).hostname.toLowerCase();
      } catch {
        return false;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Vui lòng nhập email hoặc tên đăng nhập').max(254, 'Email quá dài'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu').max(128, 'Mật khẩu quá dài'),
  rememberMe: z.boolean().optional(),
  pin: z.string().max(32, 'Mã PIN không hợp lệ').optional(),
});

export const registerSchema = z.object({
  email: z.string().trim().email('Email không hợp lệ').max(254, 'Email quá dài'),
  // bcrypt chỉ xử lý 72 byte đầu của mật khẩu
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự').max(72, 'Mật khẩu không được vượt quá 72 ký tự'),
  name: z.string().trim().min(1, 'Vui lòng nhập tên').max(50, 'Tên không được vượt quá 50 ký tự'),
  avatar: z
    .string()
    .refine(isAllowedAvatarUrl, 'Ảnh đại diện không hợp lệ')
    .optional()
    .or(z.literal('')),
});

export const postSchema = z.object({
  title: z.string().min(1, 'Tiêu đề là bắt buộc').max(100, 'Tiêu đề không được vượt quá 100 ký tự'),
  description: z.string().max(300, 'Mô tả không được vượt quá 300 ký tự').optional().or(z.literal('')),
  tags: z.array(z.string()).optional(),
  author: z.string().optional().or(z.literal('')),
  translator: z.string().max(100, 'Tên dịch giả không được vượt quá 100 ký tự').optional().or(z.literal('')),
  content: z.string().optional().or(z.literal('')),
  images: z.array(z.string()).optional(),
  chapters: z.array(
    z.object({
      title: z.string().optional().or(z.literal('')),
      chapterNumber: z.number().optional(),
      content: z.string().optional().or(z.literal('')),
      images: z.array(z.string()).optional(),
      translator: z.string().max(100, 'Tên dịch giả chương không được vượt quá 100 ký tự').optional().or(z.literal('')),
      accessType: z.enum(['inherit', 'restricted', 'public']).optional(),
    })
  ).optional(),
});

export const tagSchema = z.object({
  name: z.string().min(1, 'Tên tag không hợp lệ').max(30, 'Tag không được dài quá 30 ký tự'),
});

export const updateTagSchema = z.object({
  oldTag: z.string().min(1, 'Yêu cầu không hợp lệ. Cần có tag cũ.'),
  newTag: z.string().min(1, 'Yêu cầu không hợp lệ. Cần có tag mới.').max(30, 'Tag không được dài quá 30 ký tự'),
}).refine(data => data.oldTag !== data.newTag, {
  message: "Tag mới không được giống tag cũ.",
  path: ["newTag"]
});

export const contactSchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng cung cấp đầy đủ tên').max(100, 'Tên không được vượt quá 100 ký tự'),
  email: z.string().trim().email('Email không hợp lệ').max(254, 'Email quá dài'),
  message: z.string().trim().min(1, 'Vui lòng cung cấp đầy đủ tin nhắn').max(5000, 'Tin nhắn không được vượt quá 5000 ký tự'),
});

import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
  rememberMe: z.boolean().optional(),
});

export const registerSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
  name: z.string().min(1, 'Vui lòng nhập tên'),
  avatar: z.string().url().optional().or(z.literal('')),
});

export const postSchema = z.object({
  title: z.string().min(1, 'Tiêu đề là bắt buộc').max(100, 'Tiêu đề không được vượt quá 100 ký tự'),
  description: z.string().max(300, 'Mô tả không được vượt quá 300 ký tự').optional().or(z.literal('')),
  tags: z.array(z.string()).optional(),
  author: z.string().optional().or(z.literal('')),
  content: z.string().optional().or(z.literal('')),
  images: z.array(z.string()).optional(),
  chapters: z.array(
    z.object({
      title: z.string().optional().or(z.literal('')),
      chapterNumber: z.number().optional(),
      content: z.string().optional().or(z.literal('')),
      images: z.array(z.string()).optional(),
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
  name: z.string().min(1, 'Vui lòng cung cấp đầy đủ tên'),
  email: z.string().email('Email không hợp lệ'),
  message: z.string().min(1, 'Vui lòng cung cấp đầy đủ tin nhắn'),
});

import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { contactSchema } from '@/lib/validations';
import { connectDB } from '@/lib/db';
import { getClientIp } from '@/lib/clientIp';
import { consumeAttempt } from '@/lib/rateLimit';
import { logApiError, logApiAction } from '@/lib/telegramLogger';

function escapeHtml(str: string): string {
    return str.replace(/[&<>"']/g, (m) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    }[m] || m));
}

export async function POST(request: NextRequest) {
    try {
        const ip = getClientIp(request.headers);

        await connectDB();
        // Đếm lượt nguyên tử theo IP (tối đa 5 tin / 15 phút), tính trước khi gửi mail
        const attempt = await consumeAttempt(`contact:${ip}`);
        if (!attempt.allowed) {
            return NextResponse.json(
                { error: `Bạn đã gửi quá nhiều tin nhắn liên hệ. Vui lòng thử lại sau ${attempt.retryAfterMinutes} phút.` },
                { status: 429 }
            );
        }

        const body = await request.json();
        const parseResult = contactSchema.safeParse(body);
        if (!parseResult.success) {
            return NextResponse.json({ error: JSON.parse(parseResult.error.message)[0].message }, { status: 400 });
        }
        const { name, email, message } = parseResult.data;

        const safeSenderName = name.replace(/[\r\n"']/g, ' ').trim() || 'Người dùng';
        const safeSubjectName = name.replace(/[\r\n]/g, ' ').trim() || 'Người dùng';

        const recipient = process.env.CONTACT_TO_EMAIL || process.env.EMAIL_USER;
        if (!recipient) {
            throw new Error('CONTACT_TO_EMAIL / EMAIL_USER is not configured');
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
            disableFileAccess: true,
            disableUrlAccess: true,
        });
        const mailOptions = {
            from: `"${safeSenderName}" <${email}>`,
            to: recipient,
            replyTo: email,
            subject: `[Lubu] Tin nhắn liên hệ từ ${safeSubjectName}`,
            text: `Bạn nhận được một tin nhắn liên hệ mới từ ${name} (${email}):\n\n${message}`,
            html: `
        <h3>Tin nhắn liên hệ mới</h3>
        <p><strong>Người gửi:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Nội dung:</strong></p>
        <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
      `,
        };
        await transporter.sendMail(mailOptions);

        // Ghi nhận log tin nhắn liên hệ về Telegram
        void logApiAction({
            module: 'Liên hệ (Contact)',
            action: 'Người dùng gửi tin nhắn liên hệ',
            request,
            details: {
                'Người gửi': name,
                'Email': email,
                'Nội dung tin nhắn': message,
            },
            level: 'info',
        });

        return NextResponse.json(
            { message: 'Tin nhắn đã được gửi thành công.' },
            { status: 200 }
        );
    } catch (error) {
        console.error('Lỗi khi gửi email liên hệ:', error);
        void logApiError({
            module: '[POST] /api/contact',
            error,
            request,
            statusCode: 500,
        });
        return NextResponse.json(
            { error: 'Có lỗi xảy ra khi gửi tin nhắn. Vui lòng thử lại sau.' },
            { status: 500 }
        );
    }
}

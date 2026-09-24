import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { contactSchema } from '@/lib/validations';
import { connectDB } from '@/lib/db';
import { RateLimit } from '@/models/RateLimit';
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
        const forwardedFor = request.headers.get('x-forwarded-for');
        const realIp = request.headers.get('x-real-ip');
        const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : (realIp || 'unknown');
        const rateLimitKey = `contact:${ip}`;

        await connectDB();
        let rateLimit = await RateLimit.findOne({ ip: rateLimitKey });

        if (rateLimit && rateLimit.lockUntil && rateLimit.lockUntil > new Date()) {
            const waitMinutes = Math.ceil((rateLimit.lockUntil.getTime() - Date.now()) / 60000);
            return NextResponse.json(
                { error: `Bạn đã gửi quá nhiều tin nhắn liên hệ. Vui lòng thử lại sau ${waitMinutes} phút.` },
                { status: 429 }
            );
        }

        const body = await request.json();
        const parseResult = contactSchema.safeParse(body);
        if (!parseResult.success) {
            return NextResponse.json({ error: JSON.parse(parseResult.error.message)[0].message }, { status: 400 });
        }
        const { name, email, message } = parseResult.data;

        if (!rateLimit) {
            rateLimit = new RateLimit({ ip: rateLimitKey, attempts: 1 });
        } else {
            rateLimit.attempts += 1;
            if (rateLimit.attempts >= 5) {
                rateLimit.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
            }
        }
        await rateLimit.save();

        const safeSenderName = name.replace(/[\r\n"']/g, ' ').trim() || 'Người dùng';
        const safeSubjectName = name.replace(/[\r\n]/g, ' ').trim() || 'Người dùng';

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
            to: 'sutiexuxi.supp.0410@gmail.com',
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

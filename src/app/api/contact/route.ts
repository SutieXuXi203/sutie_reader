import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
export async function POST(request: Request) {
    try {
        const { name, email, message } = await request.json();
        if (!name || !email || !message) {
            return NextResponse.json(
                { error: 'Vui lòng cung cấp đầy đủ tên, email và tin nhắn.' },
                { status: 400 }
            );
        }
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });
        const mailOptions = {
            from: `"${name}" <${email}>`,
            to: 'sutiexuxi.supp.0410@gmail.com',
            replyTo: email,
            subject: `[Lubu] Tin nhắn liên hệ từ ${name}`,
            text: `Bạn nhận được một tin nhắn liên hệ mới từ ${name} (${email}):\n\n${message}`,
            html: `
        <h3>Tin nhắn liên hệ mới</h3>
        <p><strong>Người gửi:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Nội dung:</strong></p>
        <p style="white-space: pre-wrap;">${message}</p>
      `,
        };
        await transporter.sendMail(mailOptions);
        return NextResponse.json(
            { message: 'Tin nhắn đã được gửi thành công.' },
            { status: 200 }
        );
    } catch (error) {
        console.error('Lỗi khi gửi email liên hệ:', error);
        return NextResponse.json(
            { error: 'Có lỗi xảy ra khi gửi tin nhắn. Vui lòng thử lại sau.' },
            { status: 500 }
        );
    }
}

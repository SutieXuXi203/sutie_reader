import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { sendVerificationEmail } from '@/lib/mail';
import { registerSchema } from '@/lib/validations';
import { logApiError, logApiAction } from '@/lib/telegramLogger';
export async function POST(request: NextRequest) {
    try {
        await connectDB();
        const body = await request.json();
        const parseResult = registerSchema.safeParse(body);
        if (!parseResult.success) {
            return NextResponse.json({ error: JSON.parse(parseResult.error.message)[0].message }, { status: 400 });
        }
        const { email, password, name, avatar } = parseResult.data;
        const normalizedEmail = email.toLowerCase().trim();
        const rootAdminEmail = (process.env.ADMIN_USERNAME || '').toLowerCase().trim();

        if (rootAdminEmail && normalizedEmail === rootAdminEmail) {
            return NextResponse.json(
                { error: 'Địa chỉ email này dành riêng cho Quản trị viên và không được phép đăng ký trực tiếp' },
                { status: 400 }
            );
        }

        if (!normalizedEmail.endsWith('@gmail.com')) {
            return NextResponse.json({ error: 'Vui lòng sử dụng tài khoản Gmail hợp lệ' }, { status: 400 });
        }

        // Chống spam đăng ký gửi mail hàng loạt bằng RateLimit
        const forwardedFor = request.headers.get('x-forwarded-for');
        const realIp = request.headers.get('x-real-ip');
        const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : (realIp || 'unknown');
        const rateLimitKey = `register:${ip}`;
        const { RateLimit } = await import('@/models/RateLimit');
        let rateLimit = await RateLimit.findOne({ ip: rateLimitKey });

        if (rateLimit && rateLimit.lockUntil && rateLimit.lockUntil > new Date()) {
            const waitMinutes = Math.ceil((rateLimit.lockUntil.getTime() - Date.now()) / 60000);
            return NextResponse.json(
                { error: `Bạn đã thực hiện đăng ký quá nhiều lần. Vui lòng thử lại sau ${waitMinutes} phút.` },
                { status: 429 }
            );
        }

        let user = await User.findOne({ email: normalizedEmail });
        if (user) {
            if (user.isVerified) {
                return NextResponse.json({ error: 'Email đã được sử dụng' }, { status: 400 });
            }
        }
        const hashedPassword = await bcrypt.hash(password, 12);
        const verificationCode = randomInt(100000, 1000000).toString();
        const verificationExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
        if (user) {
            user.password = hashedPassword;
            user.name = name;
            user.isVerified = false;
            user.verificationCode = verificationCode;
            user.verificationExpiresAt = verificationExpiresAt;
            user.verificationAttempts = 0;
            if (avatar) user.avatar = avatar;
            await user.save();
        } else {
            user = await User.create({
                email: normalizedEmail,
                password: hashedPassword,
                name,
                avatar: avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
                role: 'guest',
                isVerified: false,
                verificationCode,
                verificationExpiresAt,
                verificationAttempts: 0,
            });
        }

        if (!rateLimit) {
            rateLimit = new RateLimit({ ip: rateLimitKey, attempts: 1 });
        } else {
            rateLimit.attempts += 1;
            if (rateLimit.attempts >= 5) {
                rateLimit.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
            }
        }
        await rateLimit.save();

        try {
            await sendVerificationEmail(normalizedEmail, verificationCode);
        } catch (mailError) {
            console.error('Lỗi gửi email:', mailError);
            void logApiError({
                module: '[POST] /api/auth/register (Send Mail)',
                error: mailError,
                request,
                metadata: { email: normalizedEmail },
                statusCode: 500,
            });
            return NextResponse.json({ error: 'Không thể gửi email xác thực. Vui lòng thử lại.' }, { status: 500 });
        }

        // Ghi nhận log đăng ký tài khoản mới lên Telegram
        void logApiAction({
            module: 'Xác thực (Auth)',
            action: 'Đăng ký tài khoản mới',
            request,
            details: {
                'Email': normalizedEmail,
                'Tên': name,
                'Trạng thái': 'Đã gửi mã xác thực qua email',
            },
            level: 'info',
        });

        return NextResponse.json({
            message: 'Vui lòng kiểm tra email để nhận mã xác thực',
            requireVerification: true,
            email: user.email
        });
    } catch (error) {
        console.error('Lỗi đăng ký:', error);
        void logApiError({
            module: '[POST] /api/auth/register',
            error,
            request,
            statusCode: 500,
        });
        return NextResponse.json({ error: 'Đăng ký không thành công' }, { status: 500 });
    }
}

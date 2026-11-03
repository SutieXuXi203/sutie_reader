import { connectDB } from '@/lib/db';
import { handleExpiredUnverifiedUser } from '@/lib/unverifiedUserCleanup';
import { User } from '@/models/User';
import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { logApiError, logApiAction } from '@/lib/telegramLogger';
import { z } from 'zod';

const verifySchema = z.object({
  email: z.string().trim().email('Email không hợp lệ'),
  code: z.string().trim().min(1, 'Mã xác thực không được để trống').max(10, 'Mã xác thực không hợp lệ'),
});

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json().catch(() => ({}));
    const parseResult = verifySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: JSON.parse(parseResult.error.message)[0].message }, { status: 400 });
    }
    const { email, code } = parseResult.data;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail }).select('+verificationCode');
    if (!user) {
      return NextResponse.json({ error: 'Tài khoản không tồn tại' }, { status: 404 });
    }

    if (user.isVerified) {
      return NextResponse.json({ error: 'Tài khoản đã được xác thực trước đó' }, { status: 400 });
    }

    const isExpiredAccountDeleted = await handleExpiredUnverifiedUser(user, 'verify');
    if (isExpiredAccountDeleted.deleted) {
      return NextResponse.json(
        {
          error:
            'Mã xác thực đã hết hạn. Tài khoản chưa kích hoạt đã được dọn dẹp, vui lòng đăng ký lại.',
        },
        { status: 410 }
      );
    }

    if (!user.verificationCode) {
      return NextResponse.json(
        { error: 'Mã xác thực không tồn tại hoặc đã bị vô hiệu hóa. Vui lòng đăng ký lại để nhận mã mới.' },
        { status: 400 }
      );
    }

    // Giữ chỗ một lượt thử một cách NGUYÊN TỬ trước khi so khớp mã: nhiều request song song không thể
    // "gom" nhiều lần đoán vào một lần đếm (điều kiện $lt: 5 chặn lượt thứ 6 trở đi).
    const MAX_VERIFICATION_ATTEMPTS = 5;
    const reserved = await User.findOneAndUpdate(
      {
        _id: user._id,
        isVerified: false,
        verificationCode: { $exists: true },
        verificationAttempts: { $lt: MAX_VERIFICATION_ATTEMPTS },
      },
      { $inc: { verificationAttempts: 1 } },
      { returnDocument: 'after' }
    ).select('+verificationCode');

    if (!reserved || !reserved.verificationCode) {
      return NextResponse.json(
        { error: 'Mã xác thực đã bị vô hiệu hóa do nhập sai nhiều lần hoặc đã được xác thực. Vui lòng đăng ký lại để nhận mã mới.' },
        { status: 429 }
      );
    }

    const userCodeBuffer = Buffer.from(reserved.verificationCode);
    const inputCodeBuffer = Buffer.from(code);
    const isCodeValid =
      userCodeBuffer.length === inputCodeBuffer.length &&
      crypto.timingSafeEqual(userCodeBuffer, inputCodeBuffer);

    if (!isCodeValid) {
      const attempts = reserved.verificationAttempts || MAX_VERIFICATION_ATTEMPTS;

      if (attempts >= MAX_VERIFICATION_ATTEMPTS) {
        await User.updateOne(
          { _id: user._id },
          { $unset: { verificationCode: 1 }, $set: { verificationAttempts: 0 } }
        );

        void logApiAction({
          module: 'Xác thực tài khoản (Verify)',
          action: 'Vô hiệu hóa mã OTP do nhập sai 5 lần',
          request,
          details: {
            'Email': normalizedEmail,
          },
          level: 'warn',
        });

        return NextResponse.json(
          { error: 'Bạn đã nhập sai mã xác thực quá 5 lần. Mã đã bị vô hiệu hóa, vui lòng đăng ký lại để nhận mã mới.' },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: `Mã xác thực không chính xác (còn ${MAX_VERIFICATION_ATTEMPTS - attempts} lần thử)` },
        { status: 400 }
      );
    }

    await User.updateOne(
      { _id: user._id },
      {
        $set: { isVerified: true, verificationAttempts: 0 },
        $unset: { verificationCode: 1, verificationExpiresAt: 1 },
      }
    );

    // Ghi nhận log xác thực tài khoản thành công
    void logApiAction({
      module: 'Xác thực tài khoản (Verify)',
      action: 'Xác thực tài khoản email thành công',
      request,
      details: {
        'Email': normalizedEmail,
        'Tên': user.name,
      },
      level: 'success',
    });

    return NextResponse.json({
      message: 'Xác thực thành công. Bạn có thể đăng nhập.',
    });
  } catch (error) {
    console.error('Lỗi xác thực:', error);
    void logApiError({
      module: '[POST] /api/auth/verify',
      error,
      request,
      statusCode: 500,
    });
    return NextResponse.json({ error: 'Xác thực không thành công' }, { status: 500 });
  }
}

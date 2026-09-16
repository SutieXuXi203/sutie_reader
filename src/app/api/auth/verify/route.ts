import { connectDB } from '@/lib/db';
import { handleExpiredUnverifiedUser } from '@/lib/unverifiedUserCleanup';
import { User } from '@/models/User';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json({ error: 'Thiếu email hoặc mã xác thực' }, { status: 400 });
    }

    const user = await User.findOne({ email });
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
            'Mã xác thực đã hết hạn sau 24 giờ. Tài khoản đã bị xóa, vui lòng đăng ký lại.',
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

    if (user.verificationCode !== code) {
      const attempts = (user.verificationAttempts || 0) + 1;
      user.verificationAttempts = attempts;

      if (attempts >= 5) {
        user.verificationCode = undefined;
        user.verificationAttempts = 0;
        await user.save();
        return NextResponse.json(
          { error: 'Bạn đã nhập sai mã xác thực quá 5 lần. Mã đã bị vô hiệu hóa, vui lòng đăng ký lại để nhận mã mới.' },
          { status: 429 }
        );
      }

      await user.save();
      const remaining = 5 - attempts;
      return NextResponse.json(
        { error: `Mã xác thực không chính xác (còn ${remaining} lần thử)` },
        { status: 400 }
      );
    }

    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationExpiresAt = undefined;
    user.verificationAttempts = 0;
    await user.save();

    return NextResponse.json({
      message: 'Xác thực thành công. Bạn có thể đăng nhập.',
    });
  } catch (error) {
    console.error('Lỗi xác thực:', error);
    return NextResponse.json({ error: 'Xác thực không thành công' }, { status: 500 });
  }
}

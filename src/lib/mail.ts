import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'sutiexuxi.supp.0410@gmail.com',
        pass: process.env.EMAIL_PASS, // Mật khẩu ứng dụng (App Password)
    },
});

export const sendVerificationEmail = async (email: string, code: string) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER || 'sutiexuxi.supp.0410@gmail.com',
            to: email,
            subject: 'Xác thực tài khoản của bạn',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #333; text-align: center;">Mã Xác Thực Của Bạn</h2>
          <p style="color: #555; font-size: 16px;">Cảm ơn bạn đã đăng ký! Vui lòng sử dụng mã gồm 6 chữ số dưới đây để hoàn tất việc đăng ký tài khoản của bạn:</p>
          <div style="background-color: #f4f4f4; padding: 15px; text-align: center; border-radius: 5px; margin: 20px 0;">
            <strong style="font-size: 24px; letter-spacing: 5px; color: #000;">${code}</strong>
          </div>
          <p style="color: #777; font-size: 14px;">Mã này sẽ hết hạn trong 15 phút. Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email.</p>
        </div>
      `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`Email xác thực đã được gửi đến ${email}`);
    } catch (error) {
        console.error('Lỗi khi gửi email xác thực:', error);
        throw new Error('Không thể gửi email xác thực');
    }
};

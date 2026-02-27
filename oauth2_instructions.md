# Hướng dẫn tạo OAuth 2.0 Client ID

Để hệ thống upload ảnh bằng tài khoản Google Drive cá nhân của bạn, chúng ta cần dùng **OAuth 2.0**. Vui lòng thực hiện các bước sau:

### Bước 1: Tạo OAuth Client ID
1. Vào [Google Cloud Console](https://console.cloud.google.com/).
2. Chọn dự án bạn đã tạo lúc nãy (ở thanh Toolbar phía trên cùng).
3. Vào menu bên trái chọn **APIs & Services** > **OAuth consent screen** (Màn hình xin phép OAuth).
   - Chọn loại **External** (Bên ngoài) và bấm **Create**.
   - Điền tên ứng dụng (vd: Blog Upload) và nhập email của bạn vào các ô yêu cầu. Sau đó bấm **Save and Continue** cho đến hết.
   - Ở bước **Test users** (Người dùng thử nghiệm), hãy _Add user_ và nhập chính email `@gmail.com` của bạn vào.
4. Chuyển sang thẻ **Credentials** (Thông tin xác thực) ở menu bên trái.
5. Bấm **Create Credentials** > **OAuth client ID**.
6. Chọn Application type: **Web application**.
7. Đặt tên: `Blog uploader`.
8. Tại phần **Authorized redirect URIs** (URI chuyển hướng được cấp phép), hãy thêm Link này vào:
   👉 `https://developers.google.com/oauthplayground`
9. Bấm **Create** (Tạo). Google sẽ hiện ra một bảng chứa `Client ID` và `Client secret`.
   **=> Hãy Mở Notepad và lưu 2 mã này lại để gửi cho tôi.**

### Bước 2: Lấy Refresh Token
1. Truy cập trang web: [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground/).
2. Nhìn góc trên bên phải, bấm vào biểu tượng bánh răng ⚙ (OAuth 2.0 configuration).
   - Tích chọn ô: **Use your own OAuth credentials**
   - Dán cái `Client ID` và `Client secret` (bạn vừa lấy ở Bước 1) vào 2 ô tương ứng. Bấm Close.
3. Nhìn sang cột bên trái (Step 1):
   - Thay vì bấm mở các mục, bạn hãy kiếm dòng nhập code "Input your own scopes" (nhỏ trong cùng panel)
   - Và dán link này vào: `https://www.googleapis.com/auth/drive.file`
   - Rồi bấm nút **Authorize APIs** màu xanh lam.
   - Chọn đúng tài khoản Google cá nhân của bạn và bấm Continue (nếu nó cảnh báo App chưa được xác minh thì bấm Continue).
4. Cột bên trái sẽ chuyển sang **Step 2**:
   - Bạn bấm vào nút: **Exchange authorization code for tokens**.
5. Cột Step 2 sẽ hiện ra chữ **Refresh token: 1//0eABCxyz...**
   **=> Hãy copy cái đoạn Refresh Token này lại dán vào file Notepad ban nãy.**

### Tổng kết
Sau khi làm xong, bạn hãy copy và gửi toàn bộ cái Notepad chứa 3 thông tin này vào chat cho tôi nhé:
1. **Client ID**
2. **Client Secret**
3. **Refresh Token**
4. **Folder ID** (ID thư mục mà bạn muốn Drive lưu ảnh vào)

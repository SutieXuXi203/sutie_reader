# 🛡️ Tiêu Chuẩn Bảo Mật & Bản Quyền Bắt Buộc (Security Rules)

> **Cảnh báo dành cho AI Agent**: Dự án Lubu Corp / Sutie Reader sở hữu các tiêu chuẩn bảo vệ bản quyền số và phân quyền bảo mật rất cao. Mọi hành vi làm lỏng lẻo cơ chế bảo vệ đều bị nghiêm cấm.

---

## 1. Bản Quyền Ảnh Truyện & Chống Leech (Anti-Scraper)

* **Cơ chế Canvas Scrambler**:
  * Tất cả các ảnh chương truyện lưu trữ trên Cloudflare Worker / Google Drive đều bị cắt thành ma trận các ô nhỏ (ví dụ $4 \times 4$ hoặc $6 \times 6$) và xáo trộn vị trí ngẫu nhiên.
  * Chỉ trình duyệt người dùng truy cập hợp lệ mới nhận được tham số giải mã ma trận và ghép lại hình ảnh nguyên vẹn trên HTML5 Canvas qua component `ScrambledCanvas.tsx`.
  * Trình thu thập tự động (crawler/scraper bot) tải về link `.webp` chỉ nhận được ảnh nát vụn.
* **Quy tắc tuyệt đối**:
  * **KHÔNG BAO GIỜ** tạo endpoint public trả về ảnh gốc chưa xáo trộn.
  * Tham số `pre_scrambled=1` chỉ được kích hoạt duy nhất cho người dùng mang vai trò `admin` có phiên đăng nhập hợp lệ.

---

## 2. Ký Số Đường Dẫn Ảnh (HMAC Signed URLs)

* Tất cả đường dẫn ảnh truyện phục vụ qua Cloudflare Worker đều phải đi kèm chữ ký HMAC:
  * Thời gian sống ngắn: **TTL 120 giây** (`IMAGE_SIGNED_URL_TTL_SECONDS=120`).
  * Gắn liền chữ ký với địa chỉ IP và định danh User ID.
  * Hết thời hạn 120s, đường dẫn lập tức bị vô hiệu hóa để chống copy link chia sẻ ra diễn đàn bên ngoài.
* Giới hạn tần suất gọi ảnh: **360 ảnh / 60 giây** (`IMAGE_RATE_LIMIT_MAX=360`).

---

## 3. Phân Quyền Truy Cập Đa Cấp (Granular RBAC)

* **3 Vai trò chính**: `guest` (khách), `user` (thành viên đã xác thực OTP), `admin` (quản trị viên).
* **Phân quyền cấp truyện (`Post.accessType`)**:
  * `public`: Ai cũng có thể đọc truyện.
  * `restricted`: Chỉ những người dùng có trong danh sách chia sẻ `sharedWith` (theo email/userId) hoặc Admin mới được đọc.
* **Phân quyền cấp chương (`Chapter.accessType`)**:
  * `inherit`: Thừa hưởng phân quyền từ đầu truyện.
  * `restricted`: Chỉ những độc giả được cấp quyền riêng ở chương này mới được đọc.
  * `public`: Cho phép đọc công khai (dành cho các chương mở đọc thử).
* **Bảo vệ danh sách độc giả (`accessedUsers`)**:
  * Thuộc tính `accessedUsers` ghi nhận ai đã đọc truyện.
  * **TUYỆT ĐỐI KHÔNG** trả về danh sách này cho người dùng thường hoặc người xem qua link chia sẻ. Thuộc tính này chỉ dành riêng cho Admin.

---

## 4. Chống Timing Attack & Brute-Force

* **So sánh an toàn thời gian (`crypto.timingSafeEqual`)**:
  * Khi kiểm tra mã OTP xác thực email hoặc mã PIN mở khóa website, bắt buộc dùng `crypto.timingSafeEqual` để chống việc hacker phân tích thời gian phản hồi microsecond nhằm dò tìm ký tự.
* **Chống Brute-force mật khẩu**:
  * Mọi lần nhập sai mật khẩu đều được ghi nhận theo định dạng `pwd:login:${ip}:${email}`.
  * Tự động khóa 15 phút nếu nhập sai quá 5 lần liên tiếp.
* **Bảo vệ mã PIN mở khóa (`UNLOCK_PIN`)**:
  * Cookie `site_access_token` phải là **Signed JWT Token** có scope `site_unlock`, thời hạn xác định, không lưu cookie dạng chuỗi plaintext.

# 📚 Lubu Corp – Nền Tảng Đọc Truyện & Quản Trị Nội Dung

> Dự án website đọc truyện tranh, tiểu thuyết số hiệu năng cao với công nghệ bảo vệ bản quyền đa tầng (Scramble Canvas, HMAC Signed URLs, Google Drive CDN qua Cloudflare Worker).

---

## 🛠️ 1. Danh Sách Công Nghệ Sử Dụng (Tech Stack)

### 🖥️ Frontend & UI Framework
* **Next.js 16.3.5 (Turbopack, App Router)**: Framework React hiện đại nhất với kiến trúc Server Components, Server Actions và quy ước Request Proxy (`proxy.ts`).
* **React 19.2.3 & React DOM 19.2.3**: Tận dụng cơ chế xử lý đồng thời (Concurrent rendering) và Server Actions.
* **Tailwind CSS v4**: Phiên bản CSS utility-first mới nhất, biên dịch siêu tốc với `@tailwindcss/postcss` và `tw-animate-css`.
* **Hệ thống Font chữ**: SF Pro Display (bản quyền Apple) hỗ trợ đầy đủ 9 trọng số từ Thin đến Black Italic.
* **Thư viện UI & Icon**:
  * `@base-ui/react` (v1.6) & `radix-ui` (v1.4) (shadcn/ui headless components).
  * `lucide-react` (v0.575): Bộ biểu tượng vector sắc nét.
  * `goey-toast` (v0.3): Thông báo Toast mượt mà với hiệu ứng chất lỏng (liquid gooey).
  * `next-themes` (v0.4): Quản lý chế độ sáng/tối (Dark / Light mode).
* **Hiệu ứng & Animation**:
  * `framer-motion` (v12.35): Quản lý hoạt ảnh giao diện và dialogs.
  * `lenis` (v1.3): Trải nghiệm cuộn trang siêu mượt (Smooth Scrolling).
  * `gsap` (v3.15): Hiệu ứng tương tác nâng cao.
* **Xử lý Ảnh Phía Client**:
  * `browser-image-compression` (v2.0): Nén ảnh trước khi tải lên.
  * `react-easy-crop` (v5.5): Công cụ cắt ảnh đại diện trực tiếp trên trình duyệt.

### ⚙️ Backend, Cơ Sở Dữ Liệu & Bảo Mật
* **MongoDB & Mongoose (v9.2.1)**: Cơ sở dữ liệu NoSQL lưu trữ thông tin truyện, chương, người dùng, vai trò và lịch sử bookmark.
* **Xác thực & Bảo mật (Auth & Security)**:
  * `jose` (v6.1): Thẩm định và ký mã khóa JWT an toàn thời gian thực.
  * `bcryptjs` (v3.0): Băm mật khẩu đa lớp an toàn.
  * `zod` (v4.3) & `react-hook-form` (v7.71): Kiểm soát schema và dữ liệu đầu vào.
  * **Timing-Safe Comparison (`crypto.timingSafeEqual`)**: Chống tấn công phân tích thời gian cho mã OTP và mã PIN website.
  * **Canvas Scramble Algorithm**: Thuật toán chia mảnh và xáo trộn pixel chống scraper / crawler leech ảnh.
* **Email & Dịch vụ Giao Tiếp**:
  * `nodemailer` (v8.0): Gửi email OTP xác thực tài khoản qua SMTP.
  * `googleapis` (v171.4): Tương tác trực tiếp với Google Drive API v3.
  * **Telegram Bot API**: Giám sát lỗi hệ thống, ghi nhận thao tác CRUD và tiến trình tải dữ liệu thời gian thực.

### 🌐 Hạ Tầng Mạng & Lưu Trữ (Infrastructure & CDN)
* **Cloudflare Workers (ES Modules)**: Proxy CDN biên mạng, nén ảnh WebP/AVIF và tự động áp dụng ma trận xáo trộn ảnh trước khi trả về trình duyệt.
* **Google Drive API (OAuth 2.0)**: Kho lưu trữ ảnh truyện dung lượng lớn không giới hạn băng thông.
* **Vercel Analytics & Speed Insights** (`@vercel/speed-insights` v2.0): Theo dõi hiệu năng Core Web Vitals thực tế.

---

## 💻 2. Yêu Cầu Hệ Thống (Prerequisites)

Trước khi tiến hành cài đặt, hãy đảm bảo máy tính của bạn đã chuẩn bị:
1. **Node.js**: Phiên bản **20.x** trở lên (Khuyến nghị dùng bản LTS mới nhất: 20.x hoặc 22.x).
2. **Trình quản lý gói**: `npm` (đi kèm Node.js) hoặc `pnpm`.
3. **Cơ sở dữ liệu MongoDB**:
   * Cụm đám mây miễn phí trên [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (khuyến nghị).
   * Hoặc MongoDB Community Server cài đặt cục bộ tại `mongodb://127.0.0.1:27017`.
4. **Tài khoản Google**: Để tạo OAuth 2.0 Client ID và kết nối Google Drive lưu ảnh.
5. **Tài khoản Cloudflare**: Để triển khai Cloudflare Worker phục vụ ảnh.
6. **Tài khoản Telegram**: Để nhận thông báo lỗi từ bot quản trị.

---

## 🚀 3. Hướng Dẫn Cài Đặt Từng Bước (Step-by-Step Setup)

### Bước 1: Tải mã nguồn & Cài đặt thư viện
```bash
# Clone dự án về máy
git clone <URL_DỰ_ÁN>
cd sutie_reader

# Cài đặt toàn bộ dependencies
npm install
```

---

### Bước 2: Chuẩn bị các dịch vụ bên thứ ba

#### 1. MongoDB
* Tạo một Database có tên `sutie_archive`.
* Lấy chuỗi kết nối dạng: `mongodb+srv://<username>:<password>@cluster0.xxx.mongodb.net/sutie_archive?retryWrites=true&w=majority`.

#### 2. Email SMTP (Gmail App Password)
* Truy cập [Google Account Security](https://myaccount.google.com/security).
* Bật **Xác minh 2 bước (2-Step Verification)**.
* Tạo một **Mật khẩu ứng dụng (App Password)** 16 ký tự để điền vào biến `EMAIL_PASS`.

#### 3. Google Drive API (OAuth 2.0)
* Truy cập [Google Cloud Console](https://console.cloud.google.com/), tạo một Project mới và bật **Google Drive API**.
* Tạo OAuth 2.0 Client ID (Loại Web Application) với Redirect URI: `https://developers.google.com/oauthplayground`.
* Lấy **Client ID** và **Client Secret**.
* Dùng [Google OAuth Playground](https://developers.google.com/oauthplayground/) với scope `https://www.googleapis.com/auth/drive` để lấy mã **Refresh Token**.
* Tạo một thư mục trên Google Drive để lưu ảnh và lấy ID thư mục từ đường link URL (`folders/<FOLDER_ID>`).
*(Xem hướng dẫn chi tiết từng bước tại tệp [oauth2_instructions.md](oauth2_instructions.md))*

#### 4. Cloudflare Worker
Mã nguồn Worker nằm tại thư mục `cloudflare-worker/`:
```bash
cd cloudflare-worker
# Đăng nhập vào tài khoản Cloudflare
npx wrangler login

# Triển khai Worker lên mạng Cloudflare
npx wrangler deploy
cd ..
```
* Sau khi deploy, bạn sẽ nhận được URL Worker dạng: `https://lubu-images.<subdomain>.workers.dev`.

#### 5. Telegram Bot (Báo lỗi & Giám sát)
* Mở ứng dụng Telegram, tìm bot `@BotFather` và gửi lệnh `/newbot` để tạo bot mới -> Nhận `TELEGRAM_BOT_TOKEN`.
* Tìm bot `@userinfobot` để lấy mã ID tài khoản cá nhân hoặc Group chat của bạn -> Nhận `TELEGRAM_CHAT_ID`.

---

### Bước 3: Cấu hình biến môi trường (.env)

Tạo tệp `.env` tại thư mục gốc của dự án (sao chép từ `.env.example`):
```bash
cp .env.example .env
```

Điền các thông số tương ứng vào `.env`:

```env
# ==============================================================================
# 1. Cơ sở dữ liệu MongoDB
# ==============================================================================
MONGODB_URI=mongodb+srv://<db_user>:<db_password>@cluster0.mongodb.net/sutie_archive?retryWrites=true&w=majority

# ==============================================================================
# 2. Tài khoản Quản Trị Viên Gốc (Root Admin)
# ==============================================================================
ADMIN_USERNAME=admin@domain.com
ADMIN_PASSWORD=mat_khau_admin_an_toan

# Tài khoản kiểm thử tự động (cho test suite)
TEST_USERNAME=test@domain.com
TEST_PASSWORD=mat_khau_test_an_toan

# ==============================================================================
# 3. URL Website & Cấu hình SEO
# ==============================================================================
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# ==============================================================================
# 4. Xác thực & Khóa Website
# ==============================================================================
# Chuỗi bí mật ký JWT (tối thiểu 32 ký tự ngẫu nhiên)
JWT_SECRET=chuoi_bi_mat_jwt_ngau_nhien_dai_hon_32_ky_tu

# Mã PIN 6 chữ số mở khóa toàn website (để trống nếu không muốn dùng khóa PIN)
UNLOCK_PIN=041023

# ==============================================================================
# 5. Cấu hình Email gửi mã OTP (Nodemailer)
# ==============================================================================
EMAIL_USER=email_cua_ban@gmail.com
EMAIL_PASS=mat_khau_ung_dung_16_ky_tu

# ==============================================================================
# 6. Tích hợp Google Drive API
# ==============================================================================
GOOGLE_CLIENT_ID=56699603273-xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
GOOGLE_REFRESH_TOKEN=1//04xxx
GOOGLE_DRIVE_FOLDER_ID=1eUXtTx7uvcA8KivVnrouwc0OZmQTm6Bw

# ==============================================================================
# 7. Cấu hình Cloudflare Worker & Bảo vệ Ảnh
# ==============================================================================
CLOUDFLARE_WORKER_URL=https://lubu-images.your-subdomain.workers.dev
NEXT_PUBLIC_CLOUDFLARE_WORKER_URL=https://lubu-images.your-subdomain.workers.dev
CLOUDFLARE_UPLOAD_SECRET=khoa_bi_mat_dong_bo_giua_nextjs_va_worker
CLOUDFLARE_API_TOKEN=cfut_xxx

# Khóa ký số URL ảnh (HMAC Token)
IMAGE_SIGNING_SECRET=chuoi_bi_mat_ky_anh_hmac_rat_dai
IMAGE_SIGNED_URL_TTL_SECONDS=120
IMAGE_RATE_LIMIT_MAX=360
IMAGE_RATE_LIMIT_WINDOW_MS=60000

# ==============================================================================
# 8. Cảnh báo lỗi qua Telegram Bot
# ==============================================================================
TELEGRAM_BOT_TOKEN=8820132707:AAxxx
TELEGRAM_CHAT_ID=8820132707
```

---

## 🏃‍♂️ 4. Khởi Chạy & Thao Tác (Running & Scripts)

### Chạy môi trường phát triển cục bộ (Local Development):
```bash
npm run dev
```
Mở trình duyệt tại địa chỉ: **[http://localhost:3000](http://localhost:3000)**

---

### Chạy bộ kiểm thử tự động (Test Suite):
Kiểm tra toàn bộ 105 bài test về phân quyền, bảo mật JWT, chống crawler, rate limiting:
```bash
npm test
```

---

### Đóng gói và chạy môi trường Production:
```bash
# Biên dịch mã nguồn với Next.js Turbopack
npm run build

# Khởi chạy server production
npm run start
```

---

### Kiểm tra cú pháp mã nguồn (Linter):
```bash
npm run lint
```

---

## 👑 5. Khởi Tạo Tài Khoản Quản Trị Viên (Admin)

1. Khi hệ thống khởi chạy lần đầu, hãy truy cập giao diện web và bấm **Đăng ký (Register)**.
2. Nhập chính xác email trùng khớp với biến `ADMIN_USERNAME` đã cấu hình trong `.env`.
3. Hệ thống sẽ nhận diện tài khoản này là Quản trị viên tối cao, tự động cấp vai trò `admin` và cho phép truy cập khu vực quản lý: **[http://localhost:3000/admin](http://localhost:3000/admin)** để đăng truyện, quản lý thành viên và theo dõi danh sách độc giả.

---

## 🔒 6. Cơ Chế Bản Quyền & Chống Leech Truyện

1. **Canvas Scrambler**: Mỗi ảnh truyện khi tải lên sẽ được cắt thành ma trận các mảnh nhỏ (ví dụ $4 \times 4$) và xáo trộn vị trí. Đường dẫn ảnh lưu trên CDN là dạng ảnh đã bị xáo trộn. Chỉ client hợp lệ của website mới có khóa giải mã ma trận và ghép lại nguyên vẹn trên HTML5 Canvas.
2. **Chống Crawler Tự Động**: Crawler tải link `.webp` về chỉ nhận được ảnh nát. Tham số `pre_scrambled` chỉ cấp quyền cho Quản trị viên thông qua token phiên làm việc có chữ ký HMAC.
3. **Chống Tải Lậu Bằng Đường Dẫn Trực Tiếp**: URL ảnh được cấp chữ ký số ngắn hạn (TTL 120s) gắn liền với IP và User ID, link hết hạn tự động bị vô hiệu hóa.

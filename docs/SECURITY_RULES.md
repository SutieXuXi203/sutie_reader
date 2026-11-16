# 🛡️ Tiêu Chuẩn Bảo Mật & Bản Quyền Bắt Buộc (Security Rules)

> **Cảnh báo dành cho AI Agent**: Dự án Lubu Corp / Sutie Reader sở hữu các tiêu chuẩn bảo vệ bản quyền số và phân quyền bảo mật rất cao. Mọi hành vi làm lỏng lẻo cơ chế bảo vệ đều bị nghiêm cấm.

---

## 1. Bản Quyền Ảnh Truyện & Chống Leech (Anti-Scraper)

* **Cơ chế Canvas Scrambler**:
  * Ảnh chương truyện được server (`/api/image/[id]`) cắt thành ma trận ô nhỏ (mặc định $8 \times 8$) và xáo trộn vị trí; trình duyệt ghép lại trên HTML5 Canvas qua `ScrambledCanvas.tsx`.
  * Seed xáo trộn do **server tự suy ra** (`deriveScrambleSeed`); tham số `seed/rows/cols` từ client bị bỏ qua.
  * ⚠️ **Giới hạn đã biết**: thuật toán và muối nằm trong bundle client nên xáo trộn chỉ là *obfuscation* chống crawler tự động đơn giản, KHÔNG chống được người dùng có tài khoản chủ động đảo ngược. Không được quảng bá nó như một cơ chế mã hóa.
* **Quy tắc tuyệt đối**:
  * **KHÔNG BAO GIỜ** trả URL Cloudflare Worker (`https://<worker>/image/...`) cho trình duyệt: Worker phục vụ **ảnh gốc**. Mọi API gửi ảnh cho client phải dùng `signImageUrls()` / `protectedImageUrl()` (trả `/api/image/<id>.webp?...&pid=`). `createSignedWorkerImageUrl()` chỉ dùng server-to-server.
  * **KHÔNG BAO GIỜ** để lỗi xáo trộn dẫn tới việc trả ảnh gốc (fail-closed).
  * Tham số `pre_scrambled=1` / `raw=1` chỉ được kích hoạt cho người dùng `admin` có phiên hợp lệ.
  * `/api/og-image/[postId]` là endpoint công khai duy nhất trả ảnh không xáo trộn: chỉ cho truyện `public`, chương không bị hạn chế, 600px, có giới hạn tần suất theo IP.

---

## 2. Ký Số Đường Dẫn Ảnh (HMAC Signed URLs — server-to-server)

* URL Worker được ký HMAC-SHA256 gồm: method, đường dẫn, thời điểm hết hạn, `sub` (user id).
  * TTL mặc định **120 giây**, tối đa **600 giây** (`IMAGE_SIGNED_URL_TTL_SECONDS`); Worker từ chối `exp` xa hơn 600s.
  * Chữ ký **không gắn IP** (vì URL chỉ đi từ server Next tới Worker, không bao giờ tới trình duyệt).
* Giới hạn tần suất gọi ảnh: **360 ảnh / 60 giây / (user, IP)** (`IMAGE_RATE_LIMIT_MAX=360`), lưu trong RAM của instance.
* Worker chỉ phục vụ **ảnh (png/jpeg/webp/gif/avif) nằm trong thư mục Drive gốc**; SVG và file khác bị từ chối (cả `/image` và `/avatar`).
* `/avatar/<id>` của Worker **không có chữ ký**, nên chỉ được phục vụ file thật sự là avatar (nhãn `appProperties.sutieKind=avatar`, hoặc file cũ nằm trực tiếp trong thư mục gốc `Avatars`); trang truyện qua endpoint này bị 404. Cache edge của `/avatar` dùng namespace riêng (`?cv=2`).
* Upload lên Worker chỉ chấp nhận: bí mật dùng chung server-to-server, hoặc token `scope: 'upload'` ngắn hạn (≤15 phút, bắt buộc có `exp`) do `/api/auth/token` cấp cho admin. Token phiên đăng nhập thường **không** được chấp nhận. File upload được kiểm tra bằng magic bytes, không tin `Content-Type` client khai báo.

---

## 3. Phân Quyền Truy Cập Đa Cấp (Granular RBAC)

* **3 Vai trò chính**: `guest` (khách), `user` (thành viên chính thức, **toàn quyền đọc** mọi truyện/chương), `admin` (quản trị viên).
* **Phân quyền cấp truyện (`Post.accessType`)**:
  * `public`: Ai cũng có thể đọc truyện.
  * `restricted`: `guest` chỉ được đọc nếu có trong `sharedWith` (theo email/userId); `user` và `admin` luôn được đọc.
* **Phân quyền cấp chương (`Chapter.accessType`)**:
  * `inherit`: Thừa hưởng phân quyền từ đầu truyện.
  * `restricted`: Chỉ người được cấp quyền riêng ở chương này (và admin/user) mới được đọc.
  * `public`: Cho phép đọc công khai (chương mở đọc thử).
* **Kiểm quyền ảnh (`/api/image/[id]`, `src/lib/imageAccess.ts`)** — áp dụng cho `guest`:
  * Ảnh phải thuộc đúng bài/chương chứa nó; `pid` từ client chỉ là gợi ý tra cứu, **không bao giờ được tin**.
  * Quyền được tính theo **từng chương**; thumbnail (`thumb=1`) chỉ được miễn quyền chương với **ảnh bìa** của bài mà guest xem được.
  * Cache quyền theo `(user, ảnh, thumb)` TTL 60 giây; **lỗi DB ⇒ 503 (fail-closed)**, không bao giờ mặc định cho phép.
* **Bảo vệ danh sách độc giả (`accessedUsers`)**: **TUYỆT ĐỐI KHÔNG** trả cho người dùng thường hoặc người xem qua link chia sẻ — chỉ Admin.

---

## 4. Chống Timing Attack & Brute-Force

* **So sánh an toàn thời gian**: dùng `safeEqual()` (`src/lib/password.ts`) / `crypto.timingSafeEqual` cho OTP, mã PIN, mật khẩu admin/test từ biến môi trường.
* **Khóa brute-force phải NGUYÊN TỬ** (`src/lib/rateLimit.ts`): luôn gọi `consumeAttempt(key)` **trước** khi kiểm tra thông tin xác thực, `resetAttempts(key)` khi thành công. Tuyệt đối không viết kiểu "đọc bản ghi → tăng biến → `save()`" (N request song song sẽ chỉ bị đếm 1 lần).
  * Khóa 15 phút sau 5 lượt: `pwd:login:${ip}:${email}`, `pin:login:${ip}:${email}`, `site-pin:${ip}`, `register:${ip}`, `contact:${ip}`. Hết khóa thì bộ đếm được làm lại.
  * OTP email: tối đa 5 lượt/mã, giữ chỗ lượt bằng `findOneAndUpdate` có điều kiện `verificationAttempts < 5`.
* **IP client**: chỉ lấy qua `getClientIp()` (`src/lib/clientIp.ts`), lấy phần tử do proxy tin cậy nối vào cuối `X-Forwarded-For` (`TRUSTED_PROXY_COUNT`, mặc định 1 = Vercel). Không bao giờ lấy phần tử đầu tiên.
* **Mã PIN toàn site (`UNLOCK_PIN`)**:
  * Cookie `site_access_token` phải là **Signed JWT** scope `site_unlock` (30 ngày). Proxy **không** được so sánh cookie với chính mã PIN.
  * PIN chỉ được kiểm tra qua `verifySitePin()` (dùng chung cho `/api/unlock` và Server Action) để cùng một bộ đếm khóa.
  * Các trang công khai có chủ đích, không qua cổng PIN: `/`, `/posts/*`, `/contact`, `/unlock`. Quyền đọc truyện vẫn kiểm ở server.
  * `/api/auth/me` và `/api/auth/refresh` **không** cấp `site_access_token`: người mới được nâng quyền phải tự nhập PIN.
  * ⚠️ PIN là một giá trị dùng chung (6 số), chỉ đóng vai trò cổng site, **không phải xác thực 2 lớp** thực sự cho từng người.

---

## 5. Các Quy Tắc Khác

* **Tra "ảnh thuộc bài nào"** (`/api/image/[id]`) phải dùng multikey index `Post.imageIds` (không `$regex` quét collection). Mọi đường ghi ảnh phải duy trì trường này: `pre('save')` của model, `PUT /api/posts/[id]` (đặt lại đầy đủ), `POST /api/posts/[id]/chapters` (`$addToSet`, chỉ khi bài đã có trường), và `backfillImageIds` cho dữ liệu cũ. Đường `$regex` chỉ còn là dự phòng khi `getImageIndexStatus() !== 'ready'`. Mọi URL ảnh gửi cho client nên kèm `pid`.
* **Ảnh theo từng chương**: trình đọc không nhận ảnh của mọi chương cùng lúc. Trang `/posts/[id]` chỉ gửi ảnh của chương đang mở; các chương còn lại được tải qua `GET /api/posts/[id]/chapters/[n]`, route này kiểm `canViewPost` rồi `canViewChapter` (403/401 khi không có quyền, không trả ảnh) và chỉ trả URL `/api/image/...` (kèm `pid`). `GET /api/posts/[id]?lite=1` bỏ ảnh của mọi chương; không có `lite` vẫn trả đầy đủ (trang sửa bài của admin dùng).
* **Đăng xuất = thu hồi token**: mọi đường đăng xuất (Server Action `logoutAction` và `/api/auth/logout`) phải gọi `revokeToken()`; mọi route tự `jwtVerify` (`/api/auth/refresh`, `PUT /api/auth/me`) phải kiểm `isTokenRevoked()` trước khi đúc token mới. `revokeToken` ghi cả Redis (nhanh, dùng chung) lẫn MongoDB `revoked_tokens` (bền vững, TTL theo hạn token) nên vẫn đúng khi không có Redis hoặc Redis mất dữ liệu; `isTokenRevoked(token, { durable: true })` luôn tra thêm MongoDB.
* **Trang `/posts/[id]` và metadata** phải gọi `canViewPost` giống `GET /api/posts/[id]`: người chưa có quyền chỉ nhận khung "bị khóa", không nhận tiêu đề/mô tả/thẻ/danh sách chương.
* **`/api/og-image`** chỉ lấy ảnh bìa từ chương không `restricted` (`pickPublicCoverUrl`); `post.images` là bản sao chương 1 nên không được tin.
* **`/api/auth/verify`** có giới hạn 20 lượt / 15 phút / IP (ngoài 5 lượt / mã theo tài khoản).

* **Redirect**: mọi `callbackUrl` phải qua `getSafeCallbackUrl()` (`src/lib/safeRedirect.ts`); từ chối ký tự điều khiển, `\`, `//`, URL tuyệt đối.
* **Avatar**: data URL chỉ png/jpeg/webp, tối đa 2MB, kiểm magic bytes; avatar dạng URL chỉ `https` và host trong danh sách cho phép (`isAllowedAvatarUrl`). Đổi hồ sơ giới hạn 10 lần / 10 phút.
* **`/api/telegram/log`** công khai (trang lỗi dùng khi chưa đăng nhập) nhưng giới hạn: 5 req/phút/IP (20 nếu đã đăng nhập), body ≤ 8KB, cắt độ dài mọi trường.
* **Không lộ lỗi nội bộ**: không trả `error.message` thô cho client (`details`).
* **JWT_SECRET** tối thiểu 32 ký tự (production sẽ từ chối khởi động nếu ngắn hơn).
* **Dữ liệu ghi đồng thời** phải dùng thao tác nguyên tử có điều kiện (`$push` kèm `$ne`, `$inc`, `findOneAndUpdate` theo `updatedAt`), không "đọc-rồi-ghi-cả-mảng".
* **Cache RAM** (`api-cache`, rate-limit ảnh, cache user) đều có trần kích thước; cache có dữ liệu phân quyền giữ TTL ngắn vì mỗi instance serverless có bộ nhớ riêng.

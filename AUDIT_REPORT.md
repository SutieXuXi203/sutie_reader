# BÁO CÁO KIỂM TOÁN HỆ THỐNG — Sutie Reader (Lubu Corp)

Ngày kiểm toán: 2026-11-03 · Phạm vi: toàn bộ repo (Next.js 16.3.5 / React 19 / MongoDB / Cloudflare Worker + Google Drive) · Không sửa mã nguồn, không chạm production.

**Quy ước độ tin cậy**
- **[XÁC NHẬN-ĐỘNG]**: đã tái hiện bằng cách chạy mã thật (route handler / worker / proxy) trên MongoDB cục bộ tạm, Drive/Worker được mock.
- **[XÁC NHẬN-MÃ]**: đọc mã, luồng không thể diễn giải khác; chưa chạy.
- **[RỦI RO]**: phụ thuộc cấu hình triển khai, chưa chứng minh được.

Script tái hiện (ngoài repo): `%TEMP%\claude\...\scratchpad\t1.ts` (proxy/JWT/redirect), `t2.ts` (race login/PIN/OTP), `t3.ts` (route ảnh, worker, race chương).

---

## 1. Tóm tắt điều hành

| Hạng mục | Kết quả đo được |
|---|---|
| `npm test` | 105/105 pass — **nhưng phần lớn test không gọi route/handler thật** (xem TEST-01) |
| `npx tsc --noEmit` | 0 lỗi |
| `npm run build` (env giả) | Thành công, 0 lỗi |
| `npm run lint` | **214 vấn đề (177 lỗi, 37 cảnh báo)**: 146 `no-explicit-any`, 33 `no-unused-vars`, 25 `no-require-imports` |
| `npm audit` | **38 lỗ hổng: 2 critical, 8 high, 27 moderate, 1 low** (trong đó `next@16.3.5`, `nodemailer@8.0.11`, `zod@4.3.6`, `sharp@0.35.4` bị gắn cờ) |
| Secrets trong repo/lịch sử git | Không thấy secret thật (chỉ `.env.example`) |
| Load test (P95/P99, throughput) | **Không thực hiện** — không dựng server HTTP + tải thật. Chỉ có 1 số đo thời gian cục bộ (xem PERF-01) |

**Đánh giá chung:** nền tảng RBAC theo chương và các quy ước bảo mật được nghĩ kỹ, nhưng **cơ chế chống leech — cam kết cốt lõi của docs — hiện không có hiệu lực**: người dùng đăng nhập thường lấy được ảnh gốc chưa xáo trộn bằng 1 request (SEC-01) và có nhiều đường vòng khác (SEC-03, SEC-07). Các cơ chế khóa brute-force (PIN, mật khẩu, OTP) **bị vô hiệu bởi race condition** — đã dò ra đúng PIN trong 1 loạt 200 request song song (SEC-02/04). Bộ test xanh 105/105 tạo cảm giác an toàn giả vì test mô phỏng lại logic thay vì gọi code thật.

---

## 2. Bản đồ kiến trúc

- **Frontend/Backend**: Next.js App Router, ~26k dòng TS/TSX. `src/proxy.ts` (gate PIN + /admin), 27 route handler `src/app/api/**`, 3 file Server Actions `src/actions`.
- **DB**: MongoDB qua Mongoose 9 (`comics`, `users`, `bookmarks`, `api_rate_limits`, `deleted_users`, `genres`, `roles`). Không SQL → không có SQL injection; truy vấn dùng object, regex trong Tag được `escapeRegExp`.
- **Auth**: JWT HS256 (jose) trong cookie httpOnly `token` (24h/7d); `site_access_token` (JWT scope `site_unlock`, 30d); role đọc lại từ DB qua cache RAM 15s.
- **Ảnh**: Admin upload trực tiếp từ trình duyệt lên Cloudflare Worker (Bearer JWT 10 phút) → Google Drive (OAuth refresh token). Đọc ảnh: `/api/image/[id]` (Next, ký URL Worker, `sharp` xáo trộn 8×8) **hoặc** URL Worker đã ký trả thẳng trong JSON.
- **Dịch vụ ngoài**: Google Drive, Gmail SMTP (nodemailer), Telegram Bot (log/alert), dicebear (avatar).
- **Job nền**: không có cron; dọn user chưa xác thực chạy bằng `after()` khi admin mở danh sách + TTL index Mongo.
- **Log/lỗi**: `telegramLogger.ts` → Telegram. **CI**: `.github/` chỉ có `copilot-instructions.md`, **không có workflow CI**.

---

## 3. CRITICAL

### SEC-01 — Ảnh gốc chưa xáo trộn bị phát trực tiếp cho mọi user đăng nhập [XÁC NHẬN-ĐỘNG]
- **File/vị trí**: `src/app/api/posts/[id]/route.ts:415`, `src/app/api/posts/[id]/chapters/route.ts:96`, `src/app/api/posts/route.ts:307`, `src/app/api/bookmarks/route.ts:124` → `src/lib/image-signing.ts:61-81`; Worker `cloudflare-worker/index.js:535-578`.
- **Mô tả**: Các API trả về `images[]` là **URL Worker đã ký** (`https://<worker>/image/<id>?exp&sub&sig&pid`). Worker chỉ kiểm HMAC rồi trả byte gốc từ Drive; Worker không có code xáo trộn. Việc xáo trộn chỉ xảy ra ở `/api/image/[id]` do frontend (`ensureScrambledImageUrl`) tự viết lại URL — kẻ scrape chỉ cần dùng URL trong JSON.
- **Tái hiện**: đăng nhập tài khoản guest → `GET /api/posts/<id>` → lấy `chapters[0].images[0]` → `GET` URL đó. Test `t3.ts` D1/D2: Worker trả **200, body giống hệt ảnh gốc (identical=true)**, kể cả khi header IP client khác.
- **Kỳ vọng** (docs/SECURITY_RULES.md §1): crawler chỉ nhận ảnh nát vụn. **Thực tế**: ảnh gốc độ phân giải đầy đủ.
- **Nguyên nhân**: ký URL Worker (`signImageUrls`) được dùng cho cả JSON trả client, trong khi scramble nằm ở một tầng khác.
- **Giải pháp**: không bao giờ trả URL Worker cho client; chỉ trả `/api/image/<id>?pid=` và để Worker chỉ chấp nhận request từ Next (secret server-to-server, không phải URL ký công khai). Hoặc đưa scramble vào Worker.
- **Regression test**: gọi `GET /api/posts/:id` bằng guest, assert không URL nào có host Worker / không có `sig=`.
- Ghi chú liên quan: chữ ký **không gắn IP** (payload ở `image-signing.ts:34-47` chỉ gồm method, path, exp, sub) và TTL mặc định **3600s** nếu thiếu env (`image-signing.ts:5`; `.env.example` đặt 120). Docs ghi "gắn IP" — sai so với code.

---

## 4. HIGH

### SEC-02 — Brute-force PIN toàn site: 2 đường vòng [XÁC NHẬN-ĐỘNG]
1. **Oracle không giới hạn ở proxy** — `src/proxy.ts:66-72`: nếu cookie `site_access_token` không phải JWT hợp lệ thì so `cookie.value === UNLOCK_PIN` (plaintext, không timing-safe, **không rate limit**). Test `t1.ts` T1: PIN sai → `307 /unlock`; PIN đúng làm cookie → `200`. Kẻ tấn công thử 10^6 giá trị trên bất kỳ path nào đi qua proxy (vd. `/anything`). Docs §4 cấm cookie plaintext.
2. **Race ở rate limit** — `src/app/api/unlock/route.ts:32-87`, `src/actions/authActions.ts:29-81` (đọc→sửa→`save()` không nguyên tử). Test `t2.ts` B1: 200 request song song → **chỉ ghi nhận 1 lần sai, 199 trả 500 (E11000)**; B2: một loạt 200 PIN chứa PIN đúng → **trả 200 thành công**.
- **Giải pháp**: xóa fallback plaintext trong proxy; rate limit bằng `findOneAndUpdate({ip}, {$inc:{attempts:1}}, {upsert:true, new:true})` + kiểm tra khóa sau khi tăng; bổ sung khóa theo toàn cục (không chỉ theo IP).
- **Regression**: gửi 50 request song song sai PIN, assert tổng số lần thử thực tế được xử lý ≤ 5.

### SEC-03 — Kiểm quyền ảnh `/api/image/[id]` sai/lách được [XÁC NHẬN-ĐỘNG + MÃ]
File `src/app/api/image/[id]/route.ts`:
- **IDOR qua `pid`** (dòng 140-148, 160-173): quyền tính theo bài `pid` do client gửi, **không kiểm ảnh có thuộc bài đó không**. `t3.ts` C2: guest lấy ảnh bài *restricted* với `?pid=<bài public>` → **200** (baseline với pid đúng → 403). Cần biết Drive file id.
- **`thumb=1` bỏ qua cả kiểm quyền lẫn xáo trộn** (dòng 119-122, 225-246): `t3.ts` C3 — guest lấy ảnh bài restricted bằng `?thumb=1`, không pid → **200, webp 480px *không xáo trộn*** (sai khác với ảnh gốc 3.13 so với 83 của ảnh xáo trộn).
- **Cache quyền sai khóa** (dòng 126-130, 178): khóa là `user:post:pid` chứ không theo ảnh/chương. C4: xem 1 ảnh chương preview → ảnh chương bị khóa cùng bài trả **200** trong 5 phút; C4b: bị từ chối trước → ảnh preview công khai cùng bài bị **403** (lỗi chức năng).
- **Fail-open**: `catch → isAllowed = true` (dòng 179-182); ảnh không thuộc bài nào → `true` (dòng 174-176) [XÁC NHẬN-MÃ].
- **Fail-open ra ảnh gốc**: lỗi `sharp` → trả ảnh gốc, cache public 24h (dòng 273-285) [XÁC NHẬN-MÃ].
- Worker không kiểm thư mục/mime lúc phục vụ ảnh — `assertImageCanBeServed` chỉ gọi lúc upload (`index.js:639-645`) nên mọi Drive file id của tài khoản OAuth đều qua được `/api/image/<id>` (đã mock; mức thực tế phụ thuộc biết id).
- **Giải pháp**: tra ảnh → bài/chương bằng một chỉ mục (map imageId→post/chapter) thay vì tin `pid`; cache theo `(user, imageId)`; fail-closed; bỏ nhánh `thumb` khỏi bypass (thumb chỉ cho ảnh bìa đã được duyệt); không trả ảnh gốc khi lỗi.
- **Regression**: 4 test tương ứng C2/C3/C4/C4b + mô phỏng lỗi DB ⇒ 403/5xx.

### SEC-04 — Khóa đăng nhập mật khẩu & OTP bị vô hiệu bởi race [XÁC NHẬN-ĐỘNG]
- `src/app/api/auth/login/route.ts:30-76,174`: `t2.ts` A1 — 30 lần sai song song: **1 lần được ghi nhận, 29 trả 500**; không khóa. Bcrypt vẫn chạy đủ 30 lần.
- `src/app/api/auth/verify/route.ts:58-83`: D1 — 60 mã OTP sai song song → `verificationAttempts = 1`, **mã vẫn còn hiệu lực** (kỳ vọng vô hiệu sau 5 lần). OTP 6 số, 15 phút.
- **XFF** (`login/route.ts:24-26`, cùng mẫu ở register/unlock/contact/image): khóa theo `x-forwarded-for` đầu tiên. A3: đổi XFF mỗi request → 12/12 lần sai đều 401, không khóa. Chỉ an toàn nếu hạ tầng ghi đè XFF (Vercel làm vậy; self-host/CDN khác thì không) [RỦI RO].
- **Giải pháp**: cập nhật nguyên tử (`$inc` + upsert); bỏ lặp mẫu rate-limit thành 1 helper; với OTP dùng `findOneAndUpdate` có điều kiện `attempts < 5`.

### SEC-05 — `/api/telegram/log` không cần xác thực, không giới hạn [XÁC NHẬN-MÃ]
`src/app/api/telegram/log/route.ts:5-42`: bất kỳ ai POST `{type, message, module, stack, metadata}` đều gửi được tin vào kênh Telegram của quản trị (và `await` chặn request). Không rate limit, không giới hạn kích thước. Ảnh hưởng: spam/giả mạo cảnh báo, đốt quota Telegram, gây mù cảnh báo thật.
- **Giải pháp**: yêu cầu session, rate limit theo user/IP, cắt độ dài, sandbox `module`.

### SEC-06 — Phụ thuộc có lỗ hổng [`npm audit` — chưa tự xác minh khả năng khai thác]
`next` (critical, 16.0.0–16.4.0 trong dải ảnh hưởng, bản cài 16.3.5), `nodemailer` (high; lỗi bypass `disableFileAccess` — app đang dựa vào cờ này), `zod` (high, DoS bộ nhớ), `sharp` (high; liên quan librsvg — route nhận ảnh người dùng), `undici`, `body-parser`, `proxy-addr` (transitive). Chạy `npm audit fix` / nâng phiên bản và đối chiếu advisory chi tiết.

---

## 5. MEDIUM

| ID | Vấn đề | Bằng chứng / vị trí | Cách khắc phục |
|---|---|---|---|
| SEC-07 | Xáo trộn **không có bí mật**: seed do client truyền được (`route.ts:252`) hoặc suy ra từ file id + muối hard-code trong bundle (`scramble.ts:41-52`). | **[ĐỘNG]** C5: đảo ngược bằng thuật toán công khai → sai khác **0** so với ảnh gốc | Coi như obfuscation; nếu cần thật sự, dùng khóa phía server không lộ + token mỗi lần xem |
| SEC-08 | Worker nhận bất kỳ JWT có `role: 'admin'` (không kiểm DB, không bắt buộc `exp`) và dùng chung `JWT_SECRET` với app | `index.js:459,593,671`. Admin bị hạ quyền vẫn upload được tới 7 ngày (cookie của chính họ) | Chỉ chấp nhận token `scope:'upload'` ngắn hạn, bắt buộc `exp`, secret riêng |
| SEC-09 | Worker `/avatar/<id>` không chữ ký, không kiểm thư mục/mime; upload chỉ kiểm `file.type` do client khai (`image/svg+xml` qua được) | **[ĐỘNG]** D4 (mock Drive); `index.js:416,492-533` | Kiểm thư mục + sniff magic bytes, chặn SVG, `Content-Disposition`/CSP sandbox |
| SEC-10 | Mọi user đăng nhập đẩy file lên Drive qua đổi avatar, không giới hạn tần suất/dung lượng tổng; avatar dạng URL tự do chấp nhận mọi chuỗi (kể cả không phải URL, không giới hạn độ dài) | `api/auth/me/route.ts:33-40,166-206`; `validations.ts:14` | Rate limit, magic-byte, giới hạn độ dài, chỉ cho phép host cho phép |
| SEC-11 | `/api/og-image/[postId]` công khai, trả ảnh trang đầu 600px **chưa xáo trộn** của mọi bài (kể cả restricted), mỗi request tải toàn bộ ảnh + `sharp`, không rate limit | `og-image/[postId]/route.ts:27-118` (trái docs §1 "không endpoint public trả ảnh gốc") | Cache cứng ở edge theo postId, giới hạn tần suất, chỉ cho bài public; ảnh bìa riêng |
| SEC-12 | `Cache-Control: public, max-age=2592000, immutable` cho ảnh theo-người-dùng đã xác thực, không `Vary: Cookie` | `image/[id]/route.ts:236,266,298` | `private, no-store` hoặc kiểm tra CDN không cache |
| SEC-13 | Open redirect bằng ký tự điều khiển: `/\t/evil.example` qua kiểm tra nhưng URL parser gộp thành `//evil.example` | **[ĐỘNG]** T4; `api/auth/refresh/route.ts:7-19`, `unlock/page.tsx:22-35,112` (`window.location.replace`) | Dùng `new URL(x, origin).origin === origin` và loại bỏ `\t\r\n` |
| SEC-14 | Khóa không reset sau khi hết hạn ở unlock/contact: sau 15 phút, **1 lần gõ sai** lại khóa tiếp | **[ĐỘNG]** C1; `unlock/route.ts:79-87`, `contact/route.ts:43-50` (login/register có reset) | Reset `attempts` khi `lockUntil` đã qua |
| SEC-15 | PIN dùng chung toàn hệ thống đóng vai "MFA" cho admin/user (6 số, 1 giá trị cho mọi người); `/api/auth/me` còn cấp `site_access_token` khi role đổi mà không hỏi PIN | `login/route.ts:182-211`, `me/route.ts:116` | Coi PIN là gate site, không phải 2FA; dùng TOTP thật cho admin |
| SEC-16 | Proxy miễn gate cho `/`, `/posts/*`, `/contact` và mọi path có dấu chấm → "bảo vệ toàn site" chỉ áp cho phần ít nội dung | **[ĐỘNG]** T2; `proxy.ts:9-19` | Làm rõ phạm vi trong docs hoặc áp gate cho `/posts` |
| DATA-01 | **Trùng số chương khi thêm chương song song** (check-then-push không nguyên tử; sau đó ghi đè cả mảng) | **[ĐỘNG]** E1: 8 request song song → số chương `1,2,2,2,2,2,3,4,4`; `chapters/route.ts:150-217` | `$push` kèm điều kiện `chapters.chapterNumber: {$ne:n}` hoặc unique trên `(postId, chapterNumber)` |
| DATA-02 | PUT bài ghi đè toàn bộ mảng `chapters` không kiểm phiên bản → 2 admin sửa cùng lúc mất dữ liệu | `posts/[id]/route.ts:615-715` | Optimistic concurrency (`__v` / `updatedAt`) |
| DATA-03 | `autoIndex` tắt ở production nên unique index (`RateLimit.ip`, `User.email`) và TTL index chỉ tồn tại nếu từng được tạo từ môi trường dev | `lib/db.ts:49` [RỦI RO] | Tạo index qua migration/`syncIndexes` có kiểm soát |
| DATA-04 | Xóa user không dọn `Bookmark`; `accessedUsers` có thể trùng khi vào song song | `admin/users/[id]/route.ts:41`, `posts/[id]/access/route.ts:50-90` | Cascade + `$addToSet`/upsert nguyên tử |
| DATA-05 | Worker dùng tên thư mục để gom ảnh khi không có `postId` hợp lệ → hai bài trùng tên dùng chung thư mục Drive; `getOrCreateFolder` check-then-create gây thư mục trùng | `index.js:239-314` | Luôn dùng `postId` làm khóa |
| PERF-01 | **bcryptjs (JS thuần) cost 12 chặn event loop**: 30 login song song mất **8.3s** (≈277ms/lần nối tiếp) trên máy kiểm thử → DoS rẻ lên toàn bộ site | **[ĐO]** `t2.ts` A1 | Dùng `bcrypt` native/argon2, giới hạn concurrency login |
| PERF-02 | Cache RAM không giới hạn: `userMemoryCache` khóa theo token, không bao giờ xóa mục hết hạn (`server-auth.ts:102-145`); `api-cache` chỉ xóa khi đọc lại đúng khóa; map rate limit ảnh chỉ dọn khi có người vượt hạn mức (`image/[id]/route.ts:51-79`). Khóa cache quyền chứa `pid` tùy ý | **[ĐỘNG]** C6: 111 mục sau 111 request được phép, không mục nào bị thu hồi | LRU có trần kích thước |
| PERF-03 | Cache RAM theo instance: sau khi đổi quyền/chia sẻ, instance khác (serverless/Vercel) vẫn trả danh sách/quyền cũ tới 5 phút | `posts/route.ts:12-13`, `api-cache.ts` [RỦI RO] | Cache dùng chung (Redis) hoặc TTL ngắn + bỏ cache quyền |
| PERF-04 | Trang SSR `/posts/[id]` tạo URL ảnh **không có `pid`** (`page.tsx:153,231`) → mỗi ảnh của guest chạy `$regex` quét toàn collection (`image/[id]/route.ts:150-158`) | [MÃ] | Gắn `pid` hoặc map imageId→post |
| TEST-01 | **Test "bảo mật" là tautology**: hầu hết `it()` tự viết lại logic (vd. `evaluateIsRaw`, `checkAdminAccess`, vòng đếm attempts) và không import route nào; chỉ `permissions`, `validations`, `utils`, `models` là mã thật | `src/lib/security.test.ts:7-36,210-234` | Viết test gọi route handler thật (xem mục 9) |
| DEP-01 | Dependency không khai báo: `sharp`, `mongodb`, `dotenv` được import nhưng không có trong `package.json`; `tsx` chạy bằng `npx` không ghim (`npm test`); gói `stream@0.0.3` thừa | `package.json` | Khai báo & ghim phiên bản |
| DOC-01 | Docs ≠ code: TTL 120s/IP-binding (xem SEC-01), rate limit 360 vs mặc định code 120, role `user` bị docs mô tả như phải được chia sẻ nhưng `permissions.ts:70` cho toàn quyền | `docs/SECURITY_RULES.md` | Cập nhật docs hoặc code cho khớp |

---

## 6. LOW

- **LOW-01**: Không có CI (`.github/workflows` không tồn tại); `lint` đỏ (177 lỗi) nên không thể dùng làm cổng.
- **LOW-02**: Email nhận liên hệ/gửi OTP hard-code làm fallback (`contact/route.ts:67`, `lib/mail.ts:5,14`); `contact` không giới hạn độ dài `name/message`.
- **LOW-03**: Nhiều route trả `details: error.message` cho client (PUT/POST posts, tags, `me`) làm lộ thông tin nội bộ.
- **LOW-04**: Đăng ký lộ tồn tại email ("Email đã được sử dụng", `register/route.ts:59`); mật khẩu tối thiểu 6 ký tự, không tối đa (bcryptjs cắt ở 72 byte).
- **LOW-05**: Tài khoản `TEST_USERNAME/TEST_PASSWORD` tự tạo user + bỏ qua kiểm Gmail; `password === adminPassword` so sánh không timing-safe (`login/route.ts:86-87`) — đảm bảo biến này không đặt ở production.
- **LOW-06**: Logout không thu hồi token (JWT stateless, tới 7 ngày); không có CSP; `X-XSS-Protection` đã lỗi thời; `remotePatterns: **.workers.dev` quá rộng; `localPatterns /**`.
- **LOW-07**: Code trùng lặp: `unlockSiteAction` vs `/api/unlock`; `trackPostAccessAction` vs `/api/posts/[id]/access`; mẫu rate-limit lặp ≥5 nơi; import thừa (`getSessionUserFromToken` trong `lib/auth.ts`).
- **LOW-08**: `DevToolsProtection` chỉ chặn phím tắt — không có giá trị bảo mật. `/api/roles` công khai (dữ liệu vô hại).
- **LOW-09**: `JWT_SECRET` không bị ép độ dài tối thiểu 32 như docs; `cleanupExpiredUnverifiedUsers` tải toàn bộ user chưa xác thực vào RAM.
- **Đã kiểm, không có lỗi**: JWT rỗng khi thiếu `JWT_SECRET` bị `jose` từ chối (`Zero-length key`, T3); sửa `sub` của URL ký bị Worker từ chối 403 (D3); không có sink XSS (`dangerouslySetInnerHTML` chỉ ở `layout.tsx`, nội dung tĩnh); `escapeHtml`/`escapeRegExp` đúng; admin route đều gọi `isAdmin`; thao tác ghi dùng cookie `SameSite=Lax` nên CSRF cross-site POST bị hạn chế.

---

## 7. Phân tích hiệu năng (tóm tắt)

Chỉ có dữ liệu đo ở mục PERF-01. Không có số liệu P95/P99/throughput vì chưa chạy tải trên server thật — cần môi trường staging + k6/autocannon. Nút cổ chai theo phân tích mã: bcryptjs trên event loop; xử lý `sharp` toàn bộ ảnh trong RAM cho mỗi request ảnh (kể cả `og-image` ẩn danh); `$regex` quét collection (PERF-04); cache RAM không giới hạn; Worker upload `Promise.all` tới 10 file × 10MB có thể chạm giới hạn 128MB bộ nhớ Worker [RỦI RO, chưa đo]; `PostDetailClient.tsx` 1.4k dòng và `ShareDialog.tsx` 1.4k dòng (khó bảo trì).

## 8. Khả năng phục hồi

- DB lỗi: route ảnh **fail-open** (SEC-03). Telegram lỗi không chặn nghiệp vụ nhưng `/api/telegram/log` `await` trực tiếp.
- Đa instance: cache và rate-limit RAM không nhất quán (PERF-03).
- Job nền: dọn tài khoản chưa xác thực chạy khi admin mở trang; nếu không ai mở, phụ thuộc TTL index (DATA-03).
- Không kiểm thử được động: mất kết nối giữa chừng, restart dịch vụ, Drive timeout — chưa mô phỏng.

## 9. Độ phủ test & test đề xuất

Có: `permissions.test.ts` (logic thuần, tốt), `validations`, `utils` helper, schema model. **Thiếu** (ưu tiên):
1. Route-level (gọi handler thật như `t2.ts`/`t3.ts`): login/unlock/verify lockout song song (SEC-02/04); `/api/image` với `pid` sai, `thumb=1`, cache quyền, lỗi DB (SEC-03); `/api/posts/:id` không chứa URL Worker (SEC-01).
2. Proxy: cookie plaintext bị từ chối; `/posts/*` theo thiết kế (SEC-02, SEC-16).
3. Redirect: `callbackUrl` chứa `\t \n \r` (SEC-13).
4. Chương: thêm song song không trùng số (DATA-01).
5. Worker: JWT không `exp`/không `scope:upload` bị từ chối; file không phải ảnh bị từ chối (SEC-08/09).
6. E2E (Playwright) đăng nhập guest → đọc chương khóa → bị chặn; PIN lock.
7. Test tải: login song song (PERF-01), `/api/image`.
Bỏ/viết lại các test tautology ở `security.test.ts` (TEST-01).

## 10. Kế hoạch hành động ưu tiên

1. **Ngay**: SEC-01 (ngừng trả URL Worker), SEC-02 (xóa fallback plaintext + rate limit nguyên tử), SEC-03 (fail-closed, bỏ bypass `thumb`/`pid`), SEC-05 (đóng `/api/telegram/log`), nâng dependency (SEC-06).
2. **Tuần này**: SEC-04 + SEC-14 (helper rate limit nguyên tử dùng chung), SEC-08/09/10/11, SEC-12, PERF-01, DATA-01/02/03.
3. **Sprint sau**: SEC-07 quyết định mô hình chống leech thực tế; TEST-01 viết lại test; thêm CI (test+tsc+lint+audit); dọn lint, trùng lặp; đồng bộ docs.

**Đánh giá tổng thể**: kiến trúc phân quyền tốt, chất lượng tuân thủ quy ước cao, nhưng các cơ chế bảo vệ chính (chống leech, khóa brute-force, kiểm quyền ảnh) hiện không đáng tin cậy và chưa được test thật. Mức sẵn sàng production cho nội dung có bản quyền: **chưa đạt** cho tới khi sửa nhóm Critical/High.

---

# PHỤ LỤC — TRẠNG THÁI SỬA LỖI (cập nhật sau đợt sửa)

Mỗi mục đều có kiểm thử chạy mã thật: `src/proxy.test.ts`, `src/lib/helpers.test.ts`, `src/lib/imageAccess.test.ts`, `src/worker.test.ts` (chạy trong `npm test`, không cần DB) và `tests/integration/security-routes.test.ts` (`npm run test:integration`, cần `MONGODB_TEST_URI`; gọi route handler thật trên MongoDB thật, Drive/Worker giả lập).

| ID | Trạng thái | Cách sửa (file chính) |
|---|---|---|
| SEC-01 | ✅ Đã sửa | `signImageUrls` chỉ trả `/api/image/<id>.webp?...&pid=`; URL Worker chỉ dùng server-to-server (`image-signing.ts`, `utils.ts`) |
| SEC-02 | ✅ Đã sửa | Bỏ fallback cookie plaintext (`proxy.ts`); khóa nguyên tử `consumeAttempt` (`rateLimit.ts`, `sitePin.ts`) |
| SEC-03 | ✅ Đã sửa | `imageAccess.ts` + viết lại `/api/image/[id]`: ảnh phải thuộc bài/chương, `thumb` không còn bỏ qua quyền, cache theo ảnh, fail-closed (503), không trả ảnh gốc khi lỗi xáo trộn |
| SEC-04 | ✅ Đã sửa | Đếm lượt nguyên tử cho login/register/contact/unlock; OTP giữ chỗ lượt bằng `findOneAndUpdate`; `getClientIp` chống giả mạo XFF |
| SEC-05 | ✅ Đã sửa | `/api/telegram/log`: giới hạn tần suất, kích thước, làm sạch ký tự |
| SEC-06 | ✅ Đã sửa phần có thể nâng không phá vỡ | `next` 16.4.4, `sharp` 0.35.5, `zod` 4.6.7, `nodemailer` 10.3.1 (xem `npm audit` bên dưới) |
| SEC-07 | ⚠️ Giới hạn thiết kế, đã ghi rõ trong docs | Seed do server suy ra, bỏ tham số client; nhưng xáo trộn bằng Canvas phía client vẫn chỉ là obfuscation (không thể chống người dùng chủ động) |
| SEC-08 | ✅ Đã sửa | Worker chỉ nhận token `scope:'upload'`, bắt buộc `exp` ≤ 15 phút, kiểm `alg` |
| SEC-09 | ✅ Đã sửa | Worker: kiểm thư mục + mime khi phục vụ (cả `/avatar`), magic bytes khi upload, chặn SVG, CSP sandbox |
| SEC-10 | ✅ Đã sửa | `/api/auth/me`: data URL png/jpeg/webp + magic bytes, URL chỉ https + host cho phép, giới hạn tần suất, tên ≤ 50 |
| SEC-11 | ✅ Đã sửa | og-image: chỉ truyện public/chương không hạn chế, giới hạn tần suất, bỏ redirect |
| SEC-12 | ✅ Đã sửa | Ảnh theo người dùng: `private, max-age`, `Vary: Cookie` |
| SEC-13 | ✅ Đã sửa | `getSafeCallbackUrl` dùng chung (từ chối ký tự điều khiển) cho `refresh` và trang `/unlock` |
| SEC-14 | ✅ Đã sửa | Bộ đếm làm lại khi khóa hết hạn |
| SEC-15 | ◐ Một phần | `/api/auth/me` và `/refresh` không còn cấp `site_access_token` khi đổi role. PIN dùng chung vẫn chỉ là cổng site (ghi rõ trong docs) |
| SEC-16 | ◐ Một phần | Ngoại lệ dấu chấm được thu hẹp thành danh sách đuôi tệp tĩnh; `/`, `/posts`, `/contact` vẫn công khai có chủ đích (ghi trong docs) |
| DATA-01 | ✅ Đã sửa | Thêm chương bằng `$push` có điều kiện `$ne` + `$sort`; tự cấp số có retry (`chapters/route.ts`) |
| DATA-02 | ✅ Đã sửa (phía server) | `PUT /api/posts/[id]` so-sánh-và-ghi theo `updatedAt`, hỗ trợ `expectedUpdatedAt` (409 khi xung đột) |
| DATA-03 | ✅ Đã sửa | `autoIndex` mặc định bật (`MONGOOSE_AUTO_INDEX=false` để tắt) |
| DATA-04 | ✅ Đã sửa | Xóa user dọn Bookmark; `recordPostAccess` nguyên tử, không trùng |
| DATA-05 | ✅ Đã sửa | Worker không dùng chung thư mục theo tên với truyện khác |
| PERF-01 | ✅ Đã sửa | `bcrypt` native (tự lùi `bcryptjs`), hash giả chống dò tài khoản qua timing |
| PERF-02 | ✅ Đã sửa | Trần kích thước cho `api-cache`, cache user, rate-limit RAM (có dọn mục hết hạn) |
| PERF-03 | ◐ Giảm thiểu | TTL danh sách 30s, cache quyền ảnh 60s (cache dùng chung giữa instance cần Redis — chưa thêm) |
| PERF-04 | ✅ Đã sửa | Trang SSR gắn `pid`; route ảnh không còn quét `$regex` khi có `pid` đúng |
| TEST-01 | ✅ Đã sửa | Thêm test chạy mã thật (xem trên); test tautology cũ giữ lại nhưng không còn là bằng chứng duy nhất |
| DEP-01 | ✅ Đã sửa | Khai báo `sharp`, `mongodb` (ghim 7.6.0 trùng mongoose), `tsx`, `dotenv`, `bcrypt`; bỏ `stream` |
| DOC-01 | ✅ Đã sửa | `docs/SECURITY_RULES.md`, `README.md` cập nhật khớp code |
| LOW-01 | ✅ Đã sửa | Thêm `.github/workflows/ci.yml` (test, tsc, build, audit) |
| LOW-02/03/05/09 | ✅ Đã sửa | Bỏ email hard-code; bỏ `details` lộ lỗi; so sánh mật khẩu env timing-safe; `JWT_SECRET` ≥ 32; cleanup dùng cursor |
| LOW-04 | ❌ Không sửa | Lộ tồn tại email khi đăng ký — đánh đổi UX, cần quyết định sản phẩm |
| LOW-06 | ◐ Một phần | Bỏ `X-XSS-Protection`, giới hạn `remotePatterns` theo host Worker; chưa thêm CSP (cần nonce cho inline script của Next) và JWT vẫn stateless (không thu hồi khi logout) |
| LOW-07 | ✅ Đã sửa | Hợp nhất `verifySitePin`, `recordPostAccess`, rate-limit; bỏ import thừa |
| LOW-08 | ❌ Không sửa | `DevToolsProtection`, `/api/roles` công khai — không có tác động bảo mật đáng kể |

## Kết quả kiểm chứng sau sửa

| Hạng mục | Trước | Sau |
|---|---|---|
| `npm test` | 105/105 (đa số tautology) | **148/148** (gồm test chạy proxy, Worker, phân quyền ảnh thật) |
| `npm run test:integration` (route thật + MongoDB) | không có | **17/17** — tái hiện lại đúng các lỗi cũ (khóa song song, IDOR `pid`, `thumb=1`, cache quyền, chương trùng số, URL Worker lộ) và xác nhận đã chặn |
| `npx tsc --noEmit` | 0 lỗi | 0 lỗi |
| `npm run build` | thành công | thành công |
| `npm run lint` | 214 vấn đề (177 lỗi) | **32 vấn đề (28 lỗi, 4 cảnh báo)**: toàn bộ còn lại là `react-hooks/set-state-in-effect` (25), `exhaustive-deps` (2), `preserve-manual-memoization` (1), `no-img-element` (2) — chưa sửa vì cần tái cấu trúc hiệu ứng React, có rủi ro đổi hành vi giao diện. `.agents/**` (skill bên thứ ba) được loại khỏi lint |
| `npm audit` toàn bộ | 38 (2 critical, 8 high) | 35 (1 critical, 6 high) — còn lại nằm ở công cụ dev `shadcn` (cần nâng major) |
| `npm audit --omit=dev` | — | 7 (6 moderate, 1 high `source-map-js` transitive của bộ build) |

## Việc người vận hành cần làm khi triển khai

1. **Deploy lại Cloudflare Worker** (`cloudflare-worker/index.js`): thay đổi xác thực upload, kiểm thư mục/mime. Nếu dùng `JWT_SECRET` riêng cho Worker, đặt `UPLOAD_JWT_SECRET` (tùy chọn).
2. Đảm bảo `JWT_SECRET` ≥ 32 ký tự (production sẽ từ chối khởi động nếu ngắn hơn).
3. Đặt `TRUSTED_PROXY_COUNT` đúng số proxy thật phía trước app (Vercel: 1; qua Cloudflare rồi Vercel: 2).
4. Đặt `CONTACT_TO_EMAIL` (hoặc `EMAIL_USER`) — email nhận liên hệ không còn hard-code. `EMAIL_USER` bắt buộc cho `lib/mail.ts`.
5. Lần khởi động đầu, Mongoose sẽ tạo index (unique `RateLimit.ip`, `User.email`, TTL). Nếu collection `api_rate_limits` đang có bản ghi trùng `ip`, việc tạo unique index sẽ lỗi: xóa collection này trước (dữ liệu chỉ là bộ đếm tạm).
6. Người được nâng quyền thành `user`/`admin` sẽ phải nhập mã PIN ở lần truy cập trang cần PIN kế tiếp (không còn được cấp cookie tự động).
7. Admin tab đang mở: sau khi deploy cần tải lại trang để lấy token upload mới (Worker không còn nhận token phiên thường).

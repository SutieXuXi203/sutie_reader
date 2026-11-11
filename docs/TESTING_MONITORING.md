# 🧪 Quy Trình Kiểm Thử & Giám Sát Lỗi (Testing & Monitoring)

> **Cảnh báo dành cho AI Agent**: Trước khi bàn giao bất kỳ tính năng hoặc sửa lỗi nào, Agent **bắt buộc phải thực hiện đầy đủ quy trình kiểm thử** được nêu trong tài liệu này.

---

## 1. Bộ Kiểm Thử Bảo Mật & Ràng Buộc Schema (181 Tests + 40 Tests tích hợp)

Dự án sở hữu bộ **181 bài kiểm thử đơn vị** (không cần DB) và **40 bài kiểm thử tích hợp** bao phủ các ranh giới an toàn:
* `src/lib/security.test.ts`: Kiểm thử chống timing attacks, rate limiting, xáo trộn ảnh Scramble, ký số URL, bypass tham số `pre_scrambled`, mở khóa mã PIN.
* `src/lib/permissions.test.ts`: Kiểm thử quyền hạn xem truyện, đọc chương phân lập, chia sẻ email độc giả, thu hồi quyền Admin.
* `src/models/roles.test.ts`: Kiểm thử ràng buộc schema User, Role, Post, DeletedAccount.
* `src/proxy.test.ts`: chạy `proxy.ts` thật (cổng PIN, /admin, ngoại lệ đường dẫn).
* `src/lib/helpers.test.ts`, `src/lib/imageAccess.test.ts`: redirect an toàn, IP client, magic bytes, validation, `signImageUrls`, phân quyền ảnh.
* `src/worker.test.ts`: chạy Cloudflare Worker thật với Drive giả lập (chữ ký, thư mục, upload).
* `tests/integration/security-routes.test.ts`: gọi **route handler thật trên MongoDB thật** (khóa brute-force song song, IDOR ảnh, chương song song...).
  ```bash
  MONGODB_TEST_URI=mongodb://127.0.0.1:27017/sutie_test REDIS_TEST_URL=redis://127.0.0.1:6379 npm run test:integration
  ```
  `tests/integration/session-revocation.test.ts` (thu hồi phiên khi đăng xuất, og-image không lộ chương khóa) cần thêm Redis (`REDIS_TEST_URL`) và dùng database riêng `<tên>_revocation`; thiếu Redis thì file đó được bỏ qua.
  `src/lib/ogCover.test.ts`: chọn ảnh bìa công khai; `src/lib/imageIds.test.ts`: gom id ảnh.
  `tests/integration/phase-b.test.ts`: tra ảnh bằng index `imageIds` (không `$regex`), backfill, bookmark gọn, thu hồi token bền vững trong MongoDB, tag bằng `updateMany`, xóa cache phiên theo người dùng (phần này cần Redis); dùng database riêng `<tên>_phaseb`.
  `tests/integration/lazy-chapters.test.ts`: `GET /api/posts/[id]/chapters/[n]` (quyền theo chương, URL ảnh qua `/api/image`) và `GET /api/posts/[id]?lite=1`; database riêng `<tên>_lazy`.
  ⚠️ Database trong `MONGODB_TEST_URI` bị xóa sau khi chạy — chỉ dùng database dành riêng cho test.

> Lưu ý: một số test cũ trong `security.test.ts` mô phỏng lại logic nội tuyến thay vì gọi mã thật. Khi sửa tính năng bảo mật, hãy thêm test gọi route/hàm thật.

### Lệnh chạy kiểm thử:
```bash
npm test
```
* **Tiêu chuẩn nghiệm thu**: Toàn bộ **181 tests** (và 40 tests tích hợp khi có MongoDB + Redis test) phải đạt trạng thái **PASS 100%**. Nếu có bất kỳ test nào fail, Agent phải sửa chữa ngay lập tức trước khi thông báo hoàn tất.

---

## 2. Kiểm Tra Biên Dịch & Đóng Gói (Build Verification)

Sau khi các bài test đã pass, Agent phải xác nhận mã nguồn không bị lỗi TypeScript hoặc lỗi tĩnh:
```bash
npm run build
```
* Đảm bảo không phát sinh lỗi kiểu (Type errors) hay lỗi cấu trúc Route của Next.js Turbopack.

---

## 3. Hệ Thống Giám Sát & Báo Cáo Lỗi (Telegram Logger)

Khi viết API Routes (`route.ts`) hoặc xử lý ngoại lệ nghiệp vụ quan trọng:
* **Bắt buộc log lỗi về Telegram**:
  ```typescript
  import { logApiError } from '@/lib/telegramLogger';

  try {
    // Logic xử lý
  } catch (error) {
    void logApiError({
      module: '[METHOD] /api/your-endpoint',
      error,
      request,
      statusCode: 500,
    });
    return NextResponse.json({ error: 'Đã xảy ra lỗi' }, { status: 500 });
  }
  ```
* **Không spam lỗi người dùng bình thường**:
  * Các mã lỗi 400 (Bad Request), 401 (Unauthorized), 404 (Not Found) do người dùng nhập sai không gửi về Telegram.
  * Chỉ gửi khi xảy ra lỗi 500 (Internal Server Error), lỗi crash ứng dụng trong `src/app/error.tsx` hoặc đứt kết nối cơ sở dữ liệu MongoDB trong `src/lib/db.ts`.

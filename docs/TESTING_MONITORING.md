# 🧪 Quy Trình Kiểm Thử & Giám Sát Lỗi (Testing & Monitoring)

> **Cảnh báo dành cho AI Agent**: Trước khi bàn giao bất kỳ tính năng hoặc sửa lỗi nào, Agent **bắt buộc phải thực hiện đầy đủ quy trình kiểm thử** được nêu trong tài liệu này.

---

## 1. Bộ Kiểm Thử Bảo Mật & Ràng Buộc Schema (105 Tests)

Dự án sở hữu bộ **105 bài kiểm thử tự động** bao phủ toàn diện các ranh giới an toàn:
* `src/lib/security.test.ts`: Kiểm thử chống timing attacks, rate limiting, xáo trộn ảnh Scramble, ký số URL, bypass tham số `pre_scrambled`, mở khóa mã PIN.
* `src/lib/permissions.test.ts`: Kiểm thử quyền hạn xem truyện, đọc chương phân lập, chia sẻ email độc giả, thu hồi quyền Admin.
* `src/models/roles.test.ts`: Kiểm thử ràng buộc schema User, Role, Post, DeletedAccount.

### Lệnh chạy kiểm thử:
```bash
npm test
```
* **Tiêu chuẩn nghiệm thu**: Toàn bộ **105 tests** phải đạt trạng thái **PASS 100%**. Nếu có bất kỳ test nào fail, Agent phải sửa chữa ngay lập tức trước khi thông báo hoàn tất.

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

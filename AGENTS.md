# 🤖 Hướng Dẫn & Quy Định Bắt Buộc Dành Cho AI Agent (Lubu Corp / Sutie Reader)

> **CHỈ THỊ QUAN TRỌNG DÀNH CHO AI CODING ASSISTANT / AGENT**:  
> Dự án này áp dụng các tiêu chuẩn kiến trúc hiện đại (Next.js 16, React 19) và cơ chế bảo vệ bản quyền số độc quyền rất nghiêm ngặt. Trước khi bắt đầu thực hiện bất kỳ tác vụ nào, bạn **BẮT BUỘC PHẢI ĐỌC CÁC TÀI LIỆU TƯƠNG ỨNG TRONG THƯ MỤC `docs/`**:

---

## 📚 Danh Mục Tài Liệu Bắt Buộc Đọc (Mandatory Reading)

Trước khi chỉnh sửa hoặc tạo mới bất kỳ mã nguồn nào, Agent phải đọc các tài liệu sau theo phạm vi công việc:

| Tài Liệu Hướng Dẫn | Khi Nào Bắt Buộc Phải Đọc? | Tóm Tắt Nội Dung Cần Nắm |
| :--- | :--- | :--- |
| 📘 **[docs/NEXTJS16_CONVENTIONS.md](docs/NEXTJS16_CONVENTIONS.md)** | Khi thao tác với **Routing, Middleware, Layouts, Server Components hoặc Next.js Config**. | • Bắt buộc dùng `proxy.ts` (tại `src/proxy.ts`), **tuyệt đối không** tạo lại `middleware.ts`.<br>• Quy tắc phân định Server Components vs Client Components (`'use client'`).<br>• Các Breaking Changes của Next.js 16.3.5. |
| 🛡️ **[docs/SECURITY_RULES.md](docs/SECURITY_RULES.md)** | Khi thao tác với **Xử lý ảnh, API Endpoints, Phân quyền, Đăng nhập/Đăng ký hoặc Token**. | • Cơ chế mã hóa xáo trộn ảnh Scramble Canvas chống leech truyện.<br>• Ký số HMAC Signed URL (TTL 120s) qua Cloudflare Worker.<br>• Phân quyền RBAC đa cấp (`admin`, `user`, `guest`) cho Truyện và từng Chương.<br>• Chống Brute-force và Timing Attack (`crypto.timingSafeEqual`). |
| 🧪 **[docs/TESTING_MONITORING.md](docs/TESTING_MONITORING.md)** | **BẮT BUỘC TRƯỚC KHI KẾT THÚC BẤT KỲ TÁC VỤ NÀO** hoặc khi xử lý ngoại lệ/lỗi. | • Quy trình kiểm thử: Bắt buộc chạy `npm test` và phải **Pass 100% toàn bộ 105 bài kiểm thử**.<br>• Kiểm tra đóng gói `npm run build` không lỗi TypeScript.<br>• Quy ước báo cáo lỗi hệ thống về Telegram Bot qua `telegramLogger.ts`. |
| 🎨 **[docs/UI_DESIGN_SYSTEM.md](docs/UI_DESIGN_SYSTEM.md)** | Khi thao tác với **Giao diện người dùng, Components, CSS, Icons, Bố cục hoặc Trải nghiệm đọc**. | • Hệ thống thiết kế Apple Minimalist, bảng màu OKLCH Dark/Light, font SF Pro Display.<br>• Quy cách thẻ truyện `PostCard` tỉ lệ 3:4, thanh cuộn truyện Webtoon.<br>• Trạng thái hệ thống (Skeleton loader, 404, màn hình mở khóa PIN, dialogs). |
| 🔑 **[oauth2_instructions.md](oauth2_instructions.md)** | Khi cấu hình hoặc nâng cấp luồng lưu trữ ảnh **Google Drive OAuth 2.0**. | • Hướng dẫn tạo Client ID, Client Secret, cấp quyền scope `drive` và lấy Refresh Token. |

---

## ⚡ Nguyên Tắc Bất Di Bất Dịch Khi Làm Việc

1. **Không hạ thấp tiêu chuẩn bảo mật**: Tuyệt đối không tạo endpoint public để lấy ảnh gốc chưa xáo trộn hoặc bỏ qua kiểm tra quyền truy cập.
2. **Không tự ý đổi quy ước**: Giữ nguyên quy ước `proxy.ts`, không sửa thành `middleware.ts`.
3. **Quy trình nghiệm thu bắt buộc**: Trước khi bàn giao kết quả cho người dùng, Agent phải:
   * Chạy `npm test` (Đạt 105/105 tests).
   * Chạy `npm run build` (Biên dịch sạch sẽ 0 lỗi).

---

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

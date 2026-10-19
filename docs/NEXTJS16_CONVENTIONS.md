# ⚠️ Hướng Dẫn & Quy Ước Next.js 16 (Lubu Corp)

> **Cảnh báo dành cho AI Agent**: Dự án đang vận hành trên **Next.js 16.3.5**. Phiên bản này có nhiều **Breaking Changes** so với dữ liệu huấn luyện truyền thống. Hãy đọc kỹ các quy ước dưới đây trước khi viết bất kỳ đoạn code nào.

---

## 1. Quy Ước Bắt Buộc: `proxy.ts` Thay Thế `middleware.ts`

* **Vị trí**: Đặt duy nhất tại `src/proxy.ts` (hoặc root nếu không có `src`).
* **Cú pháp hàm**:
  ```typescript
  import { NextResponse } from 'next/server';
  import type { NextRequest } from 'next/server';

  export async function proxy(request: NextRequest) {
    // Logic xử lý request proxy
    return NextResponse.next();
  }

  export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
  };
  ```
* **Quy tắc tuyệt đối**: **KHÔNG ĐƯỢC ĐỔI TÊN** tệp này thành `middleware.ts`. Next.js 16 trong dự án này nhận diện `proxy.ts` là Middleware chính thức.

---

## 2. Server Components vs Client Components

* **Mặc định Server Components**:
  * Tất cả các file `page.tsx`, `layout.tsx` trong `src/app/` mặc định là **React Server Components (RSC)**.
  * Ưu tiên thực hiện truy vấn cơ sở dữ liệu (MongoDB), kiểm tra quyền bằng `getCurrentUser()` và xử lý dữ liệu nặng trực tiếp trên server để giảm dung lượng bundle client.
* **Chỉ thị `'use client'`**:
  * Chỉ thêm `'use client'` khi component thực sự cần:
    * React Hooks (`useState`, `useEffect`, `useCallback`, `useRef`, `useContext`).
    * Lắng nghe sự kiện người dùng (`onClick`, `onChange`, `onSubmit`).
    * Tương tác với Web API trình duyệt (Canvas 2D context, LocalStorage, Audio, Video).
  * Giữ component `'use client'` ở mức lá (leaf components), truyền dữ liệu đã được tính toán từ Server Component xuống dưới dạng props.

---

## 3. Server Actions & Form Handling

* Thao tác gửi dữ liệu nhạy cảm hoặc thay đổi trạng thái có thể sử dụng Server Actions với chỉ thị `'use server'`.
* Định dạng giới hạn payload đã được tối ưu hóa trong `next.config.ts`:
  ```typescript
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  }
  ```

---

## 4. Tài Liệu Hướng Dẫn Chi Tiết Cục Bộ

Khi cần tra cứu các API chuyên sâu hoặc tính năng mới của Next.js 16, hãy đọc trực tiếp tài liệu đính kèm sẵn trong thư mục nội bộ:
📁 `node_modules/next/dist/docs/`
* `01-app/03-api-reference/03-file-conventions/proxy.md`: Tài liệu hướng dẫn chính thức về `proxy.ts`.
* `01-app/02-guides/upgrading/version-16.md`: Toàn bộ các thay đổi phá vỡ tính tương thích của phiên bản 16.

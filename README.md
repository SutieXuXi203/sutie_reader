# Blog Của Tôi - Nền Tảng Chia Sẻ Ảnh Câu Chuyện

Một ứng dụng blog hiện đại để chia sẻ những hình ảnh câu chuyện với giao diện đẹp và hỗ trợ chế độ tối. Được xây dựng bằng Next.js, MongoDB, Tailwind CSS, và shadcn/ui.

## Các Tính Năng

- 📸 **Tải Lên Nhiều Hình Ảnh** - Đăng câu chuyện với nhiều hình ảnh
- 🌙 **Chế Độ Tối** - Hỗ trợ chủ đề tối đẹp với next-themes
- 💾 **Backend MongoDB** - Lưu trữ dữ liệu liên tục với MongoDB
- 🎨 **Giao Diện Hiện Đại** - Được xây dựng bằng các thành phần shadcn/ui và Tailwind CSS
- ⚡ **Nhanh Chóng và Phản Hồi** - Kết xuất phía máy chủ với Next.js
- 📝 **Tạo Bài Viết Phong Phú** - Thêm tiêu đề, mô tả và nội dung
- 🗑️ **Quản Lý Dễ Dàng** - Xóa bài viết với xác nhận

## Bắt Đầu

### Yêu Cầu
- Node.js 20.15.1+
- MongoDB (cục bộ hoặc Atlas)

### Cài Đặt

1. Cài đặt các phụ thuộc:
```bash
npm install
```

2. Tạo `.env.local`:
```bash
cp .env.example .env.local
```

3. Đặt MongoDB URI của bạn trong `.env.local`:
```
MONGODB_URI=mongodb://localhost:27017/sutie_archive
```

### Chạy Máy Chủ Phát Triển
```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000) để xem blog của bạn.

## Ngăn Xếp Công Nghệ

- **Frontend**: Next.js 16+, React 19+, TypeScript
- **Kiểu Dáng**: Tailwind CSS v4, shadcn/ui
- **Chủ Đề**: next-themes cho chế độ tối
- **Cơ Sở Dữ Liệu**: MongoDB với Mongoose
- **Icons**: Lucide React

## Cấu Trúc Dự Án

- `src/app/` - Thư mục ứng dụng Next.js
- `src/components/` - Các thành phần React (Giao diện & tính năng)
- `src/lib/` - Các hàm tiện ích và kết nối DB
- `src/models/` - Lược đồ MongoDB
- `src/providers/` - Nhà cung cấp ngữ cảnh (chủ đề)
- `src/app/api/posts/` - Các tuyến API

## Các Tính Năng

### Tải Lên Hình Ảnh
- Tải lên tới 10 hình ảnh trên mỗi bài viết
- Mã hóa Base64 để lưu trữ
- Xem trước hình ảnh với điều hướng

### Chế Độ Tối
- Phát hiện tự động tùy chọn hệ thống
- Nút chuyển đổi thủ công
- Chuyển đổi mượt mà

### Quản Lý Bài Viết
- Tạo, xem và xóa bài viết
- Tích hợp MongoDB đầy đủ
- Thiết kế phản hồi

## Xây Dựng & Triển Khai

```bash
npm run build
npm run start
```

## Giấy Phép

MIT

# sutie_reader

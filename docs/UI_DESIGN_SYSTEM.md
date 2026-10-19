# 🎨 Tài Liệu Thiết Kế Giao Diện & Trải Nghiệm Người Dùng (UI/UX Specification)

> **Lubu Corp (Sutie Reader)** được xây dựng theo phong cách hiện đại, tối giản và cao cấp (Apple Minimalist Aesthetics). Tài liệu này mô tả chi tiết toàn bộ hệ thống thiết kế (Design System), các thành phần giao diện, luồng tương tác và trạng thái hiển thị của ứng dụng.

---

## 🌈 1. Hệ Thống Thiết Kế Cốt Lõi (Core Design System)

### 1.1. Kiểu Chữ (Typography)
* **Font chữ chủ đạo**: **SF Pro Display** (Font độc quyền của Apple), hỗ trợ đầy đủ 9 trọng số (Thin, UltraLight, Light, Regular, Medium, SemiBold, Bold, Heavy, Black Italic) qua biến CSS `--font-sans`.
* **Cấp bậc văn bản (Hierarchy)**:
  * `Heading 1` (`text-2xl sm:text-3xl font-extrabold`): Tiêu đề trang, tên truyện lớn.
  * `Heading 2` (`text-lg sm:text-xl font-bold`): Tiêu đề chương, nhóm danh mục.
  * `Body` (`text-sm sm:text-base`): Nội dung mô tả, phụ đề, nội dung tiểu thuyết.
  * `Caption / Badges` (`text-xs font-semibold`): Nhãn thể loại (Tag), số chương, ngày tháng.

### 1.2. Bảng Màu (Color Palette)
Hệ thống sử dụng không gian màu hiện đại **OKLCH** với khả năng chuyển đổi liền mạch giữa 2 giao diện Sáng / Tối:
* **Background / Foreground**: 
  * *Light mode*: Nền trắng tinh khiết `oklch(1 0 0)`, chữ đen xám `oklch(0.145 0 0)`.
  * *Dark mode*: Nền đen tuyền siêu sâu `oklch(0.145 0 0)`, chữ trắng dịu mắt.
* **Primary (Màu điểm nhấn)**: Gam màu tím chuyển sắc hiện đại (`oklch(0.6 0.22 275)`), áp dụng cho các nút hành động chính, thanh tiến trình cuộn và viền hiệu ứng.
* **Card & Popover**: Khối hộp nổi bo tròn với lớp nền mờ đục nhẹ nhàng, bóng đổ mềm (`shadow-xs` đến `shadow-md`).

### 1.3. Lớp Nền Chiều Sâu (Background Ambiance)
Toàn bộ website được bao phủ bởi 3 lớp hiệu ứng nền cố định (Fixed Background Layers) trong [src/app/layout.tsx](../src/app/layout.tsx):
1. **Lưới chấm tròn (Radial Dot Matrix)**: Kích thước `28px x 28px` với độ trong suốt tinh tế (4% trong Dark mode, 6% trong Light mode).
2. **Lưới kẻ ô công nghệ (Tech Grid Lines)**: Kích thước `180px x 180px` tạo cảm giác khối không gian 3 chiều.
3. **Mặt nạ chuyển sắc (Vignette Gradient)**: Giảm dần độ sáng về cuối trang để tập trung ánh nhìn vào vùng đọc trung tâm.

---

## 🧭 2. Thành Phần Bố Cục Toàn Trang (Global Layout)

### 2.1. Thanh Điều Hướng Trên Cùng (SiteNav - Header)
* **Vị trí**: Cố định ở đầu trang (`fixed top-0 inset-x-0 h-14 z-40`) với hiệu ứng làm mờ kính áp tròng (`backdrop-blur-md bg-background/80 border-b border-border/50`).
* **Các thành phần tích hợp**:
  * **Logo & Tên thương hiệu**: Logo Lubu Corp tròn trịa bo góc, bấm vào để quay về Trang chủ.
  * **Thanh tiến trình cuộn trang (`ScrollProgress`)**: Một vạch màu tím gradient mảnh `2.5px` nằm sát đáy Header, co giãn theo chiều dọc cuộn trang của người đọc (`framer-motion` scaleX).
  * **Bộ chuyển đổi giao diện (`ThemeToggle`)**: Nút chuyển đổi nhanh Dark / Light mode kèm hiệu ứng xoay icon mặt trời / mặt trăng.
  * **Nút Xác thực / Người dùng**:
    * *Khi chưa đăng nhập*: Hiển thị nút "Đăng nhập" dạng viền neon, mở hộp thoại `AuthDialog`.
    * *Khi đã đăng nhập*: Hiển thị Avatar tròn của người dùng, tên hiển thị và huy hiệu vai trò (`Admin`, `User`, `Guest`). Bấm vào để mở bảng hồ sơ cá nhân hoặc menu quản trị.

### 2.2. Chân Trang (Footer)
* Bố trí ở cuối trang web, hiển thị thông tin bản quyền © Lubu Corp, đường dẫn tới trang Liên hệ / Báo lỗi (`/contact`) và khẩu hiệu nền tảng.

---

## 🏠 3. Giao Diện Trang Chủ (Homepage - `HomeClient.tsx`)

Trang chủ là trung tâm khám phá truyện với khả năng tương tác mượt mà:

1. **Thanh Tìm Kiếm Thông Minh (Search Bar)**:
   * Tự động lọc theo thời gian thực (Debounced input), hỗ trợ tìm kiếm Tiếng Việt không dấu (`normalizeSearchText`).
   * Tích hợp nút xóa nhanh (`X`) khi có nội dung tìm kiếm.
2. **Bộ Sắp Xếp Nhanh (Sort Dropdown)**:
   * Hỗ trợ 5 chế độ: Mới nhất (`Sparkles`), Gần đây (`Clock`), Cũ nhất (`Calendar`), Tên A-Z, Tên Z-A.
3. **Thanh Cuộn Thể Loại (Tag Filter Pills)**:
   * Băng chuyền ngang chứa các huy hiệu thể loại (All, Action, Manhwa, Romance, Sci-fi,...).
   * Thể loại đang chọn có màu nền Primary nổi bật; người dùng có thể nhấp chọn để lọc catalog ngay lập tức.
4. **Nút Ẩn / Mờ Ảnh Bìa (`ThumbnailBlurToggle`)**:
   * Tính năng độc đáo cho phép người dùng bật chế độ làm mờ toàn bộ ảnh bìa truyện trên trang chủ (bảo vệ quyền riêng tư khi đọc ở nơi công cộng / công sở).
5. **Lưới Thẻ Truyện (PostCard Grid)**:
   * **Bố cục Responsive**: 2 cột (Mobile) ➔ 3 cột (Tablet) ➔ 4-6 cột (Desktop / Màn hình siêu rộng).
   * **Thẻ Truyện (`PostCard.tsx`)**:
     * Tỉ lệ ảnh bìa chuẩn Manga/Webtoon: **`3:4`**.
     * Hiệu ứng vệt sáng kim loại (`GlareHover.tsx`): Khi rê chuột vào ảnh bìa, một vệt sáng ánh bạc lướt qua mượt mà.
     * Huy hiệu số chương: Góc trên ảnh bìa hiển thị số chương hiện có (VD: `Chương 10`).
     * Huy hiệu phân quyền: Thể hiện rõ truyện là `Công khai`, `Giới hạn`, hoặc `Được chia sẻ với bạn`.
     * Tiêu đề truyện: Tối đa 2 dòng, tự động cắt ngắn với dấu `...` nếu quá dài.

---

## 📖 4. Giao Diện Đọc Truyện (Reader Page - `/posts/[id]`)

Trang đọc truyện được thiết kế chuyên biệt để mang lại trải nghiệm đọc truyện tranh và tiểu thuyết liền mạch:

### 4.1. Phần Thông Tin Đầu Truyện (Story Header)
* Ảnh bìa lớn, tên truyện, tác giả, dịch giả (Translator), tóm tắt cốt truyện và các thẻ thể loại (Tags).
* Nút "Đọc từ đầu" hoặc "Đọc tiếp" chương mới nhất.
* Nút "Đánh dấu" (Bookmark) lưu truyện vào danh sách yêu thích.
* Nút "Chia sẻ" (Mở `ShareDialog` cho chủ sở hữu/Admin).

### 4.2. Khu Vực Hiển Thị Nội Dung Đọc (Reader Viewport)
* **Chế độ cuộn dọc liên tục (Continuous Vertical Scroll)**: Khoảng cách giữa các trang tranh bằng 0 hoặc có khoảng giãn nhỏ tùy chỉnh, giúp đọc lướt liền mạch như Webtoon Hàn Quốc.
* **Thành phần giải mã Scramble Canvas (`ScrambledCanvas.tsx`)**:
  * Mỗi trang ảnh được tải về dưới dạng mã hóa; Canvas tự động tính toán toạ độ các mảnh lưới pixel và tái tạo lại ảnh gốc với độ sắc nét tuyệt đối (hỗ trợ màn hình Retina 2x).
  * Trong lúc ảnh đang tải/giải mã: Hiển thị bộ khung làm mờ và vòng xoay loading spinner tím sang trọng.
* **Tối ưu hiệu năng tải ảnh**: Tự động nạp trước (preload) 5 trang đầu tiên và mở rộng lề cuộn (lazy-load margin) lên 2400px để người đọc không phải chờ tải ảnh khi cuộn nhanh.

### 4.3. Thanh Điều Khiển Nổi Đáy Trang (Floating Reader Bar)
* Tự động ẩn khi cuộn xuống để mở rộng tầm nhìn, hiện lại khi cuộn ngược lên hoặc rê chuột.
* Nút lùi về "Chương trước" (Previous Chapter) và tiến tới "Chương sau" (Next Chapter).
* Dropdown menu chọn nhanh danh sách toàn bộ các chương.
* Nút điều chỉnh độ rộng khung ảnh: Co giãn vừa màn hình (Fit Width) hoặc Giữ kích thước gốc.

### 4.4. Màn Hình Kết Thúc Chương (End-of-Reading Screen)
* Khi người đọc cuộn tới đáy trang cuối cùng của chương:
  * Khung cảm ơn người đọc tinh tế.
  * Thông tin chi tiết về **Tác giả** và **Nhóm dịch / Dịch giả** thực hiện chương truyện này.
  * Nút to nổi bật chuyển tiếp sang chương kế tiếp chỉ với 1 cú nhấp.

---

## 👑 5. Giao Diện Quản Trị Viên (Admin Dashboard - `/admin`)

Dành riêng cho tài khoản có vai trò `admin`, bố cục chia thành các tab quản lý chuyên sâu:

1. **Tab Quản lý Truyện (Comics & Stories)**:
   * Danh sách truyện dạng bảng có phân trang, tìm kiếm và lọc theo thể loại.
   * Form tạo mới / chỉnh sửa truyện ([CreatePostForm.tsx](../src/components/CreatePostForm.tsx), [EditPostForm.tsx](../src/components/EditPostForm.tsx)): Nhập tên, tác giả, dịch giả, tải ảnh bìa, chỉnh sửa tags.
   * Trình quản lý chương truyện: Thêm chương, sắp xếp thứ tự chương, upload hàng loạt ảnh chương lên Google Drive thông qua Cloudflare Worker, thiết lập phân quyền cho từng chương (`inherit`, `restricted`, `public`).
2. **Tab Quản lý Thành viên (User Management)**:
   * Danh sách tài khoản người dùng, hiển thị email, ngày tạo, trạng thái xác thực OTP.
   * Bộ chọn phân quyền nhanh ([UserRoleSelect.tsx](../src/components/UserRoleSelect.tsx)): Thay đổi vai trò giữa `admin`, `user`, `guest` ngay trên bảng dữ liệu.
3. **Tab Quản lý Chia sẻ (Share & Permissions)**:
   * Xem và quản lý các quyền đọc truyện đã được chia sẻ cho từng người dùng qua email.
4. **Tab Thống Kê & Lưu Trữ**:
   * Theo dõi danh sách độc giả đã truy cập link truyện (`accessedUsers`).
   * Kho lưu trữ tài khoản đã xóa ([DeletedAccount.ts](../src/models/DeletedAccount.ts)) phục vụ mục đích kiểm toán an ninh.

---

## 💬 6. Các Hộp Thoại Tương Tác (Modals & Dialogs)

* **Hộp thoại Đăng nhập / Đăng ký (`AuthDialog.tsx`)**:
  * Chuyển đổi tab mượt mà giữa "Đăng nhập", "Đăng ký tài khoản" và "Quên mật khẩu".
  * Giao diện nhập mã OTP xác thực email 6 ô số tự động nhảy con trỏ chuột sang ô kế tiếp.
* **Hộp thoại Hồ sơ cá nhân (`ProfileDialog.tsx`)**:
  * Đổi tên hiển thị, cập nhật mật khẩu mới.
  * Tích hợp công cụ tải và cắt xén ảnh đại diện tròn theo tỉ lệ 1:1 (`react-easy-crop`).
* **Hộp thoại Chia sẻ Quyền đọc (`ShareDialog.tsx`)**:
  * Cho phép chủ sở hữu nhập email người xem để cấp quyền truy cập vào truyện hoặc chương bị khóa.
  * Hiển thị danh sách người đang có quyền truy cập kèm nút thu hồi quyền một chạm.
* **Thanh Tiến Trình Tải Lên (`UploadProgressWidget.tsx`)**:
  * Khung widget nổi thu nhỏ ở góc màn hình, hiển thị tiến độ % upload ảnh chương truyện lên Google Drive theo thời gian thực mà không làm gián đoạn việc duyệt web.

---

## 🚨 7. Các Trạng Thái Đặc Biệt (System States)

* **Trang Mở Khóa Bằng Mã PIN (`/unlock`)**:
  * Giao diện bảo mật toàn trang với ô nhập mã PIN 6 số.
  * Hỗ trợ bàn phím ảo số trên màn hình cảm ứng hoặc phím số vật lý trên bàn phím máy tính.
  * Hiệu ứng rung lắc toàn bộ khung nhập (GSAP Shake Animation) khi nhập sai mã PIN.
* **Trang Báo Lỗi 404 (`not-found.tsx`)**:
  * Biểu tượng sách mở với huy hiệu 404 gradient.
  * Thông điệp giải thích thân thiện và hai nút bấm nhanh quay về **Trang chủ** hoặc **Gửi báo lỗi / Liên hệ**.
* **Giao Diện Chờ Tải Trang (`loading.tsx`)**:
  * Khung xương xám (Skeleton) chớp tắt nhịp nhàng (Shimmering pulse), tái hiện bố cục thanh tìm kiếm và các thẻ truyện 3:4.
* **Trang Báo Lỗi Sự Cố (`error.tsx` & `global-error.tsx`)**:
  * Tự động gửi toàn bộ stack trace và ngữ cảnh lỗi về Telegram Bot của Admin để xử lý ngay lập tức, đồng thời cung cấp nút "Thử lại" cho người dùng.

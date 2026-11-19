# 🐾 Tài Liệu Cập Nhật Giao Diện Màn Hình Đăng Nhập (Login Screen Specification)

> **Nhánh thực hiện**: `feat/login-screen`  
> **Thành phần chính**: `AuthDialog.tsx`  
> **Tài nguyên đồ họa**: Thư mục ảnh `images_login`  
> **Ngày cập nhật**: 19/11/2026  
> **Trạng thái**: Đã hoàn thiện, kiểm thử tự động đạt 214/214 tests, đóng gói build production sạch 0 lỗi.

---

## 🎯 1. Tổng Quan & Mục Tiêu Cải Tiến

Màn hình Đăng nhập (`AuthDialog.tsx`) là điểm chạm đầu tiên trong trải nghiệm định danh người dùng tại **Lubu Corp (Sutie Reader)**. Bản cập nhật này hướng tới 3 mục tiêu cốt lõi:

1. **Chuẩn hóa nhận diện thị giác (UI Design System Consistency)**:
   - Giữ vững ngôn ngữ thiết kế **Apple Minimalist Aesthetics**, hệ màu không gian **OKLCH**, font chữ **SF Pro Display**.
   - Bảo toàn bán kính bo góc chuẩn hệ thống `rounded-[8px]` trên nút hành động, đồng bộ với các trường nhập liệu (`Input`), thẻ truyện (`PostCard`) và khung hộp thoại (`Dialog`).

2. **Bổ sung tương tác sinh động (Micro-interactions)**:
   - Linh vật (`half_head_trimmed.png`) cùng đôi bàn tay mèo (`cat_two_paws.png`) ló lên từ sau nút Đăng nhập khi rê chuột.
   - Nhập sai / để trống: linh vật **cộc đầu** vào ô Mật khẩu rồi thụt xuống. Nhập đúng: linh vật **ngửa đầu phá vỡ** lần lượt ô Mật khẩu và ô Email trước khi vào ứng dụng (chi tiết tại §4).

3. **Tối ưu hóa đa thiết bị (Responsive Execution)**:
   - Tỉ lệ hiển thị cân đối hoàn hảo trên cả màn hình di động nhỏ hẹp (Mobile `< 640px`) và máy tính để bàn (Desktop `≥ 640px`).

---

## 🎨 2. Quy Chuẩn Nút Bấm & Bố Cục Hộp Thoại

### 2.1. Quy cách Nút Đăng nhập (`Button`)
* **Bo góc**: `rounded-[8px]` (loại bỏ kiểu `rounded-full` để tránh xung đột với phong cách tối giản thanh lịch của dự án).
* **Kích thước**:
  * *Mobile*: Chiều cao `h-9` (36px), chữ `text-sm font-medium`.
  * *Desktop*: Chiều cao `sm:h-10` (40px), chữ `text-sm font-medium`.
* **Chiều rộng & Đổ bóng**: `w-full shadow-lg`, hiệu ứng tương phản cao trong cả Light Mode và Dark Mode.
* **Trạng thái Loading**: Khi đang gửi yêu cầu xác thực, nút hiển thị spinner quay vòng `Loader2` (`animate-spin w-5 h-5`).

### 2.2. Quy cách Khung Hộp Thoại (`DialogContent`) & Lớp Nền (`DialogOverlay`)
* **Độ co giãn**: `sm:max-w-md max-h-[90vh] sm:max-h-[85vh]`.
* **Khoảng cách lề (Padding)**: `p-4 sm:p-6`.
* **Thanh cuộn thông minh**: `overflow-y-auto overscroll-contain custom-scrollbar`.
* **Nền & Viền**: `bg-transparent border-0 ring-0 shadow-none` kết hợp cùng các lớp hiệu ứng nền toàn trang (Dot Matrix & Tech Grid).
* **Lớp phủ nền tương phản cao (`overlayClassName`)**: `bg-white/95 dark:bg-black/75 backdrop-blur-md`
  * *Light Mode*: Nền sáng trắng trang nhã, họa tiết caro tím và lưới công nghệ hiển thị nổi bật, chữ và các ô nhập liệu sắc nét tuyệt đối.
  * *Dark Mode*: Nền đen tuyền sâu thẳm nguyên bản.
* **Ô nhập liệu (`Input`)**: Áp dụng `bg-white/80 dark:bg-transparent shadow-xs` tạo khối trường nhập rõ nét, dễ đọc trên cả 2 giao diện.

### 2.3. Nút Chuyển Đổi Theme (`ThemeToggle`)
* **Vị trí**: Đặt tại góc trên bên phải màn hình thông qua cổng `topActions` (`fixed top-4 right-4 sm:top-5 sm:right-6 z-50`). Không đặt chen chúc trong khung form, giữ trọn vẹn sự cân đối và tập trung cho tiêu đề ở trung tâm.
* **Phong cách hiển thị (Không viền & Không nền hover - Pure Borderless)**: Sử dụng `variant="ghost"` và `border-0 ring-0 shadow-none bg-transparent hover:bg-transparent dark:hover:bg-transparent text-foreground cursor-pointer`, loại bỏ hoàn toàn viền và nền khi hover, chỉ giữ lại chuyển động xoay thanh thoát của biểu tượng Sun / Moon.
* **Cơ chế hoạt động**: Sử dụng `ThemeToggle` tích hợp hiệu ứng chuyển cảnh mặt nạ vòng tròn (*Circular Mask Transition* theo chuẩn Motion Prompt #017 qua View Transitions API), cho phép chuyển đổi tức thì giữa chế độ Sáng (Light Mode) và Tối (Dark Mode) mà không cần đóng hộp thoại.
* **Ngăn chặn lan truyền sự kiện**: Tích hợp `e.stopPropagation()` và khai báo `type="button"` rõ ràng nhằm tránh xung đột với sự kiện đóng modal hay submit form.

---

## 🐾 3. Kiến Trúc Minh Họa Linh Vật & Đôi Bàn Tay (Mascot & Cat Paws Architecture)

### 3.1. Danh mục Tài nguyên Đồ họa
* **`half_head.png` / `half_head_trimmed.png`**:
  * Độ phân giải: `1476px x 811px` (tỉ lệ chuẩn `1.82:1`).
  * Đặc điểm: Nửa trên khuôn mặt chú rồng/mèo lông trắng tai hồng, sừng đen, đôi mắt anime long lanh với mép đáy được cắt phẳng tuyệt đối để nhô lên từ phía dưới viền nút Đăng nhập.
* **`cat_two_paws.png`**:
  * Độ phân giải: `647px x 136px`.
  * Trích xuất nguyên bản từ bộ ảnh gốc `cat_foot.png`, gồm đầy đủ 2 bàn tay mèo cân đối, đệm thịt hồng bám chặt trên mép trên nút.
* **`cat_foot.png` / `cat_foot_v2.png`**: Bộ ảnh gốc độ phân giải cao `1024x176` chứa 2 bàn chân mèo.

### 3.2. Giải phẫu học Tọa độ Bám Viền (Anatomy & Positioning)
Toàn bộ cụm nhân vật gồm Đầu (`half_head_trimmed.png`) và Đôi bàn tay (`cat_two_paws.png`) nằm tại **tâm ngang** của nút Đăng nhập:

```
                            [Đầu Nhân Vật - half_head_trimmed.png]
                                 (Nhô lên từ phía sau nút)
                                      ╭────────────╮
                                     (   ʘ      ʘ   )
                          [Đôi Bàn Tay Mèo - cat_two_paws.png]
                                ( ฅ              ฅ )
           ╭───────────────────────────────────────────────────────╮
           │                                                       │
           │                       ĐĂNG NHẬP                       │
           │                                                       │
           ╰───────────────────────────────────────────────────────╯
```

| Thành phần | Thuộc tính CSS (Mobile) | Thuộc tính CSS (Desktop `≥ 640px`) | Cơ chế hiển thị |
| :--- | :--- | :--- | :--- |
| **Đầu nhân vật** (`half_head`) | `w-[130px] mx-auto` trong `.mascot-stage` (`bottom-full`) | `sm:w-[150px]` | Bị cắt tại mép trên nút, ló lên khi rê chuột, cộc đầu khi sai hoặc ngửa hết lên phá 2 ô input khi đúng. |
| **Đôi bàn tay** (`cat_two_paws`) | `w-[110px] -top-[14px] left-1/2` | `sm:w-[130px] sm:-top-[16px]` | Móc sâu 9–11px qua mép trên, móng vuốt và đệm thịt hồng đặt tự nhiên trên viền nút. |

---

## ⚡ 4. Kịch Bản Chuyển Động & Hoạt Họa Vật Lý (Mascot Physical Dynamics)

### 4.0. Sân khấu & Đo toạ độ động (`.mascot-stage`)
* Đầu nhân vật nằm trong một "sân khấu" có đáy trùng **mép trên nút Đăng nhập**, chỉ bị cắt cạnh dưới (`clip-path: inset(-400px -400px 0 -400px)`) ⇒ đầu luôn trông như **trồi lên từ phía sau/dưới nút**, mép cắt phẳng của ảnh không bao giờ lộ ra.
* `measureMascot()` đo khoảng cách thật (chia theo tỉ lệ scale của hộp thoại) và ghi vào biến CSS:
  * `--mascot-hide`: vị trí ẩn hoàn toàn sau nút.
  * `--mascot-peek`: ló sừng/tai, chừa khe ~8px dưới ô Mật khẩu.
  * `--mascot-contact`: đỉnh đầu chạm đúng đáy ô Mật khẩu (trần).
  * `--mascot-burst-scale`: hệ số phình để đỉnh đầu vượt qua đỉnh ô Email.
* Đo lại khi mở hộp thoại, khi rê chuột vào nút, khi kích thước thay đổi (`ResizeObserver`) và ngay trước mỗi lần cộc/phá.

### 4.1. Trạng thái Thường / Rê Chuột (Idle & Hover Peeking)
* Khi rê chuột vào vùng nút (hoặc đang gửi yêu cầu đăng nhập), đầu nhân vật ló sừng và tai lên khỏi mép nút cùng 2 bàn tay bám mép, nhưng **không chạm ô Mật khẩu**. Rê ra ngoài thì thụt xuống lại.

### 4.2. Kịch Bản 1: Khi Nhập Sai Hoặc Để Trống (Head Bonk & Recoil) — `mascot-bonk` 0.75s
1. Đầu trồi lên từ sau nút (`transform-origin: top` để đỉnh đầu được ghim vào trần).
2. **CỘC!** tại mốc 38% (~285ms): đỉnh đầu chạm đúng đáy ô `Mật khẩu`; ô rung giật (`animate-field-bonked`) kèm 2 vệt rung `impact_wave_1/2.png` hai bên đỉnh đầu.
3. Đầu bẹp lại (`scale(1.1, 0.86)`), bật xuống choáng, cố ngoi lần nữa nhưng không được.
4. Nhún hẳn xuống, trốn sau nút; khi animation kết thúc trở về trạng thái thường (hover lại sẽ ló lên).

### 4.3. Kịch Bản 2: Khi Nhập Đúng Mật Khẩu (Burst Through & Shatter Inputs) — `mascot-burst` 0.9s
1. 0–36% (tuyến tính): đầu trồi thẳng lên khỏi nút, xuyên qua ô `Mật khẩu` ⇒ **ô Mật khẩu vỡ trước**.
2. 36–60% (tuyến tính): đầu ngửa hết lên, phình to từ mép nút (`scale(--mascot-burst-scale × 1.06)`) vượt qua giữa ô `Email` ⇒ **ô Email vỡ sau**. Thời điểm vỡ từng ô được tính từ toạ độ đo được (hằng `MASCOT_BURST` trong `AuthDialog.tsx` phải khớp keyframes).
3. Mỗi ô vỡ đôi (`BrokenInputWrapper`) kèm 2 mảnh vỡ `shard_1/2.png` văng ra từ vết nứt.
4. Đầu dừng ở tư thế ngửa hết lên, sau 1.25s hộp thoại đóng và vào ứng dụng.

### 4.4. Tài nguyên phụ
* `shard_1.png`, `shard_2.png`: cắt sát (trim) từ `sfx_1.png`, `sfx_2.png`.
* `impact_wave_1.png`, `impact_wave_2.png`: cắt sát từ `wave_1.png`, `wave_2.png`.

---

## ⚡ 5. Cấu Trúc Khối Nứt & Góc Nghiêng Gãy Đôi (`BrokenInputWrapper`)

```
                        [Hiệu Ứng Gãy Đôi & Vết Nứt Tia Sét]
             ╭──────────────────╮ ⚡ ╭──────────────────╮
             │ ✉ Email hoặc tên │ ⚡ │      đăng nhập   │
             ╰──────────────────╯ ⚡ ╰──────────────────╯
               (Nghiêng -3.5° ↙)       (Nghiêng +3.5° ↘)
```

* **Nửa bên trái (`half-left`)**: Độ rộng 51%, xoay nghiêng `-3.5°` và thụt xuống `3.5px` (`origin-bottom-left`).
* **Nửa bên phải (`half-right`)**: Độ rộng 51%, xoay nghiêng `+3.5°` và thụt xuống `4px` (`origin-bottom-right`).
* **Vết nứt tia sét trung tâm**: Đường nét SVG hình zigzag đỏ phát sáng nối hai nửa gãy vỡ.
* **Cơ chế tự chữa lành**: Khi focus hoặc gõ phím, hai nửa tự động khép lại nguyên vẹn với lò xo vật lý.

---

## 📱 6. Bảng Thông Số Responsive Đa Thiết Bị

| Đặc tính / Phần tử | Mobile Viewport (< 640px) | Desktop Viewport (≥ 640px) |
| :--- | :--- | :--- |
| **Chiều cao Nút Đăng nhập** | `h-9` (36px) | `h-10` (40px) |
| **Cỡ chữ Nút Đăng nhập** | `text-sm` (14px) | `text-sm` (14px) |
| **Bán kính Bo góc Nút** | `rounded-[8px]` | `rounded-[8px]` |
| **Độ rộng Đôi Bàn Tay** | `w-[110px]` | `sm:w-[130px]` |
| **Tọa độ Đôi Bàn Tay** | `-top-[14px] left-1/2 -translate-x-1/2` | `sm:-top-[16px] left-1/2 -translate-x-1/2` |
| **Độ dịch ẩn Bàn Tay** | `-translate-y-3.5 scale-90` | `-translate-y-3.5 scale-90` |
| **Góc Nghiêng Gãy Input (Trái/Phải)** | `-3.5°` / `+3.5°` | `-3.5°` / `+3.5°` |
| **Padding Khung Hộp Thoại** | `p-4` (16px) | `p-6` (24px) |
| **Chiều cao Khung Tối Đa** | `max-h-[90vh]` | `max-h-[85vh]` |

---

## 🛡️ 7. Tuân Thủ Quy Chuẩn Kiến Trúc & An Toàn

1. **Next.js 16.4.6 & React 19**:
   * Khai báo rõ ràng chỉ thị `'use client'` ở dòng đầu tiên của `AuthDialog.tsx`.
   * Sử dụng component `Image` của Next.js với thuộc tính `priority` để tải trước ảnh linh vật và đôi bàn tay, loại bỏ độ trễ hiển thị (FOUC).
   * Trạng thái linh vật được reset ngay trong lúc render khi đổi `mode` (không gọi `setState` trong effect), hẹn giờ còn treo được huỷ qua cleanup của effect.
   * Mọi lớp hoạt họa mới đều bị tắt khi người dùng bật `prefers-reduced-motion`.
2. **Quy tắc Routing & Middleware**:
   * Tuyệt đối không can thiệp hoặc tạo file `middleware.ts`, giữ nguyên cơ chế điều hướng proxy tại `src/proxy.ts`.
3. **Bảo mật Đăng nhập**:
   * Toàn bộ mật khẩu, mã xác thực OTP và mã PIN 6 số đều đi qua luồng mã hóa, xác minh phía máy chủ an toàn với cơ chế bảo vệ Brute-force.

---

## 🧪 8. Nghiệm Thu & Kiểm Thử Hệ Thống

Tuân thủ nghiêm ngặt quy trình kiểm thử tại `TESTING_MONITORING.md`:

* **Kiểm thử tự động (`npm test`)**:
  * Toàn bộ **214/214 bài kiểm thử** (bao gồm xác thực người dùng, bảo mật API, giải mã Canvas, quyền hạn) vượt qua 100%.
* **Kiểm thử đóng gói (`npm run build`)**:
  * Biên dịch bằng Next.js Turbopack hoàn tất sạch sẽ 0 lỗi TypeScript, 0 lỗi cảnh báo style.

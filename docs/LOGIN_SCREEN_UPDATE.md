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
   - Linh vật (`half_head_2_trimmed.png`) cùng đôi bàn tay mèo (`cat_two_paws.png`) ló lên từ sau nút Đăng nhập khi rê chuột.
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
* **Bước nhập mã PIN không có nút**: mã tự gửi khi nhập hoặc dán đủ 6 số. Trong lúc xác minh, một spinner `Loader2` nhỏ hiện ngay dưới 6 ô PIN.
* **Chuyển màn do người dùng bấm** (Quên mật khẩu? / Đăng ký ngay / Quay lại / Đăng nhập) đi qua `switchMode()`: xoá thông báo thành công, lỗi và mã PIN của màn cũ. Chuyển màn do máy chủ trả về (sang bước PIN, xác thực xong) vẫn giữ thông báo của nó.

### 2.2. Quy cách Khung Hộp Thoại (`DialogContent`) & Lớp Nền (`DialogOverlay`)
* **Độ co giãn**: `sm:max-w-md max-h-[90vh] sm:max-h-[85vh]`.
* **Khoảng cách lề (Padding)**: `p-4 sm:p-6`.
* **Không hiện thanh cuộn**: `overflow-y-auto overscroll-contain no-scrollbar` (vẫn cuộn được bằng chuột/cảm ứng khi màn hình thấp). Trong lúc linh vật cộc đầu hoặc phá vỡ ô input, khung chuyển sang `overflow-visible` để đầu và mảnh vỡ bay ra ngoài mà không bị cắt, không tạo vùng cuộn.
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
* **`half_head_2.png` → `half_head_2_trimmed.png`** (đang dùng):
  * Độ phân giải sau khi cắt: `1486px x 842px` (tỉ lệ `1.76:1`).
  * Bản vẽ rõ mặt hơn (mắt to, miệng cười). Bản gốc thừa ~180px trong suốt ở đáy và vài điểm mờ, nên đã được cắt sát theo vùng hình (bỏ điểm alpha ≤ 16) để mép đáy phẳng trùng mép trên nút Đăng nhập.
* **`half_head.png` / `half_head_trimmed.png`** (bản cũ, `1476px x 811px`): không còn dùng.
* Ảnh đầu và đôi bàn tay khai báo `sizes` để Next/Image chỉ tải bản rộng ~150px thay vì 1920px.
* **`cat_two_paws.png`**:
  * Độ phân giải: `647px x 136px`.
  * Trích xuất nguyên bản từ bộ ảnh gốc `cat_foot.png`, gồm đầy đủ 2 bàn tay mèo cân đối, đệm thịt hồng bám chặt trên mép trên nút.
* **`cat_foot.png` / `cat_foot_v2.png`**: Bộ ảnh gốc độ phân giải cao `1024x176` chứa 2 bàn chân mèo.

### 3.2. Giải phẫu học Tọa độ Bám Viền (Anatomy & Positioning)
Toàn bộ cụm nhân vật gồm Đầu (`half_head_2_trimmed.png`) và Đôi bàn tay (`cat_two_paws.png`) nằm tại **tâm ngang** của nút Đăng nhập:

```
                            [Đầu Nhân Vật - half_head_2_trimmed.png]
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
| **Đầu nhân vật** (`half_head_2_trimmed`) | `w-[130px] mx-auto` trong `.mascot-stage` (`bottom-full`) | `sm:w-[150px]` | Bị cắt tại mép trên nút, ló lên khi rê chuột, cộc đầu khi sai hoặc nhô hẳn lên (không phóng to) phá 2 ô input khi đúng. |
| **Đôi bàn tay** (`cat_two_paws`) | `w-[110px] -top-[14px] left-1/2` | `sm:w-[130px] sm:-top-[16px]` | Móc sâu 9–11px qua mép trên, móng vuốt và đệm thịt hồng đặt tự nhiên trên viền nút. |

---

## ⚡ 4. Kịch Bản Chuyển Động & Hoạt Họa Vật Lý (Mascot Physical Dynamics)

### 4.0. Sân khấu & Đo toạ độ động (`.mascot-stage`)
* Đầu nhân vật nằm trong một "sân khấu" có đáy trùng **mép trên nút Đăng nhập**, chỉ bị cắt cạnh dưới (`clip-path: inset(-400px -400px 0 -400px)`) ⇒ đầu luôn trông như **trồi lên từ phía sau/dưới nút**, mép cắt phẳng của ảnh không bao giờ lộ ra.
* `measureMascot()` đo khoảng cách thật (chia theo tỉ lệ scale của hộp thoại) và ghi vào biến CSS:
  * `--mascot-hide`: vị trí ẩn hoàn toàn sau nút.
  * `--mascot-peek`: ló sừng/tai, chừa khe ~8px dưới ô Mật khẩu.
  * `--mascot-contact`: đỉnh đầu chạm đúng đáy ô Mật khẩu (trần).
* Đo lại khi mở hộp thoại, khi rê chuột vào nút, khi kích thước thay đổi (`ResizeObserver`) và ngay trước mỗi lần cộc/phá.

### 4.1. Trạng thái Thường / Rê Chuột (Idle & Hover Peeking)
* Khi rê chuột vào vùng nút (hoặc đang gửi yêu cầu đăng nhập), đầu nhân vật ló sừng và tai lên khỏi mép nút cùng 2 bàn tay bám mép, nhưng **không chạm ô Mật khẩu**. Rê ra ngoài thì thụt xuống lại. Riêng sau một lần cộc đầu, đầu tự ló lên và giữ nguyên (xem §4.2).

### 4.2. Kịch Bản 1: Khi Nhập Sai Hoặc Để Trống (Head Bonk & Recoil) — `mascot-bonk` 0.8s
1. Đầu lao lên **nhanh dần** từ sau nút (`transform-origin: top` để đỉnh đầu được ghim vào trần), thân đầu hơi kéo dài vì tốc độ.
2. **CỘC!** ở mốc 30% (240ms, `MASCOT_BONK.impactMs`): đỉnh đầu đập đúng đáy ô `Mật khẩu`.
   * Đầu bẹp dí `scale(1.2, 0.76) rotate(-5deg)`.
   * Ô Mật khẩu bị hất lên 15px, nghiêng 4.2° rồi rung lắc cả dọc lẫn ngang (`animate-field-bonked`, 0.5s).
   * Ô Email rung theo dư chấn (`animate-field-aftershock`).
   * 2 chùm tia **"CỘC!"** (`ImpactBurst`, SVG): tam giác vàng nhạt `#FCE38A` viền cam `#F5A524` bung ra hai bên điểm va chạm (`animate-impact-pop`, 0.46s), cụm tia căn đúng tâm đầu. Hai bên cố ý khác nhau như nét vẽ tay: trái 3 tia, phải 2 tia khác góc/cỡ và bung trễ 45ms (`IMPACT_RAYS`). Toạ độ bên phải được tính sẵn, không lật bằng CSS (lật `scale-x` quanh mép làm lệch cả cụm).
3. Đầu bật ngược xuống 26px, lảo đảo choáng váng rồi nhún hẳn xuống, **biến mất** sau nút.
4. Sau 600ms (`MASCOT_REAPPEAR_DELAY_MS`), đầu và đôi bàn tay **tự ló lên lại không cần rê chuột**, giữ tư thế ló cho tới lần bấm Đăng nhập kế tiếp, khi đổi chế độ hoặc đóng hộp thoại.

### 4.3. Kịch Bản 2: Khi Nhập Đúng Mật Khẩu (Duck, Spring & Shatter) — `mascot-burst` 1.1s
1. **Lùi xuống** (0–20%): đang ló lên thì thụt hẳn ra sau nút, **chỉ còn đôi bàn tay bám mép nút** (tay luôn hiện suốt kịch bản này).
2. **Lấy đà** (20–32%): nén người thêm 6px. Đôi tay ghì xuống mép nút (`animate-paws-brace`).
3. **Bật mạnh** (32–44%, tuyến tính, ~130ms): đầu vọt thẳng lên, người kéo dãn vì tốc độ, đôi tay đạp lên. Đỉnh đầu xuyên qua ô `Mật khẩu` ⇒ **ô Mật khẩu vỡ trước**. **Ô Email vỡ sau**: lúc đỉnh đầu chạm tới nếu với được, nếu không thì vỡ do dư chấn ~60ms sau khi đầu bật lên hết. Thời điểm vỡ tính từ toạ độ đo được (`MASCOT_BURST = { riseStartMs: 352, riseMs: 132, topImpactMs: 60 }` phải khớp keyframes).
4. **Tiếp đất** (44–100%): bẹp lại `scale(1.07, 0.93)` rồi lắc đầu nhẹ (≤ 2.5°). Đầu chỉ nhô lên, không phóng to; mép cắt phẳng ở đáy ảnh không bao giờ lộ khỏi nút.
5. Mỗi ô bị đánh gãy đôi (`BrokenInputWrapper`): ô thật ẩn ngay, hai nửa giật mạnh sang hai bên rồi rơi xuống, xoay và **biến mất** (0.8–0.85s), kèm 6 mảnh vụn SVG cùng chất liệu ô input văng ra (`animate-shard-fly`). Không có vết nứt hay chớp sáng.
6. Đầu dừng ở tư thế nhô hết lên, sau 1.45s hộp thoại đóng và vào ứng dụng.
7. **Tài khoản có mã PIN** (`requirePin`): máy chủ chỉ yêu cầu PIN sau khi mật khẩu đã đúng, nên hiệu ứng phá vỡ vẫn chạy đủ 1.45s (`MASCOT_BURST_HOLD_MS`) rồi mới chuyển sang bước nhập PIN.

### 4.4. Tài nguyên phụ
* Hiệu ứng va chạm và mảnh vỡ đều vẽ bằng SVG ngay trong `AuthDialog.tsx`, không dùng ảnh.
* `shard_1/2.png`, `impact_wave_1/2.png` (và ảnh gốc `sfx_1/2.png`, `wave_1/2.png`) không còn dùng.

---

## ⚡ 5. Cấu Trúc Khối Nứt & Góc Nghiêng Gãy Đôi (`BrokenInputWrapper`)

```
                        [Hiệu Ứng Gãy Đôi & Mảnh Vụn]
             ╭──────────────────╮   ╭──────────────────╮
             │ ✉ Email hoặc tên │ ✦ │      đăng nhập   │
             ╰──────────────────╯   ╰──────────────────╯
            ↙ (văng -48°, mờ dần)      (văng +52°, mờ dần) ↘
```

* **Ô input thật**: chuyển `opacity-0` trong 75ms ngay khi vỡ nhưng vẫn giữ chỗ, để nút Đăng nhập và toạ độ linh vật không bị xô lệch.
* **Nửa bên trái** (`animate-shatter-left`, 0.8s): giật tới `translate(-22px, -10px) rotate(-11deg)` ở mốc 18%, sau đó rơi theo trọng lực tới `translate(-120px, 110px) rotate(-48deg)` và mờ hẳn.
* **Nửa bên phải** (`animate-shatter-right`, 0.85s): đối xứng, `rotate(+13deg)` rồi `translate(130px, 100px) rotate(52deg)` và mờ hẳn.
* **Mảnh vỡ** (`SHATTER_SHARDS`): 6 đa giác SVG nền trắng (tối: `red-950`) viền `red-500`, to nhỏ 6–13px, bắn ngang, vồng lên rồi rơi xuống theo trọng lực, xoay 200–360° và mờ dần (`animate-shard-fly`, biến `--shard-dx/up/dy/rot`).
* **Rung va chạm** (`animate-snap-break`, 0.42s): cả ô bị nén xuống rồi rung ngang ±9px.
* **Giảm chuyển động** (`prefers-reduced-motion`): các lớp trên bị ẩn hẳn, ô bị phá biến mất ngay không để lại mảnh vỡ.
* **Cơ chế tự chữa lành**: Khi focus hoặc gõ phím vào vị trí ô cũ, ô input hiện lại nguyên vẹn (fade 300ms).

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
| **Góc Văng Gãy Input (Trái/Phải)** | `-11°→-48°` / `+13°→+52°` | `-11°→-48°` / `+13°→+52°` |
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

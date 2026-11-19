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
* **Nhân vật phản ứng khi đổi giao diện**: `ThemeToggle` có prop tuỳ chọn `onToggle(nextTheme)` (các nơi khác dùng nút này không bị ảnh hưởng). Trong `AuthDialog`, `handleThemeToggle` chờ hiệu ứng chuyển màu xong (`THEME_CHAT.delayMs` = 320ms) rồi cho nhân vật ló lên nói 1 trong 10 câu theo giao diện vừa chuyển sang (`THEME_CHATS.dark` / `THEME_CHATS.light`), tự tắt sau 3.6s (`THEME_CHAT.showMs`). Xem bảng ở §4.1.

### 2.4. Ngăn Chặn Tự Động Focus & Triệt Tiêu Gợi Ý Điền Của Google Chrome (No Auto-focus & Anti-Autofill)
* **Ngăn tự động focus khi mở hộp thoại (`initialFocus={false}`)**:
  * Mặc định, `@base-ui/react/dialog` tự động focus vào trường input đầu tiên (`email`) khi mở modal, khiến bàn phím ảo bật lên trên thiết bị di động hoặc kích hoạt cơ chế gợi ý mật khẩu của trình duyệt.
  * Thiết lập `initialFocus={false}` trên `<DialogContent>` để chặn hành vi tự focus này, giúp người dùng chủ động tương tác và giữ trọn vẹn trải nghiệm thị giác tĩnh ban đầu.
* **Triệt tiêu popup gợi ý điền thông tin đăng nhập của Google Chrome & trình quản lý mật khẩu**:
  * Khi Google Chrome nhận diện cặp trường `email`/`username` và `password`, nó tự động hiển thị dropdown lưu mật khẩu (ví dụ "Sutie Xù Xì"), đè lên bong bóng thoại và đôi bàn tay mèo.
  * **Giải pháp đa lớp đã áp dụng**:
    1. Thiết lập `autoComplete="off"` và các cờ `data-lpignore="true"`, `data-form-type="other"` trên thẻ `<form>`.
    2. Chèn 2 ô input ẩn giả lập (`fake_usernameremembered` và `fake_passwordremembered`) ở đầu form để thu hút và triệt tiêu thuật toán heuristic tự động bắt cặp tài khoản của Chromium.
    3. Ô nhập tài khoản: đặt tên phi chuẩn `name="sutie_login_id"`, kết hợp `autoComplete="off"`, `autoCorrect="off"`, `autoCapitalize="none"`, `spellCheck={false}` cùng các cờ bỏ qua của 1Password/LastPass (`data-1p-ignore`, `data-lpignore`).
    4. Ô nhập mật khẩu: đặt `name="sutie_login_secret"`, sử dụng chuẩn `autoComplete="new-password"`. Thuộc tính này báo hiệu với trình duyệt đây là trường mật khẩu mới, ngăn chặn Chrome bật danh sách gợi ý tài khoản đã lưu cũ.
    5. Các ô mã OTP và mã PIN: gán thuộc tính `autoComplete="one-time-code"` chuẩn ngữ nghĩa.

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

### 4.1. Trạng thái Thường, Rê Chuột & Bong Bóng Thoại (Idle, Hover, Typing & Speech Bubbles)
| Tình huống | Nhân vật | Bong bóng thoại (`MascotBubble`) |
| :--- | :--- | :--- |
| **Vừa mở trang đăng nhập** (sau khi màn hình chờ tắt, `usePreloader().isPreloading === false`) | Ló lên sau 0.9s, tự tắt sau 5.5s (`GREETING_CHAT`) | 1 trong **100 câu chào** `GREETING_CHATS` kèm giới thiệu hôm nay: chỗ trống `{thu}`/`{Thu}` (thứ), `{ngay}` (dd/mm), `{buoi}` (sáng/trưa/chiều/tối) điền theo giờ máy người dùng (`buildGreeting`). Vd: "Chào bạn! Hôm nay thứ Năm nè", "Buổi chiều thứ Năm, đọc ha?". Trường hợp dài nhất ≤ 32 ký tự |
| Rê chuột vào nút Đăng nhập (trên máy tính) | Đôi tay mèo bám mép nút (`group-hover`) | Không hiện bong bóng thoại (đã loại bỏ theo yêu cầu trải nghiệm) |
| Đang gõ ô **Email** | Ló lên xem, đôi tay bám mép | 1 trong **70 câu** `EMAIL_CHATS` (≤ 27 ký tự), canh mép phải khung, ngay trên góc phải đầu |
| Đang gõ ô **Mật khẩu** (kể cả Tab sang nút hiện/ẩn) | **Trốn hẳn**, chỉ còn đôi tay | 1 trong **70 câu** `PASSWORD_CHATS` (≤ 31 ký tự), căn giữa trục đôi tay (điện thoại: canh trái), đuôi chỉ xuống bàn tay trái |
| Sau một lần cộc đầu | Trốn 600ms rồi tự ló lên, không cần rê chuột | — |
| Bấm nút đổi giao diện **Sáng / Tối** | Ló lên (kể cả khi đang focus ô Mật khẩu), tự trở lại trạng thái cũ sau 3.6s | 1 trong 10 câu theo giao diện mới: tối "Chuyển qua phe bóng đêm!"... / sáng "Trời sáng, dậy đọc truyện!"... |
| Bấm Đăng nhập khi **còn để trống** ô | Cộc đầu rồi ló lên | 1 trong 8 câu `HINT_CHATS.empty` ("Bạn chưa nhập gì mà!"...) |
| Đăng nhập **sai lần 1** (401) | Cộc đầu rồi ló lên | 1 trong 20 câu `HINT_CHATS.wrong` ("Ui, sai mất rồi bạn ơi!"...) |
| Đăng nhập **sai từ lần 2** (401) hoặc **bị khoá tạm** (429) | Cộc đầu rồi ló lên | Gợi ý luân phiên `HINT_CHATS.forgot` / `register`, link tương ứng nhấp nháy cam (`mascot-hint-pulse`). Khoá tạm: `HINT_CHATS.locked`, nhấp nháy Quên mật khẩu |
| **Đăng nhập thành công** | Lùi xuống rồi bật lên phá vỡ ô nhập | 1 trong 20 câu `SUCCESS_CHATS` ("Chào mừng bạn trở lại!"...), tài khoản có PIN: 1 trong 20 câu `SUCCESS_PIN_CHATS` nhắc nhập PIN. Gõ nhanh 28ms/ký tự; hộp thoại giữ 2.3s (`MASCOT_BURST_HOLD_MS`) để kịp đọc |

* **Câu chào khi mở trang**: hộp thoại tự đặt con trỏ vào ô Email lúc mở, nhưng việc đó **không** bị tính là đang nhập, nên câu chào vẫn hiện. Câu chào tắt hẳn khi người dùng gõ hoặc bấm vào một ô; nó cũng nhường chỗ khi rê chuột vào nút, đổi giao diện hoặc sau một lần thất bại.
* **Ưu tiên**: câu về giao diện (thao tác mới nhất) đứng trên tất cả trong 3.6s nó hiện. Ngoài thời gian đó, phản hồi sau thất bại (để trống / sai / gợi ý / khoá) luôn được ưu tiên hơn câu chào khi rê chuột (chuột thường vẫn nằm trên nút vừa bấm) và hơn các câu khi đang nhập (kể cả khi bấm Enter trong ô Mật khẩu), cho tới khi người dùng gõ tiếp vào một ô.

* **Câu ngẫu nhiên** (`useRotatingChat`): mỗi lần bấm vào ô / rê vào nút bốc một câu mới (không lặp câu vừa nói); nếu vẫn đang nhập thì cứ 4.5s (`CHAT_ROTATE_MS`) đổi câu khác.
* **Gõ chữ** (`TypewriterText`): bong bóng bật nảy ra (`mascot-bubble-pop`), chữ hiện dần 38ms/ký tự kèm con trỏ nhấp nháy (`mascot-caret`). Bề rộng giữ sẵn bằng bản chữ vô hình nên bong bóng không giãn khi gõ. `prefers-reduced-motion`: hiện đủ câu ngay.
* **Không bao giờ tràn khung / đè "Quên mật khẩu?"**: đã đo đủ 240 câu (100 chào + 70 Email + 70 Mật khẩu) ở khổ máy tính và 375px. Đuôi bong bóng có miếng nền trắng phủ viền đáy nên liền khối. Bong bóng mật khẩu dùng `@container` + `cqw` để đuôi chỉ đúng bàn tay trái khi canh trái trên điện thoại.
* **Vì sao không phân biệt "sai mật khẩu" và "không có tài khoản"**: API cố ý trả cùng lỗi 401 (và băm mật khẩu giả để thời gian phản hồi như nhau) nhằm chống dò tài khoản theo `SECURITY_RULES.md`. Giao diện không được thêm cách nào để phân biệt, nên nhân vật gợi ý luân phiên cả hai hướng.
* Trạng thái cộc đầu được giải phóng bằng hẹn giờ (`MASCOT_BONK.durationMs`) thay vì `animationend`, để nhân vật không bị kẹt (và bong bóng không bị khoá) khi trình duyệt không phát sự kiện đó.

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
6. Đầu dừng ở tư thế nhô hết lên, sau 2.3s hộp thoại đóng và vào ứng dụng.
7. **Tài khoản có mã PIN** (`requirePin`): máy chủ chỉ yêu cầu PIN sau khi mật khẩu đã đúng, nên hiệu ứng phá vỡ vẫn chạy đủ 2.3s (`MASCOT_BURST_HOLD_MS`) rồi mới chuyển sang bước nhập PIN.

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

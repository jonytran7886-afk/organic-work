# Nhận diện Organic Work theo logo Organic Việt Nam

Áp dụng trực tiếp vào ứng dụng theo hai SVG được cung cấp. Bộ màu được đọc từ artwork, không lấy từ metadata hay suy đoán mã màu. Bản sao SVG trong `public/brand` có SHA-256 trùng với file nguồn.

## Logo và nhận diện sản phẩm

- `organicvn-symbol-color.svg`: biểu tượng chính thức, dùng trong nhận diện Organic Work, trạng thái tải, ô công ty và favicon.
- `organicvn-vertical-color.svg`: logo đầy đủ, dùng tại màn hình đăng nhập, đặt trên nền sáng có khoảng thở.
- `organicvn-apple-touch.png`: biểu tượng 180×180, tạo từ SVG chính thức trên nền trắng.
- Tên **Organic Work** xác định sản phẩm nội bộ; logo đầy đủ của Organic Việt Nam giữ nguyên chữ và artwork. Không vẽ lại, đổi màu hoặc kéo méo các file logo gốc.
- Logo trên vị trí nhận diện giữ đúng tỷ lệ. Biểu tượng mờ trong phần giới thiệu đăng nhập và sidebar là họa tiết nền trang trí, không mang nội dung điều hướng.

## Bảng màu

| Màu | Mã | Vai trò |
| --- | --- | --- |
| Xanh Organic | `#006B35` | Màu lấy trực tiếp từ logo; nút chính, link, nội dung nhấn |
| Xanh lá Organic | `#58A500` | Màu lấy trực tiếp từ logo; đường nhấn, trạng thái hoàn thành, tab đang chọn |
| Xanh nền điều hướng | `#063F2B` | Sidebar, mảng nhận diện đăng nhập |
| Xanh đậm bổ trợ | `#043322` | Chiều sâu và cấu trúc nhận diện |
| Nền ứng dụng | `#F3F7F4` | Mặt nền sáng, tách khỏi thẻ trắng |
| Chữ chính | `#173B2A` | Tiêu đề và thông tin công việc |
| Chữ phụ | `#5D7063` | Nội dung phụ trên nền sáng |
| Xanh lá dùng cho chữ | `#3E7700` | Chữ nhấn nhỏ trên nền trắng |

Xanh lá gốc dùng làm điểm nhấn, không dùng nền xanh lá với chữ trắng nhỏ. Cặp chữ trắng/nền `#006B35` có độ tương phản tính theo sRGB khoảng 6,66:1; chữ `#3E7700`/nền trắng khoảng 5,46:1. Đây là kiểm tra những cặp màu nêu trên, không phải tuyên bố kiểm toán khả năng tiếp cận toàn bộ hệ thống.

## Bố cục và thành phần

- Desktop: sidebar xanh đậm 256 px với logo trên ô trắng, khu công ty/phòng ban, điều hướng có điểm nhấn xanh lá; nội dung trên nền sáng, topbar trắng.
- Đăng nhập: bố cục hai mảng ở desktop; logo đầy đủ và thông điệp kết nối đội ngũ bên trái, form đăng nhập bên phải. Mobile ưu tiên logo và form.
- Việc của tôi: danh sách vẫn ở vùng nhìn đầu tiên; nhãn trạng thái, hạn và thao tác giữ rõ ở 390 px.
- Tiến độ: sáu ô số liệu có vạch màu theo ý nghĩa; danh sách và bảng phân bổ cùng ngôn ngữ màu, viền và khoảng cách.
- Công việc phòng ban: cột Kanban, thẻ, bộ lọc và danh sách mobile cùng nhận diện.
- Chi tiết, quản trị và hộp thoại: nút, trường nhập, nền, viền, chữ, bình luận và focus đồng bộ.
- Bo góc: khoảng 8 px cho trường/nút, 12 px cho thẻ và 16 px cho hộp thoại. Các đường cong lớn chỉ dùng tại vùng thương hiệu.
- Typography: font hệ thống hỗ trợ tiếng Việt, không cần tải font bên ngoài; nội dung 16 px, nhãn và dữ liệu tác nghiệp chủ yếu 14 px. Chữ trong logo chính thức là vector nguyên bản.
- Icon điều hướng dùng SVG nét, thay các ký tự biểu tượng cũ. Trạng thái có nhãn chữ; màu xanh thương hiệu không thay thế màu cảnh báo quá hạn hoặc đang chờ.
- Có focus rõ cho bàn phím và tôn trọng `prefers-reduced-motion`.

## Nơi chỉnh sửa

| Tệp | Chức năng |
| --- | --- |
| `src/components/brand.tsx` | Thành phần biểu tượng, logo đầy đủ và nhận diện Organic Work |
| `src/app/brand.css` | Token và kiểu nhận diện cho toàn ứng dụng, cùng breakpoint desktop/mobile |
| `src/app/globals.css` | Bố cục, thành phần và màu nền tảng |
| `src/components/workspace.tsx` | Đăng nhập, sidebar, icon điều hướng và tiêu đề |
| `src/app/layout.tsx` | Nạp stylesheet, metadata và favicon |
| `public/brand/` | Tài sản thương hiệu local, không phụ thuộc đường dẫn file trên máy người dùng |

## Ảnh và xác minh

- [Đăng nhập desktop](brand-login-desktop.png), [đăng nhập mobile](brand-login-mobile.png).
- [Việc của tôi desktop](my-tasks-desktop.png), [mobile](my-tasks-mobile.png).
- [Tiến độ desktop](progress-desktop.png), [mobile](progress-mobile.png).
- [Kanban desktop](kanban-desktop.png), [danh sách mobile](board-mobile.png).

Đã xem ảnh render thực tế của đăng nhập, danh sách cá nhân và Tiến độ; kiểm tra ở 1440×1000 và 390×844. Ảnh ứng dụng dùng database kiểm thử nên có công việc do các lượt E2E tạo ra.

`npm run typecheck` đạt. Bộ `npm run test:e2e` trên build production đạt **9/9**, 37,9 giây, bao gồm bàn phím, nhóm hạn, phân công, lý do chờ, quyền truy cập, bộ lọc, quản trị, lưu trữ và mobile. Sau khi tăng độ tương phản chữ phụ, bài visual chạy lại trên production build đạt 1/1 (13,3 giây) và đã cập nhật ảnh. Không thay đổi schema, dữ liệu nghiệp vụ hoặc cơ chế phân quyền trong lượt nhận diện này.

Chạy tại http://localhost:3100 bằng `npm run dev`. Các tài khoản và mật khẩu demo được giữ nguyên theo [README](../README.md).

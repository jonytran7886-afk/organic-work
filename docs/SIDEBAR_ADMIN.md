# Nhóm điều hướng Quản trị và drawer mobile

Thực hiện theo [prompt cập nhật sidebar](SIDEBAR_ADMIN_BRIEF.md). Đây là thay đổi điều hướng tiếp theo sau [dialog CRUD](ADMIN_CRUD.md); các form, transaction và quy tắc dữ liệu hiện có tiếp tục được dùng.

## Bố cục đã cập nhật

- Nhóm **Công việc**: Việc của tôi → Công việc phòng ban → Tiến độ. Nhân viên chỉ thấy hai mục đầu; trưởng bộ phận/Admin có Tiến độ.
- Nhóm **Quản trị**, chỉ Admin: Tài khoản → Phòng ban. Hai mục mở trực tiếp `/admin/users` và `/admin/departments` trong một lần bấm trên desktop.
- Bỏ link Quản trị đơn và bỏ tab Tài khoản/Phòng ban phía trên nội dung. Nội dung bắt đầu bằng tiêu đề, nút thêm, bộ lọc và danh sách.
- Mục hiện tại có `aria-current="page"`. Breadcrumb hiển thị Quản trị / Tài khoản hoặc Quản trị / Phòng ban.
- Điện thoại dùng nút Mở điều hướng và drawer có cùng hai nhóm. Chọn mục sẽ đóng drawer. Hỗ trợ Escape, focus khép kín bằng Tab/Shift+Tab, trả focus về nút mở và khóa cuộn nền khi mở.
- Khung ứng dụng vẫn nằm trong shared layout; sidebar desktop không được khởi tạo lại khi đổi trang. Drawer dùng cùng cấu hình điều hướng và quyền với sidebar.

## Route tương thích

- `/admin` → `/admin/users` cho Admin.
- `/admin?tab=users` → `/admin/users`.
- `/admin?tab=departments` → `/admin/departments`.
- Bỏ tham số `tab` sau chuyển hướng, giữ tham số tìm kiếm còn lại, ví dụ `/admin?tab=departments&q=Vận` → `/admin/departments?q=Vận`.
- Mục đích chuyển hướng luôn từ danh sách route nội bộ cho phép. Tài khoản không có quyền bị chặn trước phần chuyển hướng, và API đọc/ghi quản trị vẫn kiểm tra Admin ở server.

## Tệp chính

| Tệp | Thay đổi |
| --- | --- |
| `src/components/side-navigation.tsx` | Nhóm Công việc/Quản trị, quyền theo vai trò, link trực tiếp, drawer và focus |
| `src/components/ui-icon.tsx` | Icon dùng chung và icon tài khoản/phòng ban |
| `src/components/workspace.tsx` | Tích hợp sidebar/drawer, giữ khung và dữ liệu điều hướng |
| `src/components/admin-console.tsx` | Bỏ tab trong nội dung, giữ CRUD |
| `src/app/navigation.css` | Nhóm sidebar và drawer 390 px theo nhận diện Organic |
| `src/app/[[...page]]/page.tsx` | Tương thích URL gốc/tab cũ sau khi kiểm tra quyền |
| `tests/sidebar.spec.ts` | Nghiệm thu nhóm, route, drawer và quyền |
| `tests/helpers/navigation.ts` | Dùng chung thao tác điều hướng desktop/mobile trong kiểm thử |

Chạy local: `npm run dev`, mở http://localhost:3100. Admin demo `admin@organic.vn`; mật khẩu lấy từ `DEMO_PASSWORD` trong `.env` local theo [README](../README.md).

Ảnh: [Sidebar desktop](sidebar-admin-desktop.png), [drawer mobile](sidebar-mobile-drawer.png), [nội dung quản trị mobile](admin-sidebar-mobile.png). Ảnh dùng dữ liệu test.

Kết quả của lượt kiểm thử cuối được ghi bên dưới. Phiên này kiểm tra Chromium local với MongoDB replica set; chưa chạy Safari/Firefox hoặc triển khai Atlas/HTTPS.

## Kết quả nghiệm thu thực tế

Bộ E2E cuối chạy trên production build với MongoDB test riêng: **17/17 đạt**, 47,0 giây. Bao gồm ba bài sidebar/drawer mới và toàn bộ 14 bài hồi quy trước đó.

| Ca kiểm tra | Kết quả |
| --- | --- |
| Thứ tự Công việc, hai mục Quản trị trực tiếp, không còn link Quản trị đơn/tab nội dung | Đạt |
| `aria-current`, breadcrumb, URL riêng, reload và Back/Forward | Đạt |
| `/admin`, `?tab=users`, `?tab=departments`, giữ tìm kiếm khi chuyển URL cũ | Đạt |
| Drawer 390 px, cùng nhóm/mục, đóng khi chọn, Enter/Escape/Tab/Shift+Tab và trả focus | Đạt |
| Nhân viên/trưởng phòng không thấy Quản trị trên desktop và mobile | Đạt |
| Truy cập trang/API quản trị không có quyền | Đạt; API GET và POST trả 403 |
| Form tài khoản/phòng ban, email/mã trùng, bản nháp, lưu lỗi và xác nhận | Đạt qua bộ CRUD hiện có |
| Admin cuối cùng, phân công mở trước khi đổi phòng, thu hồi phiên khi vô hiệu hóa | Đạt |
| Sidebar/header không bị tháo và không tải lại toàn bộ bootstrap khi đổi trang | Đạt với API công việc chậm 900 ms |
| Bố cục 1440/390 px, các luồng Việc của tôi/Tiến độ/Kanban | Đạt |

`npm run typecheck` đạt; `npm run build` production chạy thành công trước E2E. Không có ca local bắt buộc còn bị chặn. Hai lỗi selector trong lần chạy đầu đã được sửa để phân biệt sidebar desktop với drawer đang đóng; lượt cuối cả hai bài chống giật trắng đều đạt.

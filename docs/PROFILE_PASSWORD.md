# Hồ sơ cá nhân và đổi mật khẩu — 20/11/2026

Triển khai theo `Organic_Work_Prompt_Ho_So_Ca_Nhan_Doi_Mat_Khau.md`.

## Giao diện

- Mọi tài khoản hoạt động có mục **Hồ sơ của tôi** trong khu vực tài khoản sidebar desktop/menu mobile và link từ avatar đầu trang.
- `/profile` dùng bố cục Organic Work hiện có, gồm Thông tin cá nhân và Bảo mật. Tên trang, điều hướng và sidebar dùng chung được giữ xuyên suốt.
- Hồ sơ tải từ API. Họ tên bắt buộc, bỏ khoảng trắng đầu/cuối, tối đa 250 ký tự; số điện thoại tùy chọn, cho phép xóa. Điện thoại chấp nhận 7–15 chữ số, dấu `+` đầu số và dấu phân cách thông dụng; lưu dạng bỏ dấu cách/chấm/gạch ngang/ngoặc.
- Email, phòng và vai trò chỉ đọc; cập nhật tổ chức dùng luồng quản trị. Chưa có dịch vụ avatar trong repo nên tiếp tục dùng chữ cái đầu.
- Lưu thành công cập nhật ngay tên và chữ cái avatar trong shell, không phụ thuộc một lần tải lại toàn bộ danh sách công việc. Lỗi lưu giữ nội dung và có lỗi theo trường.
- Dialog đổi mật khẩu dùng `Dialog` hiện có: ba trường mật khẩu, hiện/ẩn độc lập, autocomplete cho trình quản lý mật khẩu, focus ban đầu, Tab/Escape, khóa gửi lặp và trả focus. Đóng dialog sẽ unmount và bỏ các giá trị mật khẩu.

## API và quyền riêng tư

- `GET /api/profile`: chỉ hồ sơ tài khoản từ phiên hiện tại.
- `PATCH /api/profile`: chỉ nhận `name`, `phone`; trường khác, sai kiểu hoặc định dạng sai bị từ chối. Không nhận `_id` để chọn tài khoản khác.
- `POST /api/profile/password`: chỉ nhận `currentPassword`, `newPassword`, `confirmPassword`.
- Tài khoản không đăng nhập hoặc đã vô hiệu hóa nhận 401; `/api/profile/:id` không tồn tại. Giữ kiểm tra Origin của các request ghi hiện có.
- Hồ sơ trả về danh sách trường rõ ràng; không trả mật khẩu, hash, token, dữ liệu phiên. `phone` chỉ có trong API hồ sơ chính mình. Các phản hồi đăng nhập/session/bootstrap/danh sách tài khoản dùng whitelist, không đưa điện thoại hay `sessionRevision` vào màn công việc hoặc quản trị.

## Mật khẩu và phiên

- Dùng `scrypt` và so sánh hash của repo. Chính sách chung trong `password-policy.ts`: **6–200 ký tự**, áp dụng tạo tài khoản, Admin đặt lại và tự đổi mật khẩu.
- Xác nhận mật khẩu hiện tại ở server; mật khẩu mới phải khác mật khẩu hiện tại và khớp ô nhập lại. Không ghi mật khẩu vào log hay phản hồi.
- Tái sử dụng collection `login_attempts` có TTL: namespace băm riêng theo tài khoản, tối đa 5 lần thử xác thực trong 15 phút, dùng bộ đếm nguyên tử cho mọi phiên của cùng tài khoản. Hết thời gian được tính lại ngay cả khi MongoDB chưa dọn TTL; thành công xóa bộ đếm trong transaction.
- Cập nhật hash, `passwordChangedAt`, xóa tất cả session của tài khoản và xóa bộ đếm thành công trong cùng transaction. Lỗi giữa thao tác rollback toàn bộ, giữ hash và các phiên theo trạng thái thực tế.
- Chỉ sau commit API mới xóa cookie `organic_session`; giao diện xóa trạng thái tài khoản, đưa về `/login?passwordChanged=success` và hiện **Đã đổi mật khẩu. Vui lòng đăng nhập lại.**
- `login` cũng dùng transaction và cập nhật `sessionRevision` trên user trước khi tạo phiên. Vì cùng ghi vào user, đăng nhập bằng mật khẩu cũ đồng thời với đổi/đặt lại mật khẩu sẽ bị xử lý xung đột: phiên tạo trước bị thu hồi, hoặc giao dịch đăng nhập chạy lại và kiểm tra hash mới. Không có phiên cũ được tạo muộn sau bước thu hồi.

Không thêm collection/index: tái sử dụng `users`, `sessions`, `login_attempts` và TTL hiện có. Thêm trường tùy chọn `users.phone`, bộ đếm nội bộ `users.sessionRevision`; người dùng cũ không có phone được hiển thị trống. Không cần seed lại dữ liệu ứng dụng.

## Tệp chính

- Mới: `src/components/profile-route.tsx`, `src/app/profile.css`, `src/lib/profile.ts`, `src/lib/password-policy.ts`, `tests/profile.spec.ts`.
- Tích hợp: catch-all page/API, `workspace.tsx`, `workspace-context.tsx`, `side-navigation.tsx`, root layout.
- Đồng bộ chính sách: `admin-console.tsx`, `service.ts`; nhất quán tạo/thu hồi phiên: `auth.ts`.

## Kiểm thử

- `npm run typecheck`: đạt.
- `npm run test:integration`: đạt trên MongoDB test riêng.
- `npm run test:e2e`: **26/26 đạt**, bao gồm production build, hồ sơ và toàn bộ luồng quản trị/công việc/điều hướng hiện có.
- Sau chỉnh sửa bố cục cuối: build production và 7 kiểm thử hồ sơ/sidebar chạy lại đều đạt; đã xem ảnh desktop/mobile.

`tests/profile.spec.ts` dùng tài khoản tạm trên MongoDB test riêng và dọn tài khoản/phiên sau mỗi bài:

1. Nhân viên lưu tên tiếng Việt có dấu và điện thoại; lỗi định dạng/lỗi mạng giữ form; khóa gửi lặp; tên/avatar thay đổi ngay; reload dữ liệu; xóa điện thoại; không lộ phone trong bootstrap/session/danh sách.
2. Admin, trưởng bộ phận, nhân viên chỉ thao tác hồ sơ của chính mình; từ chối sửa tổ chức/ID/hash/active, sai kiểu, tên trống, phone sai; từ chối khi chưa đăng nhập hoặc bị vô hiệu hóa.
3. Sai mật khẩu hiện tại, không khớp, mật khẩu mới giống cũ hoặc dưới 6 ký tự; đóng mở xóa trường; hiện/ẩn; bàn phím; đổi thành công đúng 6 ký tự; cookie hiện tại và phiên trình duyệt thứ hai bị thu hồi; mật khẩu cũ không đăng nhập được, mới đăng nhập được.
4. Giới hạn 5 lần thử/15 phút, hết hạn bộ đếm, rollback sau lỗi ghi hash và đăng nhập đồng thời bằng mật khẩu cũ.

Ảnh kiểm tra 1440/390 px: `docs/profile-desktop.png`, `docs/profile-mobile.png`, `docs/profile-password-mobile.png`.

Chưa xác minh tự điền bằng các sản phẩm quản lý mật khẩu bên ngoài hoặc thiết bị di động thật. Giao diện responsive và bàn phím được kiểm tra bằng Chromium/Playwright; không bổ sung tải ảnh đại diện hoặc luồng quên mật khẩu.

Tham khảo nghiệp vụ: [OWASP Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html). Độ dài tối thiểu 6 ký tự giữ theo chính sách Organic Work đã được yêu cầu trong phiên này.

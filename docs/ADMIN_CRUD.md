# Quản trị và dialog CRUD

Thực hiện theo [prompt quản trị](ADMIN_CRUD_BRIEF.md), giữ nhận diện xanh Organic và MongoDB làm nguồn dữ liệu.

## Bố cục mới

- `/admin` mở `/admin/users` mặc định.
- `/admin/users`: một danh sách tài khoản, nút Thêm tài khoản, tìm tên/email, lọc phòng ban/vai trò/trạng thái. Điều kiện nằm trên URL.
- `/admin/departments`: một danh sách phòng ban, tên và mã dạng văn bản, nút Thêm phòng ban. Không còn ô sửa và nút Lưu lặp trên từng dòng.
- Hai trang dùng chung tab Quản trị, mục đang chọn và breadcrumb. Mobile chuyển bảng sang thẻ có đầy đủ thông tin và menu thao tác.
- Form chỉ mở trong dialog. Xem là chế độ chỉ đọc; chuyển sang sửa trong cùng một dialog. Không có xóa vĩnh viễn.

## Dialog và lưu dữ liệu

Tài khoản có thêm, xem, sửa, xác nhận vô hiệu hóa và kích hoạt lại. Mật khẩu chỉ nhập khi tạo; chưa có thao tác đặt lại mật khẩu chuyên biệt nên không đổi mật khẩu trong form sửa. Trạng thái của tài khoản đang có được đổi qua menu có xác nhận, thay vì thay trực tiếp trong form sửa.

Phòng ban có thêm, xem và sửa; mã và ID được giữ ổn định khi sửa. Backend từ chối yêu cầu đổi mã qua API. Đổi tên không làm thay đổi tham chiếu từ tài khoản/công việc.

Form dùng bản nháp riêng cho từng lần mở, hỏi xác nhận khi Hủy/Đóng/Escape/bấm nền nếu đã sửa. Hộp xác nhận thay nội dung dialog hiện tại, không chồng nhiều dialog. Nội dung dài cuộn bên trong, footer thao tác giữ trong khung. Tab/Shift+Tab giữ focus; đóng trả focus về nút mở hoặc nút menu của dòng, nếu dòng biến mất do bộ lọc thì về nút thêm.

Gửi có khóa chống lặp, nút Đang lưu, chờ API xác nhận rồi tải lại danh sách MongoDB. Thành công hiển thị thông báo; nếu bản ghi không khớp bộ lọc hiện tại, thông báo nêu rõ và không đưa bản ghi sai vào danh sách. Lỗi giữ dialog và bản nháp; email/mã phòng trùng được báo cạnh trường. Tìm kiếm, bộ lọc và vị trí cuộn được giữ khi danh sách cho phép.

## Quyền và ràng buộc

Route quản trị kiểm tra phiên và vai trò tại server. Nhân viên/trưởng bộ phận nhận màn từ chối; `GET/POST /api/admin` yêu cầu Admin. Mỗi yêu cầu vẫn kiểm tra tài khoản hoạt động.

Tái sử dụng transaction và khóa quản trị để bảo vệ Admin hoạt động cuối cùng. Giữ kiểm tra phân công mở trước khi đổi phòng. Vô hiệu hóa làm phiên cũ mất quyền ở yêu cầu kế tiếp. Email được chuẩn hóa trim/lowercase và có unique index; mã phòng có unique index. Không đưa password hash vào API đọc.

## Tệp chính

| Tệp | Thay đổi |
| --- | --- |
| `src/components/admin-console.tsx` | Hai danh sách, bộ lọc URL, menu, bản nháp và vòng đời CRUD |
| `src/components/dialog.tsx` | Dialog/AlertDialog dùng chung, focus, Escape, backdrop, footer cố định |
| `src/app/admin.css` | Bảng desktop, thẻ mobile và bố cục dialog |
| `src/components/workspace.tsx` | Tích hợp trang quản trị, breadcrumb, bỏ form quản trị cũ |
| `src/app/[[...page]]/page.tsx` | Kiểm tra quyền server và tương thích `/admin` |
| `src/lib/service.ts` | Giữ mã phòng ổn định, trả ID bản ghi lưu, xác thực CRUD |
| `src/app/api/[...path]/route.ts` | API quản trị đọc/ghi, lỗi theo trường, từ chối quyền |
| `tests/admin-crud.spec.ts` | Nghiệm thu CRUD, quyền, bàn phím và mobile |
| `tests/workflow.spec.ts` | Cập nhật hồi quy quản trị theo luồng dialog mới |

## Cách kiểm tra lại

```sh
npm run typecheck
npm run test:integration
npm run test:e2e
```

E2E tự build production, chạy app cổng 3101 với database `organic_work_test` tách khỏi demo và dừng app sau khi xong. Dùng Chromium ở 1440×1000 và 390×844. Chạy local bằng `npm run dev` rồi mở http://localhost:3100/admin/users với tài khoản `admin@organic.vn`; mật khẩu lấy từ `DEMO_PASSWORD` trong `.env` của máy.

Ảnh: [Tài khoản desktop](admin-users-desktop.png), [mobile](admin-users-mobile.png), [dialog mobile](admin-user-dialog-mobile.png), [Phòng ban desktop](admin-departments-desktop.png), [mobile](admin-departments-mobile.png). Ảnh dùng dữ liệu demo/test, không phải dữ liệu nghiệp vụ.

Giới hạn: chưa kiểm thử Safari/Firefox, tải lớn hoặc deployment Atlas/HTTPS trong lượt này. Kết quả thực tế của lượt chạy cuối được ghi bên dưới.

## Kết quả kiểm thử thực tế

Lượt chạy cuối: **12/12 E2E đạt**, 47,5 giây, trên production build với MongoDB replica set local. Bao gồm ba bài CRUD mới và chín bài hồi quy của các luồng đang có.

| Ca nghiệm thu | Kết quả |
| --- | --- |
| `/admin` mặc định Tài khoản; hai URL riêng, reload và Back/Forward | Đạt; mỗi trang chỉ có danh sách tương ứng, không có form ngoài dialog |
| Thêm tài khoản, reload còn dữ liệu; email trùng và chuẩn hóa email | Đạt; lỗi cạnh trường, bản nháp giữ nguyên |
| Sửa hai tài khoản liên tiếp; hủy không ghi; chỉ sửa đúng bản ghi | Đạt; kiểm tra lại bằng API MongoDB |
| Xem chỉ đọc → sửa một dialog, không tự gửi form | Đạt sau sửa lỗi nút chuyển chế độ |
| Xác nhận vô hiệu hóa/kích hoạt lại, giữ tìm kiếm và bộ lọc | Đạt; bản ghi không khớp bộ lọc được loại và có thông báo |
| Admin cuối cùng; chuyển phòng của người còn việc mở | Đạt; server từ chối, dialog giữ bản nháp và thông báo |
| Thêm/sửa phòng, mã trùng, mã ổn định, tên trong bộ chọn | Đạt; tham chiếu tài khoản và công việc giữ cùng ID sau đổi tên |
| Nhân viên mở route/API quản trị | Đạt; route từ chối và API đọc trả 403 |
| 390 px, 1440 px, Enter/Tab/Shift+Tab/Escape, trả focus | Đạt; dialog cuộn nội dung, footer trong khung và danh sách mobile không tràn ngang |
| Lỗi lưu 500 có kiểm soát và chống gửi lặp | Đạt; một yêu cầu gửi, dialog không đóng và nội dung giữ nguyên |
| Hồi quy vô hiệu hóa thu hồi phiên | Đạt; phiên cũ bị từ chối ở yêu cầu tiếp theo, đăng nhập lại bị chặn |

`npm run test:integration` đạt trên MongoDB thật, gồm bảo vệ Admin, chuyển phòng, transaction và các kiểm tra nghiệp vụ trước đó. `npm run typecheck` đạt; production build đạt trước E2E. Không có ca local bắt buộc nào còn bị chặn. Các giới hạn đa trình duyệt/triển khai đã nêu ở trên.

Các lỗi phát hiện và sửa: nút chuyển Xem→Sửa có thể tự submit; autofocus trễ có thể chuyển focus trong lúc nhập; vòng Tab của dialog; cập nhật liên tiếp bộ lọc URL làm mất giá trị tìm kiếm. Các ca tương ứng đều có kiểm thử đạt ở lượt cuối.

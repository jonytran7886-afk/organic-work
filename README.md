# Organic Work

Ứng dụng quản lý công việc nội bộ Tập đoàn Organic Việt Nam. Next.js App Router, TypeScript, Tailwind CSS và MongoDB Node driver. Dự án độc lập, không sử dụng database của website corporate.

## Điều hướng và tải dữ liệu

Khung sidebar/header nằm trong shared layout, giữ nguyên khi chuyển tab. Dữ liệu trang có cache bộ nhớ theo tài khoản/quyền và revalidate ở nền; thay đổi bộ lọc trên cùng trang không điều hướng RSC. Phiên được kiểm tra riêng khi chuyển path, quyền ghi/đọc vẫn kiểm tra tại backend. Xem [nguyên nhân, cách sửa và kiểm thử chống giật trắng](docs/NAVIGATION_PERFORMANCE.md).

## Quản trị tài khoản và phòng ban

`/admin` mở `/admin/users` mặc định. Sidebar có nhóm **Công việc** (Việc của tôi → Công việc phòng ban → Tiến độ theo quyền) và nhóm **Quản trị** chỉ cho Admin (Tài khoản → Phòng ban). Hai mục quản trị mở trực tiếp trang riêng; không còn tab phía trên nội dung. Mobile dùng drawer, đóng sau khi chọn mục. Xem [nghiệm thu sidebar/drawer và URL cũ](docs/SIDEBAR_ADMIN.md). Mỗi trang chỉ có một danh sách. Tài khoản có tìm tên/email và lọc phòng, vai trò, trạng thái trên URL. Thêm, sửa và xem dùng dialog; vô hiệu hóa/kích hoạt lại có xác nhận, form chưa lưu hỏi trước khi bỏ thay đổi. Lỗi trùng email/mã phòng hiển thị cạnh trường và giữ nội dung đã nhập. Không có xóa vĩnh viễn.

Chỉ Admin truy cập các route và API quản trị. Giữ quy tắc Admin cuối cùng và xử lý việc mở trước khi chuyển phòng. Form sửa không đổi mật khẩu. Admin dùng menu tài khoản → **Đặt lại mật khẩu**, nhập mật khẩu mới (10–200 ký tự) và xác nhận; các phiên đăng nhập của tài khoản được thu hồi sau khi lưu. Xem [nghiệm thu quản trị CRUD](docs/ADMIN_CRUD.md).

Khi thêm phòng ban, chỉ cần nhập tên. Server tự cấp mã `PB-000001` bằng bộ đếm MongoDB và kiểm tra duy nhất; mã cùng ID giữ nguyên khi đổi tên. Mã phòng hiện có tiếp tục được sử dụng.

## Nhận diện Organic Việt Nam

Giao diện dùng logo chính thức và hai màu gốc `#006B35` / `#58A500`, với sidebar xanh đậm, nền sáng và hệ thống thẻ/form đồng bộ. Xem [quy chuẩn nhận diện và ảnh giao diện](docs/BRAND_IDENTITY.md), [đăng nhập mới](docs/brand-login-desktop.png) và [giao diện mobile](docs/my-tasks-mobile.png). SVG được lưu local trong `public/brand`; các thành phần dùng chung ở `src/components/brand.tsx` và kiểu thương hiệu ở `src/app/brand.css`.

## Bố cục và theo dõi tiến độ

Đã nâng cấp theo [prompt bố cục và tiến độ](docs/LAYOUT_PROGRESS_BRIEF.md). Đăng nhập thông thường đưa mọi vai trò về **Việc của tôi**; link chi tiết giữ nguyên sau xác thực. Trưởng bộ phận và Admin có **Tiến độ** ngay sau Việc của tôi. Route Tổng quan cũ chuyển sang Tiến độ với quản lý hoặc Việc của tôi với nhân viên.

Việc của tôi mặc định là danh sách việc mở, nhóm theo hạn và có bộ đếm nhanh, tìm/lọc, thao tác trạng thái tại dòng. Tiến độ có phạm vi phòng xử lý/yêu cầu đã gửi, sáu số liệu, phân công trực tiếp và bảng phân bổ theo người/phòng. Lý do chờ bắt buộc khi chuyển mới sang Đang chờ, lưu cùng trạng thái và lịch sử trong transaction. Bộ lọc và ngữ cảnh quay lại chi tiết lưu trên URL.

Xem [bảng đối chiếu tính năng và nghiệm thu nâng cấp](docs/LAYOUT_PROGRESS.md). [Ảnh Việc của tôi](docs/my-tasks-desktop.png), [ảnh Tiến độ](docs/progress-desktop.png) và [giao diện điện thoại](docs/my-tasks-mobile.png) được tạo từ môi trường kiểm thử.

## Chạy local

Yêu cầu Node.js 22.13 trở lên, npm và Docker Compose. Cổng app `3100`, MongoDB `27018` (chỉ loopback).

```sh
cd organic-work
cp .env.example .env
# Điền BOOTSTRAP_ADMIN_PASSWORD (ít nhất 12 ký tự) trong .env
npm ci
docker compose up -d
npm run db:setup
npm run db:bootstrap-admin
npm run dev
```

Mở http://localhost:3100. Admin đầu tiên dùng `BOOTSTRAP_ADMIN_EMAIL` và mật khẩu vừa đặt. Bootstrap bỏ qua khi database đã có tài khoản. Không có tài khoản đăng ký công khai; Admin tạo tài khoản trong Quản trị.

`db:setup` chờ replica set có primary, tạo collections/indexes theo cách chạy lại an toàn. Compose sử dụng named volume `organic_work_mongo`, khởi tạo replica set lặp an toàn. Không dùng `docker compose down -v` nếu cần giữ dữ liệu.

## Demo

Trong `.env`, đặt `MONGODB_DB=organic_work_demo`, `ALLOW_DEMO_SEED=true` và `DEMO_PASSWORD` ít nhất 12 ký tự, sau đó:

```sh
npm run db:setup
npm run db:seed
npm run dev
```

Seed chỉ hoạt động với database có `demo` hoặc `test` trong tên và cờ cho phép. Khóa seed ổn định, `$setOnInsert` và transaction đảm bảo chạy lại không nhân đôi, không ghi đè mật khẩu, tên phòng hoặc công việc đã sửa. Hạn mẫu tính theo ngày seed ở Việt Nam, giữ nguyên khi seed lại.

| Email | Vai trò | Phòng |
| --- | --- | --- |
| admin@organic.vn | Admin | Kinh doanh |
| kinhdoanh@organic.vn | Trưởng bộ phận | Kinh doanh |
| vanhanh@organic.vn | Trưởng bộ phận | Vận hành |
| nv.vanhanh@organic.vn | Nhân viên | Vận hành |
| nv.vanhanh2@organic.vn | Nhân viên | Vận hành |
| nv.kinhdoanh@organic.vn | Nhân viên | Kinh doanh |
| nv.chatluong@organic.vn | Nhân viên | Chất lượng |

Có thêm `nv.nghi@organic.vn` (đã tắt) để kiểm tra bộ chọn không cho phân công người ngừng hoạt động.

Tất cả tài khoản mẫu mới tạo dùng `DEMO_PASSWORD`. Admin có thể dùng **Đặt lại mật khẩu** trong menu tài khoản; form sửa thông tin không đổi mật khẩu. Seed không đặt lại mật khẩu tài khoản đã tồn tại. Kho vận được tạo làm phòng mẫu thứ tư.

## Kiểm thử và build

```sh
npm run typecheck
npm run test:integration
npx playwright install chromium
npm run test:e2e
npm run build
npm start
```

Hai lệnh test tự chọn `MONGODB_TEST_DB` (mặc định `organic_work_test`), từ chối dùng cùng database với app hoặc tên không chứa `test`. MongoDB thật phải đang chạy. Playwright build production và khởi động server riêng ở `3101`; không chạy song song dev/build/test vì Next dùng chung thư mục `.next`. Báo cáo HTML ở `playwright-report/index.html`, trace lỗi trong `test-results/`.

Kiểm thử tích hợp kiểm tra seed/setup hai lần, indexes, bảo vệ Admin cuối, phân quyền, tham chiếu, archive, `completedAt`, ngày hạn, và cố tình gây lỗi ở bước ghi lịch sử để xác nhận rollback. Cờ gây lỗi chỉ tồn tại trong lời gọi hàm nội bộ test, không nhận qua API.

Playwright kiểm tra giao việc liên phòng → phân công → Việc của tôi → trạng thái/bình luận → theo dõi từ phòng yêu cầu; từ chối truy cập/phân công sai quyền; đối chiếu bộ đếm quá hạn; lưu trữ/khôi phục; tạo phòng/tài khoản; thu hồi phiên khi tắt tài khoản; giao diện mobile. Kết quả v1 xem `docs/VERIFICATION.md`; kết quả nâng cấp hiện tại xem `docs/LAYOUT_PROGRESS.md`.

## Quy tắc dữ liệu và quyền

- Cookie session ngẫu nhiên 256 bit, HttpOnly/SameSite, Secure trong production. Chỉ lưu SHA-256 token trong MongoDB, TTL theo `SESSION_TTL_HOURS`; mỗi yêu cầu đọc lại tài khoản đang hoạt động. Mật khẩu băm scrypt với salt ngẫu nhiên. POST/PATCH kiểm tra Origin. Đăng nhập có giới hạn thử sai.
- Quyền áp dụng ở API và lớp dịch vụ cho danh sách, chi tiết, lịch sử, bình luận và ghi dữ liệu. Admin xem mọi việc; trưởng bộ phận xem việc phòng yêu cầu/phụ trách, chỉ sửa việc phòng phụ trách; nhân viên xem/bình luận việc phòng phụ trách và chỉ đổi trạng thái việc được giao.
- Giao việc liên phòng để trống người phụ trách. Trưởng phòng nhận/Admin chọn người còn hoạt động thuộc phòng nhận. Đổi phòng của nhân sự còn phân công đang mở bị từ chối. Giao dịch quản trị tuần tự qua bản ghi khóa để bảo vệ Admin cuối khi yêu cầu đồng thời.
- Tạo/sửa việc và lịch sử dùng chung `session.withTransaction()`. Bình luận kiểm tra và ghi trong transaction. Việc lưu trữ chỉ đọc/khôi phục. Khôi phục giữ nguyên bình luận/lịch sử.
- ObjectId cho khóa và tham chiếu; BSON Date cho thời điểm; `dueDate` dạng ngày lịch `YYYY-MM-DD`. Quá hạn dùng ngày hiện tại `Asia/Ho_Chi_Minh`, loại việc hoàn thành. Mở lại đặt `completedAt=null`.
- Kanban đổi trạng thái bằng menu, không kéo thả. Mobile mặc định danh sách có menu đổi trạng thái và nút đăng xuất. Form tạo việc hỗ trợ Escape và giữ focus trong hộp thoại.

## Production / Atlas

Thay `MONGODB_URI` bằng URI MongoDB Atlas (`mongodb+srv://...`) hoặc replica set hỗ trợ transaction; đặt `MONGODB_DB=organic_work`, `APP_ORIGIN=https://ten-mien-noi-bo`, `ALLOW_DEMO_SEED=false`. Không dùng URI standalone. Giữ bí mật trong môi trường server, không dùng tiền tố `NEXT_PUBLIC_`. Chạy setup/bootstrap rồi build/start sau HTTPS reverse proxy. App dùng Node runtime, không chạy trên Edge/Cloudflare Worker. MongoClient tái sử dụng theo tiến trình.

V1 không có marketplace ADIGO, ERP, kho, KPI, chấm công hay email nhắc việc. Các bộ đếm phản ánh dữ liệu ở lần tải gần nhất; tải lại để nhận cập nhật của người khác, chưa có realtime. Triển khai nhiều instance nên bổ sung rate limit dùng IP từ reverse proxy đáng tin cậy. Không có API upload hoặc rich text.

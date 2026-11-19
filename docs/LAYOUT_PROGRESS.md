# Nâng cấp bố cục và theo dõi tiến độ Organic Work

Phần Quản trị đã được nâng cấp tiếp theo [báo cáo dialog CRUD](ADMIN_CRUD.md); các kết quả 9 bài ở tài liệu này là nghiệm thu của lượt bố cục/tiến độ trước đó.

Đặc tả: [prompt nâng cấp](LAYOUT_PROGRESS_BRIEF.md). Mã nguồn được sửa trực tiếp trong dự án `organic-work`; MongoDB và các API ghi dữ liệu v1 tiếp tục được sử dụng.

## Đối chiếu trước triển khai và kết quả bổ sung

| Hạng mục | Trước nâng cấp | Đã bổ sung / tệp liên quan |
| --- | --- | --- |
| Đăng nhập thông thường | Về Tổng quan | Về `/my-tasks` cho mọi vai trò; link chi tiết được giữ khi đăng nhập ngay trên URL đó. `src/components/workspace.tsx` |
| Điều hướng | Tổng quan, Việc của tôi, bảng, quản trị | Việc của tôi đứng đầu; Tiến độ ngay sau cho trưởng bộ phận/Admin; nhân viên không có Tiến độ. `/`, `/overview` và route cũ về Tiến độ hoặc Việc của tôi theo quyền. |
| Việc cá nhân | Bảng chung lọc theo người, vẫn có việc hoàn thành | Mặc định danh sách việc mở được giao, nhóm Quá hạn/Hôm nay/7 ngày tới/Sau đó/Chưa có hạn, ưu tiên trong cùng hạn. Chế độ hoàn thành riêng. `work-views.tsx`, `work-model.ts`, `work-query.ts` |
| Thao tác tại dòng | Menu trạng thái | Bắt đầu, Đang chờ, Hoàn thành; cùng API/transaction với chi tiết; lỗi lưu giữ trạng thái cũ. |
| Bộ đếm cá nhân và bộ lọc | Chưa có nhóm nhanh, chưa giữ đầy đủ URL | Quá hạn/Hôm nay/Đang chờ có thể bấm; tìm tiêu đề, lọc trạng thái/ưu tiên, xóa lọc và trạng thái trống riêng. |
| Tiến độ quản lý | Tổng quan chung phạm vi nhìn thấy | Tab Phòng tôi phụ trách/Yêu cầu đã gửi. Admin toàn công ty hoặc chọn phòng/người. Sáu số liệu, danh sách Cần xử lý và phân bổ theo người/phòng. `/progress` |
| Phân công tại dòng | Chỉ trong chi tiết | Phân công trực tiếp khi chưa có người; chỉ trưởng phòng xử lý/Admin, chỉ tài khoản hoạt động đúng phòng. |
| Lý do chờ | Chưa có | `waitingReason` tùy chọn; bắt buộc khi chuyển mới vào chờ, hỗ trợ bổ sung việc cũ, xóa khi ra khỏi chờ và giữ trước/sau trong lịch sử transaction. `src/lib/service.ts` |
| Phạm vi backend | Quyền bản ghi v1 đã có | API `GET /api/work` áp dụng quyền và điều kiện MongoDB trước khi tính/nhóm/tìm kiếm; chặn nhân viên xem Tiến độ và tham số mở rộng phạm vi. |
| Giữ ngữ cảnh | Một số bộ lọc có URL | Mọi bộ lọc, tab phạm vi, chế độ danh sách và nhóm số liệu trên URL; link chi tiết mang `from` đã kiểm tra đường dẫn nội bộ; quay lại giữ nguyên điều kiện. |
| Dữ liệu cũ thiếu hạn | Có thể lỗi khi sắp xếp/hiển thị | Xem được, không tính quá hạn, nhóm Chưa có hạn. Quy tắc ngày dùng Asia/Ho_Chi_Minh. |
| Seed và kiểm thử | Bộ v1 | Thêm chín tình huống hạn/lý do chờ/việc quản lý và một tài khoản vô hiệu hóa để kiểm tra bộ chọn. `$setOnInsert`, không ghi đè mật khẩu hoặc công việc đã sửa. |

## Cách dùng

```sh
cd organic-work
# MongoDB local đã được cấu hình theo .env.example
npm ci
docker compose up -d
npm run db:setup
npm run db:seed
npm run dev
```

Bản demo dùng `MONGODB_DB=organic_work_demo`, `ALLOW_DEMO_SEED=true` và mật khẩu `DEMO_PASSWORD` trong `.env`; ứng dụng ở http://localhost:3100. Với database nghiệp vụ trống, dùng `db:bootstrap-admin` thay seed theo [README](../README.md).

| Tài khoản | Vai trò / cách kiểm tra |
| --- | --- |
| `nv.vanhanh@organic.vn` | Nhân viên Vận hành, có đầy đủ nhóm hạn mẫu |
| `vanhanh@organic.vn` | Trưởng phòng Vận hành; việc cá nhân và phân công yêu cầu đến |
| `kinhdoanh@organic.vn` | Trưởng phòng Kinh doanh; tab Yêu cầu đã gửi |
| `admin@organic.vn` | Admin; toàn công ty, lọc phòng và quản trị |
| `nv.vanhanh2@organic.vn` | Nhân viên cùng phòng, mặc định chưa được phân công |
| `nv.kinhdoanh@organic.vn` | Nhân viên Kinh doanh |
| `nv.chatluong@organic.vn` | Nhân viên Chất lượng, dùng kiểm tra chặn công việc phòng khác |
| `nv.nghi@organic.vn` | Tài khoản đã tắt; không đăng nhập, không xuất hiện trong bộ chọn phân công |

Mật khẩu tài khoản demo được tạo mới lấy từ `DEMO_PASSWORD`. Seed không đặt lại mật khẩu tài khoản đã có. Ngày tương đối được tính ở lần chèn fixture đầu tiên; seed lại không đẩy hạn của việc cũ. Bài E2E tự tạo fixture mới để xác minh mốc ngày hiện tại.

## Quy tắc truy vấn và điều hướng

`GET /api/work?view=mine|progress|board` hỗ trợ `scope`, `department`, `assignee`, `status`, `priority`, `metric`, `q`, `archived`, `completed`, `open`. Mọi ID được xác thực, quyền bản ghi luôn là điều kiện gốc của truy vấn MongoDB. Nhân viên gọi `view=progress` nhận 403. Trưởng phòng chọn `scope=all` hoặc chọn phòng khác trong `scope=owned` nhận 403; `scope=sent` luôn chỉ trả yêu cầu từ phòng mình sang phòng khác. Các bộ lọc chỉ thu hẹp quyền.

Số liệu tính trên cùng tập dữ liệu đã lọc; `metric` chọn tập con để hiển thị. `Quá hạn` và `Chưa phân công` chỉ đếm việc đang mở, có thể giao nhau. `Hoàn thành` đếm mọi việc đang ở trạng thái hoàn thành trong phạm vi, không có giới hạn thời gian ngầm. Chưa có phân trang, `total` là toàn bộ số kết quả.

Nhấn số liệu mở `/board` dạng danh sách cùng phạm vi/bộ lọc. Bảng phân bổ theo người chỉ đo số công việc, không coi đó là KPI hoặc khối lượng lao động. Admin bấm tên phòng ở bảng toàn công ty để xem phân bổ người của phòng đó; bấm số liệu mở danh sách.

## Kiểm thử

```sh
npm run typecheck
npm run test:integration
npm run test:e2e
npm run build
```

E2E build production trước khi chạy, dùng `organic_work_test` (hoặc `MONGODB_TEST_DB`), cổng 3101; độc lập với demo. Tránh chạy dev/build đồng thời vì dùng chung `.next`. Playwright dừng server kiểm thử sau khi xong. Kết quả cụ thể được ghi bên dưới sau lượt xác minh cuối.

## Giới hạn và cơ hội tiếp theo

Chưa có thông báo trong ứng dụng khi được giao việc hoặc màn lịch hạn. Các công cụ theo dõi hiện có là bộ đếm Việc của tôi, nhóm Hôm nay/7 ngày tới, bộ lọc quá hạn và lịch sử công việc. Thông báo và lịch là cơ hội nâng cấp riêng, không được bổ sung vào phạm vi lượt này. Chưa có realtime; thay đổi của người khác xuất hiện khi tải lại, thay đổi của chính người dùng làm mới số liệu và danh sách sau khi lưu.

Chưa kiểm thử Safari/Firefox, tải lớn hay triển khai Atlas/HTTPS thực tế vì phiên này dùng Chromium và MongoDB replica set local. Không có thay thế MongoDB bằng dữ liệu trình duyệt.

## Tham khảo thiết kế

Tham khảo cách nhóm/lọc việc cá nhân của [Asana My Tasks](https://help.asana.com/s/article/maximize-productivity-with-my-tasks?language=en_US), cách theo dõi việc hoàn thành/quá hạn theo người của [Asana progress](https://help.asana.com/s/article/tracking-project-progress), và nhóm số liệu theo trạng thái/hạn/thành viên của [Trello Dashboard](https://support.atlassian.com/trello/docs/dashboard-view). Organic Work giữ giao diện riêng và tuân theo chi tiết nghiệm thu trong prompt.

## Kết quả nghiệm thu thực tế — 19/11/2026

Môi trường: Node.js 22.21.0, MongoDB 7.0 replica set Docker, Chromium. Bộ E2E chạy trên app production; database kiểm thử tách khỏi demo.

| Ca nghiệm thu trong prompt | Kết quả |
| --- | --- |
| 1. Đăng nhập thấy việc cá nhân; mốc hôm qua/hôm nay/ngày mai/ngày 7/ngày 8/không hạn; không trùng nhóm; ưu tiên cao trước; hoàn thành riêng | Đạt qua `layout-progress.spec.ts` và integration. Tạo fixture theo ngày chạy, kiểm tra từng ID và thứ tự ưu tiên. |
| 2. Quản lý mở Tiến độ một lần bấm; số quá hạn khớp; quay lại từ chi tiết giữ bộ lọc | Đạt. Kiểm tra cả URL phạm vi, ưu tiên, nhóm số liệu và tìm kiếm. |
| 3. Yêu cầu Kinh doanh → Vận hành, phân công tại dòng, nhân viên thấy trên trang đầu; phòng gửi không phân công bên nhận | Đạt. Bộ chọn loại tài khoản phòng khác và tài khoản đã tắt; API sửa vượt quyền bị từ chối. |
| 4. Nhập lý do chờ, quản lý nhìn thấy; hoàn thành cập nhật số liệu, lý do chỉ còn trong lịch sử và tồn tại sau reload | Đạt. Cố tình trả lỗi lưu 500 trên UI xác nhận trạng thái giữ nguyên. Integration gây lỗi ghi lịch sử xác nhận rollback cả trạng thái và lý do. |
| 5. Chặn nhân viên mở Tiến độ/API; tham số phòng và scope ngoài quyền | Đạt. API trả 403, màn hình không có số liệu; trưởng phòng chỉ xem đúng phòng xử lý hoặc yêu cầu của phòng mình. |
| 6. Giao diện 390/1440 px, bàn phím, hồi quy và production build | Đạt. Ảnh desktop/mobile được kiểm tra; việc đầu tiên của người đăng nhập nằm trong viewport 844 px. Test Enter, Shift+Tab giữ focus trong hộp thoại, Escape hủy thao tác và quay lại danh sách bằng bàn phím. |
| Admin: lọc phòng/người, sáu ô số liệu và bảng phân bổ | Đạt. Đối chiếu từng ô với số kết quả API/danh sách; bấm người chỉ hiện việc mở được giao. |
| Dữ liệu đang chờ cũ thiếu lý do | Đạt. Hiện Chưa ghi lý do, bổ sung bằng bàn phím, xóa lý do khi ra khỏi chờ, lịch sử giữ trước/sau. |
| Bộ lọc Kanban/danh sách | Đạt. Đổi ưu tiên giữ nhóm Đang chờ, đổi chế độ và đi/về chi tiết giữ cùng bộ lọc. |
| Hồi quy v1 | Đạt. Giao việc liên phòng, trạng thái, bình luận, lưu trữ/khôi phục, tạo phòng/tài khoản, thu hồi phiên và mobile. |

- `npm run test:integration`: đạt, gồm seed/setup lặp an toàn, quyền, transaction, nhóm ngày và các bộ đếm Tiến độ.
- `npm run test:e2e`: **9/9 đạt**, lượt cuối **25,4 giây**, bao gồm khởi động build/server production theo cấu hình Playwright.
- Production build: đạt qua `npm run build` trước E2E. `npm run typecheck`: đạt trong quá trình triển khai; build cuối cũng kiểm tra TypeScript.
- Không có ca nghiệm thu local bắt buộc còn bị chặn. Các giới hạn triển khai/đa trình duyệt được ghi ở phần trên.

Ảnh kiểm chứng: [Việc của tôi desktop](my-tasks-desktop.png), [mobile](my-tasks-mobile.png), [Tiến độ desktop](progress-desktop.png), [mobile](progress-mobile.png), [Kanban](kanban-desktop.png), [danh sách điện thoại](board-mobile.png). Ảnh dùng dữ liệu kiểm thử, có cả các công việc được tạo bởi E2E.

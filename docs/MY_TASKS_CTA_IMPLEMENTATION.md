# Cập nhật danh sách Việc của tôi ADIGO

Ngày hoàn tất kiểm tra: 23/11/2026, Asia/Saigon. Đã triển khai trực tiếp trong repo Organic Work theo yêu cầu cập nhật mới, không chỉ lập phương án.

## Giao diện và thao tác

- Danh sách My Tasks có năm cột: Tên công việc, Trạng thái, Hạn hoàn thành, Ưu tiên, Thao tác. Desktop dùng hàng cao tối thiểu 64 px; các hàng lá được kiểm tra không vượt 72 px trong ca trạng thái. Mobile chuyển sang bố cục hai hàng metadata/hành động, title có thể xuống dòng.
- Giữ các nhóm hạn hiện tại, kể cả Sau đó cho việc ngoài 7 ngày để không làm mất việc tương lai. Từng nhóm mở/thu gọn bằng summary hỗ trợ bàn phím.
- Todo chỉ hiện Bắt đầu; doing chỉ hiện Hoàn thành; waiting hiện Tiếp tục. Done không có CTA chính, Mở lại ở menu. Thao tác phụ chuyển vào menu, không lặp lại CTA chính.
- Cha có con hoạt động dùng actions riêng đúng guards hiện tại: không cho đổi status tự do, reviewer/Admin mới được xác nhận khi đủ điều kiện. Giữ tự hoàn thành cha không reviewer và cơ chế mở lại/tính tiến độ hiện có.
- Menu dùng native popover top layer, tự canh theo viewport, không bị container cắt. Có labels/tooltips, ArrowUp/Down, Home/End, Escape, click ngoài và trả focus. Chỉ hiện các thao tác backend hỗ trợ; không thêm Xóa/Sao chép khi chưa có API.
- Search, filter status/priority được giữ; bổ sung sort theo hạn, priority hoặc title trong từng nhóm. Sort lưu trong URL và được server áp dụng.
- Có busy state, khóa gửi lặp và thông báo thành công/lỗi qua cơ chế workspace hiện có; status chỉ cập nhật khi API thành công. Dialog lý do chờ và bàn giao liên phòng được tái sử dụng.

## Subtask và quyền

- Menu trên task hiện hữu và Task Detail cùng dùng canCreateSubtask. Nhân viên active, cùng phòng nhận, là creator hoặc assignee của cha có thể thêm con khi cha root chưa done/archive.
- Quyền này không làm thay đổi canManage hoặc quyền phân công: nhân viên chỉ tự giao con hoặc để chưa phân công; giao đồng nghiệp/khác phòng và sửa toàn bộ cha vẫn bị server từ chối theo quyền hiện tại.
- Giữ một cấp cha–con, parentTaskId thật, kế thừa scope phòng từ cha, creator từ phiên đăng nhập. Không thay database schema hoặc chạy migration dữ liệu ứng dụng.
- Root Create Task không có picker cha, nút tạo con hay cấu hình hierarchy. Điểm tạo con vẫn chỉ từ task đã tồn tại; form dùng các primitive/logic lưu sẵn có.
- Cha có icon mở/thu gọn và tỷ lệ x/y; con thụt vào, có status, deadline, assignee và link riêng. Danh sách con chỉ tải khi mở, 25 bản ghi/trang với cursor _id. Không tải history/file để dựng cây.
- Khi mở cha trong My Tasks, những con đã hiển thị dưới cha không lặp lại ở danh sách chính. Tổng đầu việc không cộng thêm task cha tổng hợp hoặc bản hiển thị ngữ cảnh.
- Expanded state giữ trong workspace và xóa khi hết phiên. Mutation làm mới workspace/detail/children caches, giữ filters và cơ chế khôi phục vị trí hiện có. Chưa bổ sung realtime đa phiên; phiên khác nhận dữ liệu khi refetch/refresh.

## File sản phẩm thay đổi trong đợt này

- `src/components/task-list-row.tsx` — mới: heading năm cột, row gọn, expanded children, phân trang và hiển thị người phụ trách con.
- `src/components/task-row-menu.tsx` — menu popover, keyboard, actions phụ và TaskPrimaryAction dùng chung.
- `src/components/work-views.tsx` — nhóm thu gọn, danh sách My Tasks mới, sort control, bỏ các nút trạng thái cạnh nhau, tránh hiển thị con lặp.
- `src/components/task-hierarchy.tsx` — cha theo dõi dùng cùng row; Detail kiểm quyền tạo con riêng.
- `src/components/workspace-context.tsx`, `src/components/workspace.tsx` — chia sẻ mutation/busy/expanded state, feedback và anchor sửa/lịch sử.
- `src/lib/model.ts` — canCreateSubtask và taskStatusActions tập trung ở domain layer.
- `src/lib/service.ts` — server kiểm quyền tạo con riêng, giữ giới hạn assignee, phòng, depth, trạng thái cha và transaction.
- `src/lib/task-hierarchy.ts` — childrenPage giới hạn 25 con/trang, lọc scope và bỏ dữ liệu lớn không cần thiết.
- `src/app/api/[...path]/route.ts` — GET children; dispatch GET/PATCH task theo đúng độ dài path, tránh route con bị handler task nuốt.
- `src/lib/work-model.ts`, `src/lib/work-query.ts` — comparator và validation sort, giữ query assignee/participant và thống kê hiện tại.
- `src/app/my-tasks.css` — mới: grid/row, responsive và top-layer menu.
- `src/app/layout.tsx` — nạp stylesheet mới sau styles hiện tại.

Working tree đã có thay đổi của các công việc trước; không reset hoặc commit những phần đó. Một số ảnh trong docs được các bài regression hiện có chụp lại khi chạy test.

## Kiểm thử và bằng chứng

Các kiểm tra cuối đều đạt:

- `npm run typecheck -- --incremental false` — exit 0.
- `npm run test:integration`, với `MONGODB_TEST_DB=organic_work_cta_test_20261123` — exit 0; MongoDB replica set thật, kiểm transaction/rollback, permission, trạng thái, scope, dates và counts.
- `npm run test:e2e`, với `MONGODB_TEST_DB=organic_work_cta_e2e_test_20261123_verified` — 39 passed, exit 0, 2,1 phút. Lệnh này build production và mở server riêng ở 3101 trước khi chạy.
- Production build — đạt trong bước webServer của Playwright; compile, TypeScript và khởi động production server thành công. Không chạy build/dev/E2E đồng thời.

Ba test mới trong `tests/my-tasks-cta.spec.ts` kiểm CTA cả bốn trạng thái, sort, nhóm thu gọn, menu bàn phím, kích thước hàng desktop, viewport 1440/768/390, nhân viên creator/assignee, gọi API vượt quyền, tạo con từ List và Detail, reload, không lặp con, không có Subtask trong root modal, retry cùng UUID và 27 con qua hai trang.

Các test hồi quy được cập nhật đúng đường thao tác mới, không bỏ assertion nghiệp vụ:

- `tests/layout-progress.spec.ts` mở menu trước các thao tác Hoàn thành/Chờ được chuyển khỏi hàng.
- `tests/participants-menus.spec.ts` kiểm assignee employee được thêm con nhưng không giao lại; helper đổi tài khoản xóa cookie trước đăng nhập, không giả định trang login còn hiện khi có phiên hợp lệ.
- `tests/subtasks.spec.ts` giữ ca từ chối nhân viên không có quyền, cập nhật thông báo lỗi vì không còn quy tắc chỉ manager tạo con.

Các vòng đầu phát hiện thiếu hiển thị lý do chờ cũ và test còn bấm nút trực tiếp/đăng nhập trên phiên cũ; các điểm này đã sửa rồi chạy lại đủ 39 ca đạt. Kết quả trên thuộc bản cuối, không phải kết quả dự kiến trong các báo cáo thiết kế trước.

Ảnh đã mở kiểm tra trực quan:

- [My Tasks desktop](my-tasks-cta-1440.png).
- [My Tasks tablet](my-tasks-cta-768.png).
- [My Tasks mobile](my-tasks-cta-390.png).
- [Subtask mở dưới cha](my-tasks-subtask-expanded.png).

Database test được tách khỏi database ứng dụng bởi runner hiện có. Không seed/reset/migration trên database ứng dụng. Chưa kiểm thiết bị di động thật hoặc tải lớn nhiều người; không coi 39 ca là chứng minh mọi cấu hình workflow tương lai đã được hỗ trợ.

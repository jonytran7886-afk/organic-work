# Công việc cha–con và giao lại — 20/11/2026

Thực hiện theo `Organic_Work_Prompt_Cong_Viec_Con_Va_Giao_Lai(1).md`, dùng lại mô hình công việc, form tạo, GridFS, lịch sử, thông báo và dialog hiện có.

## Mở mẫu và sử dụng

- Mẫu trong database ứng dụng: [Truyền thông đợt 1](http://localhost:3100/tasks/6affc89168981e2c32c89ede), gồm **Chuẩn hóa nhận diện** và **Thiết kế mẫu nội dung**. Mẫu có hạn tương đối theo ngày tạo, không ghi đè công việc đã có.
- Admin hoặc trưởng phòng phụ trách mở chi tiết cha → **Công việc con → + Thêm công việc con**. Form hiển thị cha, khóa phòng theo cha và tái sử dụng người phụ trách, Giao cho tôi, ngày, ưu tiên, mô tả/kết quả cần bàn giao và tệp.
- Chọn **Người nghiệm thu** để bật xác nhận thủ công. Chọn **Không chỉ định — hoàn thành tự động** để dùng chế độ tự động. Khi đủ điều kiện, người được chỉ định hoặc Admin bấm **Xác nhận hoàn thành**; yêu cầu liên phòng vẫn dùng dialog kết quả hiện có.
- **Giao lại** cạnh người phụ trách trên chi tiết hoặc trong menu `•••` ở dòng việc con. Dialog có người hiện tại, người mới và lý do tùy chọn. Việc chưa phân công dùng nhãn **Phân công**. Việc đã hoàn thành cần mở lại trước.
- Bấm tên việc con để mở chi tiết; dùng liên kết **Công việc cha** để quay lại cha. Bộ lọc danh sách được giữ trong URL khi đi qua cha/con.
- Trên danh sách, mở nhóm thu gọn **Công việc cha theo dõi** để xem cha. Nhóm này nằm sau đầu việc trên Việc của tôi/Tiến độ, giúp giữ các việc cần xử lý trong màn hình đầu ở mobile.

## Quyền và trạng thái

- Admin/trưởng phòng phụ trách được thêm việc con, chỉ định người nghiệm thu và giao lại; trưởng phòng gửi chỉ xem/trao đổi/bàn giao trong phạm vi hiện có. Người gửi có thể nghiệm thu khi được phòng nhận chỉ định và vẫn có quyền xem.
- Người đảm nhận mới phải hoạt động và thuộc phòng phụ trách. Nhân viên A còn quyền xem theo phòng sau giao lại, nhưng chỉ B có quyền xử lý riêng cho người đảm nhận. Giao lại cha không đổi phân công con.
- Một cấp cha–con; không chuyển liên kết bằng PATCH, không tạo con dưới con, dưới cha lưu trữ hoặc cha đã hoàn thành. Cha hoàn thành có nút **Mở lại để thêm việc con** cho người quản lý.
- Tất cả con còn Cần làm → cha Cần làm. Có con đang làm/chờ/hoàn thành nhưng chưa xong hết → cha Đang làm. Con cuối hoàn thành → cha tự hoàn thành nếu không có người nghiệm thu; nếu có thì giữ Đang làm và hiện nhãn đủ điều kiện.
- Người nghiệm thu được chỉ định hoặc Admin mới xác nhận được cha có con. API từ chối hoàn thành khi còn con mở và báo số còn lại. Trạng thái cha có con không đổi tùy ý qua form/Kanban/API; cập nhật từ con hoặc mở lại cha đã hoàn thành theo quyền.
- Mở lại con sẽ tính lại cha, xóa mốc hoàn thành/duyệt hiện tại và giữ lịch sử/các lần bàn giao. Khi con xong lại phải nghiệm thu lại nếu đã bật người nghiệm thu.
- Cha tự hoàn thành có kết quả tổng hợp từ các kết quả con; tài liệu con vẫn nằm trên con và đi theo quyền cha/phòng gửi. Các con liên phòng vẫn phải nhập kết quả theo quy tắc hiện có.
- Chỉ tính con chưa lưu trữ. Lưu trữ con chưa xong nếu làm cha đủ điều kiện đóng phải xác nhận cả ở UI và API (`confirmArchive: true`). Không còn con hoạt động thì giữ trạng thái hiện có. Khôi phục con tính lại cha; phải khôi phục cha trước nếu cha đã lưu trữ. Muốn lưu trữ cha phải lưu trữ hết các con hoạt động.

## Dữ liệu, đồng thời và số liệu

- `tasks.parentTaskId`: ObjectId tùy chọn; thiếu/null là việc độc lập. Con kế thừa phòng phụ trách và phòng yêu cầu từ cha, ghi `createdById` từ phiên tạo. Nhờ kế thừa phòng yêu cầu, trưởng phòng gửi vẫn xem được con và tệp theo cùng quy tắc quyền.
- `tasks.reviewerId`, `reviewAcceptedAt`, `reviewAcceptedById`: nghiệm thu tùy chọn. Người nghiệm thu phải hoạt động và được `canView` cha; đổi người nghiệm thu khi cha đã xong bị từ chối.
- `activeChildCount`, `completedChildCount`: số liệu tổng hợp được tính từ truy vấn con trong transaction. Chỉ một trường `status` cho mỗi công việc.
- `hierarchyVersion`: mọi thao tác ghi lên con đều ghi tăng phiên bản trên cha trước khi tính lại. Thêm con, đổi trạng thái, lưu trữ/khôi phục và thay đổi người nghiệm thu dùng chung transaction. MongoDB retry khi xung đột; không dựa vào bộ đếm từ client. Hai con cuối hoàn thành đồng thời chỉ ghi một lần chuyển cha sang hoàn thành trong mỗi chu kỳ.
- Ghi con, cha, lịch sử và thông báo trong cùng transaction. Giao lại lưu `before`, `after`, `actorId`, thời điểm và `reason` trên hoạt động phân công. Thông báo dùng cơ chế sự kiện/người nhận hiện có; không bổ sung loại thông báo hủy phân công vì trước đó chưa có.
- Truy vấn Việc của tôi/Tiến độ/Kanban tách cha đang có con hoạt động sang **Công việc cha theo dõi**. Tổng số, bộ đếm và phân bổ chỉ lấy đầu việc thực hiện (con hoặc việc độc lập), tránh cộng cả cha và con. Sidebar dùng cùng điều kiện loại cha tổng hợp. Khi không còn con hoạt động, cha dùng lại luồng việc độc lập theo quy tắc số liệu hiện tại.
- Index mới: `{ parentTaskId: 1, archivedAt: 1, createdAt: 1 }`. Đã chạy `npm run db:setup` trên database ứng dụng; không cần backfill việc cũ. Các số liệu tổng hợp chỉ phát sinh trên cha tạo con mới, không di chuyển hay sửa việc cũ.

## Tệp chính

- Mới: `src/lib/task-hierarchy.ts`, `src/components/task-hierarchy.tsx`, `src/app/subtasks.css`, `tests/subtasks.spec.ts`, `scripts/demo-subtasks.ts`.
- Tích hợp: `service.ts`, `work-query.ts`, `work-model.ts`, `notifications.ts`, API công việc, `workspace.tsx`, `work-views.tsx`, root layout và `scripts/db.ts`.

## Kiểm chứng và giới hạn

- TypeScript, production build và bộ kiểm thử tích hợp MongoDB: đạt.
- Toàn bộ **33 kiểm thử Playwright đạt**, gồm quản trị, hồ sơ, sidebar, điều hướng, công việc, thông báo và các ca cha–con mới.
- Bản cuối đã build production và chạy lại cả 6 ca cha–con thành công, gồm chặn xác nhận nghiệm thu lặp để lịch sử hoàn thành không bị ghi thêm.

Sáu bài mới trên MongoDB test riêng đã đạt: tạo con kèm PDF/reload/quyền tải; số liệu 2 đầu việc thay vì 3; tự đóng/mở lại; hai con cuối hoàn thành đồng thời; nghiệm thu đúng quyền và lại sau mở con; giao A→B và thông báo/lý do; liên phòng; giới hạn quan hệ; xác nhận lưu trữ; khôi phục; rollback giữa giao dịch. Đã chụp và kiểm tra ảnh 1440/390 px trong `docs/subtasks-desktop.png`, `docs/subtasks-mobile.png`.

Không bổ sung nhiều cấp con, chuyển con sang cha khác, kéo thả cây hoặc gửi thông báo riêng cho người cũ. Chưa chạy kiểm thử tải lớn nhiều người dùng hoặc trên thiết bị di động thật; kiểm tra đồng thời dùng hai session transaction và giao diện dùng Chromium/Playwright.

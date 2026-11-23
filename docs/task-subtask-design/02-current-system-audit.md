# Audit module công việc Organic Work cho ADIGO

Ngày: 22/11/2026. Phạm vi: frontend, API, service, cấu trúc ghi MongoDB, quyền, thông báo và test trong working tree hiện tại. Đây là audit tĩnh có kiểm tra TypeScript; chưa phải xác nhận production hay kiểm thử end-to-end đạt.

## Bằng chứng và baseline

- `package.json`: Next.js 16.4.5, React 19.2.7, MongoDB driver 6.20.0, Zod 4.6.7; backend là Next Route Handler Node.js, không có service backend riêng.
- `src/lib/db.ts`: MongoClient dùng cấu hình môi trường; `scripts/db.ts` thiết lập collections/indexes và yêu cầu replica set primary cho transaction. Đây là schema suy ra từ code ghi, chưa đối chiếu dữ liệu lưu thực tế.
- `src/lib/auth.ts`: session token băm, cookie HttpOnly/SameSite, Secure production; đọc lại tài khoản active mỗi request. Route kiểm Origin khi ghi.
- `src/lib/model.ts`, `service.ts`: quyền theo Admin, manager phòng phụ trách, assignee và scope phòng yêu cầu. Không dùng participant làm quyền đổi status.
- `npm run typecheck -- --incremental false`: đạt, exit 0 trong đợt audit.
- `npm run test:integration`, với `MONGODB_TEST_DB=organic_work_audit_test_20261122_design`: lần sandbox lỗi spawn EPERM; lần chạy được process dừng ở `ECONNREFUSED 127.0.0.1:27018`. Chưa chạy được ca tích hợp, chưa kết nối DB để ghi fixture.
- Rà soát bổ sung: `npm run build` đạt, exit 0 sau khi chạy ngoài sandbox hạn chế spawn; Next compile, TypeScript, prerender và build traces hoàn tất. Lần sandbox lỗi EPERM là lỗi quyền process, không phải lỗi biên dịch ứng dụng. Không chạy build song song với dev/E2E.
- E2E chưa chạy vì thiếu MongoDB; Docker CLI có cài nhưng engine `dockerDesktopLinuxEngine` chưa chạy. Không tự sửa cấu hình database hay khởi động Docker Desktop cho hồ sơ thiết kế. Không kế thừa tuyên bố “33 test đạt” trong tài liệu cũ làm kết quả hiện tại.
- Working tree đã có 80 dòng thay đổi/untracked trước khi thêm hồ sơ này. Không reset, commit, sửa hay phân loại lại những thay đổi đó.

## Đối chiếu luồng thực tế trong code

### Tạo Task

`workspace.tsx/CreateTask` → `api("tasks", payload)` → POST `/api/tasks` → `service.createTask` → transaction insert task + liên kết file + activity + notification → `refresh()` → detail hoặc thông báo tạo con.

Đã nối theo code: title, description, phòng, người chính, người tham gia, ngày, priority, file và request UUID. Employee chỉ tạo trong phòng mình, tự nhận hoặc chưa phân công; yêu cầu liên phòng không tự phân người nhận. UI yêu cầu startDate và dueDate, API chỉ bắt buộc dueDate: đây là lệch validation, không phải lỗi dữ liệu đã xác minh.

Thiếu: quick create tối giản, create-and-continue, chọn task/subtask trong cùng composer, cấu hình completion ngay khi tạo. Chưa có creator editor và không nên thêm chỉ để giống công cụ khác.

### Tạo Subtask và hierarchy

`TaskRowMenu`/`TaskHierarchy` → context `createChild` → cùng CreateTask → `parentTaskId` → khóa cha bằng `lockTask` → xác minh manager/Admin, cùng owning department, cha chưa archive/done, cha không phải con → insert và `recomputeParent` trong transaction → refresh + phục hồi scroll.

Mô hình chung collection `tasks`; subtask có ObjectId, assignee, deadline, status riêng. Kế thừa phòng phụ trách và phòng yêu cầu; không ép cùng assignee. Có link cha và tỷ lệ. Hiện giới hạn một cấp; PATCH allowlist không cho thay parent. Chưa có endpoint chuyển cha, tách con thành task, tree pagination, sort thủ công hoặc cấu hình độ sâu.

List hiện tách cha tổng hợp thành `ParentTaskLinks`, con là đầu việc riêng. Không phải cây mở rộng ngay dưới từng dòng cha. Tìm kiếm queryWork hiện chỉ theo title. Cha có thể không xuất hiện khi lọc theo con: cần thiết kế parent context rõ, không tự làm lỏng scope quyền.

### Assignment và nhiều người

`ReassignTask` → PATCH `/api/tasks/:id` → `changeTask` → xác minh canManage và assignee active đúng phòng → update + lịch sử `before/after/reason` + thông báo trong transaction.

`assigneeId` là một người chính; `participantIds` nhiều người, tối đa 50, khử trùng và loại người chính. `validateParticipants` kiểm tra active, cùng phòng, quyền xem; UI có bộ lọc Tôi tham gia. Participant có quyền xem/bình luận theo scope phòng, không được quyền đổi status chỉ do được thêm. Do đó **chưa có multiple assignees thực sự** hay completion từng assignee.

Giao lại giữ những người tham gia còn lại, không đổi phân công con khi giao lại cha. Người cũ mất thao tác riêng assignee nhưng vẫn có thể xem theo phòng. Chưa có workflow đề nghị chuyển việc để employee xin người quản lý duyệt.

### Completion và progress

`activeChildren` lấy con chưa archive; `recomputeParent` đếm done/total. Không có con: giữ status hiện tại. Có con: toàn todo → todo; còn việc đã bắt đầu → doing; hết con done và không reviewer → done; có reviewer → doing đến khi reviewer/Admin xác nhận.

Mở con tính lại cha và bỏ mốc duyệt/hoàn thành hiện tại, giữ lịch sử. Hai con cập nhật dùng transaction và ghi `hierarchyVersion` trên cha để tạo write conflict/retry. Đã có test khai báo cho cập nhật đồng thời và rollback, chưa chạy được trong đợt này.

Hai chi tiết migration phải giữ: `changeTask` chỉ áp reviewer completion khi có con hoạt động; reviewer trên task không con hiện không tạo approval gate. `recomputeParent` cũng không yêu cầu cha có assignee trước khi tự done. Vì vậy chỉ backfill completionMode theo reviewer rồi áp guards mới sẽ đổi hành vi dữ liệu cũ; cần policyVersion legacy riêng.

Thiếu completionMode tường minh, manual mode độc lập reviewer, approval status/reject/comment và workflow version. Nhãn “đủ điều kiện” nằm ở UI; chưa có event thông báo người duyệt khi đủ điều kiện. Không có progress trọng số, estimate, manual hoặc per-assignee. Bộ đếm loại cha có con để tránh cộng trùng, nhưng phụ thuộc cached `activeChildCount`; cần reconciliation/migration trước khi mở rộng.

### Lưu trữ và hoạt động

Cha có con hoạt động không archive được; archive con đang mở nếu làm cha đủ điều kiện đóng cần `confirmArchive`. Restore con yêu cầu cha chưa archive và tính lại cha. File dùng GridFS + metadata attachments, kiểm quyền khi đọc/link; comments có transaction; activities ghi before/after/actor.

Không có DELETE task, Trash, duplicate, move/bulk task. Các thao tác này là tính năng mới cần chính sách, không phải chỉ nối nút UI vào API sẵn có.

### Thông báo và cập nhật giao diện

`notifyTask` hỗ trợ assigned, participating, request liên phòng, due và completed; unique `(eventId, recipientId)`; kiểm active/canView khi tạo. `notificationsFor` lookup task rồi lọc scope hiện tại; tránh hiển thị thông báo đã mất quyền. Người cũ không nhận thông báo gỡ việc riêng. Chưa có watchers, overdue scheduler, ready-for-review, rejected, reopened hoặc outbox cho email/push.

Client refresh sau mutation của chính phiên; cache resource theo principal và TTL 30 giây. Không thấy WebSocket/SSE hay polling định kỳ cập nhật dữ liệu task giữa hai phiên. TTL cache không đồng nghĩa tự fetch mỗi 30 giây.

## Khoảng trống theo ưu tiên

**P0 trước khi mở rộng:**

- Thiếu bằng chứng runtime end-to-end hiện tại do DB không chạy; phải khôi phục test environment riêng trước khi ký nghiệm thu.
- Tài khoản bị tắt vẫn có thể còn nằm trong assignee của việc mở: `adminWrite` chặn đổi phòng khi có assignee mở nhưng không chặn vô hiệu hóa theo cùng điều kiện. Nguy cơ công việc không còn người thực thi; đây là nhánh code cần test tái hiện.
- Phân quyền và canonical progress chưa thành mô-đun dùng chung đủ rõ cho nhiều assignee/many-level; giữ transaction cũ nhưng tách policy trước.
- Catch-all route xét PATCH `/tasks/:id` trước khi kiểm đầy đủ suffix. Khi thêm `/move` hoặc `/approval`, phải dispatch bằng method + toàn bộ path, tránh handler tổng quát nuốt route mới. Chưa có endpoint mới nên chưa kết luận sự cố production.

**P1 để hoàn thiện nghiệp vụ:**

- True multiple assignees, vai trò primary và per-assignee submission; không biến participant thành người chịu trách nhiệm ngầm.
- CompletionMode và approval state riêng; guard cho chuyển mode, đổi người duyệt và invalidation sau reopen/move.
- Tree List với context cha đúng filter, composer thống nhất, create-and-next; assignee/date/status editor dùng cùng mutation.
- Move/convert atomic, cycle/depth guard, deterministic lock nhiều root, ảnh hưởng ACL/file/notification.
- Canonical event và activity `eventId` dùng xuyên suốt; hiện eventId có trong operation/notification nhưng activity không luôn có cùng ID.

**P2 có phạm vi riêng:** dependencies/DAG, checklist, weighted/manual progress, watchers, notification preferences/outbox, soft delete/trash, bulk, duplicate, time tracking, custom fields và drag/drop.

## Rủi ro kỹ thuật cần đo

- `/api/data` và `queryWork` tải toàn bộ task phù hợp rồi group/count trong Node, chưa pagination. Hiện detail không gọi một query cho mỗi con, nhưng validate participants và tạo thông báo vẫn query từng người: nguy cơ fan-out tuyến tính. Chuyển sang truy vấn `$in` và batch recipient khi mở rộng.
- Assignment validation đọc user trong transaction nhưng admin đổi active/phòng dùng khóa khác; snapshot read đơn thuần không đảm bảo chống race với việc vô hiệu hóa. Cần khóa/version user chung giữa account change và assignment change.
- Idempotency key chống lặp đã có, nhưng chưa gắn hash payload. Cùng key mà payload thay đổi có thể trả kết quả thao tác cũ; cần 409 rõ ràng thay vì giả vờ đã lưu payload mới.
- Task activities/handovers chưa phân trang; `handovers` embedded tăng dần. Chưa có kết quả load test để đặt ngưỡng chính xác.
- Generic error service thường trả HTTP 400 cho cả quyền/nghiệp vụ. Nên dùng typed errors 403/404/409/422 và không lộ exception hạ tầng.
- `any`/Row phổ biến; thay model cần type DTO và compatibility adapter, tránh UI/backend hiểu khác vai trò.

## Phạm vi xác nhận

“Đã nối theo code” chỉ có nghĩa lần theo frontend → API → service → cấu trúc ghi và feedback. Để gắn nhãn “đã hoàn thiện”, cần chạy lại với MongoDB replica set, login đủ vai trò, lưu/reload, kiểm DB/lịch sử/thông báo và ít nhất hai phiên đồng thời. Các test hiện có trong `tests/subtasks.spec.ts`, `tests/participants-menus.spec.ts`, `tests/workflow.spec.ts`, `tests/priority-features.spec.ts` và `scripts/integration.ts` là nền tảng tái sử dụng, không phải kết quả đạt của đợt này.

## Điểm neo bằng chứng trong source

- Model và quyền: [canView/canManage/canStatus](../../src/lib/model.ts#L38); cần active session từ [auth](../../src/lib/auth.ts#L6), không hiểu nhầm các helper tự kiểm active.
- Validation/Create: [taskSchema](../../src/lib/service.ts#L20), [createTask](../../src/lib/service.ts#L64), [changeTask](../../src/lib/service.ts#L174).
- Hierarchy: [lockTask](../../src/lib/task-hierarchy.ts#L6), [recomputeParent](../../src/lib/task-hierarchy.ts#L25), [hierarchyDetails](../../src/lib/task-hierarchy.ts#L111).
- Participants: [validateParticipants](../../src/lib/task-participants.ts#L6); thông báo [notifyTask](../../src/lib/notifications.ts#L5), [list/read](../../src/lib/notifications.ts#L75).
- UI tạo: [CreateTask](../../src/components/workspace.tsx#L1757); cha/con/giao lại trong [TaskHierarchy](../../src/components/task-hierarchy.tsx#L44); list trong [WorkViews](../../src/components/work-views.tsx#L19).
- API task trong [catch-all route](../../src/app/api/%5B...path%5D/route.ts); indexes và replica-set guard trong [db setup](../../scripts/db.ts#L4); test database isolation trong [run-tests](../../scripts/run-tests.mjs#L1).

Các số dòng là điểm neo của working tree tại đợt rà soát, có thể dịch chuyển khi coding. Chưa có production inventory hay query explain để xác nhận hiệu năng/schema của database đang triển khai.

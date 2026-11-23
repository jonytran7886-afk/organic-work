# Kế hoạch cập nhật form Tạo công việc ADIGO

Ngày: 23/11/2026, Asia/Saigon. Trạng thái: đã kiểm tra code, chờ phê duyệt trước chỉnh mã ứng dụng theo bước 6–7 của prompt mới. Phạm vi này thay thế các đề xuất Create Task xung đột trong hồ sơ ngày 22/11; không phê duyệt lại toàn bộ kế hoạch Task/Subtask trước đó.

## Phạm vi cần duyệt

Đổi riêng trải nghiệm tạo Task: một trường Người được giao, ngày tùy chọn, mô tả có định dạng, modal gọn và thống nhất. Không có parent picker, switch Task/Subtask, danh sách con hoặc nút tạo con trong modal này. Giữ chức năng tạo Subtask từ menu task đã tồn tại và Task Detail; không xây lại hierarchy, completion mode, approval hoặc dependencies.

Đề xuất triển khai multi-assignee thật trong cùng đợt, vì repo chưa có cấu hình single/multiple. Nếu chỉ muốn sửa giao diện với phạm vi nhỏ hơn, có thể duyệt chế độ single tương thích hiện tại; khi đó không được tuyên bố đã hỗ trợ nhiều assignee. Không dùng participantIds để giả làm nhiều người được giao.

## Kết quả kiểm tra hiện trạng

- `src/components/workspace.tsx:1757`: CreateTask dùng chung cho task độc lập và subtask theo prop parent. Có Người đảm nhận chính, ParticipantPicker checkbox, textarea mô tả và ngày bắt đầu/kết thúc đều required ở UI.
- `src/lib/service.ts:20`: backend bắt buộc dueDate, startDate optional; chỉ nhận assigneeId đơn; trạng thái tạo luôn todo. Không có cấu hình initial status hay single/multi mode theo workspace/phòng.
- `src/lib/model.ts:38`: scope xem theo phòng; canStatus chỉ manager/Admin hoặc assigneeId. Mở rộng nhiều người phải sửa helper, không chỉ lưu thêm array.
- `src/lib/work-query.ts`: My tasks, lọc assignee, bộ đếm việc chưa phân công và phân bổ đang dựa vào assigneeId đơn.
- `src/lib/notifications.ts`: thông báo assigned/due đang theo người chính; cần phân giải toàn bộ tập assignee thật khi bật multi.
- `src/components/autocomplete.tsx`: có tìm kiếm tiếng Việt và keyboard, nhưng chỉ single-select; chưa có chip/avatar multiselect.
- `src/components/task-files.tsx`: đã có chọn nhiều file, drag/drop, tên/dung lượng, bỏ file, tải staged và retry. Giới hạn lấy từ backend; giữ nguyên chính sách.
- `package.json`: chưa có rich text editor. Không giả định textarea hiện tại giữ được bold/list/link.
- Các điểm mở hiện có: nút global trên workspace, nút tạo ở Board, createChild từ menu dòng và TaskHierarchy. Việc của tôi/Tiến độ dùng shell global. Chưa thấy module Project/Dashboard riêng để tạo một form thứ hai hoặc dựng thêm trang ngoài scope.
- Mô tả Task Detail hiện là text và có form edit textarea; nếu thêm định dạng phải có renderer tương thích và xử lý edit cũ, tránh lưu rich text rồi Detail mất định dạng hoặc hiện bản cũ.

Các kết luận trên là audit source hiện tại; chưa phải test tạo/lưu/reload thành công trong đợt này. Không dùng kết quả build ngày 22/11 để tuyên bố hoàn thành tính năng ngày 23/11.

## Đối chiếu ClickUp đã xác minh bằng tài liệu

ClickUp có tạo task từ toolbar, List và Board. Tài liệu mô tả nhập tên và thông tin bổ sung; API yêu cầu name, cho phép assignees, status, priority, start/due dates. Multiple Assignees cần bật ClickApp, có cơ chế thêm/bỏ từng người. Task tạo từ view có thể kế thừa field từ filter/group theo tài liệu.

ADIGO áp dụng nguyên tắc thông tin chính trước, các trường bổ sung gọn và theo ngữ cảnh; không sao chép việc ClickUp cho tạo Subtask trong một số đường tạo task, vì prompt mới cấm chức năng đó ở Create Task Modal. Không tự kế thừa status từ filter nếu backend ADIGO chưa cho tạo ở trạng thái đó.

Nguồn:

- [Create a task](https://help.clickup.com/hc/en-us/articles/6309647350807-Create-a-task).
- [Create a task from views](https://help.clickup.com/hc/en-us/articles/31463619842711-Create-a-task-from-views).
- [Multiple Assignees](https://help.clickup.com/hc/en-us/articles/6309029762583-Multiple-Assignees).
- [Create Task API](https://developer.clickup.com/reference/createtask).

Chưa kiểm tra bằng phiên ClickUp đăng nhập. Bố cục 680 px, rich text storage, quy tắc phân công và dữ liệu tương thích dưới đây là đề xuất riêng ADIGO.

## Giữ, đổi, bỏ và bổ sung

**Giữ:** title, phòng phụ trách, priority, creator từ session, giao cho tôi, chưa phân công theo quyền, upload, request UUID/transaction, quyền employee/phòng nhận/phòng gửi, cơ chế làm mới client sau lưu.

**Đổi:** title placeholder thành “Nhập tên công việc...”; textarea thành editor; assignee đơn + checkbox thành một searchable picker; start/due thành optional cả UI/server; đưa file xuống sau ngày; mở theo department context hợp lệ.

**Bỏ khỏi Create Task:** Người đảm nhận chính dưới dạng trường riêng, ParticipantPicker và mọi thao tác tạo Subtask. Không xóa participantIds hay dữ liệu cũ khỏi database/Detail. Không thêm Người phối hợp.

**Bổ sung:** chip/avatar, bỏ từng assignee, cấu hình single/multiple do server cung cấp, dirty-draft confirmation, lỗi cạnh field và summary, modal header/footer cố định, body scroll, dropdown không bị cắt.

**Không thêm UI:** tags, estimate, recurring, custom fields, dependencies, approval/completion modes vì backend/phạm vi hiện chưa hỗ trợ. Không tạo một khối Tùy chọn nâng cao rỗng.

## Bố cục đề xuất

Header “Tạo công việc”, nút đóng, nhãn phòng/ngữ cảnh nếu có. Desktop 680 px, tối đa chiều rộng viewport trừ gutter; mobile một cột. Body cuộn độc lập; footer Hủy và Tạo công việc luôn thấy được.

Thứ tự: tiêu đề → mô tả → phòng → Người được giao → trạng thái/ưu tiên → bắt đầu/hạn → tệp. Priority và ngày có thể ghép hai cột ở desktop. Toolbar editor chỉ có Bold, Italic, bullet/numbered list, link, undo/redo. Native date picker theo giao diện hệ thống, hiển thị ngày thống nhất và shortcut Hôm nay/Ngày mai/Xóa ngày; lưu YYYY-MM-DD, business date Việt Nam.

Dropdown nhân sự có search, avatar initials nếu chưa có ảnh thật, tên và thông tin phòng cần thiết. Chip có nút bỏ với accessible name. Không render danh sách checkbox thường trực. Keyboard Arrow/Enter/Escape/Tab hoạt động; Escape đầu tiên đóng dropdown trước khi đóng modal. Single mode giới hạn một người ngay tại client và server.

Đổi phòng không âm thầm xóa lựa chọn. Giữ những người còn hợp lệ, chỉ rõ chip không còn đúng phạm vi, chặn submit cho đến khi người dùng bỏ/thay người không hợp lệ; xác nhận trước khi áp thay đổi loại bỏ tập đã chọn. Sau khi mở form vẫn kiểm active/phòng/quyền lại tại server khi lưu.

Global Create Task không nhận parent prop và không có state tạo con. Luồng createChild mở dialog riêng, vẫn dùng backend/hierarchy đang có và có thể dùng lại các primitive title/date/file, không đổi module con. Tách component không đồng nghĩa tạo hai logic phân quyền khác nhau.

## Multi-assignee và tương thích dữ liệu

### Quy tắc đề xuất để duyệt

- `assigneeIds` là tập những người được giao thật, unique và tối đa 50; không có Người phối hợp hay đổi tên participants thành assignees.
- New task có assigneeId legacy lấy từ phần tử đầu được chọn, chỉ để các reader cũ còn tương thích; không thêm trường chọn primary trong form. Thứ tự chọn phải ổn định khi bỏ/chọn người, không dùng thứ tự directory search làm người legacy.
- Task cũ không có assigneeIds được đọc thành `[assigneeId]` hoặc `[]`. Participants cũ giữ nguyên, không tự chuyển thành assignee. Không xóa/ghi đè người giao/creator/lịch sử quá khứ.
- Mọi assignee hợp lệ có cùng quyền xử lý mà assignee đơn hiện có, vẫn chịu tất cả guard trạng thái/bàn giao/reviewer của repo. Một task có một status chung; một người hoàn thành task là hoàn thành đầu việc chung. Không thêm trạng thái hoàn thành riêng từng người hoặc policy all/primary mới trong phạm vi form. Nếu doanh nghiệp muốn từng người xác nhận riêng thì đó là scope khác, cần duyệt riêng.
- Employee vẫn chỉ tự nhận hoặc chưa phân công trong phòng mình. Manager gửi liên phòng vẫn để trống; manager phòng nhận/Admin phân công. Multi không nới quyền qua phòng.
- My tasks và filter phải khớp bất kỳ thành viên assigneeIds; thông báo tới từng assignee mới, loại self và người mất quyền. Global totals vẫn đếm task một lần. Phân bổ công suất tiếp tục theo assigneeId legacy để giữ tổng như cũ; nếu hiển thị “việc được giao theo từng người”, ghi rõ có thể trùng đầu việc giữa người, không dùng tổng đó làm tổng phòng.
- Detail/List chỉ bổ sung đọc và hiển thị toàn tập người trong vị trí assignee hiện có, không redesign. Reassign phải xử lý nguyên tập: legacy PATCH assigneeId từ UI cũ được hiểu là thay toàn bộ tập về người mới sau xác nhận, không để giữ các assignee ẩn; dialog reassign hiện có dùng cùng picker để sửa tập rõ ràng. Lưu activity before/after cả tập và lý do theo nghiệp vụ hiện tại.
- Admin đổi phòng hoặc khóa account phải xét tất cả assigneeIds, không chỉ người legacy. Không xây workflow handoff mới trong đợt này; giữ quy tắc hiện tại và bổ sung nhận biết đủ người để không làm lọt kiểm tra vì array mới.

### Migration và rollout

Đọc tương thích trước, thêm field/index array sau, kiểm shadow queries rồi mới bật multiple ở capability server. Backfill tùy chọn, idempotent, chỉ thêm assigneeIds khi field chưa tồn tại; không đổi IDs, status, ngày, participants hoặc phát notification do backfill. Không backfill bằng cách lấy tất cả participants.

Mọi write mới cập nhật assigneeIds + assigneeId cùng transaction với audit/file/notification. Request đồng thời và replay phải không tạo trùng task/tập người hoặc thông báo. Chỉ bật multi sau khi My tasks, permissions, reassign, notifications và reader Detail/List đã hỗ trợ. Không rollback về bản app cũ chỉ hiểu một người sau khi đã phát sinh task nhiều người; giữ adapter và tắt tạo multi mới khi cần.

Nếu chỉ phê duyệt single mode, giữ assigneeId làm nguồn chuẩn, không thêm array/migration giả; picker vẫn có search/chip/self-assign và server công bố giới hạn 1 đúng khả năng thực tế.

## Ngày, trạng thái và mô tả có định dạng

**Ngày tùy chọn:** backend nhận missing/null/empty như chưa đặt ngày; validation start ≤ due chỉ khi cả hai có giá trị. Update task cũng cần cho xóa ngày, không chỉ Create. Group undated/sort/overdue hiện đã xử lý thiếu dueDate, nhưng phải regression từng view, filter, notification và detail editor; không chỉ bỏ HTML required. Đây là thay đổi hợp đồng có chủ ý theo prompt mới, thay đề xuất dueDate bắt buộc ngày 22/11.

**Trạng thái:** nguồn hiện tại là statuses/statusNames và createTask gán todo; chưa có cấu hình workflow riêng. Phương án ít tác động: hiển thị “Cần làm” như giá trị tạo mặc định, không cung cấp lựa chọn giả mà server bỏ qua. Chỉ khi bạn duyệt mở rộng initial status mới thêm select todo/doing/waiting có waitingReason; không cho tạo done để bỏ qua completion/handover. Kế hoạch đề xuất giữ todo cho đợt này, không tự đổi state machine.

**Rich text:** đề xuất Tiptap cơ bản với dependencies từ hướng dẫn chính thức, lazy-load client và cấu hình SSR đúng Next hiện tại. Lưu `descriptionDocument` JSON tùy chọn; whitelist doc/paragraph/text/bold/italic/list/link/hardBreak, giới hạn độ sâu/số node/kích thước, chỉ http(s) cho link. Server derive `description` plain text từ JSON để reader cũ dùng được, không tin hai payload độc lập. Không đưa HTML tùy ý vào dangerouslySetInnerHTML.

Detail dùng renderer whitelist đọc JSON, fallback text cho bản cũ. Nếu legacy textarea sửa description, bỏ descriptionDocument cũ trong cùng lần lưu để không hiện nội dung trước chỉnh sửa; editor không chuyển ngược text sang rich sai nghĩa. Không backfill mọi mô tả cũ thành HTML. Audit ghi được thay đổi định dạng kể cả plain text giống nhau. Tải lại phải giữ bold/list/link thì mới nghiệm thu RTE, không chỉ thấy toolbar.

Nguồn kỹ thuật: [Tiptap với Next.js](https://tiptap.dev/docs/editor/getting-started/install/nextjs), [JSON/HTML output](https://tiptap.dev/docs/guides/output-json-html). Thư viện mới và các field bổ sung là một phần phương án cần duyệt, chưa cài đặt.

## Các module dự kiến thay đổi

- `src/components/workspace.tsx`: thay điểm mở global/board bằng một openCreateTask(context); tách dialog tạo con, nối refresh và guard draft.
- Mới `create-task-dialog.tsx`, `assignee-picker.tsx`, `task-description-editor.tsx`, renderer mô tả an toàn, schema/capability chung cho tạo việc; tái sử dụng `dialog.tsx`, Autocomplete primitives và TaskFilePicker.
- `src/lib/service.ts`, `model.ts`, `work-query.ts`, `work-model.ts`, `notifications.ts`, `task-participants.ts`: kiểm/lưu assignee đúng scope, optional dates, rich text whitelist và compatibility helper. Không áp các completion modes trong hồ sơ cũ.
- `src/components/task-hierarchy.tsx`, `work-views.tsx`, `side-navigation.tsx`: chỉ sửa chỗ đọc/giao lại/bộ đếm người được giao cần thiết cho multi; không thay bố cục hoặc điều kiện hoàn thành hierarchy.
- API catch-all: validate payload mới/capabilities, giữ auth/Origin/error handling/upload policy. `scripts/db.ts`: additive index assigneeIds nếu multi được duyệt; không drop field/index hoặc dữ liệu cũ.
- `package.json` và lockfile: editor dependencies nếu được duyệt; CSS tạo task dùng tokens hiện có, không đổi CSS chung làm ảnh hưởng dialog khác.
- Tests: tạo task form mới và integration assignment/dates/rich text; điều chỉnh những test cũ chỉ vì labels mới, giữ các assertion nghiệp vụ. Regression subtask/participants/priority/workflow/admin là bắt buộc.

## Trình tự và tiêu chí nghiệm thu

1. Chốt multi hay single, ngày nullable, rich text dependency/storage và initial status giữ todo. Sau duyệt mới chỉnh code.
2. Tạo helper/schema tương thích, kiểm quyền/lưu/query/notify assignee end-to-end trước bật multi picker.
3. Tách root-task modal khỏi child dialog, làm layout/context/draft/focus/dropdown, rồi thêm editor và optional dates.
4. Kiểm unit/validation: title whitespace; duplicate/invalid/inactive/cross-department assignees; date missing/null/sai/thứ tự; JSON rich text/link độc hại; single/multiple cap.
5. Kiểm integration Mongo test: lưu đủ assigneeIds và legacy mirror; My tasks của từng người; giữ participant cũ; quyền trực tiếp API; notification/audit/retry; bỏ hạn; render/reload rich text; legacy edit/reassign không mất dữ liệu.
6. Kiểm UI desktop/mobile: search/chip/remove/self-assign, department change không silent-clear, date shortcuts, upload/drop/remove/retry, busy/double-submit, dirty close với X/Escape/Hủy, tab order, dropdown không bị cắt.
7. Kiểm mọi entrypoint hiện có và context: global/My tasks/Progress/Board/list; phòng được chọn đúng quyền; không áp filter status không hỗ trợ; context mới không kế thừa creationParent từ lần mở con trước.
8. Kiểm root dialog không có nút/field/switch Subtask, ParticipantPicker hoặc Người phối hợp. Tạo Subtask từ menu List/Board và Detail vẫn lưu đúng parent/scope/count sau reload.
9. Chạy typecheck, integration, Playwright và production build tuần tự trong môi trường test riêng. Không kết luận đạt frontend→backend→DB nếu MongoDB chưa chạy; không dùng QA hồ sơ HTML thay E2E ứng dụng.

## Rủi ro và giới hạn phê duyệt

Multi-assignee là mở rộng dữ liệu/quyền/query, không phải thay một dropdown. Optional dueDate khác API hiện tại. Rich text cần field và renderer để định dạng được giữ. Việc sửa một số adapter ở Detail/List/Reassign là phụ thuộc bắt buộc để không có người được giao bị ẩn hoặc mất quyền, không phải xây lại các view đó.

Chưa tạo code tính năng, chưa cài dependency, chưa migration hoặc chạy test mutation ở database trong đợt lập kế hoạch này. Các quy tắc trong hồ sơ cũ về primary UI, participant UI và chọn Task/Subtask chung composer không áp dụng cho prompt mới.

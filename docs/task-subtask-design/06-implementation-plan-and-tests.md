# Kế hoạch triển khai và kiểm thử Task và Subtask ADIGO

Trạng thái: chờ phê duyệt. Chưa sửa code ứng dụng, chưa migration, chưa viết/chạy bộ test cho tính năng sản phẩm đề xuất. Các ca sản phẩm dưới đây là hợp đồng nghiệm thu sẽ chuyển thành executable khi bắt đầu coding theo bước 7. Riêng ca E19 kiểm hồ sơ HTML đã có script QA chạy offline, không truy cập ứng dụng/database.

## Các quyết định cần duyệt

1. ADIGO là tên nghiệp vụ cho repo Organic Work hiện tại, chưa đổi brand/package/database.
2. Giữ participant đúng nghĩa phối hợp; thêm true multiple assignees + một primary. Không tự đổi participant cũ thành assignee.
3. Task mới mặc định Manual; Approval cho việc cần nghiệm thu; Automatic được manager bật rõ. Task cũ giữ hành vi cũ qua adapter/migration.
4. Giai đoạn đầu một cấp con; nâng tối đa 3 cấp con dưới root sau khi đã có cycle guard, lock nhiều root và leaf metrics. Không mở 7 cấp chỉ để theo ClickUp.
5. Employee không tự giao lại; dùng đề nghị chuyển việc. Quyền delegateSubtasks mặc định tắt. Chuyển cha chỉ cùng owning/requesting scope trong bản đầu.
6. DueDate tiếp tục bắt buộc; hạn con vượt cha được cảnh báo, không tự đổi hạn cha. Delete là soft delete, chặn cha còn con hoạt động; không hard delete/cascade trong scope đầu.

Phê duyệt có thể giới hạn Phase 1; các phase sau vẫn giữ gate nghiệp vụ riêng nếu scope thay đổi. Không ước lượng ngày hoàn tất khi chưa đo baseline và xác nhận phạm vi.

## Gate trước coding

Chốt các lựa chọn trên và xác nhận dùng codebase này. Khôi phục MongoDB replica set test tại cấu hình dev/test, không dùng database ứng dụng. Read-only inventory + backup/restore rehearsal trước migration. Chạy baseline typecheck, integration, E2E; mọi failure được phân biệt lỗi có sẵn với regression. Không chạy Next dev/build/E2E đồng thời vì dùng chung `.next`.

Ưu tiên P0 là tính đúng quyền/dữ liệu; P1 là luồng người dùng; P2 là mở rộng. Thứ tự 1→2→3→4→5 giữ như prompt, nhưng Phase 1 chỉ làm hierarchy nền; move và multi-level chỉ được bật khi policy/assignment/completion của Phase 2–3 đã hiểu các tác động đó.

## Phase 1 hoàn thiện task và hierarchy nền

**Scope:** model/DTO typed, exact route dispatch, capability policy, validation chung, composer thống nhất, List context/tree một cấp, progress count hiện có và idempotency hash. Giữ nguyên semantics completion/assignment cũ trong phase này. Chuẩn bị path/version, chưa bật nested/move.

**Files/modules:** `src/lib/model.ts`, `service.ts`, `task-hierarchy.ts`, `work-query.ts`, `work-model.ts`, catch-all API, `workspace.tsx`, `work-views.tsx`, `task-hierarchy.tsx`, `task-row-menu.tsx`, `dialog.tsx`; đề xuất thêm task-types/task-policy/task-command DTO modules và TaskComposer/TaskTreeRows. Đọc tài liệu Next cài trong `node_modules/next/dist/docs` trước sửa handler/components.

**Migration:** optional schemaVersion/version/root/path; dry-run orphan/cycle/count; checkpoint backfill không đổi trạng thái. Index child cursor; chưa bỏ field cũ.

**API/UI:** POST/PATCH/GET cũ qua adapter; hierarchy cursor, activities cursor và strict suffix dispatch. Quick/full/create-next cùng schema; cây ở List phòng ban, My tasks vẫn separate.

**Acceptance:** tạo từ list/detail/global không tạo trùng; reload giữ đúng cha/phòng/file; startDate tùy chọn thống nhất; filter/scroll/focus được giữ; không lộ title cha ngoài quyền; tổng số đầu việc không cộng cha+con; route lạ không bị PATCH handler nuốt.

**Tests:** U01–U04, I01–I05, I15, E01–E04, E10 bên dưới; regression hiện có subtasks/participants/workflow.

**Risks:** dữ liệu cũ lệch counts/path; filter cây làm mất context; composer làm hỏng staged upload; existing working tree nhiều thay đổi. Tách thay đổi phase trong diff rõ, không reset phần khác.

## Phase 2 assignment và permissions

**Dependencies:** Phase 1 typed DTO/capability/idempotency ổn định; approval invalidation interface được định nghĩa trước dù UI duyệt ở Phase 4.

**Scope:** nhiều assignee thực sự, primary, participant giữ riêng, submission cá nhân, history phân công, đề nghị chuyển việc và bàn giao khi vô hiệu hóa; không mở rộng quyền ngoài phòng.

**Files/modules:** service/model/auth/adminWrite, task-participants, task-hierarchy/ReassignTask, task-row-menu, work-query/work-model, notifications; thêm task-assignment-service, assignment history/submission UI và account handoff dialog.

**Migration:** task_assignments, assignment requests, assignee arrays/primary projection; map assigneeId cũ, giữ participant cũ; historical assignedBy unknown phải ghi unknown; unique partial index sau kiểm trùng.

**API/UI:** assignment PUT, submission của tôi, assignment request create/decision; My tasks phân tab primary/co/participant; dialog hiển thị delta và ảnh hưởng approval. User lock/revision dùng chung với deactivate/change department.

**Acceptance:** A–H trong đặc tả 03 được xử lý; role duplicate bị chặn; co-assignee không đóng chung; người cũ mất đúng quyền; task không rơi vô chủ âm thầm; assignment không vượt qua deactivate đồng thời; lịch sử không bị ghi đè.

**Tests:** U05–U06, I06–I09, I16–I17, E05–E06. Kiểm trực tiếp API bằng user khác phòng/inactive, không chỉ kiểm nút ẩn.

**Risks:** participant bị đổi nghĩa; hai nguồn assignee ghi độc lập; nhiều người làm làm bộ đếm nhân đôi; quyền của primary bị lẫn quyền manager.

## Phase 3 completion modes và progress

**Dependencies:** assignment/readiness từ Phase 2, ancestor locks từ Phase 1. Core approval commands/guards cần có trong phase này để Approval không là lựa chọn giả; Phase 4 hoàn thiện event và trải nghiệm duyệt.

**Scope:** Manual/Automatic/Approval, separate execution progress và readiness; progress count trước, weighted/estimate/manual sau flag; dependency DAG; move/convert và nested depth tối đa 3 sau khi invariants đạt.

**Files/modules:** task-completion-service, task-progress-policy, task-dependency-service, task-hierarchy, service, workflow configuration, API commands, TaskHierarchy, mode editor và progress display; work-model/query leaf counts.

**Migration:** completionMode cũ suy từ reviewer như hiện tại; giữ status/acceptance evidence; approval cycles; weight/estimate tùy chọn; path/backfill root đủ trước nested; graph locks/dependencies và indexes.

**API/UI:** completion/reopen, completion-policy, progress, dependency, move/convert, impact preview và approval decision core. UI mode/reviewer/readiness/blockers, cảnh báo deadline, preview ảnh hưởng hai cha.

**Acceptance:** 2/5=40%; 100% Manual không tự done; Approval không done trước accepted; Automatic không tự đóng task không con; reopen con invalidate ancestors; đồng thời hai con cuối chỉ một done event/cycle; move atomic cả hai cây; cấm cycle/depth vượt; không bypass hard dependency.

**Tests:** U07–U12, U14–U18, I10–I14, I18–I24, I33–I40, E07–E09, E11, E17–E19. Property tests cho reducer/progress trên tổ hợp hợp lệ và boundary, không dùng snapshot UI làm bằng chứng consistency.

**Risks:** migration đổi hành vi cũ; nested progress double count; transaction quá lớn; deadlock khóa hai root; graph cycle do hai cạnh đồng thời; mode flip khiến đóng ngoài ý muốn.

## Phase 4 notification và approval workflow

**Dependencies:** typed events, approval cycle/submission revision và assignment invalidation từ Phase 2–3.

**Scope:** reviewer inbox, accept/reject, watchers/preferences, event taxonomy, outbox cho kênh ngoài nếu được chọn, overdue scheduler, audit cursors, account handoff notification. Không xây workflow automation engine tổng quát ở phase này; chỉ domain rules có guard/cause rõ.

**Files/modules:** notifications.ts, notification-bell.tsx, task-approval-service/events/outbox-worker, activity UI, watcher controls, scheduler entry point có auth và business timezone.

**Migration:** task_approvals/watchers/outbox; unique event/recipient/channel; bổ sung eventId/cycle cho sự kiện mới, không bịa quyết định lịch sử; notification legacy đọc được.

**API/UI:** approvals list/detail/decision, notification cursors/preferences, watchers; badge Chờ nghiệm thu/Đã yêu cầu sửa và reviewer-unavailable. Replay outbox sau lỗi không lặp quyết định.

**Acceptance:** event A–H và trạng thái được gửi đúng người; removed chỉ notify khi còn scope; không gửi lại due/overdue trong cùng mốc; accept stale cycle bị 409; reviewer mất quyền không duyệt được; queue không leak nội dung sau revoke.

**Tests:** U13, I25–I28, E12–E13. Kiểm dedup, rollback, quyền bị thu hồi trước delivery và lúc mở link.

**Risks:** outbox at-least-once gây trùng; webhook gửi trong transaction; gửi thông tin người dùng đã mất quyền; spam parent status events.

## Phase 5 UX, regression và hiệu năng

**Dependencies:** invariant/commands ổn định qua các phase trước. Soft delete/checklist/duplicate/bulk là scope thêm cần duyệt; time tracking/custom fields/hybrid progress thuộc roadmap riêng nếu chưa có nhu cầu rõ.

**Scope:** accessibility, keyboard/mobile, bulk atomic, duplicate có tùy chọn, soft delete/restore, checklist required, sort/group/search hợp lý; drag/drop dùng cùng command sau menu fallback. Realtime SSE chỉ làm nếu có yêu cầu đa phiên; trước đó refetch-on-focus + Refresh rõ.

**Files/modules:** composer/detail/list/board/dialog/CSS, command modules tương ứng, work-query aggregation, test fixtures và Playwright. Không thay brand hoặc kiến trúc framework ngoài phạm vi.

**Migration:** deletedAt/checklist/duplicate provenance, indexes được explain/load test; không drop fields hoặc GridFS. Có feature flags/compatibility rollback, không downgrade về app không hiểu nested/co-assignee.

**API/UI:** bulk, duplicate, soft delete/restore và checklist, drag-drop gọi move/status command. Cùng semantics ở mọi view; pagination không mất con được giao khi cha không khớp.

**Acceptance:** keyboard đầy đủ, 390/1440 px không hỏng bố cục; create-next không tạo trùng; reload giữ progress; hồi quy tất cả test cũ; kiểm DB/audit/notification; không N+1 theo số dòng; latency đạt ngân sách đã đo và chốt ở Gate, không tuyên bố SLA chưa đo.

**Tests:** I29–I32, E14–E16, performance fixture 50 dòng/page và cây đến giới hạn cấu hình; production build sau toàn bộ regression. Quan sát query count, payload size, p50/p95, conflict rate và outbox retries.

**Risks:** scope phình thành bản sao ClickUp; test dữ liệu thật; thiếu keyboard fallback; rollback dữ liệu không tương thích; N+1 người/notification và lịch sử quá dài.

## Danh mục test phải chuyển thành executable

Mỗi ca cần fixture riêng và assert trạng thái **sau reload/đọc lại DB**. User/org/database tên test được cô lập; không seed/reset DB ứng dụng. Existing tests được giữ và bổ sung; không cần dựng lại framework test. Unit có thể dùng node:test + tsx cho pure policy; integration Mongo thật replica set; E2E dùng Playwright hiện có.

### Unit

- **U01** title rỗng/251 ký tự, ngày sai, leap-day, startDate sau dueDate bị từ chối.
- **U02** tạo con kế thừa scope từ cha; client giả owning/requesting không có hiệu lực.
- **U03** depth root=0, self-parent, cycle và subtree move vượt maxDepth bị chặn.
- **U04** capability matrix đủ admin/receiving manager/sending manager/primary/co/participant/watcher/outside/inactive.
- **U05** khử trùng role, primary phải thuộc assignees; participant không tự thành co-assignee.
- **U06** policy primary/all và B submitted C active cho readiness khác nhau, không đổi status tùy tiện.
- **U07** count 2/5=40%; 0 con không tự đủ điều kiện đóng; mẫu số loại archive/delete.
- **U08** weighted ví dụ 60%; weight 0/NaN/âm bị từ chối; estimate thiếu không bị âm thầm loại.
- **U09** manual progress 100 không bypass con/dependency/approval.
- **U10** state transitions đúng mode; waiting thiếu reason bị chặn; chỉ completion command được done.
- **U11** approval accepted gắn đúng cycle/submission revision; reject cần reason; reopen làm invalidated.
- **U12** ngày Asia/Ho_Chi_Minh, con quá hạn khác cha quá hạn; checklist không cộng task count.
- **U13** recipient resolution loại self/inactive/outside, unique event/recipient/channel và overdue key ổn định.
- **U14** legacy-v1 task không con dù có reviewer vẫn dùng luồng cũ; cha không assignee vẫn giữ guards cũ, modern-v2 chặn thiếu người hợp lệ.
- **U15** Approval cha đủ con và đủ result tự pending đúng một lần; missing own result chỉ ready; leaf cần explicit submit.
- **U16** rejected không tự pending lại khi recompute; role Admin+assignee vẫn bị self-approval guard chặn nếu policy không cho.
- **U17** dependency finish-to-start chặn bắt đầu lẫn complete; move không được tạo dependency với ancestor mới.
- **U18** DTO missing fields, manual mode approvalState none; số liệu direct-child milestone không nhầm với rollup leaf hay giờ tracked.

### Integration

- **I01** POST task → collection task/assignment/activity/notification đúng; replay cùng request chỉ một task.
- **I02** cùng requestId khác payload → 409; metadata update unknown field → 422.
- **I03** tạo con khác assignee cha, cùng department; file brief được link; parent link và counts đúng.
- **I04** child under archived/done/depth vượt bị chặn ở API, không ghi nửa dữ liệu.
- **I05** hierarchy filter/cursor không leak hidden ancestors; totals không tính context hoặc trùng task.
- **I06** B,C assignees, B primary; both My tasks đúng role; task total vẫn một.
- **I07** reassign B→D giữ status/dates/files/comments; B mất quyền xử lý riêng, còn scope xem; audit có actor/before/after/reason.
- **I08** inactive/cross-department assignee và participant bị chặn; reviewer ngoài scope bị chặn.
- **I09** B submit C active, policy all chặn complete; primary policy vẫn cần completion command explicit.
- **I10** Manual 2/2 giữ doing; người có quyền complete mới done.
- **I11** Automatic 1/2 chưa done, 2/2 done; hai con cuối chạy đồng thời chỉ một done event trong cycle.
- **I12** reopen con sau accepted → cha reopen, current completedAt=null, old history/decision còn nguyên; xong lại phải duyệt cycle mới.
- **I13** archive/delete con làm thay readiness cần previewToken đúng version; con cuối bị loại không tự đóng cha.
- **I14** đổi completionMode có preview; done cần reopen; Approval→Auto eligible chỉ đóng sau confirm.
- **I15** suffix route lạ không thực thi mutation tổng quát; actor giả trong body không thay creator/assignedBy.
- **I16** assignee request chuyển chưa duyệt không đổi task; approve/reject đúng role và stale version.
- **I17** assign đồng thời deactivate/change department: không tạo assignment active không hợp lệ; chuyển giao khẩn cấp giữ audit.
- **I18** move con từ cha A→B tính lại cả hai; convert null giữ task ID/file/comment và creator.
- **I19** move A→B và B→A đồng thời không tạo cycle; retry/deadlock bounded, không mất subtree.
- **I20** depth của toàn subtree được kiểm; root/path cached nhất quán sau move.
- **I21** thêm hai dependency đối nghịch đồng thời chỉ một thành công; ancestor/descendant dependency bị chặn.
- **I22** hard finish-to-start dependency chưa done chặn start/submit/complete kể cả direct API; predecessor done mở readiness, không tự duyệt.
- **I23** transaction fail giữa update và audit/notify rollback task/ancestors/assignments/outbox cùng nhau.
- **I24** stale expectedVersion → 409, không overwrite thay đổi phiên khác; retry không duplicate handover.
- **I25** pending review gửi reviewer một lần; reject/accept đúng cycle; revoke quyền trước quyết định bị chặn.
- **I26** outbox retry sau send timeout dedup; event consumer không tạo vòng lặp status.
- **I27** removed notification chỉ tới người cũ còn quyền; revoke sau enqueue không gửi nội dung nhạy cảm.
- **I28** overdue timezone/boundary/due changed: không spam mỗi lần scheduler; unread/list/read dùng cùng quyền.
- **I29** soft delete/restore giữ lịch sử/file; chặn cha còn con hoạt động; không hard delete.
- **I30** bulk một task sai quyền/stale rollback toàn batch; unique request và events nhất quán.
- **I31** duplicate có IDs mới/todo/creator mới, không copy approval/history/submission/file ngoài lựa chọn cho phép.
- **I32** migration chạy hai lần không đổi creator/status/dates và không gửi notification; shadow counts tương đương; fixture old missing fields vẫn đọc được.
- **I33** policy-upgrade chỉ qua command có preview; backfill không auto-enforce primary/reviewer policy lên task cũ; upgrade thiếu invariant bị 422.
- **I34** cha Approval tự pending khi eligible; recompute nhiều lần không lặp cycle; leaf/gửi báo cáo riêng/reject-resubmit theo đúng command.
- **I35** cùng user không thể có primary+co hoặc assignee+participant active; role switch giữ đủ interval lịch sử.
- **I36** missing reporter/required own result không tạo vòng chờ vô hạn trong Automatic; UI/backend trả thiếu kết quả rõ; aggregate output ghi provenance system.
- **I37** reopen predecessor invalidate successor done và ancestors trong impact plan; vượt 500 task từ chối trước ghi; recompute không vòng lặp.
- **I38** dispatch legacy PATCH và v2 command dùng cùng guards; task ngoài scope trả 404, task nhìn thấy nhưng cấm thao tác trả 403; malformed JSON 400, unknown field 422.
- **I39** outbox crash sau send/trước sentAt: provider idempotency thì không duplicate; provider không hỗ trợ phải ghi nhận delivery có thể lặp, không tuyên bố exactly-once.
- **I40** participant/watch subscription không invalidate output; actor mất scope trước replay không đọc được operation result; preview hết hạn hoặc scope version đổi bị 409.

### End to end

- **E01** manager tạo task từ global, file và người nhận đúng sau reload; employee ngoài quyền bị chặn trực tiếp.
- **E02** tạo con từ menu List và section Detail kể cả rỗng, cùng form/validator; người nhận khác cha thấy My tasks.
- **E03** Quick→Full giữ draft; Tạo và tiếp tục tạo ba con không trùng UUID/tệp; retry mất response không duplicate.
- **E04** filter/sort/group/expanded/scroll/focus giữ khi quay qua cha/con, không hiện context ngoài scope.
- **E05** B,C đều thấy role riêng; giao lại sang D làm hai phiên A/B/D phản ánh đúng sau refresh/reload.
- **E06** participant không có action assignee; reviewer không có quyền manager; gọi API trực tiếp cũng bị chặn.
- **E07** Manual/Auto/Approval thể hiện khác nhau ở List/Board/Detail; 100% pending không hiện done.
- **E08** reject với lý do, sửa/nộp lại cycle mới, accept; stale reviewer dialog không duyệt kết quả cũ.
- **E09** move/convert có preview hai cha, reload giữ ID/link/file; lỗi concurrency giữ draft và báo conflict.
- **E10** mobile 390px/desktop 1440px: nút thêm con/giao lại tìm thấy không hover; keyboard focus/escape/menu/readout đúng.
- **E11** con quá hạn/cha chưa quá hạn và blocked dependency có nhãn khác; completion dialog hiển thị blocker rõ.
- **E12** notifications assigned/removed/review/reopen/due đúng tài khoản; mở link sau mất quyền không lộ nội dung.
- **E13** khóa account có việc mở hiển thị chuyển giao; tài khoản cũ không tiếp tục ghi qua phiên sẵn có.
- **E14** archive/delete/restore và checklist required giữ counts, output và history sau reload.
- **E15** bulk và drag/drop có menu tương đương; rollback không để UI báo thành công một phần.
- **E16** toàn bộ workflow/admin/profile/priority/participants/subtasks regression; production build và smoke production server.
- **E17** task cũ và task mới cùng view hiện policy/label đúng; legacy chưa phân công không tự bị khóa bởi mode migration; chỉ upgrade action đổi semantics.
- **E18** task cha auto-pending không có nút gửi lần hai; rejected giữ lý do đến khi explicit gửi lại; Admin cùng là assignee không tự duyệt trái policy.
- **E19** tài liệu tổng quan mở đầy đủ nội dung nghiên cứu/thiết kế trong một HTML offline, navigation/hash/keyboard và bảng quyền hiển thị đúng ở 390/1440 px.

## Hồ sơ nghiệm thu từng phase

Ghi commit/diff, môi trường và database test, lệnh thực chạy, exit code, ca pass/fail/blocked, ảnh List/Detail desktop/mobile, query timings và ghi nhận migration/rollback. Chuỗi E2E phải kiểm frontend→API→DB→permission→UI feedback, không kết luận từ component tồn tại. Phase nào chưa có bằng chứng thì ghi chưa xác minh, không gắn nhãn hoàn thành.

Baseline thực tế của đợt thiết kế: TypeScript và production build đạt; integration bị chặn do MongoDB connection refused, Docker engine chưa chạy; chưa chạy E2E ứng dụng. Danh mục cuối là 77 ca (18 unit, 40 integration, 19 E2E/check), trong đó E19 là QA hồ sơ offline đã chạy ở 390/1440 px; 76 ca sản phẩm còn là đặc tả, không phải executable suite đã đạt. Sau khi bạn duyệt mới bắt đầu sửa code ứng dụng và chuyển các ca sản phẩm trên thành test.

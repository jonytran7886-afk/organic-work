# Thiết kế kỹ thuật Task và Subtask ADIGO

Đề xuất chưa triển khai. Tái sử dụng Next Route Handlers, MongoDB replica set, GridFS, auth và transaction hiện có. Chưa có thay đổi schema/API nào được áp dụng trong đợt thiết kế.

## Mô hình dữ liệu

Giữ chung collection `tasks` với `parentTaskId` vì con có cùng vòng đời, quyền, file và hoạt động như task độc lập. Tách collection subtasks sẽ nhân đôi API/validator, khiến chuyển con thành task phải đổi định danh hoặc di chuyển dữ liệu. Chỉ tách các quan hệ có cardinality/lịch sử lớn, không tách loại công việc.

### Tasks và hierarchy

Giữ `_id`, `title`, `description`, `owningDepartmentId`, `requestingDepartmentId`, `createdById`, `assigneeId`, `participantIds`, ngày/priority/status và archive hiện tại. Bổ sung theo giai đoạn:

- `schemaVersion:2`, `version:int64` tăng trên mọi thay đổi nghiệp vụ; `hierarchyVersion` tiếp tục làm khóa ancestor, không dùng nó thay version hiển thị.
- `parentTaskId:ObjectId|null`, `rootTaskId:ObjectId`, `ancestorIds:ObjectId[]`, `depth:int`, `sortKey:string`. `parentTaskId` là nguồn chuẩn, path/root/depth là cache được sửa trong transaction. Missing parent ở bản cũ nghĩa task độc lập.
- `assigneeIds:ObjectId[]`, `primaryAssigneeId:ObjectId|null`, `assigneeCompletionPolicy:primary|all`. Trường `assigneeId` legacy là projection của primary, không phải nguồn ghi thứ hai.
- `policyVersion:legacy-v1|modern-v2`, `completionMode:manual|automatic|approval`, `progressMode:count|weighted|estimate|manual`, `workflowId`, `workflowVersion`, `statusId`; giữ semantic `status` 4 giá trị để tương thích truy vấn cũ trong migration. `requiresOwnResult` lấy từ workflow version, không để client bỏ qua báo cáo bắt buộc.
- `activeChildCount`, `completedChildCount`, `executionProgress`, `weight`, `estimateMinutes`, `manualProgress`, `computedAt`, `computedVersion`.
- `approvalState:none|ready|pending|accepted|rejected|invalidated`, `reviewerId`, `approvalCycle`, `submissionRevision`, `reviewAcceptedAt/ById` tương thích hiện tại.
- `needsAssignment`, `reviewerUnavailable`, `completedAt/ById`, `completionCycle`, `deletedAt/ById`; `archivedAt` và `deletedAt` có ý nghĩa khác nhau.

Không nhúng toàn bộ cây hoặc lịch sử vô hạn vào task. Bắt đầu với trường tùy chọn và DTO adapter; chỉ bật nhiều cấp sau khi mọi reader hiểu cached path và leaf metrics.

### Các collections liên quan

- `task_assignments`: taskId, userId, role primary/co-assignee/participant, assignedById, assignedAt, removedAt, removedById, reason, assignmentCycle, submissionState, submittedAt, resultRevision. Một assignment active cho mỗi `(taskId,userId)`, không có cùng một người ở hai role hoạt động. Primary cũng là một assignee; `assigneeIds` gồm role primary và co-assignee. Nguồn chuẩn vai trò nằm đây sau cutover; arrays trên tasks là read projection cập nhật cùng transaction.
- `task_activities`: giữ collection hiện tại; mở rộng eventId, aggregateVersion, operation, actor, source, before/after, reason, causationId, cycle. Append-only. Status/assignment history là các event lọc từ collection này, không cần nhân đôi nhiều bảng lịch sử.
- `task_approvals`: taskId, cycle, submissionRevision, reviewerId, state, requestedAt, decidedAt/ById, reason; không tái dùng quyết định của cycle cũ.
- `task_dependencies`: predecessorId, successorId, type finish_to_start, hard, createdById/At, removedAt; graph revision/lock theo scope. Không cho cross-department ở bản đầu.
- `task_checklists`: taskId, itemId, text, required, checked, assigneeId?, checkedById/At, position, version. Checklist không biến thành task/assignee completion ngầm.
- `task_watchers`: taskId, userId, preferences, createdAt; unique task/user. Không cấp ACL.
- `task_custom_field_definitions`: department/workflow scope, key, type, validation, required, version. `task_custom_field_values`: taskId, definitionId, definitionVersion, value; chỉ mở sau core workflow.
- `task_comments`, `attachments`, GridFS và `notifications`: tái sử dụng, thêm cursor paging và eventId liên kết khi cần.
- `task_operations`: actorId, requestId, payloadHash, route/command, result summary, taskId/version, createdAt; dùng idempotency cho toàn bộ command mới.
- `task_outbox`: eventId, recipientId, channel, type, payloadRef, state, attempts, nextAttemptAt, sentAt. Chỉ cần khi gửi ngoài transaction hoặc scheduler; thông báo in-app vẫn có thể ghi đồng transaction như hiện tại.
- `task_workflows`: danh sách trạng thái id/label/semanticCategory, allowed transitions, default mode, policyVersion, hierarchy limits. Admin cấu hình; không để client tự định nghĩa enum.
- `task_assignment_requests`: requester, target user, taskId/version, reason, pending/approved/rejected, decidedBy/At cho đề nghị chuyển việc.
- Kết quả bàn giao tăng dài: chuyển `handovers` embedded sang `task_handovers` theo đợt migration riêng, giữ eventId và original timestamps; không bắt buộc chuyển trong Phase 1.

## Invariants và concurrency

Mỗi command đi qua thứ tự: xác thực → parse DTO nghiêm ngặt → transaction → khóa scope/user/root cần thiết → đọc lại quyền/phiên bản → validate invariants → ghi task/projections → tính ancestor bottom-up → audit/notification/operation → commit → phản hồi.

- Dùng `session.withTransaction`, retry có giới hạn cho transient conflict; hết retry trả 409 có mã rõ. Không gọi email/webhook trong callback transaction vì callback có thể chạy lại.
- Dùng một thứ tự khóa toàn cục: khóa workflow/scope-graph theo scope ID → các user theo ID → các hierarchy root theo ID → các task còn lại theo ID. Mọi command, kể cả deactivate/bulk/approval/dependency, dùng thứ tự này; command không cần lớp nào thì bỏ qua lớp đó, không đảo lớp. Khám phá tập khóa trước transaction; sau khi lấy khóa đọc lại parent/root/version, nếu tập khóa thay đổi phải hủy và retry từ đầu. Move giữa hai cây khóa hai root theo ID; không lấy user lock sau root lock.
- `expectedVersion` chống ghi đè giữa hai dialog; update với filter `_id,version`, không match thì 409. Root lock giải quyết consistency cây; optimistic version giải quyết ý định người dùng, không thay thế nhau.
- Cấm self-parent/cycle bằng ancestor check và xác minh lại đường cha trong transaction. Depth mới = depth cha mới + 1; tính chiều cao subtree để kiểm maxDepth, không chỉ kiểm node di chuyển.
- Chặn duplicate active assignments bằng unique partial index; guard đúng một primary nằm trong active assignees được service kiểm trong transaction, không thể chỉ dựa unique multikey arrays.
- Dependency thêm edge khóa graph scope revision, kiểm path successor→predecessor bằng truy vấn bounded traversal; hai cạnh đối nghịch đồng thời phải conflict. Không dùng root lock của cây để giả vờ bảo vệ được mọi dependency graph.
- Derived fields không nhận từ client. Recompute cùng transaction cho subtree giới hạn; subtree lớn chưa đủ ngân sách transaction thì từ chối có hướng dẫn, không ghi nửa cây rồi tính async mà vẫn báo hoàn tất.
- Một lần done mỗi cycle dùng event uniqueness; reopen tăng cycle. Outbox/event handler chỉ phát thay đổi semantic thực sự; causationId và visited set chặn vòng lặp automation. Không chạy pipeline “đổi cha → tự đổi con → đổi cha”.

## Indexes và truy vấn

Giữ indexes hiện có: tasks theo parent/archive/createdAt, assignee, participant, owning/requesting department, dueDate; notifications event/recipient unique; task_operations actor/request unique; activities task/createdAt; files task/state.

Đề xuất index thêm, đo `explain` trước rollout:

- tasks `{parentTaskId:1,deletedAt:1,archivedAt:1,sortKey:1,_id:1}` cho con trực tiếp; `{rootTaskId:1,depth:1}` và `{ancestorIds:1}` khi bật nhiều cấp.
- tasks `{owningDepartmentId:1,archivedAt:1,deletedAt:1,status:1,dueDate:1,_id:1}` và assigneeIds/archived/due theo query thật. Không tạo compound index có hai trường array độc lập.
- assignments unique partial `(taskId,userId)` khi removedAt=null; unique partial taskId khi role=primary và removedAt=null; `(userId,removedAt,taskId)` cho My tasks. Chuyển primary/co-assignee đóng interval cũ và mở interval mới trong transaction; lịch sử không mất.
- approvals unique `(taskId,cycle)`; activities `(taskId,createdAt,_id)` cursor và unique `(eventId,taskId,type)` khi type được định nghĩa đủ phân biệt.
- dependencies unique partial `(predecessorId,successorId,type)` active; indexes hai chiều. Watchers unique task/user; outbox unique event/recipient/channel và state/nextAttemptAt.

List query trả một page tasks cộng ancestor context theo `$in`/batch có kiểm scope; không fetch từng child từ client để dựng 50 hàng. Detail tải con trực tiếp theo cursor; user names lấy batch `$in` hoặc directory cache không nhạy cảm. `$graphLookup` chỉ khi bật nhiều cấp, có maxDepth và giới hạn số node; vẫn lọc quyền, không trả toàn graph rồi giấu tại UI. Count và cursor phải dùng cùng filter/snapshot hợp lý; ancestor context không cộng vào totals.

## Hợp đồng API đề xuất

Đường dẫn bên dưới thuộc ADIGO, không phải ClickUp. API hiện có giữ adapter; endpoint mới chưa tồn tại. Mutation mới dùng `requestId:UUID` và `expectedVersion` trừ create. Idempotency lặp cùng payload trả kết quả cũ; cùng key khác payload trả 409. Success gồm `task`, `version`, `affectedAncestors`, `eventId`, `warnings` khi phù hợp.

### Hợp đồng dùng chung cho mọi mutation

JSON không parse được/ID hay cursor sai format → 400; field ngoài allowlist hoặc sai schema/nghiệp vụ → 422; chưa đăng nhập → 401; task không tồn tại hoặc ngoài canView → cùng 404; đã xem được nhưng thiếu quyền thao tác → 403; stale version/policy/payloadHash → 409. Không đủ điều kiện trả 422 kèm `code`, `fieldErrors`, `remainingCount`/`blockers` đã lọc quyền. Lỗi hạ tầng trả 503/500 và correlationId, không trả stack. Duplicate key do replay cùng request trả kết quả cũ, không biến thành 409 tổng quát; conflict assignment thực sự trả 409.

Mọi mutation nghiệp vụ dùng transaction và append audit kể cả thay role, mode hoặc hierarchy; chỉ sự kiện thực thay đổi mới tạo notification. Actor/creator/assignedBy/timestamp lấy server. Response không trả tên/title/id của blocker ngoài quyền.

### Danh mục endpoint và hành vi

1. **POST `/api/tasks` — Create Task/Subtask.** Body `{title,description,owningDepartmentId?,assigneeIds,primaryAssigneeId,participantIds,startDate?,dueDate,priority,parentTaskId?,completionMode?,reviewerId?,attachmentIds?,requestId}`. Task độc lập bắt buộc owningDepartmentId; con lấy scope từ cha, client có gửi giá trị khác thì từ chối, không chuyển scope âm thầm. Response 201 DTO; replay 200. Quyền create như cũ, nếu con cần canManage cha; employee không tự đặt mode/reviewer ngoài workflow mặc định. Validate ngày/role/scope/depth/cha mở. Transaction tạo task/assignment/file/audit, recompute cha. Event task.created và assignment.added; recipient đúng scope.
2. **PATCH `/api/tasks/:id` — Update task/subtask metadata.** Body `{expectedVersion,title?,description?,startDate?,dueDate?,priority?,requestId}`. Manager/Admin. Không cho parent/status/role/progress derived đi qua metadata handler. 200 DTO; audit từng thay đổi, deadline.changed notify người liên quan; khóa root khi thay đổi tiêu chí ảnh hưởng cha.
3. **GET `/api/tasks/:id` — Detail.** Response task, capabilities, readiness, parent summary, children page, attachments summary; canView; không transaction ghi/không side effects. Comments/activity có cursor riêng để không tăng response vô hạn.
4. **GET `/api/tasks/:id/hierarchy?depth=1&cursor=...&limit=50` — Hierarchy.** Response `{nodes,parentContext,nextCursor,version}`; depth <= cấu hình và bounded total. Batch query theo quyền; không mutation/audit/notify. Không trả hidden parent title.
5. **PUT `/api/tasks/:id/assignment` — Assign/Reassign/Add/Remove.** Body `{assigneeIds,primaryAssigneeId,participantIds?,reason?,previewToken?,expectedVersion,requestId}` là tập cuối cùng, không mơ hồ add/rem. Manager/Admin; quyền delegated nếu bật sau. Validate active/cùng phòng/primary thuộc tập/không duplicate; done cần reopen. Transaction khóa user/root, lưu intervals cũ/mới, projection và invalidation approval. Events assignment.added/removed/primary.changed. Status giữ, readiness tính lại. 200 DTO + delta. Bỏ tất cả hoặc làm invalidate pending cần reason và preview token; đang doing/waiting/có submission thì reason bắt buộc.
6. **POST `/api/tasks/:id/assignment-requests` và PATCH `/api/tasks/:id/assignment-requests/:requestId` — Đề nghị chuyển/duyệt.** Request `{targetUserId,reason,expectedVersion,requestId}`; decision `{decision,reason?,expectedVersion,requestId}`. Assignee đề nghị, manager/Admin duyệt; pending không đổi assignment. Duyệt dùng chung assignment service trong transaction; log và notify người đề nghị/người nhận. Đề nghị stale phải duyệt lại, không âm thầm áp.
7. **POST `/api/tasks/:id/status-transitions` — Change status.** `{targetStatusId,waitingReason?,expectedVersion,requestId}`; chỉ transition cho phép. Primary/manager/Admin; co-assignee theo policy bắt đầu phần mình. Không nhận done qua đường này: gửi 422 USE_COMPLETION_COMMAND. Audit status.changed; notify theo preference.
8. **POST `/api/tasks/:id/completion` — Complete/submit.** `{result?,resultLinks?,attachmentIds?,expectedVersion,requestId}`. Primary/manager/Admin, guard eligible sau khi merge payload candidate và submission của chính primary nếu policy all; manager/Admin không submit thay người khác. Manual → done, automatic task độc lập → done, Approval → pending. Cha Approval có con đủ điều kiện có thể đã được hệ thống tạo pending theo quy tắc 03; request mới không tạo thêm cycle, trả 409 APPROVAL_ALREADY_PENDING nếu không phải replay. Ghi handover/submission revision, recompute ancestor, event task.completed hoặc approval.requested; không phát cả hai khi chỉ pending. 200 DTO/readiness.
9. **POST `/api/tasks/:id/reopen` — Reopen.** `{reason,expectedVersion,requestId}`. Primary/manager/Admin của task, kể cả con; invalidate approval/ancestors, clear current completedAt, giữ historical handover. 200 affectedAncestors; events task.reopened và approval.invalidated. Không tự mở task archive/deleted.
10. **PUT `/api/tasks/:id/assignees/me/submission` — Phần việc cá nhân.** `{state:active|submitted,result?,expectedVersion,requestId}`. Chỉ active assignee của chính user, không sửa hộ qua userId tùy ý. Transaction cập nhật assignment cycle, readiness; event assignee.submitted/reopened notify primary. Không tự coi đây là completion task.
11. **PATCH `/api/tasks/:id/progress` — Manual progress/weights.** `{manualProgress?,childWeights?,progressMode?,reason,expectedVersion,requestId}`. Manager/Admin, primary chỉ manual value nếu policy cho phép. Validate tổng/trọng số/estimate; không cho gửi executionProgress derived. Transaction recompute, audit progress.changed; không tự gửi completion/approval.
12. **PUT `/api/tasks/:id/completion-policy` — Mode/policy/reviewer.** `{completionMode,reviewerId?,assigneeCompletionPolicy,previewToken?,reason,expectedVersion,requestId}`. Manager/Admin. Done phải reopen. Preview nếu thay đổi đóng/invalidates; audit policy.changed, notify reviewer/primary khi cần.
13. **POST `/api/tasks/:id/move` — Move/convert.** `{newParentTaskId:ObjectId|null,expectedVersion,expectedSourceParentVersion?,expectedTargetParentVersion?,previewToken,reason,requestId}`. Null là convert trong API ADIGO này, không suy từ ClickUp API. Manager/Admin có quyền nguồn và đích; validate cùng owning/requesting scope, cycle/depth/active. Transaction khóa hai root, sửa subtree path, recompute cả hai phía, giữ ID/file/comments. Events task.moved/progress.changed; response affectedRoots.
14. **POST `/api/tasks/:id/approval-decisions` — Approve/reject.** `{cycle,submissionRevision,decision:accepted|rejected,reason?,expectedVersion,requestId}`. Reviewer hiện hành/Admin, reject phải reason; kiểm eligibility lại ngay khi duyệt. Transaction decision + done nếu accepted + recompute; event approval.accepted/rejected notify primary/assignees.
15. **GET `/api/tasks/:id/activities?cursor=...&limit=50`.** canView hiện tại, response `{items,nextCursor}`. Lọc thứ tự ổn định createdAt/_id; không viết event vì đọc audit. History không cấp quyền xem nội dung tài liệu ngoài scope.
16. **POST `/api/tasks/bulk-operations`.** `{operation,items:[{taskId,expectedVersion}],payload,requestId}`. Giới hạn 50; bản đầu chỉ metadata deadline/priority và assignment trong một scope, không gồm move/delete/status/complete. Preflight toàn bộ quyền; một item lỗi rollback cả batch. Response affected DTOs; audit/notify từng task với causationId chung và dedup recipient digest. Không vừa báo partial success vừa ngầm dùng atomic.
17. **GET `/api/notifications?cursor=...` và PATCH `/api/notifications/:id`.** Dùng luồng hiện có, bổ sung cursor. GET/mark-read đều kiểm recipient/canView hiện tại; trả items/unread/cursor. Mark-read idempotent, không gửi notification của notification.
18. **POST `/api/tasks/:id/impact-preview`.** `{operation,payload,expectedVersion}`. Chỉ người có quyền thực hiện; response token gắn actor/target versions/payloadHash/expiry + tác động đóng cha, đổi scope, invalidates. Không ghi thay đổi nghiệp vụ; token stale/expired → 409 khi command lưu.
19. **POST `/api/tasks/:id/archive` và POST `/api/tasks/:id/restore`.** `{expectedVersion,previewToken?,reason?,requestId}`. Manager/Admin, restore cha trước con; giữ guard cha còn con hoạt động. Transaction recompute, audit/notify tác động thực tế. Legacy PATCH archived gọi chung service.
20. **DELETE `/api/tasks/:id` — Soft delete giai đoạn sau.** Body `{expectedVersion,previewToken,reason,requestId}`. Manager/Admin; chặn cha còn con hoạt động, preview dependency; transaction deletedAt + recompute + audit. 200 tombstone/ancestors; không xóa GridFS/activity. Restore dùng command trên có loại restore deleted rõ ràng.
21. **POST `/api/tasks/:id/dependencies` và DELETE `/api/tasks/:id/dependencies/:edgeId`.** `{predecessorId,type,hard,reason?,expectedVersion,requestId}`. Manager/Admin của cả hai task cùng scope. Khóa graph + cycle check; recompute blocked/readiness; audit dependency.added/removed, notify assignee bị ảnh hưởng; không tự dời hạn.
22. **POST `/api/tasks/:id/duplicate`.** `{includeSubtasks,includeAssignments,includeAttachments:false,dueDate,requestId}`. Manager/Admin hoặc creator có create permission với nguồn đang được xem. Mặc định không copy activity/approval/submission/result/file; creates new IDs, todo, creator actor. Đệ quy bounded trong cùng transaction; log source ID; chỉ notify người được giao mới sau commit.

23. **GET `/api/work` — List/query.** Giữ endpoint hiện tại, thêm `{view,modes:collapsed|expanded|separate,involvement:assigned|primary|co|participating|watching,q,status,department,sort,group,cursor,limit}` dưới dạng query string. `assigned` giữ nghĩa tất cả active assignees; primary/co là bộ lọc mới, participant/watch không đổi nghĩa. canView được áp trước pagination/count. Response `{tasks,parentContext,groups,stats,total,nextCursor,queryRevision}`; parent context không cộng vào total. Limit 1–100, mặc định 50; cursor gắn actor/scope/filter/sort/policy revision và stable tie-break `_id`; đổi filter phải reset cursor. Không side effects/audit/notify. Chưa có snapshot lịch sử thì queryRevision thay đổi trả 409 CURSOR_STALE, không hứa snapshot liên trang không có thật.
24. **PUT `/api/tasks/:id/participants` — Sửa người tham gia.** `{participantIds,expectedVersion,requestId}`; canManage; active/cùng phòng/không trùng assignee, tối đa 50. Transaction update assignments/projection, audit participant.added/removed; notify người thêm, người bỏ chỉ nếu còn quyền. Không đổi assignee submission/progress/approval vì đây không là người chịu trách nhiệm.
25. **GET/PUT `/api/tasks/:id/watchers/me` — Theo dõi của tôi.** GET trả setting hiện tại; PUT `{following,events,requestId}` cho user active có canView, không dùng task expectedVersion vì không sửa task nghiệp vụ. Transaction watcher + operation + audit watcher subscription; không gửi thông báo tự theo dõi; không cho payload userId để đăng ký thay người khác. Event allowlist rõ, không để người xem tự chọn loại nội dung ngoài scope.
26. **GET/POST `/api/tasks/:id/checklist` và PATCH/DELETE `/api/tasks/:id/checklist/:itemId`.** Manager/Admin thêm/sửa requirement/xóa; primary có thể tick, co chỉ tick mục được giao mình. Payload create `{text,required,assigneeId?,position?,expectedVersion,requestId}`, tick/update `{checked?,text?,required?,expectedVersion,requestId}`. Guard role theo field, không cho co sửa required. Transaction checklist + task version + approval invalidation khi thay acceptance criterion; audit item/actor/before/after, notify primary khi readiness đổi. Không hard delete task; item xóa lưu tombstone/audit. GET canView và cursor, không side effect.
27. **GET/POST `/api/tasks/:id/comments` — Trao đổi.** Giữ POST hiện có `{body}` qua adapter, v2 thêm requestId; GET `{cursor,limit}`. canView + active task; input body 1–5000. Ghi transaction comment/operation, trả 201 hoặc replay 200; audit comment.created với content reference, notify watchers đăng ký comments, không invalidate output. Không sửa/xóa comment trong scope đầu.
28. **POST `/api/tasks/:id/policy-upgrade` — Chuyển legacy-v1 sang modern-v2.** `{targetPolicyVersion:modern-v2,expectedVersion,previewToken,reason,requestId}`; canManage; task chưa done/archive/deleted, invariant mới đủ hoặc trả danh sách field cần xử lý. Transaction policy + mapped workflow + readiness + audit; không nâng hàng loạt qua backfill. Nếu preview dự kiến auto-close/auto-submit phải confirm đúng versions của các task liên quan. Không có downgrade command khi đã ghi dữ liệu modern-only.
29. **GET `/api/task-options` và GET `/api/review-queue`.** Options `{departmentId,parentTaskId?,q,cursor,limit}` trả danh sách assignee/reviewer/parent candidates theo mục đích và quyền manager/employee; không trả email hoặc toàn bộ directory không cần thiết. Parent candidates loại done/archive/depth sai. Queue chỉ reviewer hiện hành hoặc Admin, lọc scope trước count/pagination; response pending cycles với submissionRevision, không lộ phòng khác cho reviewer thường. Hai GET không có transaction ghi/audit/notify.
30. **POST `/api/admin/users/:id/task-handoff` — Chuyển giao và vô hiệu hóa.** Body `{userVersion,mode:handoff|emergency,targetAssignments?,reviewerReplacements?,reason,requestId}`; chỉ Admin. Bình thường preview toàn bộ việc mở/role và chuyển giao bounded cùng scope; nếu quá transaction budget thì chia batch được checkpoint, chưa deactivate cho đến khi hoàn tất. Emergency khóa user trước trong transaction ngắn, revoke sessions, audit và thông báo manager; task flags có thể materialize sau nhưng mọi command kiểm user active trực tiếp ngay từ commit khóa, không chờ job. Response phân biệt `completed` với `handoffPending`; không tuyên bố chuyển giao xong khi mới khóa account.

Custom field/time-entry APIs là roadmap ngoài implementation scope đầu: khi bật phải có endpoint/validation riêng; hiện gửi field chưa triển khai trả 422 FEATURE_NOT_ENABLED, không bỏ qua im lặng.

### DTO, preview và compatibility

Task DTO chung gồm `id`, `version`, `policyVersion`, `statusId`, `statusCategory`, `completionMode`, `approvalState`, `approvalCycle`, `submissionRevision`, `executionProgress`, `progressMode`, `primaryAssigneeId`, `assigneeIds`, `participantIds`, `parent`, `childCounts`, `readiness:{eligible,blockers,requiresOwnResult}`, `capabilities` và `updatedAt`. Không dùng `completedById` của actor con để giả quyết định người duyệt. Preview response có `operation`, `affectedTasks`, `before/after` counts/readiness, `requiresConfirmation` và token ký server hết hạn sau 5 phút, gắn actor/session/payload hash/versions; client không tự tạo token. Token chỉ xác nhận tác động, không thay authorization hoặc expectedVersion.

Ví dụ Create Subtask modern-v2 (ID minh họa, không phải dữ liệu thật):

```json
{"title":"Thiết kế mẫu nội dung","parentTaskId":"aaaaaaaaaaaaaaaaaaaaaaaa","assigneeIds":["bbbbbbbbbbbbbbbbbbbbbbbb"],"primaryAssigneeId":"bbbbbbbbbbbbbbbbbbbbbbbb","participantIds":[],"dueDate":"2026-12-01","priority":"normal","attachmentIds":[],"requestId":"d115527a-fbf2-4b42-9716-292b90b51056"}
```

Ví dụ assignment đang thực hiện:

```json
{"assigneeIds":["cccccccccccccccccccccccc"],"primaryAssigneeId":"cccccccccccccccccccccccc","reason":"Bàn giao cho người tiếp nhận","expectedVersion":7,"requestId":"44e9048f-3f58-4c23-9fb5-5293f35991ae"}
```

Ví dụ stale version response HTTP 409:

```json
{"error":{"code":"VERSION_CONFLICT","message":"Công việc đã thay đổi. Hãy kiểm tra dữ liệu mới.","currentVersion":8,"retryable":false,"correlationId":"audit-example"}}
```

Legacy API vẫn nhận PATCH status/assignee/archived như hiện tại qua compatibility adapter; mỗi field được chuyển về command domain tương ứng, không giữ một đường ghi bỏ qua guards. Request trộn metadata + assignment/status bị từ chối ở v2; client legacy chỉ được giữ tổ hợp đã hỗ trợ và xử lý atomic có test riêng. Form v1 không bắt buộc expectedVersion trước cutover, nhưng adapter vẫn dùng root lock và ghi audit; sau cutover mutation v2 bắt buộc version. Cho phép retry chỉ transient conflict; với intent stale phải trả conflict để người dùng xem lại, không tự lấy version mới rồi ghi đè.

Chỉ hash payload đã chuẩn hóa gồm actor/command/target/body có ý nghĩa và expectedVersion; không hash requestId, transport headers hay field server tự sinh. PreviewToken được kiểm riêng, payload hash dùng preview input semantics, không phụ thuộc chữ ký/token timestamp. Operation lookup phải kiểm actor còn quyền trước trả dữ liệu replay. Khóa toàn cục theo policy/scope → users → roots → tasks áp dụng cả dispatch adapter và event-driven recompute.

### Propagation và giới hạn xử lý

Dependency hard finish-to-start chặn bắt đầu lẫn completion; khi predecessor reopen, thu thập successor cần invalidate/reopen và ancestors trong cùng impact plan, chống lặp bằng visited IDs. Move kiểm dependency/ancestor relation mới dưới scope graph lock, không chỉ kiểm tree cycle. Ngân sách một command đề xuất tối đa 500 task bị ảnh hưởng và 50 assignees/task; vượt ngân sách trả 422 IMPACT_LIMIT_EXCEEDED trước ghi. Số này là trần bảo vệ đề xuất cần load test, không phải SLA đã đo.

Emergency deactivate có ngoại lệ có chủ ý với việc cập nhật flags: user active=false là nguồn chuẩn tức thì; needsAssignment/reviewerUnavailable trong DTO được tính cả từ active user ở read/command dù job chưa materialize xong. Không tự chuyển completed task về mở chỉ do một người sau đó rời công ty; chỉ task mở/pending và người chưa hoàn thành phần hiện hành cần bàn giao.

Outbox chỉ bảo đảm at-least-once; unique event/recipient/channel chống enqueue trùng nhưng không bảo đảm external provider chỉ gửi một lần nếu worker crash sau gửi trước lưu sentAt. Cần provider hỗ trợ idempotency key để giảm trùng; nếu không có, ghi nhận khả năng duplicate delivery và dedup ở inbox nơi kiểm soát được. Không tuyên bố exactly-once email/push. Recheck quyền trước dispatch là bắt buộc nhưng không thu hồi được email đã gửi; payload ngoài ứng dụng mặc định chỉ có thông báo chung và link có auth, không nhúng kết quả/mô tả nhạy cảm.

## Notification events

- task.created/subtask.created: người được giao, manager nhận yêu cầu liên phòng, watcher đủ quyền theo preference; không gửi toàn phòng vô điều kiện.
- assignment.added/removed/primary.changed: người mới, người cũ nếu còn quyền, primary và manager khi bỏ hết người. Không gộp “removed” thành “assigned”.
- subtask.completed/task.completed/parent.status.changed: primary cha và watchers có subscribe; completion task và completion từng assignee khác event.
- deadline.changed/task.overdue: assignees/primary/watchers; overdue scheduler dùng business date Asia/Ho_Chi_Minh và dedup `(taskId,dueDate,completionCycle,type,recipient)` cho thông báo quá hạn lần đầu; không gửi mỗi ngày chỉ vì cron chạy. Đổi hạn hoặc chu kỳ mở lại tạo mốc mới; nếu có daily reminder phải là event type khác theo preference.
- task.reopened/approval.requested/accepted/rejected/invalidated: reviewer cho pending; primary/assignees cho decision; không gửi acceptance cũ khi mất quyền.

Tất cả event có eventId/actor/aggregateVersion/causationId; loại self notification, batch recipients bằng `$in`. In-app ghi cùng transaction và unique event/recipient; external outbox worker at-least-once với dedup theo event/recipient/channel. Trước gửi và lúc mở link kiểm quyền lại; không nhúng mô tả nhạy cảm vào payload email đã xếp hàng. Retry không nhân đôi lịch sử hoặc thông báo.

## Migration và rollback

1. Chạy read-only inventory: số task thiếu parent, orphan, cycle, duplicate role, inactive assignee/reviewer, sai phòng, thiếu ngày, cached count lệch, kích thước histories. Xuất thống kê có scope, không sửa dữ liệu.
2. Backup và diễn tập restore; snapshot code/schema versions. Tạo collections/indexes mới trước, kiểm duplicate trước unique index. Không đổi ID task/file/user.
3. Adapter gắn policyVersion=legacy-v1 khi thiếu, không chỉ suy completionMode. Reviewer trên task không con vẫn không buộc phê duyệt, cha chưa phân công vẫn tính theo guards cũ, thay đổi con vẫn dùng luồng xác nhận cũ thay vì tự gửi pending. Map assigneeId → primary và assigneeIds=[id], participant giữ nguyên. Modern-v2 chỉ bật cho task mới hoặc upgrade-policy command có preview. Creator giữ nguyên; assignedBy quá khứ không biết thì null/unknown, không bịa creator là người giao.
4. Backfill theo batch checkpoint idempotent và không sửa updatedAt nghiệp vụ nếu chỉ bổ sung projection. Không tự đóng/mở task hoặc gửi notification do migration. Task bất thường vào báo cáo xử lý, không âm thầm “sửa”.
5. Dual-write projection và assignment trong cùng transaction, so sánh shadow reads; test counts cũ/mới. Sau đó bật feature flag cho một phòng, theo dõi event/latency/conflicts.
6. Cutover reader rồi writer; ghi rõ source of truth duy nhất. Không duy trì hai writer độc lập assigneeId và assigneeIds. Rollback bằng feature flag về reader tương thích; không thả collection/field mới để rollback.
7. Nhiều cấp/move/dependency chỉ bật sau khi reader legacy không còn hiểu sai. Khi đã có co-assignee/nested task không thể downgrade an toàn về app chỉ hiểu một người/một cấp; rollback phải giữ adapter hoặc khóa write và dùng forward fix.

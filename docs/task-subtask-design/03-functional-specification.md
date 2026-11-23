# Đặc tả nghiệp vụ Task và Subtask ADIGO

Trạng thái: đề xuất chờ duyệt ngày 22/11/2026. Quy tắc trong tài liệu này là thiết kế ADIGO, không phải mô tả mặc định ClickUp. Áp dụng sau migration có kiểm soát; không tự thay hành vi công việc cũ.

## Vai trò và trách nhiệm

- **Creator:** người tạo thực tế từ phiên đăng nhập, bất biến. Sửa sai/import chỉ qua công cụ Admin chuyên biệt, có lý do và lưu original creator; không cho đổi từ form task.
- **Assigned by:** actor trong mỗi sự kiện phân công. Initial assigned by và last assigned by là hai dữ kiện khác nhau; không ghi đè lịch sử bằng một trường cuối.
- **Primary owner:** một đầu mối chịu trách nhiệm chung, bắt buộc khi có assignee, phải thuộc tập assignee đang hiệu lực. Task chưa phân công có primary null.
- **Assignees:** một hoặc nhiều người thực hiện thực sự; có quyền cập nhật phần việc của mình theo policy, không mặc nhiên có quyền thay người khác hoặc sửa hierarchy.
- **Participants:** người phối hợp, giữ nghĩa hiện tại; không tự động chuyển thành assignee. Xem/bình luận theo quyền phòng ban, không được đóng task chỉ vì tham gia.
- **Watchers:** đăng ký nhận sự kiện, không được cấp thêm quyền xem hay sửa. Mất scope thì dừng thông báo.
- **Reviewer:** người duyệt đang hoạt động, có quyền xem; chỉ reviewer chỉ định hoặc Admin được quyết định nghiệm thu. Modern-v2 mặc định cấm tự duyệt nếu chính mình thuộc assignees, kể cả Admin; ngoại lệ phải bật trong policy có lý do và audit. Legacy giữ quyền hiện tại.

## Quyền đề xuất

Mọi quyền cần phiên active và `canView` trước; archived/deleted là guard bổ sung. Creator hoặc watcher không tự có quyền quản lý. Phòng gửi chỉ quan sát/trao đổi yêu cầu liên phòng; phòng nhận/Admin phân công.

- **Admin:** quản lý task trong toàn hệ thống; không được bỏ qua guard còn con mở/dependency/mode bằng PATCH thường. Override đặc biệt nếu sau này có phải là command riêng kèm lý do, không nằm trong bản đầu.
- **Manager phòng phụ trách:** tạo/sửa, thêm con, đổi assignees/participants/reviewer, chọn mode, archive/restore/move trong phạm vi. Không duyệt thay reviewer chỉ vì là manager.
- **Manager phòng yêu cầu:** tạo yêu cầu liên phòng chưa phân công, xem/bình luận; chỉ nghiệm thu khi được chỉ định và còn quyền xem. Không đổi người phòng nhận.
- **Primary:** nhận việc, đổi todo/doing/waiting, nhập kết quả, yêu cầu đóng hoặc gửi duyệt khi đủ điều kiện. Không tự giao người mới; có thể gửi đề nghị chuyển việc.
- **Co-assignee:** nhập/cập nhật phần việc mình, đánh dấu submitted/reopen phần mình. Không đóng task chung hoặc sửa phần việc người khác. Cần output độc lập và hạn riêng thì tạo subtask thay cho một dòng completion cá nhân.
- **Employee assignee của cha:** mặc định chưa có quyền giao subtask cho người khác, tương thích repo. Có thể bật `delegateSubtasks` theo phòng cho primary, nhưng việc giao vẫn trong cùng phòng, active, có audit. Bản đầu để tắt.
- **Participant/watcher/người cùng phòng:** xem/bình luận theo phạm vi hiện có; không quyền thay status/assignment từ nhãn tham gia/theo dõi.
- **Inactive/outside scope:** bị từ chối ở server kể cả dialog mở từ trước hoặc gọi API trực tiếp.

## Tạo và chỉnh sửa

Giữ title 1–250 ký tự, mô tả tối đa 20.000, phòng bắt buộc, dueDate bắt buộc để phù hợp quy trình quản trị hiện tại; startDate tùy chọn và không sau dueDate. UI và API cùng schema. Cho phép chưa phân công hoặc giao cho tôi theo quyền hiện hành. Quick create vẫn phải có hạn; có thể chọn “dùng hạn cha” nhưng phải hiển thị rõ trước lưu, không âm thầm tự điền.

Subtask dùng cùng task model. Kế thừa owning/requesting department từ cha tại server, không nhận client sửa scope; creator lấy actor. Title, assignees, priority, deadline, status và kết quả độc lập; UI đề xuất ngày/priority từ cha nhưng chỉ giá trị người dùng xác nhận mới lưu. Không sao chép file, reviewer, watchers hoặc assignees ngầm.

Độ sâu cấu hình: bản đầu giữ 1 cấp con; giai đoạn nhiều cấp đề xuất tối đa 3 cấp con dưới root (root depth 0), giới hạn server cấu hình 1–7. Trần tổng số hậu duệ đề xuất 500/root, cần đo hiệu năng trước khi mở. Không dùng “7” hoặc “1.000” của ClickUp làm SLA ADIGO.

## Tám tình huống phân công

### A — A tạo rồi giao B

A phải có quyền phân công trong phòng nhận; employee chỉ tự nhận hoặc để trống như hiện tại. Không thêm phê duyệt nếu A đã có quyền. Lý do ban đầu tùy chọn. Ghi creator=A, assignment actor=A, assignee=B, primary=B, thời điểm và nguồn; thông báo B sau commit, trừ tự giao. Status todo, progress 0; không đổi creator về B.

### B — A giao B và C

Manager phòng nhận/Admin chọn B,C và primary rõ ràng, ví dụ B. Không yêu cầu duyệt thứ hai. Hai người phải active/cùng phòng/còn scope; lý do tùy chọn; log toàn bộ thêm/bỏ/primary; thông báo cả hai. Mặc định `assigneeCompletionPolicy=primary`, không bắt đầu tính “50%” chỉ vì B submit. Tùy chọn `all` yêu cầu tất cả assignee hiện hành submit trước khi task đủ điều kiện đóng. Có thể chọn khi tạo; đổi sau đó phải preview tác động.

### C — Đổi B sang D lúc đang làm

Manager/Admin thực hiện trực tiếp; lý do bắt buộc nếu task đã doing/waiting hoặc có submission. Preview người mất/thêm vai trò. Giao lại giữ task status, ngày, tệp và tiến độ theo subtasks; submission của B giữ trong lịch sử nhưng không dùng làm submission của D. Notify D và B nếu B còn quyền xem. Nếu policy all thì task có thể mất readiness, approval cũ phải invalidated; không tự xóa kết quả lịch sử.

### D — B giao subtask cho C

Nếu B là manager/Admin: được. Nếu B chỉ là employee assignee: gửi đề nghị manager duyệt; cấu hình delegateSubtasks có thể cho phép trực tiếp ở giai đoạn sau. Lý do tùy chọn khi tạo, bắt buộc nếu thay phân công đang thực hiện. Creator là người thực tạo, actor phân công là người quyết định; thông báo C. Assignee cha không tự đổi, progress cha tính lại từ con mới. Không được thêm dưới cha đã done trước khi mở lại.

### E — B xong, C chưa xong

Ghi B submitted, C active. Policy all: chưa được đóng task; primary policy trên task lá: primary vẫn phải xác nhận kết quả chung, không suy từ tick của B rằng C đã xong. Trên cha tổng hợp dùng readiness/mode như phần hoàn thành, không yêu cầu thêm tick primary. Nếu đây là hai subtask: task cha chỉ tính phần con đã done, chưa đủ điều kiện đóng. Thông báo primary khi có submission; không tạo notification trùng cho từng lần retry. Không thay status chung thành done từ mutation completion cá nhân; nếu submission làm đủ toàn bộ điều kiện của cha thì domain completion có thể chuyển cha đúng mode trong cùng transaction.

### F — Người nhận muốn chuyển người khác

Assignee gửi đề nghị kèm lý do và người mong muốn; manager/Admin quyết định, không tự đổi assignment. Đề nghị pending không đổi assignee/status/progress. Sau duyệt dùng đúng command phân công và các guard như C; thông báo người đề nghị, người mới, người cũ còn quyền. Từ chối ghi lý do, không làm thay đổi phân công.

### G — Người làm bị vô hiệu hóa hoặc rời tổ chức

Manager/Admin xử lý danh sách việc đang mở, pending approval và vai trò primary/reviewer. Vô hiệu hóa thông thường cần chọn chuyển giao hoặc đưa vào hàng chờ chưa phân công; vô hiệu hóa khẩn cấp vẫn được Admin thực hiện nhưng đánh cờ `needsAssignment`/`reviewerUnavailable`, notify manager, khóa thao tác tài khoản ngay. Không xóa người khỏi lịch sử. Task giữ trạng thái đang thực hiện, tiến độ con không reset; chặn đóng nếu thiếu người hợp lệ. Assignment và deactivate phải dùng chung user revision/lock để tránh giao đúng lúc người đó bị khóa.

### H — Bỏ toàn bộ assignees

Manager/Admin thao tác với lý do bắt buộc và xác nhận; primary về null, không ép todo, đặt needsAssignment. Giữ kết quả đã nộp trong audit nhưng mất readiness nếu cần assignee completion. Notify manager và người cũ còn scope; status/progress theo đầu việc được giữ, approval pending bị vô hiệu nếu thay đổi người chịu trách nhiệm của phiên duyệt. Không cho task chưa phân công được auto-close qua một retry nền.

## Ba chế độ hoàn thành

**Manual:** đủ điều kiện chỉ mở khả năng đóng; primary/manager/Admin chủ động xác nhận. Tất cả con done có thể hiển thị 100% nhưng task vẫn doing. Dễ kiểm soát đầu ra, thêm một thao tác và nguy cơ task chờ đóng.

**Automatic:** khi có ít nhất một con hoạt động và tất cả điều kiện đạt, service đóng task một lần. Không có con thì không dùng mệnh đề rỗng “mọi con đã xong” để tự đóng; task độc lập phải được người có quyền hoàn thành. Ít thao tác nhưng dễ đóng ngoài ý muốn khi archive/move làm thay đổi mẫu số; bắt buộc preview.

**Approval:** cha có con hoạt động và đủ toàn bộ điều kiện → hệ thống lập submission và chuyển approval pending, task status vẫn doing, hiển thị “Chờ nghiệm thu”. Nếu thiếu kết quả bắt buộc thì chỉ ready, primary/manager/Admin bổ sung bằng “Gửi nghiệm thu”. Task không con luôn cần thao tác gửi rõ ràng. Reviewer/Admin duyệt → done/accepted; reject bắt buộc lý do → doing/rejected. Sau reject không tự gửi lại chỉ vì recompute; cần submission revision mới và thao tác gửi lại. 100% chỉ nói đầu việc đã thực hiện, không nói được duyệt. Reviewer không hợp lệ thì báo cần thay người, không fallback tự động.

**Mặc định đề xuất:** task mới dùng Manual; yêu cầu liên phòng vẫn Manual khi mới gửi chưa chọn reviewer, phòng nhận chọn Approval khi chỉ định reviewer hợp lệ; không tự cấp quyền cấu hình cho phòng gửi. Automatic là lựa chọn manager bật rõ. Dữ liệu cũ chạy `policyVersion=legacy-v1`: có con và reviewer dùng xác nhận hiện tại; có con không reviewer tự tính như hiện tại; không con giữ luồng đóng thủ công dù bản ghi có reviewer. Không áp điều kiện assignee mới hay tự gửi duyệt của modern-v2 lên task cũ. Chỉ chuyển sang modern-v2 bằng preview và thao tác quản lý riêng. Đây là thay đổi mặc định cho việc mới cần duyệt, không migration đổi hành vi việc cũ.

### Điều kiện đóng chuẩn

Với `policyVersion=modern-v2`: `eligible = còn active + không deleted + assignee/primary hợp lệ + mọi con hoạt động done + không dependency chưa giải quyết + kết quả bàn giao đủ + policy assignee đạt + checklist bắt buộc đạt`. Legacy-v1 tiếp tục dùng guards hiện có cho đến khi được nâng chính sách rõ ràng.

Với task không có con, bỏ điều kiện con nhưng vẫn phải có explicit completion command. Checklist/dependency chỉ được áp dụng khi tính năng bật và đã triển khai server. Manager đổi cấu hình không được tự bỏ qua điều kiện bàn giao liên phòng.

### Quy tắc thống nhất về người làm và kết quả

- `primary` là chính sách trách nhiệm chung, không yêu cầu primary phải bấm thêm tick cá nhân trước khi đóng. Cha tổng hợp đủ điều kiện có thể tự đóng/gửi duyệt theo mode; task lá cần completion command của primary/manager/Admin.
- `all` yêu cầu các assignee hiện hành đều submitted trong assignment cycle hiện tại. Khi primary bấm completion, server có thể ghi submission của chính primary trong cùng transaction, sau đó kiểm những người còn lại; manager/Admin không được tự đánh dấu submitted thay người khác. Nếu chưa đủ, trả blocker trước khi ghi bất kỳ thay đổi nào.
- Kết quả cha tổng hợp mặc định là bản tổng hợp có nguồn từ kết quả con và link con theo quyền; server sinh bản tóm tắt, không giả chữ ký bàn giao của primary. Nếu workflow yêu cầu báo cáo riêng của cha, phải nhập báo cáo trước; đủ con nhưng thiếu báo cáo không được tự đóng. Cờ `requiresOwnResult` do workflow policy quản lý, mặc định false cho cha tổng hợp, true cho task lá liên phòng.
- Khi cha tự hoàn thành, audit ghi `source=system`, `initiatedById` là actor gây thay đổi con, `completedById=null` và `automatic=true`; không trình bày actor đó là người duyệt. Handover có provenance từ các task con.
- Modern-v2 không tự đóng khi thiếu primary/assignee hợp lệ; việc này khác legacy-v1 vốn có thể có cha chưa phân công. UI phải hiện policy đang áp dụng khi nâng chính sách có thể làm thay đổi readiness.

### Tạo và vô hiệu hóa chu kỳ nghiệm thu

Cha Approval có con chuyển từ chưa eligible sang eligible lần đầu → tạo một pending cycle bằng hệ thống. Nếu đang pending/accepted không tạo thêm cycle khi sửa priority, comment hay refresh. Task lá gửi thủ công; cha thiếu báo cáo riêng gửi sau khi bổ sung báo cáo. Sau rejected hoặc invalidated, chỉ một completion command gửi lại với submission revision mới được tạo cycle mới; recompute đơn thuần không làm mất lý do từ chối.

Submission chứa phiên bản tiêu chí, kết quả và mọi con được nghiệm thu. Reopen con, thay kết quả/báo cáo, assignee, mode, reviewer, required checklist hoặc dependency hard làm submission cũ mất hiệu lực. Deadline/priority/comment không đổi output nên không vô hiệu mặc định, trừ workflow đánh dấu là acceptance criterion. Nếu predecessor bị mở lại sau khi successor done, giữ kết quả successor trong lịch sử, mở lại successor và ancestors, invalidate approval; không tự đóng lại successor khi predecessor hoàn thành lần nữa, cần explicit resubmit/recomplete. Đây là chính sách ADIGO được đề xuất, chưa có trong repo.

Reviewer không được là bất kỳ active assignee nào của cùng task trong modern-v2 khi `allowSelfApproval=false`; Admin cũng chịu guard này. Admin chỉ bypass khi policy đã bật ngoại lệ có lý do và audit, không có override ngầm. Legacy-v1 không bị thay đổi quyền duyệt trong migration.

Role được hợp khi một người có nhiều vai trò, nhưng guard cấm luôn ưu tiên hơn quyền cho phép: Admin cũng không duyệt cycle stale hoặc tự duyệt trái policy. `ready` là approvalState chỉ của mode Approval; Manual dùng readiness để hiện đủ điều kiện nhưng approvalState vẫn none. Người cùng thực hiện có thể rút submission của chính mình khi task chưa done và làm pending mất hiệu lực; task done phải được primary/manager/Admin reopen trước, không cho co-assignee sửa submission để mở lại task ngầm.

### State transitions

- todo → doing: primary/manager/Admin bắt đầu; co-assignee chỉ cập nhật phần mình, service có thể đưa task từ todo sang doing khi có lần bắt đầu đầu tiên.
- todo/doing → waiting: primary/manager/Admin, bắt buộc waitingReason. Blocked bởi dependency là cờ tính riêng, không ghi đè lý do chờ.
- waiting → doing: người có quyền tiếp tục; xóa lý do chờ hiện hành, giữ audit.
- todo/doing/waiting → done: chỉ completion command, kiểm eligible và mode; Approval cần decision accepted đúng revision.
- done → doing hoặc todo: explicit reopen đúng quyền, xóa mốc hoàn thành hiện hành, tăng completion cycle, vô hiệu phê duyệt cũ; giữ handover/activity.
- archived/deleted: không đổi nghiệp vụ; restore có kiểm scope/cha và tính lại.

Đối với task tổng hợp, auto/approval có thể tính todo/doing từ con như cũ; manual giữ trạng thái người quản lý chọn nhưng không được done khi còn con mở. Không cho status label tùy ý từ client; cấu hình workflow được Admin quản lý, statusId ánh xạ semantic todo/doing/waiting/done để guard không phụ thuộc nhãn hiển thị.

## Tiến độ

Tách `executionProgress`, `status`, `approvalState` và `assigneeSubmission`. Không dùng phần trăm làm nguồn duy nhất quyết định done. Progress con và tiến độ cá nhân là hai khái niệm riêng.

- **Count mặc định:** `100 × số con trực tiếp done / số con trực tiếp hoạt động`. Ví dụ 2 done, 1 doing, 2 todo → 40%, không cộng 50% tùy ý cho doing. UI hiện thêm x/y và tiến độ bên trong từng con có hậu duệ.
- **Weighted:** `100 × Σ(weight_i × done_i) / Σweight_i`; weight hữu hạn >0, không tự trộn đơn vị. Ví dụ weight [5,1,2,1,1], hai con đầu done → 60%. Con chưa done đóng góp 0 kể cả có progress bên trong; ghi rõ đây là milestone progress.
- **Estimate:** cùng công thức weighted với estimateMinutes >0 cho mọi con tham gia. Không đủ estimate → lỗi cấu hình hoặc đề nghị quay về count, không bỏ qua những con thiếu giá trị. Time tracked không phải phần trăm hoàn thành.
- **Manual:** giá trị 0–100 có lý do/actor, chỉ manager/primary theo quyền; không tự đổi status hoặc bypass con/dependency.
- **Hybrid, giai đoạn sau:** các hệ số α,β,γ ≥0 tổng bằng 1 cho milestones/checklist/manual contribution; công bố mẫu số, không tính một output vừa checklist vừa subtask. Không bật trong scope đầu vì tăng chi phí giải thích.

Không con: executionProgress của task độc lập là 100 khi done, 0 nếu chưa done, trừ manual progress được bật. Task từng có con mà archive/move mất toàn bộ con giữ status hiện tại và chuyển sang quy tắc task độc lập; không tự đóng. Bộ đếm công suất tính mỗi task lá/độc lập một lần; workload nhiều assignee cần phân bổ effort/share, không nhân tổng công việc theo số người.

## Ngoại lệ và tác động

- Cha còn con mở: chặn done ở mọi điểm vào, trả danh sách/số còn lại theo quyền; không chỉ disable nút.
- Cha done muốn thêm con: yêu cầu reopen riêng, không âm thầm mở cha trong Create.
- Con reopen: invalidate approval và mở lại mọi ancestor done từ dưới lên; ghi một sự kiện mỗi lần trạng thái thực sự đổi, không xóa lịch sử. Sau khi xong lại, approval phải tạo cycle mới.
- Archive/delete/move con làm cha đủ điều kiện: preview tại server gắn revision; confirm đúng revision; tính lại cả cha nguồn và đích. Không còn con thì giữ status, không tự đóng.
- Nhiều cấp: cấm self-parent, cycle, vượt depth/descendant limit; không được cùng một task xuất hiện hai lần trong path. Tính bottom-up và chỉ truyền thay đổi lên ancestor, không phát command xuống con để tránh vòng lặp.
- Move/convert: bản đầu chỉ cùng phòng phụ trách và cùng requesting department; task/cha liên quan chưa done/archive/deleted. Khác scope phải qua workflow riêng ở giai đoạn sau. ID, file, comment và audit của con được giữ; không sao chép thành bản mới.
- Delete: đề xuất soft delete khác archive; bản đầu chặn xóa cha còn con hoạt động, preview các dependency; không hard delete. Cascade cả subtree chỉ là mở rộng sau, không tự thêm vào bản đầu. Restore giữ ID/lịch sử và kiểm cha còn tồn tại, scope cùng như trước.
- Checklist không con: checklist bắt buộc chặn completion; checklist không tự tạo thêm task trong số liệu. Checklist thay đổi sau accepted làm approval invalidated.
- Dependency: hard finish-to-start chặn bắt đầu, gửi kết quả và đóng khi predecessor chưa done; thông báo blocked riêng. Nếu thêm cạnh lúc successor đang doing, giữ status và dữ liệu nhưng đánh blocked, không cho tiếp tục transition tới done. Cấm cycle trong đồ thị dependency lẫn ancestor-descendant dependency để tránh deadlock nghiệp vụ; move phải kiểm lại cả hai loại quan hệ.
- Hạn con sau cha: cho lưu với cảnh báo manager; không tự kéo hạn cha. Con quá hạn làm cờ `hasOverdueChildren`, khác cờ cha overdue. Due date đổi không tự đổi progress hay assignees.
- Đổi completionMode/progressMode: manager/Admin, reason + preview + expectedVersion; task done phải reopen trước. Chuyển Approval cần reviewer hợp lệ; Approval → Auto có thể đóng ngay khi eligible nên cần xác nhận rõ. Phê duyệt cũ không được tái dùng khi đổi mode/đổi assignment/hierarchy/tiêu chí đầu ra.
- Reviewer reject: giữ executionProgress 100 nếu chưa mở lại đầu việc, hiển thị rejected + lý do; muốn sửa thực chất thì reopen con hoặc cập nhật kết quả, tạo submission revision mới, không biến rejected thành todo để che mất trạng thái.

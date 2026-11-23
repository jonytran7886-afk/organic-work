# Đặc tả giao diện tạo và xử lý công việc ADIGO

Đề xuất chờ duyệt. Dùng ngôn ngữ và phong cách giao diện Organic Work hiện có; học mô hình tương tác, không sao chép tài sản/giao diện ClickUp. Mobile 390 px và desktop 1440 px là kích thước kiểm thử tối thiểu, không thay thế kiểm tra thiết bị thật.

## List và Board

### Cây công việc trong danh sách phòng ban

Mỗi dòng gồm nút mở cây, title/link, status, primary + nhóm avatar assignees, deadline, priority, `x/y hoàn thành` và menu. Dòng con thụt vào, nhãn Công việc con, có đường quay về cha. Nút `+` thêm con luôn có tên truy cập “Thêm công việc con cho …”; desktop có thể gọn, mobile không phụ thuộc hover. Cha done hiện “Mở lại để thêm việc con”, không silently reopen.

Ba chế độ hiển thị: Thu gọn, Mở rộng và Tách riêng. Tree mode giữ cha làm context khi con khớp filter, nhưng cha không khớp phải gắn “Ngữ cảnh” và không cộng vào totals. Các con không khớp không tự xuất hiện vì mở cây; có lựa chọn xem toàn bộ trong chi tiết. Counts tổng số con có thể khác số đang lọc, phải ghi “2 con hiển thị / 5 con tổng”. Không hiện title cha nếu người dùng không được xem cha.

Việc của tôi mặc định Tách riêng để không che subtask được giao khi cha thuộc người khác; có tabs Tôi phụ trách, Tôi cùng thực hiện, Tôi tham gia, Tôi theo dõi. Assignment role quyết định tab; không suy từ participant thành assignee. Tổng task duy nhất không nhân đôi giữa primary/co-assignee.

Lưu mode, filters, sort, group trong URL; expanded IDs có thể lưu state theo view/user, không đưa toàn dữ liệu vào URL. Từ detail quay lại đúng filter và anchor; sau tạo con giữ nguyên scroll, tự mở cha khi cần và focus về dòng vừa tạo.

Sort hỗ trợ deadline, priority, title, status và manual ở từng nhóm anh em; khi sort khác manual thì drag reorder bị tắt có giải thích. Group theo status/phòng/người phụ trách được cân nhắc theo view; không kéo con ra khỏi cha chỉ vì group status khác. Search bản đầu theo title, bổ sung description sau khi đánh giá index/search engine. Không tự nhận tìm được comments/files nếu backend chưa tìm.

### Inline editor và menu

- Status editor dùng capabilities server; chuyển waiting mở nhập lý do; done gọi completion, không PATCH status trực tiếp.
- Assignee picker có primary rõ và nhiều người; người đã inactive vẫn hiển thị lịch sử nhưng không thể chọn mới. Primary phải thuộc assignees, tự loại khỏi participants có thông báo rõ.
- Deadline editor hiển thị cảnh báo vượt cha, giữ dữ liệu khi server từ chối; không tự kéo hạn cha.
- Menu theo quyền: mở chi tiết, thêm con, phân công/giao lại, sửa, đổi mode, mở lại, archive; move/convert/duplicate/delete chỉ xuất hiện khi phase đã có backend.
- Không optimistic thay status/assignee trước khi server chấp nhận trong luồng có nhiều guard. Busy khóa đúng thao tác; lỗi 409 tải dữ liệu mới và yêu cầu người dùng kiểm tra phần thay đổi, không ghi đè tự động.

Bulk toolbar xuất hiện khi chọn task, hiển thị số lượng và operation hỗ trợ. Preview tất cả task trước ghi; batch atomic cùng scope tối đa 50. Những task chỉ là context không được chọn. Drag/drop cuối lộ trình chỉ gọi cùng move command; có lựa chọn menu tương đương cho keyboard và mobile.

### Board

Board dùng cùng capabilities và status transition; bản đầu giữ menu đổi trạng thái, không làm thêm drag/drop chỉ vì ClickUp có. Chế độ separate có thẻ con riêng kèm parent link; chế độ collapsed có count và mở section. Không render cùng task hai lần rồi cộng hai lần. Việc cha tổng hợp có khu vực theo dõi hoặc thẻ có nhãn tổng hợp; đưa vào số liệu theo cùng leaf rule với List.

## Task Detail

Header: breadcrumb cha có kiểm quyền; title; status; priority; menu; nút hành động chính tùy readiness/mode. Khu nội dung: mô tả → kết quả yêu cầu → progress và subtasks → checklist/dependencies khi bật → files → trao đổi và activity. Desktop có cột thông tin bên phải; mobile đưa các trường quan trọng lên trước trao đổi, không giấu nút thêm con ở cuối trang.

Thông tin trách nhiệm hiển thị riêng: người tạo, người giao gần nhất có link lịch sử, primary, co-assignees, participants, watchers và reviewer. Creator không phải dropdown sửa. Labels thống nhất “Người phụ trách chính”, “Người cùng thực hiện”, “Người tham gia”, “Người theo dõi”, “Người nghiệm thu”.

Progress hiển thị nguồn tính: “2/5 công việc con hoàn thành · 40%”. Nếu Manual/Approval và 100%, hiện “Đủ điều kiện đóng” hoặc “Chờ nghiệm thu”, không dùng nhãn Hoàn thành trước khi status done. Riêng deadline có cả cờ “Có việc con quá hạn” và cờ quá hạn của chính task.

Subtask section luôn hiện cho task đủ điều kiện có con, kể cả 0/0: “Chưa có công việc con” và nút thêm theo quyền. Rows có title, assignees, deadline, status, progress riêng và menu. “Hiện con lưu trữ” là toggle tách biệt; con archive không vào mẫu số. Khi vượt depth, không hiện thao tác tạo nhưng có giải thích cấp tối đa.

Activity có filter loại sự kiện, cursor tải thêm; before/after tên người lấy được từ snapshot/ID có quyền, giữ tên historical khi tài khoản inactive. Thông báo đổi người không ghi đơn thuần “đã sửa” mà nêu ai→ai, actor, lúc nào, lý do. Hiển thị automatic source khác người bấm hoàn thành để tránh hiểu actor là người duyệt.

## Composer thống nhất

Một `TaskComposer` phục vụ Create Task và Create Subtask; dùng cùng schema DTO. Khi mở từ cha, parent đã chọn, owning/requesting department bị khóa theo cha và server vẫn xác minh. Khi mở global có bộ chọn loại công việc và parent search theo quyền; không cho đổi parent bằng metadata edit.

### Quick create

Hiện title, phòng hoặc cha context, assignees/primary, hạn bắt buộc và priority. Expand “Thêm chi tiết” để có description, startDate, file, participants và mode. Không giấu trường nghiệp vụ bắt buộc nhằm đạt ít click. Enter lưu khi focus ở title; textarea Enter xuống dòng; Cmd/Ctrl+Enter có thể lưu khi form hợp lệ. Không tạo khi IME đang composition.

### Full create

Title, description/kết quả yêu cầu, phòng, assignees, primary, participants, start/due, priority và file. Completion mode ở phần quy tắc; Approval mở reviewer bắt buộc. Watchers/checklist/dependencies chỉ hiển thị sau khi có feature và backend; không render control giả. DueDate không trước startDate, parent done/archived/scope stale hiển thị lỗi bên cạnh parent.

Footer: Hủy, Tạo, Tạo và tiếp tục. Tạo và tiếp tục giữ parent/phòng/priority theo lựa chọn rõ, reset title/mô tả/file/assignees nhạy cảm; phát UUID mới sau mỗi lần thành công. Khi lỗi hoặc mất response giữ UUID và draft để retry không tạo trùng. File upload đã thành công cần giữ staged IDs, không upload lại khi retry; chưa attach thì được cleanup theo TTL hiện có.

Create-and-continue không chuyển trang sau mỗi task. Có feedback “Đã tạo …”, link mở task mới và focus về title. Sau Tạo bình thường từ detail/list, close đúng dialog và refresh task/ancestor rows; không reset filter. Đóng draft có dữ liệu cần confirm bỏ thay đổi; không yêu cầu xác nhận khi form rỗng.

## Các dialog nghiệp vụ

- **Giao lại:** hiện tập hiện tại, primary cũ, tập mới, primary mới và reason. Preview người bị gỡ/thêm, phần submission bị thay hiệu lực, ai nhận thông báo. Không thay người của con khi giao lại cha.
- **Chuyển việc con:** chọn cha mới hoặc chuyển thành task; hiện breadcrumb, phòng, max depth, thay đổi progress cả hai cha và cảnh báo phạm vi. Confirm chỉ với preview token còn đúng version. Không hỗ trợ chuyển khác scope trong bản đầu.
- **Hoàn thành:** hiển thị blockers và count con; đủ điều kiện thì nhập kết quả/tệp. Manual có “Xác nhận hoàn thành”; Approval task lá hoặc cha cần báo cáo riêng có “Gửi nghiệm thu”. Cha Approval có con đủ điều kiện và đủ kết quả sẽ tự tạo pending: lúc này hiện “Đã gửi nghiệm thu”, không thêm nút gửi tạo cycle thứ hai. Sau rejected/invalidated hiện “Sửa và gửi lại”. Legacy-v1 giữ nút xác nhận của luồng hiện tại, không tự đổi UI sang auto-submit.
- **Duyệt:** reviewer thấy kết quả, cycle và danh sách con; buttons “Duyệt hoàn thành”, “Yêu cầu sửa”. Reject phải có lý do; stale cycle thì disable và tải mới.
- **Đổi mode:** giải thích hành vi, reviewer nếu cần, preview việc có đóng ngay hay mất approval, reason. Task done phải mở lại trước; không thay mode rồi tự xóa chứng cứ duyệt.
- **Archive/delete:** hiện rõ số con và tác động lên cha; soft delete và archive khác câu chữ. Không có nút xóa vĩnh viễn trong scope đầu.
- **Chuyển giao khi khóa tài khoản:** Admin thấy việc mở, primary/reviewer/co-assignee; chuyển hàng loạt trong scope hoặc chọn hàng chờ. Trường hợp khóa khẩn cấp ghi lý do và nhu cầu manager xử lý.

## Accessibility và feedback

Tái sử dụng `Dialog` hiện có cho focus trap, Escape, trả focus và khóa đóng khi đang lưu; composer hiện dùng backdrop riêng nên cần hợp nhất, nhưng phải kiểm tra các hook keyboard hiện có trước khi thay. Buttons có type, label và busy state; aria-live cho thông báo thành công/lỗi, aria-expanded/controls cho cây. Không yêu cầu màu để phân biệt trạng thái.

Loading có skeleton đúng vùng; empty nêu không có việc hoặc không có kết quả lọc, không lẫn permission denied. Lỗi field giữ dữ liệu; session hết hạn lưu draft phù hợp nhưng không hiển thị dữ liệu cho tài khoản tiếp theo. Touch targets tối thiểu 44 px; không overflow ngang toàn trang tại 390 px; bảng rộng cuộn trong vùng có nhãn. Kiểm keyboard-only, screen-reader labels, focus sau thêm/reassign/reopen và mobile menu.

## Tiêu chí đồng nhất

Cùng task, cùng user và cùng version phải thấy cùng status/assignees/progress/mode ở List, Board, My tasks và Detail. Khác filter có thể khác danh sách nhưng không được khác định nghĩa completion. Server capabilities hướng dẫn UI, mọi command vẫn kiểm quyền lại lúc lưu. Khi chưa có realtime, phải có Refresh rõ và refetch khi focus/tab trở lại; realtime là phần nâng cấp riêng, không gọi cache TTL là đồng bộ đa phiên.

Tree mode group theo giá trị của root/context cha, rồi sort các anh em trong nhánh; không đặt cùng một nhánh vào nhiều group chỉ vì con khác status. Muốn group mọi con theo status/assignee độc lập thì chuyển sang separate mode. Số tổng đầu việc và số cha ngữ cảnh được hiển thị riêng.

Ma trận quyền thao tác chuẩn nằm trong [bản tổng quan](index.html#permission-matrix). User có nhiều role nhận hợp các quyền cho phép, nhưng guard cấm self-approval/archived/deleted/blocked/stale vẫn có ưu tiên cao hơn; không bật nút Duyệt chỉ vì user là Admin. Khi chọn task có legacy policy, hiện mô tả hành vi cũ và không ngầm chuyển sang policy mới bằng một lần sửa metadata.

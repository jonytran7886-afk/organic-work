# Nghiên cứu ClickUp cho thiết kế Task và Subtask ADIGO

Ngày đối chiếu: 22/11/2026, Asia/Saigon. Trạng thái: hồ sơ để duyệt, chưa triển khai. ADIGO được hiểu là hệ thống trong repo Organic Work; không đổi thương hiệu hoặc tên database theo giả định này.

## Kết luận sản phẩm

Nên học cách ClickUp coi subtask là công việc có định danh, người làm và trạng thái riêng; cho phép tạo từ danh sách lẫn chi tiết; tách tiến độ khỏi việc đóng công việc. Không nên xem auto-completion hoặc một người phụ trách chính là quy tắc mặc định của ClickUp. Hai quy tắc đó cần được quyết định riêng cho ADIGO.

Các nhãn dưới đây chỉ mức bằng chứng: **Tài liệu** là hành vi được tài liệu chính thức mô tả; **Cấu hình** là hành vi cần ClickApp, quyền hoặc gói; **Chưa xác minh** là chưa đủ căn cứ; **Đề xuất ADIGO** là thiết kế trong các tài liệu 03–06. Không có phiên ClickUp đăng nhập được dùng trong đợt này, nên “Tài liệu” không có nghĩa là đã kiểm thử trên ứng dụng thật.

## Vòng đời và các trường Task

- **Tạo — Tài liệu:** tạo qua toolbar, quick-create và API `POST /api/v2/list/{list_id}/task`. API yêu cầu List ở URL và `name` trong body. Mô tả, assignees, trạng thái, ưu tiên, ngày, estimate, tags, custom fields và parent là các tham số bổ sung. Việc UI hoặc Workspace yêu cầu thêm thông tin phải kiểm tra theo cấu hình. [Create task](https://help.clickup.com/hc/en-us/articles/6309647350807-Create-a-task), [Create Task API](https://developer.clickup.com/reference/createtask).
- **Chỉnh sửa, phân công và giao lại — Tài liệu/Cấu hình:** Update Task hỗ trợ cập nhật thông tin và `assignees.add/rem`; nhiều assignee cần bật Multiple Assignees. Không suy ra từ API rằng mọi thành viên đều được thay người: quyền truy cập công việc vẫn áp dụng. [Update Task API](https://developer.clickup.com/reference/updatetask), [Multiple Assignees](https://help.clickup.com/hc/en-us/articles/6309029762583-Multiple-Assignees).
- **Đóng, mở lại và theo dõi — Tài liệu/Cấu hình:** có status và ngày đóng trong mô hình API; không đồng nhất trạng thái Done/Closed với một bước phê duyệt nghiệp vụ của ADIGO. Cấu hình cảnh báo việc chưa hoàn tất được mô tả riêng. Quy tắc tự mở cha khi mở con chưa được xác minh cho mọi cấu hình. [Incomplete Warning](https://help.clickup.com/hc/en-us/articles/6304420229527-Incomplete-Warning), [Update Task API](https://developer.clickup.com/reference/updatetask).
- **Sao chép và di chuyển — Tài liệu:** Duplicate tạo công việc độc lập, cho chọn nội dung copy và vị trí đích. Move khác Add to another List: move bỏ vị trí cũ, add giữ cả hai; chuyển List có thể cần map status/custom fields. Chuyển cha của subtask là thao tác khác với đổi List. Không mặc định copy toàn bộ lịch sử hoặc quyền. [Duplicate a task](https://help.clickup.com/hc/en-us/articles/6309819303703-Duplicate-a-task), [Move tasks between Lists](https://help.clickup.com/hc/en-us/articles/6329600534935-Move-tasks-between-Lists).
- **Lưu trữ, xóa — Tài liệu:** archive khác delete. Delete đưa task vào Trash; tài liệu hiện ghi thời hạn 30 ngày. Khi con đã bị xóa trước cha, Trash nhóm con dưới cha. Chưa xác minh trực tiếp chuỗi xóa/khôi phục cha cùng con đang hoạt động; không áp chính sách cascade suy đoán vào ADIGO. [Delete a task](https://help.clickup.com/hc/en-us/articles/6311358652951-Delete-a-task), [Restore from Trash](https://help.clickup.com/hc/en-us/articles/6311742742423-Restore-items-from-the-Trash).
- **Lịch sử — Tài liệu:** thay đổi trạng thái, người làm và ưu tiên có trong hoạt động công việc. Đây không phải bằng chứng về khả năng xuất audit pháp lý hoặc lưu vô hạn trên mọi gói. [Task activity and comments](https://help.clickup.com/hc/en-us/articles/29723182607127-Task-activity-and-comments).

### Phân loại trường dữ liệu

- **Sinh bởi hệ thống:** ID, creator, thời điểm tạo/cập nhật/đóng; các tham chiếu List và parent. Không thấy tham số thay creator hoặc “assigned by” trong Create/Update Task đã đọc; chưa kết luận ClickUp tuyệt đối không hỗ trợ qua các cơ chế khác. ADIGO giữ creator bất biến, lưu người giao trong sự kiện phân công.
- **Nhập khi tạo/sửa:** title/name; description; assignees; priority; status; start/due; estimate; tags. `name` bắt buộc ở Create API. Time tracked là dữ liệu ghi nhận thời gian, không nên suy từ trường estimate; chưa nghiên cứu hợp đồng time-entry để đề xuất triển khai trong phạm vi đầu.
- **Theo tính năng/cấu hình:** Multiple Assignees, watchers/followers, checklist, Custom Fields, dependencies và các loại progress. Không có bằng chứng đủ để coi “primary owner” là vai trò native tách biệt trong Multiple Assignees; đây là đề xuất ADIGO. Người duyệt cũng phải thiết kế rõ, không gán nhãn approval native chỉ vì có status Review.
- **Tài nguyên liên quan:** attachments, comments và activity có luồng riêng; không phải tất cả đều là field tùy ý gửi vào Update Task.
- **Kế thừa:** định nghĩa Custom Fields đến từ hierarchy; giá trị trên con có thể khác cha. Không suy ra con luôn kế thừa assignee, deadline hoặc giá trị custom field từ cha. [Work with subtasks](https://help.clickup.com/hc/en-us/articles/29665922829335-Work-with-subtasks-from-tasks).
- **Custom field bắt buộc — Cấu hình:** Required Custom Fields phụ thuộc gói. Đặc biệt Create Task API mặc định không enforce required custom fields, trừ khi gửi `check_required_custom_fields: true`. ADIGO cần enforce nghiệp vụ tại server trên mọi điểm vào. [Custom Field types](https://help.clickup.com/hc/en-us/articles/6303499162647-Custom-Field-types), [Create Task API](https://developer.clickup.com/reference/createtask).

### Bổ sung thời gian, tài nguyên liên quan và giới hạn kết luận

Time estimate là kế hoạch, time tracked là các time entry thực tế; không lấy số giờ đã chạy timer làm tỷ lệ hoàn thành. Time Tracking cần Admin/Owner bật, availability tùy gói; rollup có thể cộng thời gian của cha, con và nested con. Estimate cơ bản có trên mọi gói, nhưng estimate theo từng assignee được tài liệu ghi là Business trở lên. Đây là hai cơ chế khác Progress Auto. [Intro to time tracking](https://help.clickup.com/hc/en-us/articles/6304291811479-Intro-to-time-tracking), [Time estimates](https://help.clickup.com/hc/en-us/articles/7257011414807-See-time-estimates-in-tasks-views-and-Dashboard-cards).

Comments và attachments có endpoint riêng. API upload attachment không phải bằng chứng Update Task nhận toàn bộ file trong JSON. Chưa kiểm tải file hay timer bằng phiên thật. [Get Task Comments](https://developer.clickup.com/reference/gettaskcomments), [Create Task Attachment](https://developer.clickup.com/reference/createtaskattachment), [Get Task](https://developer.clickup.com/reference/gettask).

Danh mục 28 trường được đối chiếu riêng trong [bản tổng quan đọc được trực tiếp](index.html#field-dictionary): field bắt buộc, optional/system/configuration, hiện trạng repo và quy tắc kế thừa. Những trường không có bằng chứng native như primary/assigned-by độc lập được đánh dấu rõ, không gán mặc định cho ClickUp.

## Mười lăm câu hỏi về Subtask

1. **Số lượng:** tài liệu giới hạn hiệu năng 1.000 subtask cho một task, bao gồm nested subtasks. Một tài liệu template còn đề cập các con bị xóa trong 51 ngày gần nhất khi áp template; không dùng giới hạn này làm thiết kế ADIGO. [Task limits](https://help.clickup.com/hc/en-us/articles/29664799512855-Tasks-feature-availability-and-limits), [Templates](https://help.clickup.com/hc/en-us/articles/6309918176535-Use-task-templates).
2. **Nhiều cấp:** có Nested Subtasks ClickApp; bảng ClickApps mô tả tối đa 7 cấp hierarchy cho subtasks. Cần chủ Workspace/Admin bật và cấu hình, không mặc định mọi Workspace bật. [ClickApps](https://help.clickup.com/hc/en-us/articles/6304327753111-Intro-to-ClickApps).
3. **ID riêng:** Create API tạo subtask bằng `parent` và trả task có ID; subtask là tài nguyên task riêng. [Create Task API](https://developer.clickup.com/reference/createtask).
4. **Status riêng:** subtask có thể đặt status trong section con; không chỉ là checkbox của cha. [Work with subtasks](https://help.clickup.com/hc/en-us/articles/29665922829335-Work-with-subtasks-from-tasks).
5. **Người phụ trách riêng:** có. [Intro to subtasks](https://help.clickup.com/hc/en-us/articles/6309825777943-Intro-to-subtasks).
6. **Khác người cha:** tài liệu và payload cho phép đặt assignee riêng; không nêu ràng buộc phải trùng cha. Đây là kết luận từ hợp đồng API, chưa chạy phiên thật. [Create Task API](https://developer.clickup.com/reference/createtask).
7. **Nhiều người:** Multiple Assignees áp dụng cho task; các task con dùng mô hình đó khi bật ClickApp. [Multiple Assignees](https://help.clickup.com/hc/en-us/articles/6309029762583-Multiple-Assignees).
8. **Chuyển thành task:** có trong menu nested subtask. Riêng Update Task API ghi rõ không thể chuyển con thành task bằng cách đặt `parent:null`; khả năng UI không đồng nghĩa endpoint này hỗ trợ. [Nested subtasks](https://help.clickup.com/hc/en-us/articles/6304431740055-Create-nested-subtasks), [Update Task API](https://developer.clickup.com/reference/updatetask).
9. **Chuyển sang cha khác:** có menu; Update Task API hỗ trợ `parent` chứa ID cha mới. Điều kiện status/location áp dụng khi chuyển vị trí. [Nested subtasks](https://help.clickup.com/hc/en-us/articles/6304431740055-Create-nested-subtasks), [Update Task API](https://developer.clickup.com/reference/updatetask).
10. **Xóa cha:** Trash có quan hệ cha–con, nhưng cascade đầy đủ cùng khả năng khôi phục con đang hoạt động chưa xác minh thực tế. ADIGO đề xuất soft delete có preview trong tài liệu 03.
11. **Đóng cha khi còn con:** Incomplete Warning hiển thị cảnh báo nếu bật cho Space và loại mục tương ứng; tài liệu chi tiết không đủ để gọi đây là ràng buộc server bắt buộc trong mọi Workspace. ADIGO đề xuất chặn hoàn thành khi con chưa xong. [Incomplete Warning](https://help.clickup.com/hc/en-us/articles/6304420229527-Incomplete-Warning).
12. **Mở lại con:** chưa xác minh mặc định cha có tự mở; ADIGO đề xuất tự vô hiệu hóa xác nhận và mở lại cha theo chế độ.
13. **Deadline con sau cha:** tài liệu sync cho phép cha lấy ngày muộn nhất của con; có cơ chế remap ngày riêng. Chưa xác minh có hard constraint trên mọi đường tạo/cập nhật. ADIGO đề xuất cho phép với cảnh báo, không tự đổi hạn cha. [Sync dates](https://help.clickup.com/hc/en-us/articles/34108351520407-Sync-parent-and-subtask-dates), [Remap dates](https://help.clickup.com/hc/en-us/articles/6304545702423-Remap-Subtask-Due-Dates).
14. **Tạo ở List:** có tạo ngay tại dòng và Enter để lưu. [List/Board subtasks](https://help.clickup.com/hc/en-us/articles/6310382044567-Create-and-edit-subtasks-in-List-and-Board-view).
15. **Tạo ở Detail:** có section dưới description và sidebar điều hướng con khi task đã có con. [Work with subtasks](https://help.clickup.com/hc/en-us/articles/29665922829335-Work-with-subtasks-from-tasks).

## Trạng thái, tiến độ và Automation

Progress Auto có thể tính subtasks, checklist và assigned comments; có tùy chọn tính con archive. Tài liệu nêu không roll up tiến độ nested subtask vào Progress Auto. Progress Manual là giá trị đặt tay. Vì vậy không thể coi mọi thanh tiến độ ClickUp là số task con hoàn thành chia tổng số con. Quy tắc lúc không có action item cũng được cấu hình. [Custom Field types](https://help.clickup.com/hc/en-us/articles/6303499162647-Custom-Field-types).

Tài liệu Kanban gợi ý automation đóng cha khi tất cả con xong. Đây là một cấu hình automation, không chứng minh cha tự đóng ở trạng thái mặc định. Triggers, Conditions và Actions cần xét gói/quyền; có cảnh báo vòng lặp khi action tạo thêm công việc. [Kanban workflow](https://help.clickup.com/hc/en-us/articles/40674788220311-Set-up-a-Kanban-board-for-task-tracking), [Create Automation](https://help.clickup.com/hc/en-us/articles/30241682127127-Create-an-Automation).

Count-based có lợi vì dễ giải thích; trọng số phù hợp độ phức tạp; estimate phù hợp công suất nhưng cần ước lượng đáng tin; manual linh hoạt nhưng dễ chủ quan; hybrid cần hệ số công khai và không đếm trùng. Trọng số/estimate/hybrid trong tài liệu 03 là đề xuất ADIGO, chưa được xác minh là công thức native mặc định của ClickUp.

## Assignment và UX

ClickUp phân biệt assignees với followers. Followership và thông báo có cấu hình theo sự kiện; không mặc định mọi thay đổi đều gửi cho mọi người. API thêm/bỏ assignee không chứng minh mỗi người có trạng thái “hoàn thành phần việc” riêng. Việc chuyển quyền tự giao lại và xử lý người rời tổ chức chưa được xác minh trong phiên Workspace thực tế. [Notification settings](https://help.clickup.com/hc/en-us/articles/6325918957335-Notification-settings), [Sharing and permissions](https://help.clickup.com/hc/en-us/articles/6309266954263-Share-Spaces-Folders-Subfolders-Lists-and-tasks).

List/Board hỗ trợ collapse all, expand all, separate tasks; tài liệu yêu cầu separate để con xuất hiện trong kết quả lọc theo cách mô tả. Bulk edit và kéo task lên task khác để đổi quan hệ được hỗ trợ. Detail cho sửa trường, sort và reorder con. Không sao chép nguyên UI; ADIGO cần ưu tiên nút rõ trên mobile và giữ đúng bộ lọc/điểm quay lại. [List/Board subtasks](https://help.clickup.com/hc/en-us/articles/6310382044567-Create-and-edit-subtasks-in-List-and-Board-view), [Detail subtasks](https://help.clickup.com/hc/en-us/articles/29665922829335-Work-with-subtasks-from-tasks).

Chưa xác minh bằng phiên đăng nhập: tất cả thao tác quick/full/create-next theo gói; đổi creator; deadline vượt cha qua mọi view; cascade delete/restore; tự mở cha; ACL đặc thù trên nhiều List; completion từng assignee. Không dùng các mục này làm “ClickUp đã làm vậy” trong tiêu chí nghiệm thu ADIGO.

### Mâu thuẫn giữa các tài liệu chính thức

Trang List/Board nói guest có Edit hoặc Full edit có thể tạo/sửa subtasks, nhưng Intro to subtasks lại nói guest chỉ có Edit không thể tạo hoặc xóa subtasks. Hai nguồn không thống nhất; kết luận được thu hẹp thành “phụ thuộc quyền, cần kiểm tra bằng Workspace thực tế”, không coi Edit là đủ trên mọi điểm vào. ADIGO không có guest role hiện tại nên không ánh xạ quyền này sang employee. [List/Board permissions](https://help.clickup.com/hc/en-us/articles/6310382044567-Create-and-edit-subtasks-in-List-and-Board-view), [Intro to subtasks permissions](https://help.clickup.com/hc/en-us/articles/6309825777943-Intro-to-subtasks).

Create-next, cascade delete/restore và tự mở cha vẫn là unknown sau lần rà soát này; không có tài khoản ClickUp được xác định trong ngữ cảnh để kiểm chứng thao tác. Điều này không ngăn thiết kế chính sách ADIGO độc lập, nhưng phải giữ nhãn unknown thay vì kết luận từ nguồn không nói tới hành vi đó.

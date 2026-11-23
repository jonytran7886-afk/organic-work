# Kết quả rà soát và độ bao phủ hồ sơ Task và Subtask

Ngày: 22/11/2026. Phạm vi hoàn tất là hồ sơ nghiên cứu và thiết kế; không đồng nghĩa tính năng đề xuất đã được lập trình hoặc hệ thống đã đạt end-to-end. Yêu cầu chờ duyệt trước chỉnh code ứng dụng vẫn giữ theo prompt.

## Các thiếu sót đã sửa

1. **Approval không nhất quán:** phân biệt cha tổng hợp tự tạo pending khi đủ cả con/kết quả với task lá hoặc cha thiếu báo cáo riêng cần gửi. Reject không được tự pending lại bởi recompute. Cycle và submission revision là guard quyết định.
2. **Điều kiện primary/all có nguy cơ chờ vô hạn:** primary không cần thêm tick cá nhân cho cha tổng hợp; all kiểm từng assignment cycle, primary submit phần mình cùng completion command, manager không submit thay người khác.
3. **Kết quả tự động chưa rõ người chịu trách nhiệm:** tổng hợp kết quả con có provenance system; initiator không phải reviewer hay người ký báo cáo. RequiresOwnResult được workflow định nghĩa và không bị auto-close bỏ qua.
4. **Migration có thể đổi hành vi task cũ:** thêm policyVersion legacy-v1/modern-v2. Giữ reviewer không con và cha chưa phân công theo semantics hiện tại; upgrade có preview thay vì backfill tự áp guards mới.
5. **Quyền chỉ mô tả bằng prose:** thêm ma trận 17 thao tác, 7 nhóm vai trò; guard cấm ưu tiên hơn role allow, Admin cũng không tự duyệt trái policy. Actor active/scope vẫn kiểm ở command.
6. **Field coverage chưa tường minh:** thêm từ điển 28 dòng, gồm 26 field trong prompt và hai scope phòng của repo; đánh dấu required/optional/system/configuration/unknown, hiện trạng và kế thừa.
7. **API còn lỗ hổng:** bổ sung list/filter/cursor, participants, watcher của tôi, checklist, comments, policy-upgrade, options/review queue và account handoff. Tổng 30 nhóm hợp đồng; giữ adapter cho API hiện hành, không bỏ qua guard bằng legacy PATCH.
8. **Lỗi API mơ hồ:** chốt 400 malformed, 401 anonymous, 404 missing/outside scope, 403 visible-but-forbidden, 409 conflict, 422 schema/domain; payloadHash/preview token có quy tắc chuẩn hóa rõ.
9. **Assignment index chưa chặn trùng khác role:** đổi unique partial sang taskId/userId active; thêm unique primary/task; giữ intervals khi đổi role.
10. **Lock order chưa có thứ tự toàn cục:** chốt scope/workflow graph → users → roots → task IDs, mọi command dùng cùng quy tắc; tập khóa thay đổi thì retry từ đầu.
11. **Dependency gọi finish-to-start nhưng chỉ chặn đóng:** bổ sung chặn start/submit/complete, invalidation khi predecessor reopen, guard quan hệ ancestor mới khi move và giới hạn impact trước ghi.
12. **Outbox diễn đạt quá mạnh:** tách chống enqueue trùng khỏi exactly-once delivery; crash sau send vẫn có thể lặp nếu provider không idempotent. External payload chung + link auth, không hứa thu hồi email đã gửi.
13. **Các tài liệu ClickUp chưa được đối chiếu chéo:** thêm nguồn riêng cho duplicate/move/time, ghi xung đột quyền guest giữa Intro và List/Board; không kết luận guest Edit chắc chắn được tạo subtask.
14. **Bản tổng quan chỉ dẫn tới raw Markdown:** render toàn bộ nội dung thành HTML offline đọc trực tiếp, thêm navigation giữa sáu deliverable, phụ lục và bảng quyền/field/events/traceability. Markdown vẫn là nguồn chỉnh sửa.
15. **Validation mới chỉ kiểm file/link:** bổ sung kiểm parse/report structure, số ca, ID bảng, local anchors, ảnh và browser layout 390/1440 px trong biên bản xác minh. Các mục chưa chạy phải ghi chưa xác minh, không tự đánh dấu đạt.

## Traceability

[Bảng đối chiếu 12 phần của prompt](index.html#requirement-coverage) nêu tài liệu đáp ứng và trạng thái bằng chứng. [Bảng dữ liệu](index.html#field-dictionary), [ma trận quyền](index.html#permission-matrix) và [bảng 13 nhóm sự kiện](index.html#event-matrix) là phần cấu trúc đọc từ review-data.json để tránh mỗi bản tổng quan mô tả khác nhau.

Sáu deliverable vẫn ở 01–06; tài liệu này là phụ lục review. Danh mục test đã tăng từ 61 lên 77 ca để phủ các thiếu sót mới; E19 là ca QA hồ sơ đã chạy, 76 ca còn lại là đặc tả sản phẩm. Không có test sản phẩm mới nào được viết/chạy trong giai đoạn thiết kế; validation của tài liệu không thay thế integration/E2E ứng dụng.

## Phần vẫn cần bằng chứng ngoài hồ sơ

- ClickUp phiên thật: chưa có Workspace/account xác định; các hành vi chưa xác minh như auto-reopen parent, cascade xóa/khôi phục và create-next giữ nhãn unknown. Không cần giả định chúng để triển khai chính sách riêng của ADIGO.
- ADIGO runtime: MongoDB cấu hình không nghe ở 127.0.0.1:27018; Docker engine chưa chạy. Không có inventory dữ liệu production, query explain hoặc E2E mới. Build đạt không chứng minh transaction và permission ở runtime đã đạt.
- Các giá trị 3 cấp, 500 hậu duệ/impact, 50 người và 50 bulk item là trần đề xuất để duyệt/đo, không phải hiệu năng đã kiểm chứng.
- Các lựa chọn Manual mặc định, primary/all, self-approval, employee delegation và zero-assignee là quyết định nghiệp vụ đang đề xuất. Không triển khai chúng như yêu cầu đã được duyệt.

## Điều kiện đóng giai đoạn hồ sơ

Đóng khi đủ sáu deliverable; mọi phần prompt có tham chiếu; các mâu thuẫn trên được sửa xuyên tài liệu; report có nội dung đầy đủ và bảng dễ đọc; trạng thái test thực tế được ghi chính xác. Coding/migration/release nằm ngoài việc đóng giai đoạn này và tiếp tục cần phê duyệt theo bước 7 ban đầu.

Lệnh tái tạo report: `node docs/task-subtask-design/render-report.mjs`. Lệnh kiểm không thay file: `node docs/task-subtask-design/render-report.mjs --check`. Các lệnh này chỉ xử lý tài liệu trong thư mục hồ sơ, không gọi API ứng dụng hoặc MongoDB.

## Kết quả xác minh cuối

- Renderer và `--check`: đạt kiểm cấu trúc 7 tài liệu, 28 field, 17 thao tác quyền, 13 nhóm event, 12 phần yêu cầu, ID/anchor/link nội bộ và 77 mã ca không trùng. Không dùng kiểm số lượng làm bằng chứng tính đúng nghiệp vụ; các quyết định đã được đối chiếu xuyên tài liệu ở phần trên.
- Chromium headless tại 1440×1000 và 390×1000: 7 nội dung đầy đủ hiện trong HTML; navigation tới kế hoạch, quay mục lục và keyboard Enter tới bảng quyền đạt; bảng quyền cuộn được trên mobile; không tràn ngang toàn trang, không có pageerror.
- Lỗi tràn ngang ban đầu do chuỗi kỹ thuật nối bằng dấu `/` trong nội dung đã sửa bằng wrap đúng vùng, không che nội dung bằng overflow hidden.
- Ảnh [desktop](review-desktop.png), [mobile](review-mobile.png) đã mở để kiểm trực quan; kết quả máy đọc trong [report-verification.json](report-verification.json). Đây là kiểm tra hồ sơ, không phải giao diện tính năng mới.
- TypeScript và production build của repo: đạt. Integration/E2E ứng dụng và dữ liệu DB thực tế: chưa xác minh vì hạ tầng MongoDB chưa chạy. Không có migration/code ứng dụng nào được áp dụng.

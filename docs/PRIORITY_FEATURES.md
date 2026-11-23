# Tính năng ưu tiên Organic Work — 20/11/2026

Phạm vi thực hiện theo `Organic_Work_Prompt_Tinh_Nang_Uu_Tien(1).md`. Giữ dialog tạo việc, Việc của tôi, Tiến độ, Kanban và trang chi tiết hiện có.

## Đối chiếu trước khi sửa

| Hạng mục | Trạng thái ban đầu | Bằng chứng trong repo |
| --- | --- | --- |
| Quyền tạo việc, người phụ trách theo phòng | Đã có | `src/lib/service.ts`: `createTask`, `assignment`; `workspace.tsx`: `CreateTask` |
| Giao cho tôi | Có một phần | Có trường người phụ trách, chưa có nút tự giao |
| Tiến độ, chỉ số, phân bổ và phân công tại dòng | Đã có | `work-query.ts`, `work-model.ts`, `work-views.tsx`, `tests/layout-progress.spec.ts` |
| Yêu cầu đã gửi, lý do chờ, giữ bộ lọc khi quay lại | Đã có | Phạm vi `sent`, `waitingReason`, `detailHref`, `safeReturnPath` |
| Yêu cầu đến | Có một phần | Có phạm vi `owned`, chưa có phạm vi riêng cho yêu cầu liên phòng đến |
| Tệp giao việc, tệp kết quả và tải riêng tư | Chưa có | Không có dịch vụ lưu tệp hoặc route tải tệp |
| Thông báo trong ứng dụng | Chưa có | Không có collection hoặc UI thông báo |
| Kết quả bàn giao, các lần hoàn thành | Chưa có | Có trạng thái/lịch sử, chưa có trường và dialog kết quả |
| Hành vi trên MongoDB/trình duyệt của phần cũ | Chưa xác minh ở đầu đợt | Được chạy kiểm tra lại trong đợt này |

## Đã bổ sung và tái sử dụng

- **Tự giao:** nút cạnh nhãn Người phụ trách; hiện tên `(Tôi)`; chỉ hiện cho tài khoản hoạt động cùng phòng nhận. Đổi phòng xóa người phụ trách, giữ tệp và các trường khác. Dùng nguyên kiểm tra quyền tạo việc/phân công trên server. Người tự giao không nhận thông báo từ chính mình.
- **Tệp:** chọn nhiều và kéo thả; tên/dung lượng/trạng thái/lỗi từng tệp; bỏ trước khi lưu; giữ form khi lỗi. Tệp tải qua GridFS, chỉ được hiển thị khi đã liên kết công việc trong transaction. Thử lại cùng `uploadKey` không tạo bản sao; tạo việc cùng `requestId` trả về công việc đã lưu.
- **Tải xuống:** `/api/files/:id` kiểm tra phiên, trạng thái tệp và quyền hiện tại với công việc mỗi lần đọc. Không có URL công khai. Ảnh/PDF có link Xem dùng trình xem sẵn của trình duyệt; Word/Excel tải xuống. Có hai nhóm tài liệu giao việc và bàn giao.
- **Tiến độ:** tái sử dụng các bộ đếm, phân bổ, truy vấn MongoDB theo quyền, phân công tại dòng, lý do chờ và loại bỏ việc lưu trữ mặc định. Thêm phạm vi `incoming`, nút Tất cả để thấy yêu cầu chưa quá hạn, và Xem tiến độ khi người quản lý chưa có việc cá nhân.
- **Thông báo:** chuông, số chưa đọc, danh sách 40 mục mới nhất, mở công việc, đọc từng mục/tất cả. Làm mới khi vào ứng dụng, dữ liệu làm mới hoặc mở chuông. Sự kiện: giao việc, đổi hạn, yêu cầu liên phòng mới, hoàn thành liên phòng. Gộp người nhận trùng, bỏ người thao tác; kiểm tra tài khoản hoạt động và quyền xem. Danh sách/số chưa đọc/đánh dấu đã đọc dùng người nhận từ phiên và quyền hiện tại.
- **Kết quả:** mọi thao tác hoàn thành liên phòng qua Chi tiết, Việc của tôi, Kanban đều mở cùng dialog; API bắt buộc kết quả khi chuyển từ chưa xong sang hoàn thành. Có liên kết http/https, tệp bàn giao, người hoàn thành và thời điểm. Nội bộ vẫn hoàn thành nhanh, hoặc dùng nút Bàn giao kết quả để ghi chú/tệp tùy chọn. Mở lại giữ các lần bàn giao; lần hoàn thành mới phải nhập kết quả mới. Việc cũ hoàn thành không có kết quả vẫn đọc được.

## Dữ liệu, index và triển khai

Chạy `npm run db:setup` trước khi dùng phiên bản mới. Đã chạy lệnh này trên database ứng dụng cấu hình trong `.env`; không chạy seed trên database ứng dụng.

| Collection/trường | Thay đổi |
| --- | --- |
| `attachments` | Metadata: tên, MIME xác minh, dung lượng, SHA-256, người tải, thời điểm, `uploadKey`, trạng thái, hạn tạm; khi liên kết có `taskId`, `purpose` |
| `fs.files`, `fs.chunks` | GridFS riêng tư; metadata GridFS cũng có `taskId`, `purpose` sau khi liên kết |
| `notifications` | `recipientId`, `taskId`, `eventId`, `types`, `createdAt`, `readAt`; không sao chép mô tả/tệp nhạy cảm vào thông báo |
| `task_operations` | Ghi nhận `actorId`, `requestId`, `taskId`, `eventId` để thử lại cập nhật an toàn |
| `tasks` | Thêm `requestId` khi tạo, `completedById`, `result`, `resultLinks`, `handovers[]`; không cần ghi lại dữ liệu cũ |

Index duy nhất: `(uploadedById, uploadKey)`, `(eventId, recipientId)`, `(actorId, requestId)`, `(createdById, requestId)` với partial filter cho bản ghi mới; GridFS `(files_id, n)`. Có index tra tệp theo task/trạng thái/hạn tạm, thông báo theo người nhận/thời điểm.

Ghi công việc, liên kết tệp, kết quả, lịch sử và thông báo trong cùng transaction MongoDB. GridFS upload nằm ngoài transaction và có trạng thái tạm; lỗi lưu không làm tệp tạm xuất hiện như tài liệu hoàn chỉnh. Rollback giữ tệp đã tải để thử lại.

`ATTACHMENT_MAX_FILES=5`, `ATTACHMENT_MAX_MB=20` là mặc định; cấu hình trong `.env` nếu cần đổi, sau đó khởi động lại app. UI lấy cùng giới hạn từ `/api/attachment-config`; backend kiểm tra số tệp, dung lượng, đuôi và chữ ký nội dung. Route nhận một tệp/request, kiểm tra Content-Length không vượt giới hạn tệp + 1 MB multipart. Nếu triển khai sau reverse proxy, đặt giới hạn body của proxy ít nhất bằng mức này.

Tệp tạm hết hạn sau 24 giờ. Bỏ tệp/hủy dialog sẽ yêu cầu dọn tệp đã staged; tệp đã linked không bị xóa. Dọn hết hạn theo lô khi mở bộ chọn/tải tệp mới; có `npm run files:cleanup` để chạy từ tác vụ nền của môi trường triển khai. Repo chưa có scheduler tin cậy nên không tự tạo lịch chạy nền.

## Kiểm chứng

- TypeScript và bộ kiểm thử tích hợp MongoDB: đạt.
- Toàn bộ 22 kiểm thử Playwright: đạt; có production build trước khi chạy. Production build độc lập bản cuối: đạt.
- `tests/priority-features.spec.ts`: kiểm tra tự giao kèm PDF, đổi phòng giữ tệp/xóa phân công, lỗi tải, mất phản hồi sau commit, gửi lặp, reload và không trùng việc/tệp; PDF/Excel liên phòng; quyền đọc tệp; thông báo/phân công/đổi hạn/đọc; bàn giao kèm tệp/liên kết; mở lại; mất quyền; rollback; dọn file tạm; mốc 00:00 giờ Việt Nam.
- Các test tiến độ và workflow được cập nhật cho quy tắc bắt buộc kết quả liên phòng và chạy lại.
- Ảnh kiểm tra: `priority-create-desktop.png`, `priority-create-mobile.png`, `priority-completion-mobile.png`, `priority-self-assigned-mobile.png`, `priority-handover-desktop.png` trong `docs/`.
- Không tích hợp nhắc hạn theo giờ, email/push, checklist, việc lặp lại, duyệt kết quả hoặc trạng thái nghiệm thu mới.
- Chưa xác minh trên reverse proxy/hosting thực tế và chưa thử mở Word/Excel bằng phần mềm Office cài tại máy người dùng. Test tạo tài liệu Excel hợp lệ và đối chiếu nội dung tải xuống; chức năng Xem ảnh/PDF dùng trình duyệt.

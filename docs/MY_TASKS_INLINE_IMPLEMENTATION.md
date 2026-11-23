# ADIGO — Inline Editable Task List

Ngày cập nhật: 23/11/2026.

## Thay đổi

- Thay CTA trạng thái bằng dropdown trong danh sách. Các lựa chọn lấy từ `taskStatusActions` và `statusNames`; không định nghĩa thêm workflow hoặc quyền tại component.
- Dropdown dùng `Workspace.change`: giữ validation phía API, dialog lý do chờ, bàn giao kết quả, khóa khi đang lưu, thông báo lỗi/thành công và refresh dữ liệu dùng chung với Task Detail.
- Menu không còn thao tác chuyển trạng thái. Các thao tác quản lý tiếp tục theo quyền hiện có.
- Sáu cột: tên, trạng thái, người được giao, hạn hoàn thành, ưu tiên và menu. Một header chung cho My Tasks, gồm cả khi chỉ có công việc cha theo dõi.
- Dòng desktop khoảng 52–53px; mobile chuyển sang bố cục thích ứng, giữ thông tin người được giao và ưu tiên. Menu dùng popover trên top layer; trạng thái dùng native select.
- Giữ nhóm deadline, tìm kiếm/lọc/sắp xếp, thu gọn nhóm và mở rộng Subtask thụt vào. Subtask có dropdown riêng và tải thêm theo trang.
- Không thêm Subtask vào form tạo Task mới. Không sửa database, API hoặc business logic trong lần refactor này.
- Hệ thống hiện có lưu trữ/khôi phục, chưa có API xóa Task. Giữ các thao tác hiện có thay vì bổ sung xóa dữ liệu.

## File cập nhật trong lần refactor này

- `src/components/task-row-menu.tsx`: dropdown dùng chung; bỏ status actions và CTA khỏi menu/danh sách.
- `src/components/task-list-row.tsx`: sáu cột, dropdown và người được giao.
- `src/components/work-views.tsx`: một header chung; dùng dropdown tại danh sách tiến độ.
- `src/components/task-hierarchy.tsx`: bỏ header lặp ở nhóm công việc cha.
- `src/app/my-tasks.css`: độ rộng cột, chiều cao dòng, màu dropdown và responsive.
- `tests/my-tasks-cta.spec.ts`: kiểm tra inline status, lý do chờ, mở lại, quyền, keyboard, responsive, Subtask và phân trang 25/27 mục.
- `tests/layout-progress.spec.ts`: cập nhật tương tác theo dropdown, giữ kiểm tra lỗi API và bàn giao liên phòng.

## Xác minh

- TypeScript: `npm run typecheck -- --incremental false` — đạt.
- Integration: `npm run test:integration` — đạt, database riêng `organic_work_inline_integration_test`.
- Playwright: `npm run test:e2e` — 39/39 đạt trong 2,7 phút, database riêng `organic_work_inline_verified_test`; production build đạt trước khi chạy.
- Ảnh kiểm tra trực quan: `my-tasks-inline-1440.png`, `my-tasks-inline-768.png`, `my-tasks-inline-390.png` trong thư mục này.

Các thay đổi có sẵn khác trong working tree không thuộc phạm vi báo cáo này.

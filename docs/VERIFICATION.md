# Kết quả kiểm chứng Organic Work

Báo cáo nghiệm thu v1. Bố cục Tổng quan và trang sau đăng nhập đã được nâng cấp tiếp theo [báo cáo bố cục và tiến độ](LAYOUT_PROGRESS.md); dùng báo cáo đó cho phiên bản hiện tại.

Ngày thực hiện: 19/11/2026 (Asia/Ho_Chi_Minh). Máy local macOS, Node.js 22.21.0, Docker 29.8.2, MongoDB 7.0 replica set một node, Playwright Chromium. Môi trường demo `organic_work_demo`, kiểm thử `organic_work_test`, bootstrap `organic_work_bootstrap_test`.

| Tiêu chí trong tài liệu | Kết quả thực tế |
| --- | --- |
| 1. Kinh doanh tạo yêu cầu → Vận hành phân công, chỉ chọn người đang hoạt động đúng phòng | Đạt qua Playwright và kiểm thử dịch vụ trên MongoDB thật |
| 2. Việc của tôi → Đang làm → bình luận → Hoàn thành; phòng yêu cầu xem cùng việc, tải lại, mở lại và tính quá hạn | Đạt qua Playwright; kiểm thử tích hợp xác nhận `completedAt` được tạo/xóa |
| 3. Chặn phòng khác; đồng nghiệp xem/bình luận nhưng không đổi trạng thái; trưởng phòng yêu cầu không phân công bên nhận | Đạt qua URL trực tiếp, gọi API từ các phiên riêng và kiểm thử tích hợp |
| 4. Số quá hạn khớp danh sách; lưu trữ loại khỏi số liệu; khôi phục giữ bình luận/lịch sử | Đạt qua Playwright, thêm kiểm tra khóa bình luận/chỉnh sửa khi đã lưu trữ |
| 5. Admin tạo phòng/tài khoản trên UI; tài khoản mới đăng nhập; tắt tài khoản thu hồi phiên | Đạt qua Playwright; đăng nhập lại bị từ chối |
| 6. Setup/seed hai lần; indexes, không nhân đôi/ghi đè; restart app/MongoDB giữ dữ liệu | Đạt qua integration, restart Docker thực tế, đối chiếu hash và smoke app production mới |
| 7. Lỗi ghi lịch sử trong transaction không làm thay đổi trạng thái/lịch sử | Đạt trên MongoDB thật với lỗi có kiểm soát `TEST_ACTIVITY_FAILURE` |
| Bảo vệ Admin đang hoạt động cuối cùng, chặn đổi phòng khi còn phân công đang mở | Đạt qua integration |
| Bootstrap database trống, chạy lại không ghi đè | Đạt, chạy hai lần trên database bootstrap riêng |
| Mobile: danh sách đủ thông tin, menu trạng thái lưu qua reload và đăng xuất | Đạt qua Playwright ở viewport 390×844 |
| Desktop: Kanban, Tổng quan; lọc phòng ban qua URL và reload; không tràn ngang trang | Đạt qua Playwright ở viewport 1440×1000; kiểm tra ảnh render |
| Cài từ lockfile | `npm ci --no-audit --no-fund` đạt |
| TypeScript | `npm run typecheck` đạt; production build cũng kiểm tra TypeScript |
| Build production | `npm run build` đạt, được chạy trước E2E |
| Bộ E2E cuối | 4/4 đạt trên bản production, 16.1 giây (gồm build/server); sau đó chụp lại riêng bài visual |

## Kiểm tra lưu dữ liệu qua restart

Đã chụp snapshot sau E2E: 10 phòng, 12 tài khoản, 18 công việc, 12 bình luận, 59 bản ghi hoạt động. Các bản ghi phụ ngoài seed được tạo bởi những lượt kiểm thử, chỉ tồn tại trong database test.

Sau `docker compose restart mongodb`, đối chiếu SHA-256 toàn bộ dữ liệu từng collection không thay đổi. Sau đó khởi động một app production mới ở cổng 3102 với database test; đăng nhập Admin, đối chiếu số bản ghi và đọc lại bình luận xác nhận đóng gói, bình luận đồng nghiệp, lịch sử trạng thái/lưu trữ của việc E2E. Tất cả đạt. Tiến trình smoke đã dừng.

Có thể chạy lại sau một lượt E2E, không ghi dữ liệu xen giữa snapshot và kiểm tra:

```sh
MONGODB_DB=organic_work_test node --env-file=.env --import tsx scripts/persistence.ts snapshot
docker compose restart mongodb
# Chờ MongoDB có primary; db:setup cũng đợi primary
MONGODB_DB=organic_work_test npm run db:setup
MONGODB_DB=organic_work_test node --env-file=.env --import tsx scripts/persistence.ts check
node --env-file=.env scripts/smoke-restart.mjs
```

Smoke dùng production build đã có. Snapshot `.persistence-check.json` không đưa vào Git. Server E2E 3101 và smoke 3102 tự dừng sau kiểm thử. MongoDB demo còn chạy, app dùng `npm run dev` tại http://localhost:3100.

## Các lỗi đã sửa trong quá trình kiểm thử

- Bộ lọc số liệu Tổng quan và ô phòng ban bị mất khi component khởi tạo lại sau điều hướng: chuyển bộ lọc vào URL và khôi phục khi tải trang.
- Refresh dữ liệu làm tháo form chi tiết khi lưu: giữ nội dung trong lúc lấy bản cập nhật, bỏ phản hồi đã lỗi thời khi đổi trang.
- Nhãn truy cập cho nút tạo việc và chọn phòng ban thiếu rõ ràng: thêm nhãn, kiểm tra bằng locator theo vai trò/nhãn.
- Mobile trước đó cần cuộn ngang để thấy hạn/trạng thái: chuyển hàng bảng thành danh sách thẻ, thêm menu đổi trạng thái và đăng xuất.
- Dev server gặp lỗi manifest JSON khi biên dịch nóng nhiều trang: E2E dùng build production cố định; lượt E2E cuối không có lỗi runtime này.

## Phạm vi chưa kiểm chứng

Chưa triển khai lên Atlas hoặc máy chủ HTTPS thật vì chưa có cụm/đích triển khai được cấp. Chưa chạy Safari/Firefox, kiểm thử tải hoặc kiểm toán bảo mật độc lập; phiên nghiệm thu dùng Chromium local. Đây là các giới hạn kiểm chứng triển khai, không phải dùng dữ liệu giả thay MongoDB. Không có test bắt buộc nào trong bảy kịch bản local còn bị chặn.

Chưa có realtime, kéo thả, email nhắc việc hoặc các module ngoài phạm vi v1. Dữ liệu của người khác được cập nhật khi tải lại trang.

# Sửa giật trắng khi chuyển tab

## Nguyên nhân

Trước thay đổi, `Workspace` được tạo bên trong catch-all `page.tsx`. Khi Next.js đổi page/segment, component này có thể bị tạo lại: `loading=true`, dữ liệu và trạng thái đăng nhập trở về ban đầu, `/api/data` chạy lại và toàn bộ ứng dụng bị thay bằng màn tải toàn trang. `loading.tsx` cũng dùng màn tải toàn trang.

Một số bộ lọc chỉ thay query nhưng gọi điều hướng RSC, tạo thêm công việc cho router/server. Dữ liệu danh sách và chi tiết chưa được giữ lại khi rời tab.

## Đã sửa

| Phần | Cách xử lý |
| --- | --- |
| Khung ứng dụng | Đặt `Workspace` trong root `layout.tsx`, giữ cùng sidebar/header và state giữa các route |
| Page | Chỉ giữ phần theo route, đặc biệt guard Admin phía server và nội dung quản trị; không khởi tạo lại toàn bộ Workspace |
| Loading | Màn tải toàn trang chỉ dùng lúc khởi động; chuyển route/API chờ ở vùng nội dung |
| Bootstrap | Không tải lại `/api/data` chỉ vì đổi tab; sau mutation mới tải lại và làm mới dữ liệu liên quan |
| Phiên | Kiểm tra nhẹ `/api/session` khi đổi path; API đọc/ghi vẫn xác thực và kiểm tra quyền độc lập |
| Dữ liệu danh sách/chi tiết | Cache trong bộ nhớ, tối đa 24 truy vấn, dùng lại dữ liệu mới trong 30 giây; luôn revalidate ở nền khi mở lại |
| Phân tách dữ liệu | Key cache có ID, vai trò và phòng ban; xóa cache khi đăng xuất/hết quyền và sau refresh dữ liệu. Không lưu task cache vào localStorage |
| Request cũ | Abort khi query/route/phiên thay đổi; phản hồi đã hủy không ghi đè dữ liệu hiện tại |
| Bộ lọc | Dùng History API của Next.js cho thay query trên cùng trang; URL/Back/Forward vẫn đồng bộ, không điều hướng RSC để đổi lọc |
| Bundle quản trị | Tách `AdminRoute`, tải `AdminConsole` theo nhu cầu; không import trực tiếp vào khung ứng dụng |

Mã chính: `src/app/layout.tsx`, `src/app/[[...page]]/page.tsx`, `src/app/loading.tsx`, `src/components/workspace.tsx`, `src/components/workspace-context.tsx`, `src/components/use-query-resource.ts`, `src/components/admin-route.tsx`, `src/components/work-views.tsx` và API phiên.

## Kiểm chứng

`npm run test:e2e` build production trước khi chạy. Lượt cuối **14/14 đạt**, 45,9 giây, gồm 12 bài hồi quy và hai bài mới trong `tests/navigation.spec.ts`.

- Làm chậm API công việc 900 ms; chuyển qua Tiến độ, Công việc phòng ban, Quản trị/Tài khoản, Phòng ban và về Việc của tôi.
- Xác nhận sidebar/header là cùng DOM node, không bị tháo; theo dõi DOM không thấy màn `main.loading` xuất hiện lại.
- Sau bootstrap đăng nhập, đếm **0 lần gọi `/api/data`** trong chuỗi chuyển tab không ghi dữ liệu.
- Mở lại Việc của tôi thấy kết quả cache trong thời hạn kiểm tra 500 ms, trong khi request revalidate bị làm chậm 900 ms.
- Đổi tìm kiếm/ưu tiên trong bảng: URL giữ đủ hai điều kiện, không có request `_rsc` hoặc điều hướng document mới.
- Vô hiệu hóa một tài khoản thử nghiệm từ phiên Admin; khi phiên nhân viên chuyển tab, trở về đăng nhập và API phiên trả 401.
- Hồi quy CRUD, focus/bàn phím, nhóm hạn, bộ đếm, lý do chờ, quyền, lưu trữ và màn hình 390/1440 px đều đạt.

`npm run typecheck` đạt trong quá trình thực hiện; production build cuối cũng kiểm tra TypeScript. Đây là kiểm chứng phần điều hướng và các luồng đã nêu, không phải điểm Lighthouse hoặc cam kết tốc độ cho mọi môi trường mạng.

## Chạy để so sánh

```sh
npm run dev
# Hoặc dừng dev server trước rồi chạy bản production:
npm run build
npm start
```

URL local: http://localhost:3100. Khởi động lại server đang chạy để nhận cấu trúc layout mới. Dev có thể mất thêm thời gian biên dịch ở lần mở route đầu; kiểm thử độ ổn định phía trên chạy trên production. Lần tải đầu hoặc khi phải đăng nhập lại vẫn có trạng thái tải/xác thực phù hợp.

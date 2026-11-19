# Prompt build Organic Work

Bạn là kỹ sư full-stack chịu trách nhiệm build và chạy thử **Organic Work**, ứng dụng web nội bộ quản lý công việc cho các phòng ban của Tập đoàn Organic Việt Nam. Hãy triển khai trực tiếp trong workspace. Đọc cấu trúc repo và hướng dẫn dự án trước khi sửa. Nếu repo trống, hãy khởi tạo ứng dụng. Dùng luồng Kanban kiểu Trello làm tham khảo cho cách tổ chức việc, với giao diện và nhận diện riêng của Organic Work.

## 1. Kết quả cần bàn giao

Người dùng đăng nhập, mở bảng phòng ban, tạo hoặc nhận việc, cập nhật tiến độ, bình luận và xem việc quá hạn. Trưởng bộ phận có thể giao việc nội bộ và gửi yêu cầu sang phòng khác. Phòng nhận có thể phân công nhân sự và xử lý trên cùng một công việc. Dữ liệu được lưu trong MongoDB và giữ nguyên qua lần tải lại trang hoặc khởi động lại ứng dụng và cơ sở dữ liệu.

Phạm vi v1 gồm **Tổng quan**, **Việc của tôi**, **Công việc phòng ban**, **Chi tiết công việc** và **Quản trị**. Đây là công cụ quản lý đầu việc nội bộ. Để marketplace ADIGO, tích hợp ERP, quản lý kho, KPI, chấm công và nhắc việc qua email ngoài phạm vi v1.

## 2. Công nghệ và cách chạy với MongoDB

- **MongoDB là cơ sở dữ liệu của ứng dụng** ở các môi trường dev, demo, kiểm thử và triển khai. Với repo trống, dùng Next.js App Router, TypeScript, Tailwind CSS và driver MongoDB chính thức cho Node.js (`mongodb`). Nếu đã có ứng dụng, tận dụng stack hiện có và kết nối lớp truy cập dữ liệu với MongoDB.
- Tạo `docker-compose.yml` để chạy MongoDB local dưới dạng replica set một node, có named volume và bước khởi tạo replica set chạy lặp an toàn. Khi app chạy trên máy host, chỉ mở cổng MongoDB trên loopback. Script setup đợi replica set có primary trước khi thiết lập dữ liệu. Khi triển khai, dùng MongoDB Atlas hoặc cụm MongoDB có hỗ trợ transaction.
- Cung cấp `.env.example` với `MONGODB_URI`, `MONGODB_DB`, cấu hình phiên đăng nhập và các biến mật khẩu bootstrap/demo. Ghi URI local khớp Docker Compose và hướng dẫn thay bằng URI Atlas. Giữ thông tin kết nối ở server, tái sử dụng `MongoClient` theo tiến trình và chạy lớp dữ liệu trên Node.js runtime.
- Dùng đăng nhập email/mật khẩu có phiên phía máy chủ hoặc cookie ký an toàn. Băm mật khẩu và kiểm tra tài khoản còn hoạt động ở mỗi yêu cầu. Có lệnh bootstrap Admin đầu tiên cho database trống. Admin tạo tài khoản và gán quyền trong ứng dụng. Chỉ seed tài khoản mẫu trên database demo/test.
- Nối mọi thao tác giao diện với backend và MongoDB. API hoặc server actions xác thực dữ liệu, phiên đăng nhập và quyền theo bản ghi. Từ chối ID sai định dạng và trả lỗi rõ ràng khi lưu thất bại.
- Bàn giao README, lockfile và lệnh chạy local theo thứ tự `npm ci`, `docker compose up -d`, `npm run db:setup`, `npm run db:bootstrap-admin`, `npm run dev`. Có lệnh `npm run db:seed` riêng để chuẩn bị demo, cùng `npm run test:e2e` và `npm run build`. `db:setup` tạo collections và indexes theo cách chạy lại an toàn. Bootstrap và seed dùng khóa ổn định để tránh bản ghi trùng và tránh ghi đè mật khẩu hoặc công việc đã cập nhật.

## 3. Luồng nghiệp vụ

### Tạo việc và phân công

- Mỗi việc có tiêu đề, mô tả, phòng yêu cầu, phòng phụ trách, người tạo, một người phụ trách có thể để trống, ngày đến hạn, ưu tiên và trạng thái. Tiêu đề, phòng phụ trách và ngày đến hạn là bắt buộc. Trạng thái mặc định là **Cần làm**, ưu tiên mặc định là **Bình thường**. Các mức ưu tiên gồm **Thấp**, **Bình thường**, **Cao** và **Khẩn**.
- Trưởng bộ phận tạo việc cho phòng mình hoặc gửi việc sang phòng khác. Với việc liên phòng, phòng yêu cầu là phòng của người tạo, phòng phụ trách là phòng nhận và người phụ trách ban đầu để trống. Trưởng phòng nhận hoặc Admin chọn người phụ trách trong danh sách tài khoản đang hoạt động của phòng nhận. Với việc nội bộ, trưởng phòng có thể gán người ngay khi tạo.
- Ví dụ demo: trưởng phòng **Kinh doanh** gửi việc **Xác nhận lịch đóng gói lô gà Kỳ Anh** sang **Vận hành**. Trưởng phòng Vận hành gán việc cho một nhân viên. Nhân viên cập nhật trạng thái và bình luận xác nhận giờ đóng gói. Trưởng phòng Kinh doanh mở lại đúng công việc đó để theo dõi kết quả.

### Cập nhật và lưu vết

- Bốn cột Kanban cố định gồm **Cần làm**, **Đang làm**, **Đang chờ** và **Hoàn thành**. Cho phép chuyển qua lại giữa các trạng thái bằng menu trên thẻ và ở trang chi tiết. Kéo thả có thể bổ sung sau khi menu đã hoạt động và kiểm thử qua. Nếu triển khai kéo thả, dùng chung logic cập nhật trạng thái và hoàn tác giao diện khi lưu lỗi.
- Người có quyền xem việc có thể bình luận văn bản. Trang chi tiết hiển thị lịch sử tạo việc, giao hoặc đổi người phụ trách, đổi trạng thái và sửa ngày hạn, kèm người thực hiện và thời điểm. Dùng cùng một MongoDB session và `withTransaction()` để ghi thay đổi công việc cùng lịch sử. Nếu một thao tác ghi thất bại, hủy toàn bộ giao dịch.
- Việc hoàn thành ghi `completedAt`. Mở lại việc sẽ xóa giá trị này. Việc quá hạn là việc chưa hoàn thành có ngày đến hạn trước ngày hiện tại theo múi giờ `Asia/Ho_Chi_Minh`. Lưu ngày hạn theo dạng ngày lịch `YYYY-MM-DD` và dùng chung quy tắc tính hạn ở các màn hình.
- Admin hoặc trưởng phòng phụ trách có thể lưu trữ và khôi phục việc. Việc lưu trữ có bộ lọc riêng và được loại khỏi bảng, danh sách đang hoạt động và số liệu tổng quan mặc định. Giữ lại bình luận và lịch sử của việc. Việc đã lưu trữ chỉ cho phép xem và khôi phục theo quyền.

## 4. Quyền theo vai trò

Mỗi tài khoản thuộc một phòng ban và có một vai trò trong v1. Công việc có một phòng phụ trách. Các phòng ban trong dữ liệu demo có thể đổi tên trong trang quản trị.

| Vai trò | Quyền |
| --- | --- |
| Admin | Xem và quản lý mọi việc. Tạo, sửa, bật/tắt tài khoản và quản lý danh mục phòng ban. Tài khoản bị tắt mất quyền truy cập ở yêu cầu kế tiếp. Bảo vệ Admin đang hoạt động cuối cùng khỏi thao tác vô hiệu hóa hoặc hạ quyền. |
| Trưởng bộ phận | Tạo việc nội bộ hoặc gửi yêu cầu từ phòng mình. Xem và bình luận trên việc do phòng mình phụ trách hoặc yêu cầu. Sửa tiêu đề, mô tả, hạn, ưu tiên, phân công, chuyển trạng thái và lưu trữ khi phòng mình phụ trách. |
| Nhân viên | Xem và bình luận trên việc phòng mình phụ trách. Chuyển trạng thái khi là người được giao việc. |

Áp dụng cùng phạm vi quyền cho Kanban, danh sách, tìm kiếm, bộ đếm, chi tiết, bình luận và lịch sử. Kiểm tra quyền phía máy chủ kể cả khi người dùng mở URL chi tiết trực tiếp hoặc gửi yêu cầu sửa với ID tự nhập. Khi Admin đổi phòng của người đang được giao việc, yêu cầu xử lý các phân công đang mở trước để người phụ trách luôn thuộc phòng xử lý.

## 5. Màn hình

- **Đăng nhập.** Email, mật khẩu, thông báo lỗi và đăng xuất. Sau khi đăng nhập, đưa người dùng về Tổng quan.
- **Tổng quan.** Hiển thị số việc cần làm, đang làm, đang chờ, hoàn thành và quá hạn theo phạm vi nhìn thấy. Bấm vào số liệu để mở danh sách tương ứng với bộ lọc đã áp dụng.
- **Việc của tôi.** Danh sách việc được giao cho tài khoản hiện tại, sắp xếp việc quá hạn trước rồi theo hạn gần nhất. Có bộ lọc trạng thái, ưu tiên và quá hạn.
- **Công việc phòng ban.** Mặc định hiển thị Kanban. Có chế độ danh sách dùng chung bộ lọc theo phòng phụ trách, người nhận việc, trạng thái, ưu tiên và quá hạn. Tìm theo tiêu đề. Thẻ hiển thị tiêu đề, người phụ trách hoặc **Chưa phân công**, ưu tiên, hạn và nhãn quá hạn. Nút **Tạo công việc** hiển thị theo quyền.
- **Chi tiết công việc.** Có URL riêng. Hiển thị hai phòng ban, người tạo, người phụ trách, trạng thái, ưu tiên, hạn, mô tả, bình luận và lịch sử. Các nút chỉnh sửa hiển thị theo quyền tương ứng.
- **Quản trị.** Admin tạo và đổi tên phòng ban, tạo và sửa tài khoản, gán phòng ban và vai trò, bật hoặc tắt tài khoản. Giữ ID phòng ban ổn định để việc cũ vẫn tham chiếu đúng.

Giao diện tiếng Việt, nền sáng, xanh đậm làm màu chủ đạo. Dùng nhãn chữ cùng màu để thể hiện trạng thái và quá hạn. Trên điện thoại, ưu tiên chế độ danh sách và menu đổi trạng thái. Các trang phải có hiển thị đang tải, dữ liệu trống và lỗi truy cập hoặc lỗi lưu. Các bộ lọc và điều hướng phải thao tác được bằng bàn phím.

## 6. Dữ liệu và nghiệm thu

| Collection | Dữ liệu chính |
| --- | --- |
| `departments` | `_id`, tên, mã phòng ổn định, thời điểm tạo. |
| `users` | `_id`, email chuẩn hóa, tên, mật khẩu đã băm, vai trò, `departmentId`, trạng thái hoạt động. |
| `tasks` | `_id`, tiêu đề, mô tả, `requestingDepartmentId`, `owningDepartmentId`, `createdById`, `assigneeId`, `dueDate`, ưu tiên, trạng thái, `archivedAt`, `completedAt`, thời điểm tạo và cập nhật. |
| `task_comments` | `_id`, `taskId`, `authorId`, nội dung, thời điểm tạo. |
| `task_activities` | `_id`, `taskId`, `actorId`, loại thao tác, giá trị trước và sau nếu có, thời điểm tạo. |

Dùng `ObjectId` cho ID và các tham chiếu trong MongoDB, chuyển thành chuỗi khi trả về qua API. Backend kiểm tra đối tượng được tham chiếu tồn tại và người được giao đang hoạt động, thuộc phòng xử lý khi phân công. Dùng BSON Date cho thời điểm tạo, cập nhật, hoàn thành và lưu trữ. Giữ `dueDate` là ngày lịch theo mục 3. Nếu lưu phiên ở MongoDB, tạo collection phiên phù hợp với cơ chế đăng nhập.

Tạo unique index cho email đã chuẩn hóa và mã phòng. Tạo index cho các truy vấn công việc theo phòng phụ trách, phòng yêu cầu, người được giao, trạng thái, ngày hạn và tình trạng lưu trữ. Đánh index theo `taskId` và thời điểm tạo cho bình luận và lịch sử.

Seed bốn phòng mẫu **Kinh doanh, Vận hành, Chất lượng, Kho vận**, một Admin demo, trưởng phòng Kinh doanh, trưởng phòng Vận hành và nhân viên ở ít nhất hai phòng. Tạo việc mẫu đủ bốn trạng thái, có việc quá hạn, việc chưa phân công và việc liên phòng ban. Tính ngày hạn mẫu tương đối với ngày chạy seed.

Dùng Playwright hoặc công cụ E2E có sẵn để chạy các kịch bản sau:

1. Trưởng phòng Kinh doanh đăng nhập và tạo yêu cầu đóng gói sang Vận hành. Trưởng phòng Vận hành thấy yêu cầu và gán cho nhân viên Vận hành. Bộ chọn chỉ hiển thị tài khoản đang hoạt động thuộc phòng nhận.
2. Nhân viên được giao thấy việc trong **Việc của tôi**, chuyển sang **Đang làm**, bình luận rồi chuyển **Hoàn thành**. Trưởng phòng Kinh doanh thấy kết quả và lịch sử trên cùng công việc. Tải lại trang, xác nhận dữ liệu vẫn còn. Mở lại việc và kiểm tra phép tính quá hạn.
3. Nhân viên phòng khác bị từ chối khi mở URL chi tiết hoặc gọi thao tác sửa việc bằng ID. Nhân viên cùng phòng nhưng chưa được giao có thể xem và bình luận, còn thao tác đổi trạng thái bị từ chối. Trưởng phòng yêu cầu xem được việc liên phòng và bị từ chối khi thử đổi người phụ trách của phòng nhận.
4. Từ Tổng quan, bấm số việc quá hạn và đối chiếu danh sách sau khi lọc. Lưu trữ một việc, xác nhận việc biến mất khỏi danh sách mặc định và số liệu cập nhật. Khôi phục và xác nhận bình luận, lịch sử còn đủ.
5. Admin tạo phòng và tài khoản qua giao diện. Tài khoản mới đăng nhập được với quyền đã gán. Sau khi Admin tắt tài khoản, phiên cũ mất quyền và đăng nhập lại bị từ chối.

6. Chạy `db:setup` và `db:seed` hai lần trên database kiểm thử. Kiểm tra indexes và xác nhận dữ liệu mẫu không bị nhân đôi hoặc ghi đè. Khởi động lại app và container MongoDB, kiểm tra công việc, bình luận và lịch sử vẫn tồn tại.
7. Kiểm thử tích hợp trên MongoDB thật. Tạo lỗi có kiểm soát ở bước ghi lịch sử trong transaction đổi trạng thái, sau đó xác nhận cả trạng thái và lịch sử đều giữ nguyên.

## 7. Thứ tự triển khai

Triển khai theo các luồng chạy được từ giao diện đến cơ sở dữ liệu: đăng nhập và seed → giao việc và phân quyền → Kanban và chi tiết → bộ lọc, tổng quan và quản trị → kiểm thử E2E. Tự khởi động MongoDB demo hoặc dùng cụm demo được cấp, chạy setup và seed, khởi động app, thực hiện các kịch bản, sửa lỗi và chạy lại build production. Chạy E2E trên database riêng, với tên database khác môi trường triển khai. Tiếp tục sau phần lập kế hoạch để bàn giao mã nguồn hoạt động.

Báo cáo cuối cùng gồm URL chạy thử hoặc URL local, lệnh khởi động, danh sách tài khoản demo và cách đặt mật khẩu, các kịch bản đã chạy cùng kết quả, và những kiểm thử còn vướng với lý do cụ thể. Chỉ đánh dấu đạt cho thao tác đã kiểm chứng.

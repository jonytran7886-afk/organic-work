# Prompt nâng cấp giao diện và theo dõi tiến độ Organic Work

Bạn là kỹ sư full-stack phụ trách nâng cấp **Organic Work**, ứng dụng quản lý công việc nội bộ của Tập đoàn Organic Việt Nam. Hãy sửa trực tiếp repo hiện có và chạy thử bằng dữ liệu MongoDB. Hai kết quả chính là **đăng nhập xong thấy ngay việc mình cần xử lý** và **trưởng bộ phận biết đội đang làm đến đâu, đang vướng gì và cần phân công việc nào**.

## 1. Đọc repo và chọn phần cần nâng cấp

Kiểm tra cấu trúc dự án, route sau đăng nhập, các màn hình hiện có, component dùng chung, quyền, truy vấn MongoDB, seed và test. Lập bảng ngắn gồm **Hạng mục**, **Đã có / Cần chỉnh / Chưa có** và **Tệp hoặc route sẽ sửa**. Sau đó tiếp tục triển khai ngay. Tái sử dụng tính năng, API và component đang chạy được. Nếu repo trống, dùng đặc tả Organic Work nền cùng prompt này, lấy yêu cầu dưới đây làm chuẩn cho bố cục sau đăng nhập.

Tham khảo cách tổ chức **My Tasks** của Asana và cách Trello tổng hợp việc theo trạng thái, hạn và thành viên. Thiết kế giao diện riêng cho Organic Work, dùng tiếng Việt và ưu tiên danh sách có thể thao tác.

- [Asana – My Tasks và cách nhóm công việc](https://help.asana.com/s/article/maximize-productivity-with-my-tasks?language=en_US)
- [Asana – Theo dõi và lọc tiến độ công việc](https://help.asana.com/s/article/tracking-project-progress)
- [Trello – Dashboard View](https://support.atlassian.com/trello/docs/dashboard-view)

## 2. Bố cục và điều hướng sau đăng nhập

Đưa mọi vai trò về **Việc của tôi** sau khi đăng nhập từ trang đăng nhập thông thường. Nếu người dùng xuất phát từ link chi tiết, mở lại đúng link sau khi xác thực và kiểm tra quyền. Trưởng bộ phận và Admin thấy **Tiến độ** ở vị trí kế ngay **Việc của tôi**, truy cập trong một lần bấm.

| Vai trò | Mục điều hướng | Phạm vi ở Tiến độ |
| --- | --- | --- |
| Nhân viên | Việc của tôi, Công việc phòng ban | Truy cập công việc theo quyền nhân viên. |
| Trưởng bộ phận | Việc của tôi, Tiến độ, Công việc phòng ban | Mặc định **Phòng tôi phụ trách**, có tab **Yêu cầu đã gửi**. |
| Admin | Việc của tôi, Tiến độ, Công việc phòng ban, Quản trị | Mặc định **Tất cả phòng ban**, có bộ lọc theo phòng phụ trách. |

Nếu repo đã có **Tổng quan**, nâng cấp màn này thành **Tiến độ** và xử lý route cũ tương thích với quyền của người dùng. Trên desktop, dùng sidebar hoặc thanh điều hướng hiện có, tiêu đề trang rõ ràng và nút **Tạo công việc** chỉ hiện cho vai trò được phép. Trên mobile, giữ đường vào **Việc của tôi** và **Tiến độ** rõ ràng, dùng thẻ danh sách và menu thao tác theo việc. Sử dụng nền sáng, xanh đậm của Organic làm màu chủ đạo, trạng thái có nhãn chữ. Kiểm tra trên màn hình rộng 390 px và 1440 px.

## 3. Việc của tôi

- Mặc định hiển thị việc **chưa hoàn thành, chưa lưu trữ và đang giao cho tài khoản đăng nhập**. Đưa danh sách và công việc đầu tiên lên ngay vùng nhìn thấy khi mở màn hình. Hiện bộ đếm nhỏ **Quá hạn**, **Hôm nay**, **Đang chờ** và cho phép bấm để lọc danh sách tương ứng.
- Nhóm mỗi việc đang mở đúng một lần theo thứ tự **Quá hạn → Đến hạn hôm nay → 7 ngày tới → Sau đó → Chưa có hạn**. Nhóm cuối chỉ xuất hiện khi có dữ liệu cũ thiếu hạn. **7 ngày tới** tính từ ngày mai đến hết ngày thứ bảy sau hôm nay. Sắp xếp trong từng nhóm theo hạn tăng dần, sau đó ưu tiên cao trước. Có chế độ riêng để tra cứu việc **Đã hoàn thành**.
- Mỗi dòng hiện tiêu đề, trạng thái, hạn, ưu tiên và lý do chờ nếu có. Bấm tiêu đề để mở chi tiết. Có thao tác nhanh **Bắt đầu**, **Chuyển sang Đang chờ** hoặc **Hoàn thành** theo trạng thái và quyền, dùng cùng logic lưu MongoDB như trang chi tiết. Sau khi lưu thành công, cập nhật danh sách và bộ đếm. Nếu lưu lỗi, giữ trạng thái cũ và hiển thị lỗi.
- Có tìm kiếm theo tiêu đề, lọc trạng thái và ưu tiên, nút **Xóa bộ lọc**, cùng trạng thái trống phù hợp. Ví dụ người chưa được phân công thấy **Bạn chưa có công việc được giao**. Khi bộ lọc không khớp, hiển thị **Không tìm thấy công việc phù hợp** và cho xóa bộ lọc.

## 4. Tiến độ cho trưởng bộ phận và Admin

Giữ bố cục từ trên xuống gồm **phạm vi và bộ lọc → số liệu có thể bấm → việc cần xử lý → phân bổ theo người hoặc phòng**.

### Phạm vi và số liệu

- **Phòng tôi phụ trách** chỉ tổng hợp việc có phòng phụ trách là phòng của trưởng bộ phận. **Yêu cầu đã gửi** chỉ hiện việc do phòng mình gửi sang phòng khác, hiển thị phòng nhận, người xử lý, hạn và kết quả trên cùng một công việc. Nút phân công và thao tác chỉnh sửa tuân theo quyền của phòng xử lý.
- Admin xem theo toàn công ty hoặc chọn phòng phụ trách. Cho lọc theo người phụ trách nếu vai trò và phạm vi cho phép. Áp dụng cùng bộ lọc cho số liệu và danh sách hiển thị.
- Hiện **Cần làm**, **Đang làm**, **Đang chờ**, **Hoàn thành**, **Quá hạn** và **Chưa phân công**. Bốn mục đầu là trạng thái. Hai mục cuối chỉ tính việc đang mở, có thể giao nhau và có thể nằm trong một trạng thái ở trên. Việc lưu trữ được loại khỏi toàn bộ số liệu mặc định. Mốc **Hoàn thành** đếm việc đang ở trạng thái hoàn thành trong phạm vi, không áp dụng khoảng thời gian ngầm.
- Bấm bất kỳ số liệu nào phải mở đúng tập công việc cấu thành con số. Giữ phạm vi và bộ lọc trên URL để tải lại, quay lại từ chi tiết hoặc chia sẻ đường dẫn trong phạm vi quyền. Khi bảng có phân trang, bộ đếm hiển thị tổng số kết quả của bộ lọc.

### Việc cần xử lý và phân bổ

- Tạo danh sách **Cần xử lý** với ba bộ lọc nhanh **Quá hạn**, **Đang chờ**, **Chưa phân công**. Mỗi dòng hiện tiêu đề, người xử lý hoặc **Chưa phân công**, phòng phụ trách, hạn, trạng thái và lý do chờ nếu có. Trưởng phòng phụ trách và Admin có thao tác **Phân công** ngay tại dòng chưa có người, lấy từ danh sách tài khoản đang hoạt động của phòng nhận.
- Trong **Phòng tôi phụ trách**, bảng **Theo người phụ trách** hiển thị số việc đang mở, quá hạn và đang chờ của từng người. Bấm vào tên hoặc số liệu để mở danh sách tương ứng. Với Admin xem toàn công ty, nhóm mặc định theo phòng phụ trách rồi cho mở bảng theo người khi chọn phòng. Gọi đây là số việc theo người, vì dữ liệu hiện tại đo được số lượng việc.
- Trong **Yêu cầu đã gửi**, dùng bảng theo phòng nhận để trưởng phòng biết yêu cầu đang nằm ở đâu. Bấm vào hàng để mở danh sách yêu cầu của phòng nhận hoặc mở trực tiếp chi tiết một việc.
- Nếu có Kanban, giữ bảng này trong **Công việc phòng ban**, cùng chế độ danh sách và bộ lọc hiện có. Khi chuyển chế độ xem hoặc quay lại từ trang chi tiết, giữ các bộ lọc còn áp dụng được.

## 5. Bổ sung khi chưa có lý do chờ

Kiểm tra xem ứng dụng đã có trường lý do chờ, vướng mắc hoặc trường tương đương chưa. Nếu đã có, dùng lại. Nếu chưa có, bổ sung trường tùy chọn `waitingReason` trên document công việc và xử lý cả bản ghi cũ thiếu trường này.

- Khi chuyển mới sang **Đang chờ**, yêu cầu nhập lý do ngắn và hiển thị lý do tại **Việc của tôi**, **Tiến độ** và **Chi tiết**. Với công việc cũ đang chờ mà chưa có lý do, hiển thị **Chưa ghi lý do** và cho người có quyền bổ sung.
- Khi ra khỏi **Đang chờ**, xóa lý do chờ hiện tại khỏi chế độ xem và giữ lý do cũ trong lịch sử. Lưu lý do cùng trạng thái và lịch sử bằng transaction hiện có. Chỉ người có quyền cập nhật công việc được thay đổi lý do.
- Ưu tiên hoàn thành các mục về Việc của tôi, Tiến độ, phân công và lý do chờ trong lượt triển khai này. Ghi vào báo cáo nếu phát hiện cơ hội nâng cấp như thông báo trong ứng dụng khi được giao việc hoặc lịch hạn, kèm tính năng tương đương đã có trong repo nếu tìm thấy.

## 6. Dữ liệu, quyền và hành vi giao diện

- Giữ MongoDB là nguồn dữ liệu. Dùng chung quy tắc trạng thái và hạn giữa bộ đếm, danh sách, Kanban và chi tiết. Tính ngày lịch bằng múi giờ `Asia/Ho_Chi_Minh`. Việc quá hạn có hạn trước hôm nay, đang mở và chưa lưu trữ. Việc cũ thiếu hạn vẫn xem được và không tính quá hạn.
- Phạm vi quyền phải được kiểm tra ở backend trước khi đếm, nhóm, tìm kiếm, truy vấn chi tiết hoặc ghi dữ liệu. Trưởng phòng xem việc do phòng mình phụ trách hoặc yêu cầu theo từng tab. Nhân viên chỉ thấy công việc theo quyền hiện có. Admin truy cập phạm vi được cấp. Thay tham số phòng, người hoặc trạng thái trên URL không được mở rộng quyền truy cập.
- Sau khi đổi trạng thái, phân công hoặc lưu trữ thành công, cập nhật mọi danh sách và số liệu liên quan qua cơ chế làm mới của dự án. Lưu và khôi phục bộ lọc qua URL. Hỗ trợ bàn phím, nút có nhãn, trạng thái đang tải, lỗi có thể thử lại và giao diện gọn trên điện thoại.

## 7. Nghiệm thu và bàn giao

Tận dụng tài khoản demo và test hiện có. Seed thêm tình huống còn thiếu trên database demo/test. Tự khởi động app, chạy kiểm thử với MongoDB và kiểm tra tối thiểu các ca sau:

1. Nhân viên đăng nhập và thấy ngay việc được giao. Dữ liệu mẫu có việc hôm qua, hôm nay, ngày mai, đúng mốc 7 ngày, ngày thứ 8 và việc cũ chưa có hạn. Xác nhận mỗi việc vào đúng nhóm, việc của người khác không xuất hiện, việc đã hoàn thành xem được trong chế độ riêng.
2. Trưởng phòng thấy việc cá nhân khi đăng nhập, mở **Tiến độ** bằng một lần bấm, mở danh sách quá hạn từ bộ đếm và đối chiếu số kết quả. Từ danh sách mở chi tiết rồi quay lại, phạm vi và bộ lọc vẫn đúng.
3. Trưởng phòng Vận hành nhận yêu cầu **Xác nhận lịch đóng gói lô gà Kỳ Anh** từ Kinh doanh và phân công ngay từ danh sách chưa phân công. Nhân viên Vận hành thấy việc trên trang đầu. Trưởng phòng Kinh doanh thấy tiến độ trong **Yêu cầu đã gửi** và không có quyền phân công việc của Vận hành.
4. Nhân viên chuyển việc sang **Đang chờ** và nhập lý do. Quản lý thấy lý do trong Tiến độ. Sau khi hoàn thành, kiểm tra số liệu thay đổi, lý do còn trong lịch sử và dữ liệu đúng sau khi tải lại.
5. Nhân viên thử mở URL Tiến độ và gọi truy vấn thống kê trực tiếp. Trưởng phòng thử đổi tham số sang phòng ngoài phạm vi. Xác nhận backend từ chối phạm vi không hợp lệ hoặc chỉ trả kết quả được cấp quyền, kể cả bộ đếm.
6. Kiểm tra ở 390 px và 1440 px. Xác nhận đọc được tiêu đề, hạn, trạng thái và thao tác được bằng bàn phím. Chạy lại test hiện có và build production.

Bàn giao mã nguồn đã sửa, URL chạy thử nếu có, tài khoản demo, bảng tính năng đã có và đã bổ sung, cùng kết quả kiểm thử thực tế. Ghi rõ bước nào chưa chạy được và nguyên nhân.

# Prompt tổ chức thanh bên Quản trị và dialog CRUD cho Organic Work

Hãy chỉnh trực tiếp giao diện **Quản trị** của Organic Work trong repo hiện có. Ảnh mới cho thấy **Tài khoản** và **Phòng ban** đã tách thành hai trang nhưng vẫn được đặt ở thanh tab phía trên nội dung. Chuyển cả hai lên **thanh điều hướng bên trái**, xếp vào nhóm **Quản trị** bên dưới nhóm **Công việc**. Dựa trên route và quyền hiện có, triển khai rồi chạy thử.

## 1. Cấu trúc thanh điều hướng bên trái

| Nhóm | Thứ tự mục | Ai thấy |
| --- | --- | --- |
| **Công việc** | Việc của tôi → Công việc phòng ban → Tiến độ | Mỗi vai trò thấy những mục hiện có trong phạm vi quyền. |
| **Quản trị** | Tài khoản → Phòng ban | Chỉ Admin thấy nhóm này. |

- Dùng **Công việc** và **Quản trị** làm tiêu đề nhóm, với khoảng cách rõ ràng giữa hai nhóm. Hiển thị trực tiếp các mục con để Admin vào Tài khoản hoặc Phòng ban bằng một lần bấm. Mỗi mục là link đến trang riêng. Bỏ mục **Quản trị** dạng nút điều hướng đơn hiện tại để tránh trùng với tiêu đề nhóm.
- Dùng route hiện tại của từng trang, ví dụ `/admin/users` và `/admin/departments`. Đường dẫn gốc Quản trị đưa Admin đến **Tài khoản**. Nếu phiên bản cũ có URL chỉ định tab, chuyển URL đó đến trang tương ứng để các link đã lưu vẫn mở đúng.
- Đánh dấu mục đang mở theo route và dùng `aria-current="page"`. Breadcrumb thể hiện **Quản trị → Tài khoản** hoặc **Quản trị → Phòng ban**. Bỏ thanh tab trong nội dung và khoảng trống do thanh tab để lại. Phần nội dung bắt đầu bằng tiêu đề trang và nút thêm, tiếp theo là bộ lọc và danh sách.
- Tái sử dụng sidebar hiện có cho desktop. Trên mobile, dùng drawer điều hướng với cùng hai nhóm và đóng sau khi chọn mục. Giữ quyền truy cập ở server cho cả trang và thao tác ghi.

## 2. Nội dung từng trang

| Trang | Thành phần chính | Thao tác |
| --- | --- | --- |
| **Tài khoản** | Tiêu đề, nút **+ Thêm tài khoản**, tìm theo tên hoặc email, lọc theo phòng ban, vai trò và trạng thái. Bảng hiện họ tên, email, phòng ban, vai trò, trạng thái và thao tác. | **Xem chi tiết**, **Chỉnh sửa**, **Vô hiệu hóa** hoặc **Kích hoạt lại** từ menu từng dòng. |
| **Phòng ban** | Tiêu đề, nút **+ Thêm phòng ban**, danh sách tên và mã phòng. Hiển thị tên dưới dạng văn bản. | **Xem chi tiết** và **Chỉnh sửa** từ menu từng dòng. |

Mỗi trang dành chiều rộng chính cho một danh sách. Đưa nút thêm lên góc phải tiêu đề trên desktop và đặt gần tiêu đề trên mobile. Bỏ form tạo ở đầu hoặc cuối danh sách, bỏ ô nhập và nút Lưu lặp trên từng dòng. Nút **Thêm tài khoản** mở dialog ngay, thay cho cuộn tới form. Trên mobile, hiển thị danh sách dạng thẻ, có đầy đủ thông tin nhận diện và menu thao tác. Dùng nhận diện xanh hiện tại của Organic Work và hạn chế tiêu đề lặp.

## 3. Dialog theo thao tác

| Thao tác | Nội dung dialog |
| --- | --- |
| **Thêm tài khoản** | Họ tên, email, mật khẩu khởi tạo, phòng ban, vai trò và trạng thái mặc định theo hệ thống. Nút **Hủy** và **Tạo tài khoản**. |
| **Sửa tài khoản** | Nạp giá trị của đúng tài khoản vào form. Các trường tuân theo quyền và quy tắc hiện có. Chỉ cho đổi mật khẩu qua thao tác chuyên biệt nếu ứng dụng đã hỗ trợ. Nút **Hủy** và **Lưu thay đổi**. |
| **Xem tài khoản hoặc phòng ban** | Dialog chỉ đọc với thông tin đang lưu, có nút **Đóng** và đường chuyển sang **Chỉnh sửa** khi có quyền. Dùng một dialog tại một thời điểm. |
| **Thêm hoặc sửa phòng ban** | Khi thêm, nhập tên và mã phòng theo quy tắc hiện tại. Khi sửa, điền sẵn dữ liệu và giữ định danh cùng mã ổn định theo quy tắc hệ thống. |
| **Vô hiệu hóa hoặc kích hoạt lại** | Dialog xác nhận nêu rõ tên tài khoản và hành động. Với vô hiệu hóa, nêu hệ quả là tài khoản mất quyền truy cập. Dùng nhãn nút **Vô hiệu hóa** hoặc **Kích hoạt lại**. |

Tái sử dụng Dialog và AlertDialog đã có trong hệ UI. Không dùng xóa vĩnh viễn làm thao tác CRUD mới. Tài khoản dùng kích hoạt/vô hiệu hóa, phòng ban dùng tạo, xem và sửa theo nghiệp vụ hiện tại. Các dialog có tiêu đề rõ, chiều rộng vừa với form trên máy tính và vừa màn hình điện thoại. Nếu form dài, chỉ cuộn phần nội dung và giữ nút thao tác trong vùng dễ thấy.

## 4. Lưu dữ liệu và xử lý lỗi

- Dùng chung form cho chế độ thêm và sửa khi phù hợp. Mỗi lần mở, khởi tạo đúng theo thao tác và bản ghi được chọn. Nếu form đã chỉnh và người dùng hủy hoặc đóng, hỏi xác nhận bỏ thay đổi trước khi thoát. Hỗ trợ bàn phím, quản lý focus trong dialog và đưa focus về nút mở khi đóng. Nếu mở từ menu từng dòng, đưa focus về nút menu tương ứng.
- Khi gửi, hiển thị **Đang lưu** và khóa gửi lặp. Chờ server xác nhận thành công rồi mới đóng dialog, hiện thông báo kết quả và cập nhật danh sách MongoDB. Giữ nguyên tìm kiếm, bộ lọc và vị trí danh sách khi có thể. Nếu bản ghi vừa đổi không còn phù hợp với bộ lọc, hiển thị thông báo phù hợp thay vì đưa nó vào sai danh sách.
- Khi lưu lỗi, giữ dialog mở và giữ nội dung đã nhập. Báo lỗi cạnh trường liên quan nếu có, chẳng hạn email hoặc mã phòng đã tồn tại, và thông báo rõ khi thao tác bị từ chối. Kiểm tra dữ liệu phía server, dùng lại quy tắc chuẩn hóa và ràng buộc hiện có.
- Kiểm tra quyền Admin ở cả route và thao tác ghi. Tái sử dụng các quy tắc hiện có về Admin đang hoạt động cuối cùng, phiên của tài khoản bị vô hiệu hóa và xử lý phân công đang mở trước khi chuyển phòng. Dùng API/server actions và MongoDB hiện có. Phạm vi chỉnh sửa là màn Quản trị và các thành phần CRUD liên quan.

## 5. Kiểm thử và bàn giao

Tự chạy ứng dụng trên môi trường dev/test, dùng MongoDB và tài khoản demo. Kiểm tra các ca sau:

1. Đăng nhập Admin. Từ thanh bên trái, mở **Quản trị → Tài khoản**, chuyển sang **Phòng ban** rồi quay lại. Kiểm tra mục được đánh dấu, breadcrumb, URL trực tiếp, reload và Back/Forward. Mỗi trang mở thẳng tiêu đề, bộ lọc và danh sách. Kiểm tra đường dẫn Quản trị cũ hoặc URL tab cũ nếu có.
2. Bấm **Thêm tài khoản** ở đầu danh sách. Dialog mở tại chỗ, không cuộn xuống form. Tạo tài khoản hợp lệ, thấy danh sách cập nhật và dữ liệu vẫn còn sau khi tải lại. Thử email trùng và kiểm tra dialog giữ nội dung đã nhập.
3. Mở sửa hai tài khoản liên tiếp. Xác nhận form luôn lấy đúng dữ liệu, hủy không ghi vào MongoDB, lưu chỉ cập nhật tài khoản được chọn. Kiểm tra xác nhận vô hiệu hóa và kích hoạt lại, cùng quy tắc bảo vệ Admin cuối cùng.
4. Thêm và sửa phòng ban bằng dialog. Kiểm tra tên hiển thị đúng trong danh sách và trong bộ chọn phòng ban của tài khoản. Tài khoản và công việc đang tham chiếu phòng ban vẫn truy cập đúng sau khi đổi tên.
5. Kiểm tra màn hình rộng **390 px** và **1440 px**, drawer điều hướng trên mobile, thao tác Tab, Enter và Escape, lỗi lưu và việc đóng dialog. Đăng nhập bằng tài khoản thường để xác nhận nhóm Quản trị ẩn và link quản trị trực tiếp bị từ chối. Chạy các test liên quan và build production. Ghi rõ route, component đã sửa và những ca thực sự đã chạy.

Triển khai mã chạy được ngay trong repo. Sau khi hoàn tất, tóm tắt ngắn bố cục mới và kết quả kiểm thử.

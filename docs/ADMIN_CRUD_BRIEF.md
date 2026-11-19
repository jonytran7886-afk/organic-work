# Prompt chỉnh giao diện Quản trị và dialog CRUD cho Organic Work

Hãy sửa trực tiếp giao diện **Quản trị** trong repo Organic Work hiện có. Màn trong ảnh đang ghép danh sách Phòng ban và Tài khoản thành hai cột, mỗi phòng có ô sửa kèm nút Lưu, còn form tạo tài khoản chiếm một khối lớn trong trang danh sách. Mục tiêu là **mỗi trang xử lý một nhóm dữ liệu, mỗi danh sách có một nút thêm rõ ràng và các form chỉ xuất hiện khi người dùng mở dialog**. Hãy đọc route hiện tại, component UI, form, API/server actions và quyền Admin, sau đó triển khai và chạy thử.

## 1. Tách màn Quản trị thành hai trang

Dùng chung layout Quản trị, với hai mục điều hướng **Tài khoản** và **Phòng ban**. Mỗi mục có URL riêng, ví dụ `/admin/users` và `/admin/departments`. Điều chỉnh theo quy ước route của repo. Cho đường dẫn Quản trị hiện tại mở **Tài khoản** mặc định. Hiển thị mục đang chọn và breadcrumb tương ứng. Tải lại trang, dùng nút Back/Forward và mở link trực tiếp đều phải vào đúng mục.

| Trang | Thành phần chính | Thao tác |
| --- | --- | --- |
| **Tài khoản** | Tiêu đề, nút **+ Thêm tài khoản**, tìm theo tên hoặc email, lọc theo phòng ban, vai trò và trạng thái. Bảng hiện họ tên, email, phòng ban, vai trò, trạng thái và thao tác. | **Xem chi tiết**, **Chỉnh sửa**, **Vô hiệu hóa** hoặc **Kích hoạt lại** từ menu từng dòng. |
| **Phòng ban** | Tiêu đề, nút **+ Thêm phòng ban**, danh sách tên và mã phòng. Hiển thị tên dưới dạng văn bản. | **Xem chi tiết** và **Chỉnh sửa** từ menu từng dòng. |

Mỗi trang dành chiều rộng chính cho một danh sách. Đưa nút thêm lên góc phải tiêu đề trên desktop và đặt gần tiêu đề trên mobile. Bỏ form tạo ở đầu hoặc cuối danh sách, bỏ ô nhập và nút Lưu lặp trên từng dòng. Nút **Thêm tài khoản** mở dialog ngay, thay cho cuộn tới form. Trên mobile, hiển thị danh sách dạng thẻ, có đầy đủ thông tin nhận diện và menu thao tác. Dùng nhận diện xanh hiện tại của Organic Work và hạn chế tiêu đề lặp.

## 2. Dialog theo thao tác

| Thao tác | Nội dung dialog |
| --- | --- |
| **Thêm tài khoản** | Họ tên, email, mật khẩu khởi tạo, phòng ban, vai trò và trạng thái mặc định theo hệ thống. Nút **Hủy** và **Tạo tài khoản**. |
| **Sửa tài khoản** | Nạp giá trị của đúng tài khoản vào form. Các trường tuân theo quyền và quy tắc hiện có. Chỉ cho đổi mật khẩu qua thao tác chuyên biệt nếu ứng dụng đã hỗ trợ. Nút **Hủy** và **Lưu thay đổi**. |
| **Xem tài khoản hoặc phòng ban** | Dialog chỉ đọc với thông tin đang lưu, có nút **Đóng** và đường chuyển sang **Chỉnh sửa** khi có quyền. Dùng một dialog tại một thời điểm. |
| **Thêm hoặc sửa phòng ban** | Khi thêm, nhập tên và mã phòng theo quy tắc hiện tại. Khi sửa, điền sẵn dữ liệu và giữ định danh cùng mã ổn định theo quy tắc hệ thống. |
| **Vô hiệu hóa hoặc kích hoạt lại** | Dialog xác nhận nêu rõ tên tài khoản và hành động. Với vô hiệu hóa, nêu hệ quả là tài khoản mất quyền truy cập. Dùng nhãn nút **Vô hiệu hóa** hoặc **Kích hoạt lại**. |

Tái sử dụng Dialog và AlertDialog đã có trong hệ UI. Không dùng xóa vĩnh viễn làm thao tác CRUD mới. Tài khoản dùng kích hoạt/vô hiệu hóa, phòng ban dùng tạo, xem và sửa theo nghiệp vụ hiện tại. Các dialog có tiêu đề rõ, chiều rộng vừa với form trên máy tính và vừa màn hình điện thoại. Nếu form dài, chỉ cuộn phần nội dung và giữ nút thao tác trong vùng dễ thấy.

## 3. Lưu dữ liệu và xử lý lỗi

- Dùng chung form cho chế độ thêm và sửa khi phù hợp. Mỗi lần mở, khởi tạo đúng theo thao tác và bản ghi được chọn. Nếu form đã chỉnh và người dùng hủy hoặc đóng, hỏi xác nhận bỏ thay đổi trước khi thoát. Hỗ trợ bàn phím, quản lý focus trong dialog và đưa focus về nút mở khi đóng. Nếu mở từ menu từng dòng, đưa focus về nút menu tương ứng.
- Khi gửi, hiển thị **Đang lưu** và khóa gửi lặp. Chờ server xác nhận thành công rồi mới đóng dialog, hiện thông báo kết quả và cập nhật danh sách MongoDB. Giữ nguyên tìm kiếm, bộ lọc và vị trí danh sách khi có thể. Nếu bản ghi vừa đổi không còn phù hợp với bộ lọc, hiển thị thông báo phù hợp thay vì đưa nó vào sai danh sách.
- Khi lưu lỗi, giữ dialog mở và giữ nội dung đã nhập. Báo lỗi cạnh trường liên quan nếu có, chẳng hạn email hoặc mã phòng đã tồn tại, và thông báo rõ khi thao tác bị từ chối. Kiểm tra dữ liệu phía server, dùng lại quy tắc chuẩn hóa và ràng buộc hiện có.
- Kiểm tra quyền Admin ở cả route và thao tác ghi. Tái sử dụng các quy tắc hiện có về Admin đang hoạt động cuối cùng, phiên của tài khoản bị vô hiệu hóa và xử lý phân công đang mở trước khi chuyển phòng. Dùng API/server actions và MongoDB hiện có. Phạm vi chỉnh sửa là màn Quản trị và các thành phần CRUD liên quan.

## 4. Kiểm thử và bàn giao

Tự chạy ứng dụng trên môi trường dev/test, dùng MongoDB và tài khoản demo. Kiểm tra các ca sau:

1. Mở **Quản trị → Tài khoản**, chuyển sang **Phòng ban** rồi quay lại. Mỗi trang chỉ hiển thị danh sách của mình. URL trực tiếp, tải lại và Back/Forward hoạt động.
2. Bấm **Thêm tài khoản** ở đầu danh sách. Dialog mở tại chỗ, không cuộn xuống form. Tạo tài khoản hợp lệ, thấy danh sách cập nhật và dữ liệu vẫn còn sau khi tải lại. Thử email trùng và kiểm tra dialog giữ nội dung đã nhập.
3. Mở sửa hai tài khoản liên tiếp. Xác nhận form luôn lấy đúng dữ liệu, hủy không ghi vào MongoDB, lưu chỉ cập nhật tài khoản được chọn. Kiểm tra xác nhận vô hiệu hóa và kích hoạt lại, cùng quy tắc bảo vệ Admin cuối cùng.
4. Thêm và sửa phòng ban bằng dialog. Kiểm tra tên hiển thị đúng trong danh sách và trong bộ chọn phòng ban của tài khoản. Tài khoản và công việc đang tham chiếu phòng ban vẫn truy cập đúng sau khi đổi tên.
5. Kiểm tra màn hình rộng **390 px** và **1440 px**, thao tác Tab, Enter và Escape, lỗi lưu và việc đóng dialog. Chạy các test liên quan và build production. Ghi rõ route, component đã sửa và những ca thực sự đã chạy.

Triển khai mã chạy được ngay trong repo. Sau khi hoàn tất, tóm tắt ngắn bố cục mới và kết quả kiểm thử.

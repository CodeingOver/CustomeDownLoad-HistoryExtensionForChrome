# Bộ đôi Chrome Extension: Lịch sử & Tải xuống phong cách Edge

Dự án này là bộ đôi tiện ích mở rộng (Chrome Extensions) được phát triển nhằm tái hiện giao diện Fluent Design cao cấp của Microsoft Edge trên trình duyệt Chrome.

## 1. Tính năng chính
- **EdgeHistoryPopup**:
  - Giao diện tối Fluent Design với hiệu ứng kính mờ (glassmorphism) và bo góc mượt mà.
  - Phân nhóm lịch sử duyệt web theo ngày và khoảng thời gian (Recent, Today, Yesterday...).
  - Tích hợp thanh tìm kiếm lịch sử với hiệu ứng focus Fluent và nút xóa nhanh nội dung tìm kiếm.
  - Quản lý các tab gần đây (Recently closed) và đồng bộ tab từ thiết bị khác (Tabs from other devices).
  - Thao tác nhanh: Nhấp để mở tab mới, di chuột qua để xóa nhanh URL khỏi lịch sử hoặc sao chép liên kết.
- **EdgeDownloadsPopup**:
  - Quản lý danh sách tải xuống gần đây đồng bộ thiết kế với menu lịch sử.
  - Tải và nhận diện đuôi tệp để tự động hiển thị biểu tượng tương ứng (.docx, .pdf, .zip, .jar...).
  - Hiển thị tệp tin đã bị xóa khỏi đĩa cứng (hiệu ứng gạch ngang tên tệp và nhãn "Removed").
  - Thanh tiến trình tải xuống thời gian thực đối với các tệp tin đang tải.
  - Thao tác nhanh: Mở tệp trực tiếp, hiển thị tệp trong thư mục lưu trữ, hoặc xóa khỏi lịch sử tải xuống.

## 2. Yêu cầu hệ thống
- Trình duyệt Google Chrome hoặc các trình duyệt nhân Chromium (như Cốc Cốc, Brave, Opera, Microsoft Edge) phiên bản mới hỗ trợ Manifest V3.

## 3. Hướng dẫn cài đặt
Để cài đặt và sử dụng các tiện ích này, bạn **không được nạp thư mục gốc** mà phải nạp từng thư mục con:
1. Mở trình duyệt Chrome và truy cập địa chỉ: `chrome://extensions/`
2. Bật công tắc **Chế độ cho nhà phát triển** (Developer mode) ở góc trên bên phải.
3. Bấm vào nút **Tải tiện ích đã giải nén** (Load unpacked) ở góc trái.
4. Trỏ đến thư mục con tiện ích đầu tiên: `D:\CodePython\CustomeExtensionForChrome\EdgeHistoryPopup`.
5. Tiếp tục bấm **Tải tiện ích đã giải nén** và chọn thư mục thứ hai: `D:\CodePython\CustomeExtensionForChrome\EdgeDownloadsPopup`.
6. Nhấp vào biểu tượng mảnh ghép (Extensions) trên thanh công cụ của Chrome và bấm **Ghim** (Pin) các tiện ích lên để sử dụng.

## 4. Biến môi trường
Dự án này không yêu cầu bất kỳ biến môi trường (`.env`) nào vì nó hoạt động hoàn toàn bằng các API nội bộ của trình duyệt Chrome.

## 5. Hướng dẫn chạy & Sử dụng
- Nhấp vào biểu tượng Lịch sử trên thanh công cụ để mở pop-up xem lịch sử.
- Nhấp vào biểu tượng Tải xuống để quản lý các file đã tải.

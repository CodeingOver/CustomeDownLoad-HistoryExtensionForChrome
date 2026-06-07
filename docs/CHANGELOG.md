# Nhật ký thay đổi (CHANGELOG)

Tài liệu này ghi lại toàn bộ lịch sử các phiên bản phát hành và các cập nhật thay đổi của dự án.

---

### [v1.0.2] - 2026-06-07

#### - **[Xóa bỏ]**
- Loại bỏ hoàn toàn tiện ích **`GeminiShortcut`** (thư mục `GeminiShortcut`) và các file mã nguồn liên quan theo yêu cầu của người dùng.
- Cập nhật tài liệu cấu trúc thư mục, hệ thống và hướng dẫn cài đặt để loại bỏ tiện ích Gemini Shortcut.

---

### [v1.0.1] - 2026-06-07

#### - **[Sửa lỗi]**
- Đổi giới hạn `maxResults` từ 50 xuống 25 trong hàm `chrome.sessions.getRecentlyClosed` tại [popup.js](file:///d:/CodePython/CustomeExtensionForChrome/EdgeHistoryPopup/popup.js) của `EdgeHistoryPopup` để sửa lỗi Chrome Console crash ("Value must be at most 25").

#### - **[Thêm mới]**
- Triển khai tính năng **Cuộn vô tận (Infinite Scroll)** cho danh sách lịch sử tại [popup.js](file:///d:/CodePython/CustomeExtensionForChrome/EdgeHistoryPopup/popup.js) nhằm tự động tải thêm 50 trang lịch sử cũ khi người dùng kéo xuống dưới cùng.
- Tích hợp hàm kiểm duyệt và lọc phần tử trùng lặp (deduplication) để ngăn chặn hiển thị nhiều lần một dòng lịch sử.

#### - **[Cập nhật]**
- Tải các vector SVG chính thức từ thư viện Microsoft Fluent UI và Wikimedia Commons để làm icon đại diện cho cả 3 extensions (thay thế cho icon tự sinh bằng AI trước đó):
  - [EdgeHistoryPopup/icon.svg](file:///d:/CodePython/CustomeExtensionForChrome/EdgeHistoryPopup/icon.svg): Đồng hồ Lịch sử Fluent UI.
  - [EdgeDownloadsPopup/icon.svg](file:///d:/CodePython/CustomeExtensionForChrome/EdgeDownloadsPopup/icon.svg): Mũi tên tải xuống Fluent UI.
  - [GeminiShortcut/icon.svg](file:///d:/CodePython/CustomeExtensionForChrome/GeminiShortcut/icon.svg): Ngôi sao bốn cánh logo Gemini.
- Cập nhật [EdgeHistoryPopup/manifest.json](file:///d:/CodePython/CustomeExtensionForChrome/EdgeHistoryPopup/manifest.json), [EdgeDownloadsPopup/manifest.json](file:///d:/CodePython/CustomeExtensionForChrome/EdgeDownloadsPopup/manifest.json) và [GeminiShortcut/manifest.json](file:///d:/CodePython/CustomeExtensionForChrome/GeminiShortcut/manifest.json) để chuyển định dạng `default_icon` và `icons` sang sử dụng trực tiếp các file SVG này.

---

### [v1.0.0] - 2026-06-07

Nhà phát triển phát hành phiên bản đầu tiên của bộ ba Chrome Extension phong cách Edge bao gồm Lịch sử duyệt web, Lịch sử tải xuống và Lối tắt Gemini.

#### - **[Thêm mới]**
- Thiết lập tiện ích **`EdgeHistoryPopup`**:
  - Viết tệp cấu hình [manifest.json](file:///d:/CodePython/CustomeExtensionForChrome/EdgeHistoryPopup/manifest.json) sử dụng Manifest V3.
  - Viết giao diện [popup.html](file:///d:/CodePython/CustomeExtensionForChrome/EdgeHistoryPopup/popup.html) với cấu trúc phân tab, thanh tìm kiếm và khu vực cuộn danh sách.
  - Thiết kế [popup.css](file:///d:/CodePython/CustomeExtensionForChrome/EdgeHistoryPopup/popup.css) giao diện Fluent tối (Dark Mode), bo góc tròn, hiệu ứng kính mờ, tùy chỉnh scrollbar mảnh và tương tác di chuột thay thế thời gian bằng nút xóa.
  - Xây dựng logic [popup.js](file:///d:/CodePython/CustomeExtensionForChrome/EdgeHistoryPopup/popup.js) xử lý đọc lịch sử Chrome, phân nhóm ngày, quản lý phiên tab đã đóng gần đây, tab trên thiết bị đồng bộ và tìm kiếm debounce.
  - Tạo biểu tượng đồng hồ lịch sử `icon.png` bằng AI.
- Thiết lập tiện ích **`EdgeDownloadsPopup`**:
  - Khởi tạo cấu hình [manifest.json](file:///d:/CodePython/CustomeExtensionForChrome/EdgeDownloadsPopup/manifest.json) với quyền truy cập download.
  - Viết khung giao diện [popup.html](file:///d:/CodePython/CustomeExtensionForChrome/EdgeDownloadsPopup/popup.html) tương thích với menu Lịch sử.
  - Thiết kế [popup.css](file:///d:/CodePython/CustomeExtensionForChrome/EdgeDownloadsPopup/popup.css) định nghĩa thanh tiến trình tải xuống Fluent, kiểu hiển thị tệp tin đã bị xóa khỏi ổ đĩa.
  - Viết logic [popup.js](file:///d:/CodePython/CustomeExtensionForChrome/EdgeDownloadsPopup/popup.js) tích hợp lấy lịch sử tải xuống, vẽ icon tệp tin dạng vector SVG theo đuôi tệp (.docx, .pdf, .zip, .jar...), theo dõi tiến trình trực tiếp qua API, xử lý mở tệp, hiển thị trong thư mục và xóa khỏi lịch sử.
  - Tạo biểu tượng mũi tên tải xuống `icon.png` bằng AI.
- Thiết lập tiện ích **`GeminiShortcut`**:
  - Tạo tệp cấu hình [manifest.json](file:///d:/CodePython/CustomeExtensionForChrome/GeminiShortcut/manifest.json) và script ngầm [background.js](file:///d:/CodePython/CustomeExtensionForChrome/GeminiShortcut/background.js) thực hiện hành động mở trang web Gemini khi nhấp vào nút icon.
  - Tạo logo Gemini cách điệu `icon.png` bằng AI.

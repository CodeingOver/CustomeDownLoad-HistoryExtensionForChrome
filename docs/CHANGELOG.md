# Nhật ký thay đổi (CHANGELOG)

Tài liệu này ghi lại toàn bộ lịch sử các phiên bản phát hành và các cập nhật thay đổi của dự án.

---

### [v1.0.8] - 2026-06-07

#### - **[Sửa lỗi]**
- Khắc phục lỗi không tự động cập nhật lại giao diện ngay lập tức sau khi nhấn "Delete file" (xóa tệp vật lý) bằng cách gọi trực tiếp hàm cập nhật `loadDownloads()` trong callback của `chrome.downloads.removeFile`.
- Đồng bộ nâng phiên bản của cả hai tiện ích lên `1.0.8` tại các tệp `manifest.json`.

---

### [v1.0.7] - 2026-06-07

#### - **[Sửa lỗi]**
- Khắc phục logic nút Thùng rác (Xóa) của tiện ích Downloads:
  - Nếu tệp tin vẫn còn tồn tại trên ổ đĩa, nút thùng rác sẽ thực hiện **Xóa tệp vật lý khỏi máy tính** (`chrome.downloads.removeFile`) và hiển thị tooltip là "Delete file" khớp hoàn toàn với Edge.
  - Nếu tệp tin đã bị xóa khỏi đĩa trước đó (trạng thái "Removed") hoặc bị lỗi, nút thùng rác sẽ thực hiện **Xóa dòng lịch sử khỏi danh sách** (`chrome.downloads.erase`) với tooltip "Remove from history".
- Đồng bộ nâng phiên bản của cả hai tiện ích `Edge History` và `Edge Downloads` lên `1.0.7` tại các tệp `manifest.json`.

---

### [v1.0.6] - 2026-06-07

#### - **[Cập nhật]**
- Tăng kích thước nút hành động (dấu X xóa lịch sử, mở Folder, Thùng rác) lên **28px** x **28px** để khớp hoàn toàn với thiết kế thực tế của Microsoft Edge.
- Chuyển đổi toàn bộ icon hành động (dấu X, Folder, Thùng rác) sang dạng nét viền (outline) Fluent UI sắc nét (viewBox 20x20, stroke-width 1.5).
- Tùy chỉnh hiệu ứng hover của các nút hành động sang kiểu nền Fluent bán trong suốt (`rgba(255, 255, 255, 0.08)`) và loại bỏ hover màu đỏ giúp giao diện đồng nhất, tinh tế.
- Đồng bộ nâng phiên bản của cả hai tiện ích `Edge History` và `Edge Downloads` lên `1.0.6` tại các tệp `manifest.json`.

---

### [v1.0.5] - 2026-06-07

#### - **[Sửa lỗi]**
- Khắc phục lỗi sắp xếp danh sách tải xuống bằng cách cấu hình thuộc tính `orderBy: ['-startTime']` trực tiếp trong API `chrome.downloads.search` của Chrome để lấy thứ tự thời gian giảm dần gốc từ trình duyệt (mới nhất lên đầu) mà không cần tự sắp xếp thủ công ở phía client.

#### - **[Thêm mới]**
- Sử dụng API `chrome.downloads.getFileIcon` để tự động lấy icon tệp tin gốc của hệ điều hành (như Word, PDF, Excel...) thay thế cho các icon vẽ bằng SVG tĩnh trước đây.

#### - **[Cập nhật]**
- Tăng kích thước hiển thị của icon tệp từ 24px lên 32px trong giao diện pop-up giúp hiển thị to rõ ràng.
- Rút ngắn mã nguồn bằng cách loại bỏ các hàm vẽ SVG phức tạp tĩnh, chỉ giữ lại một icon tài liệu xám mặc định làm phương án dự phòng (fallback) nếu xảy ra lỗi tải icon gốc.
- Nâng phiên bản của tiện ích `Edge Downloads` lên `1.0.5` trong tệp `manifest.json`.

---

### [v1.0.4] - 2026-06-07

#### - **[Sửa lỗi]**
- Khắc phục triệt để lỗi lặp và đan xen tiêu đề ngày trong Lịch sử duyệt web (EdgeHistoryPopup) bằng cách bỏ hoàn toàn phân nhóm động "Recent" và thay thế bằng phân nhóm theo ngày dương lịch chuẩn xác của Chrome.
- Khắc phục lỗi xuất hiện tiêu đề rỗng (như tiêu đề "Recent" không có dòng nào bên dưới) bằng cách lọc các tệp tin trùng lặp trước khi quyết định tạo thẻ tiêu đề nhóm.

#### - **[Cập nhật]**
- Làm đậm các tiêu đề ngày trong [popup.css](file:///d:/CodePython/CustomeExtensionForChrome/EdgeHistoryPopup/popup.css) của `EdgeHistoryPopup` bằng cách đổi màu chữ sang màu trắng (`--text-primary`) và cỡ chữ lên 12px để giao diện trực quan và dễ phân tách thông tin hơn.

---

### [v1.0.3] - 2026-06-07

#### - **[Sửa lỗi]**
- Thêm quyền `"downloads.open"` vào [EdgeDownloadsPopup/manifest.json](file:///d:/CodePython/CustomeExtensionForChrome/EdgeDownloadsPopup/manifest.json) để khắc phục lỗi "The 'downloads.open' permission is required" khi người dùng nhấp mở tệp trực tiếp từ pop-up.
- Thêm quyền `"tabs"` vào [EdgeHistoryPopup/manifest.json](file:///d:/CodePython/CustomeExtensionForChrome/EdgeHistoryPopup/manifest.json) để sửa triệt để lỗi tab đóng gần đây trả về giá trị `undefined` cho tiêu đề và URL. Tab **Recently closed** hoạt động và đồng bộ hiển thị đúng dữ liệu thực tế của Chrome.

#### - **[Xóa bỏ]**
- Loại bỏ hoàn toàn tab "Tabs from other devices" khỏi giao diện [popup.html](file:///d:/CodePython/CustomeExtensionForChrome/EdgeHistoryPopup/popup.html) và logic [popup.js](file:///d:/CodePython/CustomeExtensionForChrome/EdgeHistoryPopup/popup.js) của `EdgeHistoryPopup` theo yêu cầu.

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

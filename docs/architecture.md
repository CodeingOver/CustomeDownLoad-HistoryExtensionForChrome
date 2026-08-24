# Tài liệu Kiến trúc Hệ thống (System Architecture)

Tài liệu này mô tả kiến trúc hệ thống và luồng xử lý của bộ đôi tiện ích mở rộng Chrome bao gồm: EdgeHistoryPopup và EdgeDownloadsPopup.

---

## 1. Tổng quan hệ thống (System Overview)
Hệ thống là một tập hợp gồm 2 Chrome Extensions độc lập, được đóng gói dưới dạng các thư mục riêng lẻ để nạp vào Chrome. Chúng được thiết kế để mở rộng tính năng điều hướng và quản lý của trình duyệt, cung cấp cho người dùng giao diện mượt mà phong cách Fluent Design để truy cập nhanh Lịch sử (History) và Lượt tải xuống (Downloads).

---

## 2. Công nghệ sử dụng (Tech Stack)
- **Cốt lõi**: HTML5, Vanilla JavaScript (ES6+), và Chrome Extension Manifest V3 APIs.
- **Giao diện & Phong cách**: CSS3 (Biến CSS, Flexbox, Bố cục lưới, Hiệu ứng kính mờ `backdrop-filter`).
- **Tài nguyên đồ họa**: Ảnh biểu tượng SVG và PNG, bao gồm bộ icon trạng thái được dựng overlay bằng Canvas trong Service Worker.
- **Trình duyệt mục tiêu**: Google Chrome và các trình duyệt nhân Chromium phiên bản hỗ trợ Manifest V3.

---

## 3. Cấu trúc thư mục (Folder Structure)

```markdown
d:/CodePython/CustomeExtensionForChrome/
├── README.md                           # Hướng dẫn sử dụng & cài đặt tổng quan
├── docs/
│   ├── architecture.md                 # Tài liệu kiến trúc hệ thống này
│   └── CHANGELOG.md                    # Nhật ký thay đổi phiên bản
├── EdgeHistoryPopup/                   # Extension Lịch sử phong cách Edge
│   ├── manifest.json                   # Cấu hình extension lịch sử
│   ├── popup.html                      # Giao diện popup lịch sử
│   ├── popup.css                       # Kiểu giao diện tối Fluent
│   ├── popup.js                        # Logic truy vấn & xử lý lịch sử
│   ├── icon.svg                        # Icon gốc dạng SVG
│   ├── icon16.png                      # Icon kích thước 16x16
│   ├── icon32.png                      # Icon kích thước 32x32
│   ├── icon48.png                      # Icon kích thước 48x48
│   └── icon128.png                     # Icon kích thước 128x128
└── EdgeDownloadsPopup/                 # Extension Lượt tải xuống phong cách Edge
    ├── manifest.json                   # Cấu hình extension lượt tải
    ├── popup.html                      # Giao diện popup lượt tải
    ├── popup.css                       # Kiểu giao diện và progress bar
    ├── popup.js                        # Logic theo dõi & thao tác tải xuống
    ├── background.js                   # Service Worker quản lý vòng đời tải xuống và vẽ Canvas
    ├── offscreen.html                  # HTML chứa script offscreen để polling tiến độ ngầm
    ├── offscreen.js                    # Logic offscreen phát tick polling tiến trình và giữ Service Worker không bị ngủ đông
    ├── icon.svg                        # Icon gốc dạng SVG (trắng)
    ├── icon16.png                      # Icon trắng kích thước 16x16
    ├── icon32.png                      # Icon trắng kích thước 32x32
    ├── icon48.png                      # Icon trắng kích thước 48x48
    ├── icon128.png                     # Icon trắng kích thước 128x128
    ├── icon_glow.svg                   # Icon phát sáng dạng SVG (xanh Fluent)
    ├── icon_glow16.png                 # Icon xanh kích thước 16x16
    ├── icon_glow32.png                 # Icon xanh kích thước 32x32
    ├── icon_glow48.png                 # Icon xanh kích thước 48x48
    ├── icon_glow128.png                # Icon xanh kích thước 128x128
    ├── pause_filled_icon_202026.png    # Icon pause gốc do người dùng cung cấp
    ├── pause_icon16.png                # Icon pause kích thước 16x16
    ├── pause_icon32.png                # Icon pause kích thước 32x32
    ├── pause_icon48.png                # Icon pause kích thước 48x48
    ├── pause_icon128.png               # Icon pause kích thước 128x128
    ├── checkbox_checked_filled_icon_201518.png # Icon hoàn tất gốc do người dùng cung cấp
    ├── complete_icon16.png             # Icon hoàn tất kích thước 16x16
    ├── complete_icon32.png             # Icon hoàn tất kích thước 32x32
    ├── complete_icon48.png             # Icon hoàn tất kích thước 48x48
    └── complete_icon128.png            # Icon hoàn tất kích thước 128x128
```

---

## 4. Kiến trúc thành phần (Component Architecture)
Hệ thống chia làm hai thành phần lớn tương ứng với hai tiện ích:

1. **Thành phần Lịch sử (History Component)**:
   - Giao diện người dùng (`popup.html` & `popup.css`): Hiển thị cấu trúc tab và danh sách kết quả.
   - Trình điều khiển logic (`popup.js`): Giao tiếp với API trình duyệt (`chrome.history` và `chrome.sessions`) để lấy lịch sử và khôi phục tab/cửa sổ đã đóng gần đây.
2. **Thành phần Tải xuống (Downloads Component)**:
   - Giao diện người dùng (`popup.html`, `popup.css`, `popup.js`): Hiển thị danh sách tải xuống, hỗ trợ chế độ thu gọn phiên hiện tại kết hợp nút "See more" để mở rộng, mở tệp, hiển thị vị trí, tiếp tục/tải lại lượt tải bị gián đoạn và xóa lịch sử tải xuống. Popup nhận message batch `sync-all-progress` từ Service Worker qua `chrome.runtime.onMessage` để cập nhật DOM tại chỗ theo mô hình event-driven, đồng thời chỉ vẽ lại danh sách khi có thay đổi trạng thái quan trọng. Trước khi hiện nút "See more", Popup đối chiếu ID phiên với danh sách tải xuống thực tế và bỏ qua các mục đã bị xóa khỏi ổ đĩa.
   - Service Worker (`background.js`): Chạy ngầm để quản lý vòng đời tải xuống, tắt UI mặc định của Chrome khi Service Worker nạp bằng `chrome.downloads.setUiOptions`, đổi icon toolbar theo trạng thái tải xuống (mặc định, glow, pause overlay, hoàn tất overlay), điều phối đóng/mở tài liệu offscreen và lưu danh sách ID tải xuống của phiên hiện tại bằng payload có mã phiên trong `chrome.storage.session`. Đồng thời gom dữ liệu tiến trình trong `activeDownloads` thành message batch gửi về Popup tối đa mỗi 3 giây.
   - Tài liệu ẩn (`offscreen.html`, `offscreen.js`): Môi trường DOM ẩn phát tick `'polling-tick'` định kỳ 3 giây để Service Worker đọc nhẹ `bytesReceived` và `totalBytes` bằng `chrome.downloads.search({ state: 'in_progress' })`, vì `chrome.downloads.onChanged` không cung cấp nhịp thay đổi byte liên tục.

---

## 5. Luồng dữ liệu (Data Flow)

### Luồng 1: Xem và tìm kiếm lịch sử duyệt web
1. Người dùng click vào icon tiện ích Lịch sử.
2. Pop-up tải dữ liệu và gọi hàm `chrome.history.search`.
3. Trình duyệt trả về danh sách lịch sử dưới dạng mảng JSON.
4. Trình điều khiển phân loại thời gian, chèn biểu tượng favicon thông qua định dạng URL nội bộ `chrome-extension://<id>/_favicon/...` với URL đầy đủ của từng mục lịch sử và hiển thị lên danh sách.
5. Khi người dùng nhập từ khóa tìm kiếm, bộ đệm (debounce) sẽ chờ 200ms trước khi thực hiện truy vấn lại từ đầu. Mỗi truy vấn được gắn mã định danh hiện hành để callback bất đồng bộ cũ không thể ghi đè kết quả mới hơn.

### Luồng 2: Theo dõi và cập nhật tiến trình tải xuống
1. Người dùng bắt đầu tải xuống một tệp tin.
2. Trình duyệt kích hoạt sự kiện `chrome.downloads.onCreated`.
3. Background Service Worker đã thiết lập vô hiệu hóa bong bóng tải gốc ở giai đoạn khởi động bằng `setUiOptions`. Khi nhận sự kiện tải mới, tiến trình tải được xử lý êm trong nền mà không tự động mở popup, tránh làm gián đoạn trải nghiệm người dùng. Sau đó Service Worker khởi động hoạt ảnh nhấp nháy phát sáng (glow icon) và gọi `ensureOffscreenDocument()` để kích hoạt tài liệu ẩn Offscreen.
4. Tài liệu Offscreen hoạt động và gửi tin nhắn `'polling-tick'` định kỳ mỗi 3 giây để đánh thức Service Worker và kích hoạt một lượt đọc nhẹ `chrome.downloads.search({ state: 'in_progress' })`.
5. Service Worker nhận sự kiện trạng thái qua `chrome.downloads.onChanged` để cập nhật các trường quan trọng như `state`, `filename`, `paused` và `error`. Với mỗi tick polling, Service Worker chỉ so sánh hai trường `bytesReceived` và `totalBytes`; nếu byte thật sự thay đổi thì mới cập nhật Badge và gửi message batch `sync-all-progress` về Popup.
6. Khi popup đang mở, `popup.js` lắng nghe `sync-all-progress` và cập nhật trực tiếp nhãn phần trăm, dung lượng, thanh tiến trình và trạng thái Pause/Resume của từng dòng tương ứng. Khi popup gửi tín hiệu dọn badge hoàn tất, Service Worker chỉ xóa badge nếu không còn tệp `in_progress`; nếu vẫn đang tải, badge phần trăm được vẽ lại ngay từ `activeDownloads`. Nếu toàn bộ lượt tải đang tạm dừng, Service Worker dùng `OffscreenCanvas` để vẽ icon tải xuống gốc kèm icon pause nhỏ màu trắng ở góc dưới bên phải. Trình lắng nghe `onChanged` trong popup được lọc để cập nhật dòng tương ứng hoặc gọi `loadDownloads()` khi có thay đổi trạng thái quan trọng.
7. Khi hoàn tất, Service Worker gửi tin nhắn hoàn thành đến Popup để tải lại danh sách. Đồng thời, nếu cửa sổ popup không mở và trạng thái kết thúc cuối cùng là `complete`, Service Worker dùng `OffscreenCanvas` để vẽ icon tải xuống gốc kèm icon checkbox nhỏ màu trắng ở góc dưới bên phải rồi đặt icon thông qua `chrome.action.setIcon`. Nếu lượt tải kết thúc bằng `interrupted` do hủy hoặc lỗi, badge phần trăm được xóa ngay và không hiển thị icon hoàn tất. Khi không còn tệp nào đang tải ngầm, Offscreen Document tự động đóng lại thông qua `closeOffscreenDocument()`. Biểu tượng hoàn tất này sẽ được khôi phục về mặc định ngay khi người dùng mở popup hoặc bắt đầu lượt tải mới.
8. Với lượt tải thất bại (`interrupted`), Popup hiển thị lý do lỗi từ `item.error`. Nếu Chrome cho phép tiếp tục (`canResume`), người dùng có thể bấm `Resume` để gọi `chrome.downloads.resume()`. Nếu không thể resume nhưng còn URL gốc (`url` hoặc `finalUrl`), Popup hiển thị `Retry` và gọi `chrome.downloads.download()` để tạo lượt tải mới.

### Luồng 3: Phân trang và cuộn vô hạn danh sách tải xuống (Infinite Scroll)
1. Khi người dùng click biểu tượng Downloads, Popup khởi tạo `loadDownloads()` và truy vấn lô 50 tệp tin tải xuống mới nhất (`limit: 50, orderBy: ['-startTime']`).
2. Danh sách tệp được lọc trùng bằng bộ đệm `renderedDownloadIds` (Set in-memory) và hiển thị lên giao diện.
3. Khi người dùng lăn chuột cuộn danh sách xuống gần đáy (ngưỡng threshold 30px), sự kiện `scroll` (được tối ưu hóa bằng `requestAnimationFrame`) sẽ kích hoạt `fetchDownloads(..., isNextPage = true)`.
4. Popup gửi truy vấn tiếp theo kèm tham số `startedBefore` lấy từ mốc thời gian bắt đầu của tệp cuối cùng trong trang trước để tải liền mạch 50 tệp tiếp theo.
5. Quá trình cuộn và tải dữ liệu diễn ra liên tục cho đến khi tải hết toàn bộ lịch sử tệp tin (`hasMore = false`).

---

## 6. Cơ chế bảo mật (Security Mechanisms)
- **Nguyên tắc phân quyền tối thiểu (Least Privilege)**: Mỗi extension chỉ yêu cầu các quyền thực sự cần thiết trong `manifest.json`.
- **Favicon bảo mật**: Sử dụng đường dẫn Favicon an toàn nội bộ của trình duyệt Chrome Manifest V3 thay vì gửi URL trang web cho các dịch vụ bên thứ ba để đảm bảo quyền riêng tư của người dùng.
- **Môi trường Sandbox**: Toàn bộ mã nguồn chạy trong môi trường bảo mật độc lập của Chrome, bảo vệ hệ điều hành khỏi các tương tác độc hại.

---

## 7. APIs / Routes cốt lõi (Core APIs/Routes)
Hệ thống sử dụng các API gốc của trình duyệt Chrome:
- `chrome.history.search`: Truy vấn lịch sử duyệt web.
- `chrome.history.deleteUrl`: Xóa một URL khỏi lịch sử của trình duyệt.
- `chrome.sessions.getRecentlyClosed`: Lấy danh sách các tab/cửa sổ đã đóng gần đây.
- `chrome.sessions.restore`: Khôi phục một phiên làm việc đã đóng.
- `chrome.downloads.search`: Lấy danh sách lịch sử tải xuống phân trang cho popup; trong Service Worker, API này được dùng khi khởi động và trong tick polling 3 giây để đọc `bytesReceived`/`totalBytes` cho tiến trình Badge.
- `chrome.downloads.getFileIcon`: Lấy biểu tượng thực tế của tệp tin từ hệ thống dựa trên phần mở rộng hoặc đường dẫn tệp.
- `chrome.downloads.open`: Mở tệp tin đã tải xuống hoàn thành.
- `chrome.downloads.resume`: Tiếp tục lượt tải bị gián đoạn nếu Chrome còn khả năng nối tiếp dữ liệu.
- `chrome.downloads.download`: Tạo lượt tải mới từ URL gốc khi người dùng chọn Retry cho tệp bị lỗi không thể resume.
- `chrome.downloads.show`: Hiển thị vị trí tệp tin trong thư mục lưu trữ (File Explorer).
- `chrome.downloads.erase`: Xóa tệp tin khỏi lịch sử tải xuống.
- `chrome.downloads.showDefaultFolder`: Mở thư mục tải xuống mặc định của hệ điều hành.
- `chrome.downloads.setUiOptions`: Cấu hình tắt/bật bong bóng tải xuống mặc định của trình duyệt trên Chrome/Chromium hiện đại.
- `chrome.action.setIcon`: Thay đổi biểu tượng (icon) trên thanh công cụ động.
- `chrome.action.setBadgeText`: Cập nhật văn bản chỉ số badge (phần trăm).
- `chrome.runtime.onMessage.addListener`: Lắng nghe tin nhắn trao đổi dữ liệu giữa các thành phần, nhận dữ liệu tiến trình tải xuống event-driven và xử lý tín hiệu dọn badge hoàn tất mà không xóa nhầm badge phần trăm khi vẫn còn tệp đang tải.

---

## 8. Sơ đồ trực quan (Visual Diagrams)

### Sơ đồ 1: Luồng xử lý lấy và lọc lịch sử duyệt web (Flowchart)
```mermaid
graph TD
    A[Người dùng click Icon Lịch sử] --> B{Tab nào đang kích hoạt?}
    B -->|All| C[Gọi chrome.history.search]
    B -->|Recently Closed| D[Gọi chrome.sessions.getRecentlyClosed]
    
    C --> F[Nhận mảng Lịch sử từ Chrome]
    D --> G[Nhận mảng Phiên từ Chrome]
    
    F --> I[Nhóm dữ liệu theo ngày]
    I --> J[Tải Favicon qua Chrome API]
    J --> K[Hiển thị danh sách lên Pop-up]
    
    G --> K
```

### Sơ đồ 2: Trình tự cập nhật tiến trình tải xuống thời gian thực (Sequence Diagram)
```mermaid
sequenceDiagram
    autonumber
    actor User as Người dùng
    participant Chrome as Trình duyệt Chrome
    participant SW as Service Worker (Bg)
    participant Offscreen as Tài liệu ẩn (Offscreen)
    participant Pop as Pop-up Download
    participant Disk as Ổ đĩa máy tính

    User->>Chrome: Bắt đầu tải file
    Chrome->>SW: Kích hoạt sự kiện onCreated
    SW->>SW: Lưu ID vào sessionDownloadIds & bật hoạt ảnh Glow
    SW->>Chrome: Khởi tạo Offscreen Document
    loop Định kỳ polling mỗi 3 giây
        Offscreen->>SW: Gửi tin nhắn polling-tick
        SW->>Chrome: Gọi chrome.downloads.search in_progress
        Chrome->>SW: Trả về bytesReceived và totalBytes
        alt Byte tải xuống thật sự thay đổi
            SW->>Chrome: Cập nhật Badge % thực tế
            SW->>Pop: Gửi sync-all-progress để cập nhật DOM tại chỗ
        end
    end
    loop Khi trạng thái tệp thay đổi
        Chrome->>SW: Kích hoạt onChanged (state, filename, paused, error)
        SW->>SW: Cập nhật trạng thái quan trọng trong activeDownloads
    end
    Chrome->>Disk: Hoàn tất ghi file lên ổ đĩa
    Chrome->>SW: Kích hoạt onChanged (complete)
    SW->>Pop: Kích hoạt onChanged (critical) -> loadDownloads() vẽ lại DOM
    User->>Pop: Nhấp vào Open file
    Pop->>Chrome: Gọi chrome.downloads.open(id)
    Chrome->>User: Mở ứng dụng tương ứng chạy tệp
```

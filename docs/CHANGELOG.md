# Nhật ký thay đổi (CHANGELOG)

Tài liệu này ghi lại toàn bộ lịch sử các phiên bản phát hành và các cập nhật thay đổi của dự án.

---

### [v1.2.13] - 2026-06-07

#### - **[Thêm mới]**
- Khởi tạo tài liệu ẩn (Offscreen Document) qua [offscreen.html](file:///d:/CodePython/CustomeExtensionForChrome/EdgeDownloadsPopup/offscreen.html) và [offscreen.js](file:///d:/CodePython/CustomeExtensionForChrome/EdgeDownloadsPopup/offscreen.js) nhằm đảm bảo vòng lặp polling tiến độ chạy ngầm ổn định mà không bị dừng đột ngột.

#### - **[Sửa lỗi]**
- Khắc phục hoàn toàn lỗi mất hiển thị phần trăm (%) tiến trình tải xuống trên biểu tượng tiện ích (badge) khi Service Worker ngủ đông:
  - Loại bỏ cơ chế polling không hoạt động bằng `setInterval` trực tiếp trong Service Worker [background.js](file:///d:/CodePython/CustomeExtensionForChrome/EdgeDownloadsPopup/background.js).
  - Sử dụng cơ chế gọi `ensureOffscreenDocument()` và `closeOffscreenDocument()` để tự động kích hoạt tài liệu ẩn khi có lượt tải và đóng lại ngay khi hoàn thành để tiết kiệm năng lượng.
  - Nhận tin nhắn `'polling-tick'` (nhịp tim) định kỳ từ Offscreen Document để đánh thức Service Worker, giúp Service Worker tự truy vấn dữ liệu tiến độ thực tế và cập nhật chỉ số phần trăm chính xác trên badge của thanh công cụ.
  - Bổ sung cơ chế polling trực tiếp tại chỗ (in-place) mỗi 1 giây trong [popup.js](file:///d:/CodePython/CustomeExtensionForChrome/EdgeDownloadsPopup/popup.js), trực tiếp thay đổi thanh tiến trình (`width`) và nhãn phần trăm hiển thị của các thẻ `li` đang tải mà không cần vẽ lại toàn bộ danh sách, đem lại trải nghiệm mượt mà không bị chớp nháy.
- Khắc phục lỗi `Uncaught (in promise) Error: Download file already deleted` khi mở tệp đã bị xóa khỏi đĩa cứng:
  - Bọc tất cả các cuộc gọi `chrome.downloads.open()` trong [background.js](file:///d:/CodePython/CustomeExtensionForChrome/EdgeDownloadsPopup/background.js) và [popup.js](file:///d:/CodePython/CustomeExtensionForChrome/EdgeDownloadsPopup/popup.js) vào khối `.catch()` để bắt và xử lý các trường hợp ngoại lệ một cách êm đẹp (chỉ ghi log cảnh báo chứ không gây crash hoặc quăng lỗi không được kiểm soát).

- Tối ưu hóa hiệu năng và giảm tải CPU trong suốt quá trình tải xuống:
  - Giảm tần suất nhịp tim trong [offscreen.js](file:///d:/CodePython/CustomeExtensionForChrome/EdgeDownloadsPopup/offscreen.js) và polling cập nhật giao diện trong [popup.js](file:///d:/CodePython/CustomeExtensionForChrome/EdgeDownloadsPopup/popup.js) từ 1 giây thành 2 giây (2000ms), giúp giảm một nửa (50%) số lượng lời gọi API và cập nhật DOM.
  - Tăng khoảng thời gian hoạt ảnh nhấp nháy phát sáng biểu tượng tiện ích từ 800ms lên 1.5 giây (1500ms) trong [background.js](file:///d:/CodePython/CustomeExtensionForChrome/EdgeDownloadsPopup/background.js) giúp icon chuyển đổi chậm rãi tinh tế hơn, đồng thời hạn chế tối đa việc trình duyệt liên tục nạp lại file ảnh giúp tiết kiệm CPU đáng kể.

#### - **[Cập nhật]**
- Cấu hình quyền `"offscreen"` trong tệp [manifest.json (Downloads)](file:///d:/CodePython/CustomeExtensionForChrome/EdgeDownloadsPopup/manifest.json).
- Tích hợp thuộc tính `"incognito": "split"` vào cả hai tiện ích [manifest.json (Downloads)](file:///d:/CodePython/CustomeExtensionForChrome/EdgeDownloadsPopup/manifest.json) và [manifest.json (History)](file:///d:/CodePython/CustomeExtensionForChrome/EdgeHistoryPopup/manifest.json) nhằm phân tách hoàn toàn quy trình xử lý, bộ nhớ đệm và dữ liệu tải xuống/lịch sử giữa phiên duyệt web thường và phiên duyệt web ẩn danh, tối ưu tính bảo mật dữ liệu và mang lại trải nghiệm độc lập mượt mà.
- Đồng bộ nâng phiên bản của cả hai tiện ích mở rộng lên `1.2.13` tại các tệp `manifest.json`.

### [v1.2.12] - 2026-06-07

#### - **[Sửa lỗi]**
- Bổ sung cơ chế tự bảo vệ và ghi nhật ký gỡ lỗi (defensive check and debug logs):
  - Thêm kiểm tra an toàn `if (!item) return;` vào đầu hàm xử lý thay đổi tệp tin `handleDelta()` trong [background.js](file:///d:/CodePython/CustomeExtensionForChrome/EdgeDownloadsPopup/background.js) nhằm ngăn chặn triệt để nguy cơ Service Worker bị sập (crash) do các lỗi bất đồng bộ khi cập nhật các tệp tin đã hoàn thành hoặc bị xóa.
  - Bổ sung các lệnh `console.log` chi tiết tại các sự kiện `handleDelta` và `updateBadgeAndAnimation` để dễ dàng theo dõi và gỡ lỗi hiển thị phần trăm badge khi cần thiết.

#### - **[Cập nhật]**
- Đồng bộ nâng phiên bản của cả hai tiện ích mở rộng lên `1.2.12` tại các tệp `manifest.json`.

---

### [v1.2.11] - 2026-06-07

#### - **[Sửa lỗi]**
- Khắc phục lỗi hiển thị phần trăm và hoạt ảnh tải xuống khi tải nhiều file đồng thời:
  - Đồng bộ hóa logic cập nhật badge phần trăm tải và kiểm soát trạng thái hoạt ảnh thông qua biến lưu trữ đồng bộ in-memory `activeDownloads` thay vì gọi API tìm kiếm không đồng bộ `chrome.downloads.search({ state: 'in_progress' })` vốn bị trễ nhịp cơ sở dữ liệu (race conditions).
  - Giúp loại bỏ hiện tượng khi 1 file tải xong thì phần trăm trên badge bị giật lùi về tiến trình của file còn lại hoặc bị mất hoạt ảnh nhấp nháy dù vẫn còn file đang tải.
  - Bổ sung theo dõi thuộc tính tạm dừng (`paused`) trực tiếp trong bộ nhớ `activeDownloads`.
  - Khởi tạo nạp danh sách các file đang tải từ trình duyệt ngay khi Service Worker khởi động, đưa thông tin vào `activeDownloads` và `sessionDownloadIds` để duy trì chính xác giao diện popup và biểu tượng thanh công cụ khi extension tải lại.

#### - **[Cập nhật]**
- Đồng bộ nâng phiên bản của cả hai tiện ích mở rộng lên `1.2.11` tại các tệp `manifest.json`.

---

### [v1.2.10] - 2026-06-07

#### - **[Sửa lỗi]**
- Khắc phục lỗi "Uncaught (in promise) Error: A listener indicated an asynchronous response...":
  - Loại bỏ hoàn toàn dòng `return true;` không cần thiết ở cuối trình lắng nghe tin nhắn `chrome.runtime.onMessage.addListener` trong [background.js](file:///d:/CodePython/CustomeExtensionForChrome/EdgeDownloadsPopup/background.js) do tất cả các phản hồi được thực hiện đồng bộ (synchronous) hoặc không yêu cầu phản hồi từ phía popup, tránh việc Chrome báo lỗi đóng kênh thông tin trước khi phản hồi.

#### - **[Cập nhật]**
- Đồng bộ nâng phiên bản của cả hai tiện ích mở rộng lên `1.2.10` tại các tệp `manifest.json`.

---

### [v1.2.9] - 2026-06-07

#### - **[Sửa lỗi]**
- Tối ưu hóa kích thước checkmark hoàn thành tải xuống:
  - Sử dụng Canvas vẽ động qua `OffscreenCanvas` trực tiếp trong Service Worker để tạo badge checkmark nhỏ gọn, sắc nét chuẩn Fluent ở mọi kích cỡ (16x16, 32x32, 48x48), loại bỏ hoàn toàn vấn đề ký tự Unicode `✔` bị Windows tự động kết xuất thành emoji màu tím quá to và lệch vị trí.
- Khắc phục cơ chế xóa tệp không cần tải lại toàn bộ danh sách:
  - Cập nhật logic trong [popup.js](file:///d:/CodePython/CustomeExtensionForChrome/EdgeDownloadsPopup/popup.js): khi xóa tệp thành công, trạng thái được thay đổi trực tiếp trên đối tượng `item` và cập nhật hàng tương ứng trong danh sách bằng phương thức DOM `replaceWith()` thay vì gọi trực tiếp hàm `loadDownloads()`.

#### - **[Cập nhật]**
- Tăng cường khả năng ẩn UI tải xuống mặc định của Chrome bằng cách đăng ký gọi `chrome.downloads.setUiOptions({ enabled: false })` trong các sự kiện vòng đời `chrome.runtime.onInstalled`, `chrome.runtime.onStartup` và cả sự kiện `chrome.downloads.onChanged`.
- Nâng cấp đồng bộ phiên bản của cả hai tiện ích mở rộng lên `1.2.9` tại các tệp cấu hình `manifest.json`.

---

### [v1.2.8] - 2026-06-07

#### - **[Sửa lỗi]**
- Khắc phục lỗi màu sắc hai biểu tượng tiện ích mở rộng bị tối màu trở lại trên thanh công cụ:
  - Do tệp hình ảnh gốc do người dùng cung cấp (`arrow_download_filled_icon_201617.png` và `history_filled_icon_202154.png`) ban đầu có màu xám tối. Khi script cắt lề chạy, nó đã giữ nguyên màu sắc gốc này.
  - Cập nhật quy trình xử lý ảnh: Bổ sung bộ lọc bắt buộc chuyển đổi màu sắc toàn bộ điểm ảnh của biểu tượng sang màu trắng sáng tinh khiết (`#ffffff`) trước khi xuất ra các kích cỡ PNG tiêu chuẩn.
  - Giúp các biểu tượng luôn luôn sáng rõ, dễ nhìn và nổi bật trên cả thanh công cụ giao diện tối và sáng của trình duyệt.

#### - **[Cập nhật]**
- Đồng bộ nâng phiên bản của cả hai tiện ích mở rộng lên phiên bản mới `1.2.8`.

---

### [v1.2.7] - 2026-06-07

#### - **[Thêm mới]**
- Bổ sung cơ chế Port Connection (`chrome.runtime.connect`) giữa popup và Service Worker:
  - Cho phép Service Worker nhận diện chính xác thời điểm cửa sổ popup đang mở.
  - Khi tệp tin tải xong, nếu người dùng vẫn đang mở xem popup trực tiếp thì **không hiển thị Badge checkmark hoàn thành** nữa để tránh gây rối mắt không cần thiết.

#### - **[Cập nhật]**
- Tinh chỉnh biểu tượng hoàn thành (checkmark) nổi bật và sáng rõ hơn:
  - Đổi màu nền của Badge sang màu xanh lá cây sáng rực Fluent (`#10c15c`).
  - Thay đổi ký tự dấu tích sang dạng đậm nét (`✔` - Heavy Check Mark) để nâng cao độ tương phản và dễ nhận biết trên thanh công cụ.
- Phóng to kích thước hiển thị của biểu tượng thanh công cụ (Toolbar Icons):
  - Viết script PowerShell tự động phát hiện và cắt bỏ hoàn toàn các phần viền lề trong suốt (transparent border padding) thừa thãi của các tệp PNG gốc (`arrow_download_filled_icon_201617.png` và `history_filled_icon_202154.png`).
  - Xuất bản lại 4 kích cỡ icon PNG tiêu chuẩn (16, 32, 48, 128) căng đầy khung hình 100%, giúp hai biểu tượng Lịch sử và Tải xuống to rõ ràng và khớp kích thước các biểu tượng hệ thống của Google.
  - Đồng bộ tái tạo bộ ảnh biểu tượng nhấp nháy phát sáng (`icon_glow*.png`) từ tệp PNG gốc đã được cắt lề và đổi màu để đảm bảo hoạt ảnh chuyển động khi tải xuống mượt mà tuyệt đối, không bị giật hay nhảy lệch khung hình.

#### - **[Cập nhật]**
- Đồng bộ nâng phiên bản của cả hai tiện ích mở rộng lên phiên bản mới `1.2.7`.

---

### [v1.2.6] - 2026-06-07

#### - **[Thêm mới]**
- Tích hợp Badge hoàn thành (Completion Badge) kiểu Microsoft Edge:
  - Khi một tệp tin tải xong và không còn tác vụ tải nào khác đang chạy, Badge trên biểu tượng thanh công cụ sẽ tự động chuyển sang màu xanh lá cây (`#21a366`) và hiển thị biểu tượng checkmark (`✓`).
  - Gửi tin nhắn `clear-complete-badge` từ [popup.js](file:///d:/CodePython/CustomeExtensionForChrome/EdgeDownloadsPopup/popup.js) khi người dùng mở popup để tự động xóa đi Badge hoàn thành này, giống như cách Edge xử lý.

#### - **[Sửa lỗi]**
- Khắc phục lỗi card Toast của Content Script bị kẹt ở `0%` khi mở popup:
  - Cải tiến hàm truy vấn tab `broadcastProgressToActiveTab` trong [background.js](file:///d:/CodePython/CustomeExtensionForChrome/EdgeDownloadsPopup/background.js) sử dụng thuộc tính `lastFocusedWindow: true` thay vì `currentWindow: true` để tránh nhầm lẫn cửa sổ popup đang mở là cửa sổ trình duyệt chính.
- Khắc phục việc bong bóng tải mặc định (Download Bubble) của Google Chrome hiển thị lại:
  - Gọi bổ sung hàm `chrome.downloads.setUiOptions({ enabled: false })` ngay trong sự kiện `chrome.downloads.onCreated` tại [background.js](file:///d:/CodePython/CustomeExtensionForChrome/EdgeDownloadsPopup/background.js) để gia cố việc chặn giao diện tải xuống gốc trên mọi trang web.

#### - **[Cập nhật]**
- Đồng bộ nâng phiên bản của cả hai tiện ích mở rộng lên phiên bản mới `1.2.6`.

---

### [v1.2.5] - 2026-06-07

#### - **[Sửa lỗi]**
- Khắc phục triệt để lỗi kẹt hiển thị chỉ số `0%` trên Badge thanh công cụ khi tệp tải thực tế đang tiến triển bình thường:
  - Viết lại thuật toán tính toán Badge trong [background.js](file:///d:/CodePython/CustomeExtensionForChrome/EdgeDownloadsPopup/background.js) để loại bỏ các tệp tải chưa bắt đầu nhận dữ liệu (`bytesReceived === 0`).
  - Tránh các tệp tin đang chờ máy chủ phản hồi (pending), bị nghẽn (stalled), hoặc đang chờ người dùng xác nhận cảnh báo bảo mật (unconfirmed download danger) kéo tụt chỉ số phần trăm của tệp đang tải thật xuống `0%`.

#### - **[Cập nhật]**
- Đồng bộ nâng phiên bản của cả hai tiện ích mở rộng lên phiên bản mới `1.2.5`.

---

### [v1.2.4] - 2026-06-07

#### - **[Sửa lỗi]**
- Khắc phục lỗi giao diện popup bị kéo dài quá mức khi chỉ có ít tệp tin hiển thị:
  - Thay đổi thuộc tính chiều cao của `body` từ cố định (`height: 550px`) sang chiều cao tối đa (`max-height: 550px`) trong [popup.css](file:///d:/CodePython/CustomeExtensionForChrome/EdgeDownloadsPopup/popup.css).
  - Giúp cửa sổ popup tự động co giãn mượt mà bao bọc vừa vặn với nội dung hiển thị thực tế (ví dụ khi chỉ có 1 tệp đang tải và nút "See more" chân trang), loại bỏ hoàn toàn khoảng trống đen thừa thãi bên dưới.
  - Vẫn đảm bảo khả năng giới hạn chiều cao tối đa và kích hoạt thanh cuộn dọc cuộn nội dung khi danh sách tệp tin vượt quá 550px.

#### - **[Cập nhật]**
- Đồng bộ nâng phiên bản của cả hai tiện ích mở rộng lên phiên bản mới `1.2.4`.

---

### [v1.2.3] - 2026-06-07

#### - **[Thêm mới]**
- Tích hợp tính năng hiển thị danh sách tải xuống thu gọn và nút "See more" chuẩn Microsoft Edge:
  - Nếu chưa có hoạt động tải xuống nào trong phiên làm việc hiện tại (session), danh sách sẽ hiển thị đầy đủ toàn bộ lịch sử tải xuống (dài xuống).
  - Khi có tệp đang tải hoặc đã tải trong phiên hiện tại, giao diện tự động chuyển sang chế độ thu gọn: chỉ hiển thị các tệp của phiên hiện hành và bổ sung nút **"See more"** phong cách Fluent UI ở chân trang.
  - Click vào nút **"See more"** sẽ mở rộng danh sách hiển thị đầy đủ lịch sử và ẩn nút chân trang đi.
  - Các lượt mở popup tiếp theo trong cùng phiên làm việc sẽ mặc định hiển thị danh sách thu gọn để tối ưu hóa không gian hiển thị.
  - Sử dụng giao tiếp tin nhắn `chrome.runtime.sendMessage` lấy mã định danh tải xuống phiên (`sessionDownloadIds`) từ Service Worker để quản lý trạng thái hiển thị nhất quán.

#### - **[Sửa lỗi]**
- Khắc phục hoàn toàn lỗi hiển thị sai phần trăm (%) trên Badge biểu tượng thanh công cụ:
  - Tiến hành lọc bỏ các tệp tải xuống đang ở trạng thái tạm dừng (`item.paused === true`) ra khỏi công thức tính toán phần trăm tổng thể.
  - Sửa lỗi kẹt số phần trăm (như hiển thị `1%` khi tệp thực tế đang tải đã đạt `63%` do bị kéo tụt bởi một tệp lớn khác đang bị tạm dừng từ trước trong lịch sử của người dùng).
- Chuyển đổi giao diện popup sang layout Flexbox động (`display: flex; flex-direction: column`):
  - Loại bỏ các giới hạn chiều cao tĩnh (`max-height`) để phần danh sách tệp tự động giãn nở tối đa chiếm phần không gian trống và xuất hiện thanh cuộn mượt mà ở giữa Header và Footer chân trang.

#### - **[Cập nhật]**
- Đồng bộ nâng phiên bản của cả hai tiện ích mở rộng lên phiên bản mới `1.2.3`.

---

### [v1.2.2] - 2026-06-07

#### - **[Thêm mới]**
- Tự động hiển thị popup danh sách tải xuống khi bắt đầu tải:
  - Gọi hàm `chrome.action.openPopup()` trong sự kiện `chrome.downloads.onCreated` tại [background.js](file:///d:/CodePython/CustomeExtensionForChrome/EdgeDownloadsPopup/background.js) để kích hoạt hiển thị trình đơn tải xuống của tiện ích mở rộng ngay lập tức khi người dùng bắt đầu tải một tệp tin mới.

#### - **[Sửa lỗi]**
- Khắc phục lỗi hiển thị sai số phần trăm trên Badge biểu tượng thanh công cụ:
  - Chuyển đổi phương thức tính toán từ sử dụng bộ nhớ cache tạm thời sang truy vấn trực tiếp nguồn dữ liệu thực tế của trình duyệt thông qua API `chrome.downloads.search({ state: 'in_progress' })`.
  - Giải quyết triệt để tình trạng Badge hiển thị sai tỷ lệ (như bị kẹt ở `0%` trong khi tiến trình tải thực tế đã đạt phần trăm cao hơn).
- Tự động khôi phục trạng thái khi Service Worker thức dậy:
  - Tự động chạy quét các tác vụ tải xuống hiện hành ngay khi khởi động tiện ích để khôi phục đúng hoạt ảnh biểu tượng nhấp nháy phát sáng và Badge tiến độ.

#### - **[Cập nhật]**
- Đồng bộ nâng phiên bản của cả hai tiện ích mở rộng lên phiên bản vá lỗi mới `1.2.2`.

---

### [v1.2.1] - 2026-06-07

#### - **[Thêm mới]**
- Tích hợp cấu hình chặn bong bóng tải xuống mặc định của trình duyệt:
  - Bổ sung quyền `"downloads.ui"` trong tệp [manifest.json của EdgeDownloadsPopup](file:///d:/CodePython/CustomeExtensionForChrome/EdgeDownloadsPopup/manifest.json).
  - Khởi chạy hàm `chrome.downloads.setUiOptions({ enabled: false })` trong [background.js](file:///d:/CodePython/CustomeExtensionForChrome/EdgeDownloadsPopup/background.js) khi tiện ích khởi động để vô hiệu hóa hoàn toàn bong bóng tải gốc (Download Bubble) của Chrome.
  - Điều này giúp icon tải xuống gốc của Chrome đứng yên, không hiện lên và không nhấp nháy, nhường toàn bộ giao diện thông báo và hoạt ảnh tải xuống Fluent Toast cho tiện ích của chúng ta.
- **[Cập nhật]**
  - Đồng bộ nâng phiên bản của cả hai tiện ích mở rộng lên phiên bản vá lỗi mới `1.2.1`.

---

### [v1.2.0] - 2026-06-07

#### - **[Thêm mới]**
- Tích hợp tính năng hoạt ảnh tải xuống custom (Custom Download Animation) phong cách Edge Fluent Toast:
  - Tạo tệp Content Script [content.js](file:///d:/CodePython/CustomeExtensionForChrome/EdgeDownloadsPopup/content.js) bọc giao diện thông báo bằng cơ chế Shadow DOM để tránh xung đột phong cách CSS với các trang web mẹ.
  - Vẽ card thông báo Toast Acrylic Fluent góc trên bên phải trang web hiện tại với các thông tin: tên file, tiến trình hình tròn xoay động (Circular Progress Ring), tỷ lệ phần trăm và dung lượng đã tải.
  - Tích hợp hiệu ứng hoạt ảnh hạt màu bay tỏa (particle burst explosion) khi tệp tải xuống hoàn tất 100%.
  - Tạo tệp Service Worker [background.js](file:///d:/CodePython/CustomeExtensionForChrome/EdgeDownloadsPopup/background.js) lắng nghe sự kiện `chrome.downloads` toàn cục để cập nhật tiến trình tải xuống và bắn tin nhắn đồng bộ tiến trình tới tab hiện đang active.
  - Hỗ trợ đổi tab mượt mà (Multi-tab Sync): Tự động lắng nghe sự kiện đổi tab (`chrome.tabs.onActivated`) để chuyển và tiếp tục vẽ hoạt ảnh tiến trình tải xuống trên tab mới mà không bị gián đoạn.
  - Triển khai hoạt ảnh nhấp nháy phát sáng (Glow Flashing Animation) trên thanh công cụ của trình duyệt bằng cách thay thế tuần hoàn giữa icon trắng tiêu chuẩn và icon xanh Fluent (`icon_glow*.png`) mỗi 800ms khi tệp đang tải, kết hợp hiển thị số phần trăm tiến trình trực tiếp trên Badge.
  - Cho phép click nút "Open" trên card toast để mở trực tiếp tệp tin đã tải thông qua gửi message gọi `chrome.downloads.open`.
- **[Cập nhật]**
  - Cấu hình lại [EdgeDownloadsPopup/manifest.json](file:///d:/CodePython/CustomeExtensionForChrome/EdgeDownloadsPopup/manifest.json) đăng ký background script, content script và quyền `activeTab`.
  - Đồng bộ nâng phiên bản của cả hai tiện ích mở rộng lên phiên bản Minor mới `1.2.0`.

---

### [v1.1.5] - 2026-06-07

#### - **[Sửa lỗi]**
- Khắc phục lỗi biểu tượng hiển thị quá nhỏ trên thanh công cụ so với các tiện ích của Google:
  - Bản chất là do khi mở trực tiếp file SVG để chụp ảnh màn hình bằng Chrome Headless, trình duyệt áp dụng lề (`margin: 8px`) mặc định của thẻ `body` khiến vùng vẽ SVG bị co cụm thu nhỏ lại, tạo nhiều khoảng trống trong suốt thừa thãi xung quanh biểu tượng.
  - Giải quyết bằng cách tạo trình bao HTML tạm thời với thuộc tính CSS loại bỏ lề (`margin: 0`), đệm (`padding: 0`), ẩn thanh cuộn (`overflow: hidden`) và thiết lập kích thước SVG lấp đầy 100% viewport trước khi chụp ảnh màn hình.
  - Kết xuất lại 4 kích cỡ PNG trong suốt của biểu tượng trắng sáng, đảm bảo biểu tượng căng đầy khung hình và có kích thước hiển thị lớn tương đương 100% các biểu tượng của Google.
  - Đồng bộ nâng phiên bản của cả hai tiện ích lên `1.1.5` tại các tệp `manifest.json`.

---

### [v1.1.4] - 2026-06-07

#### - **[Cập nhật]**
- Chuyển màu sắc các biểu tượng tiện ích mở rộng sang màu sáng/trắng (giống Google/Edge gốc) để hiển thị nổi bật và rõ nét trên cả thanh công cụ (toolbar) chủ đề tối và sáng của trình duyệt:
  - Khôi phục tệp thiết kế vector gốc `icon.svg` của cả `EdgeHistoryPopup` và `EdgeDownloadsPopup`.
  - Thay đổi màu sắc đường nét và mảng tô (`fill`) trong file `icon.svg` từ màu tối (`#212121`) sang màu trắng sáng (`#ffffff`).
  - Dùng Chrome Headless kết xuất lại hoàn toàn 4 kích cỡ ảnh biểu tượng PNG trong suốt tiêu chuẩn (`icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`) từ file SVG đã chuyển màu trắng.
  - Đồng bộ nâng phiên bản của cả hai tiện ích lên `1.1.4` tại các tệp `manifest.json`.

---

### [v1.1.3] - 2026-06-07

#### - **[Cập nhật]**
- Cập nhật tài nguyên hình ảnh biểu tượng gốc (PNG) chất lượng cao do người dùng cung cấp trực tiếp:
  - Sử dụng biểu tượng tải xuống Fluent chính thức [arrow_download_filled_icon_201617.png](file:///d:/CodePython/CustomeExtensionForChrome/arrow_download_filled_icon_201617.png) và biểu tượng lịch sử Fluent chính thức [history_filled_icon_202154.png](file:///d:/CodePython/CustomeExtensionForChrome/history_filled_icon_202154.png).
  - Sử dụng script PowerShell (`resize.ps1`) gọi thư viện đồ họa .NET để thực hiện nén và thu nhỏ ảnh PNG gốc từ độ phân giải 512x512 thành 4 kích cỡ tiêu chuẩn `16x16`, `32x32`, `48x48`, và `128x128` có độ trong suốt và sắc nét tuyệt đối.
  - Đồng bộ nâng phiên bản của cả hai tiện ích lên `1.1.3` tại các tệp `manifest.json`.

---

### [v1.1.2] - 2026-06-07

#### - **[Sửa lỗi]**
- Khắc phục lỗi không nạp được tiện ích `"Could not load icon 'icon.png' specified in 'icons'"` trên Chrome/Edge do kích thước file ảnh không khớp cấu hình:
  - Phân tách và tạo ra 4 kích cỡ biểu tượng PNG trong suốt tiêu chuẩn: 16x16 (`icon16.png`), 32x32 (`icon32.png`), 48x48 (`icon48.png`), và 128x128 (`icon128.png`) cho cả hai tiện ích.
  - Sử dụng Chrome Headless kết xuất trực tiếp các kích cỡ này từ tệp biểu tượng Fluent SVG gốc.
  - Loại bỏ tệp biểu tượng dùng chung `icon.png` không chuẩn.
- **[Cập nhật]**
  - Cập nhật cấu hình `action.default_icon` và `icons` trong `manifest.json` của cả `EdgeHistoryPopup` và `EdgeDownloadsPopup` sang dạng đối tượng ánh xạ riêng từng tệp ảnh PNG với kích cỡ tương ứng (học tập từ dự án tham chiếu `QRScan`).
  - Đồng bộ nâng phiên bản của cả hai tiện ích lên `1.1.2` tại các tệp `manifest.json`.

---

### [v1.1.1] - 2026-06-07

#### - **[Sửa lỗi]**
- Khắc phục triệt để lỗi "Could not load icon 'icon.png' specified in 'icons'" khi nạp tiện ích:
  - Bản chất là do tiến trình chạy Chrome Headless ở phiên trước diễn ra không đồng bộ (asynchronous) dẫn đến tiến trình bị tắt trước khi kịp ghi file ảnh `icon.png` ra đĩa cứng.
  - Sửa đổi lệnh render sử dụng cơ chế gọi `Start-Process -Wait` để bắt buộc tiến trình Chrome Headless hoàn tất việc ghi tệp PNG ra đĩa cứng 100% rồi mới kết thúc lệnh.
  - Tạo thành công các tệp `icon.png` sắc nét với kích thước chuẩn 128x128 cho cả hai thư mục tiện ích.
- Đồng bộ nâng phiên bản của cả hai tiện ích lên `1.1.1` tại các tệp `manifest.json`.

---

### [v1.1.0] - 2026-06-07

#### - **[Sửa lỗi]**
- Khắc phục lỗi không hiển thị icon tiện ích trên trang quản lý mở rộng (`chrome://extensions/`) và thanh công cụ:
  - Bản chất là do Chrome chưa hỗ trợ tệp định dạng vector SVG cho trường `icons` toàn cục trong `manifest.json`.
  - Tiến hành viết script render tự động vẽ các tệp biểu tượng SVG gốc sang định dạng PNG trong suốt (`icon.png`) chất lượng cao (128x128) bằng nhân trình duyệt Chrome Headless.
  - Cập nhật cấu hình `manifest.json` của cả `EdgeHistoryPopup` và `EdgeDownloadsPopup` trỏ trường `default_icon` và `icons` sang tệp ảnh PNG mới tạo để tương thích hoàn hảo.
- Đồng bộ nâng phiên bản của cả hai tiện ích lên `1.1.0` tại các tệp `manifest.json`.

---

### [v1.0.9] - 2026-06-07

#### - **[Cập nhật]**
- Cập nhật biểu tượng chính thức cho tiện ích:
  - Thay thế biểu tượng cũ của `EdgeHistoryPopup` bằng tệp [history_filled_icon_202154.svg](file:///d:/CodePython/CustomeExtensionForChrome/EdgeHistoryPopup/icon.svg) định dạng Filled chuẩn Microsoft Fluent.
  - Thay thế biểu tượng cũ của `EdgeDownloadsPopup` bằng tệp [arrow_download_filled_icon_201617.svg](file:///d:/CodePython/CustomeExtensionForChrome/EdgeDownloadsPopup/icon.svg) định dạng Filled chuẩn Microsoft Fluent.
- Đồng bộ nâng phiên bản của cả hai tiện ích lên `1.0.9` tại các tệp `manifest.json`.

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

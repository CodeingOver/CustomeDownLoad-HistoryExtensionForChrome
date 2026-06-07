let activeDownloads = {};
let sessionDownloadIds = new Set();
let wasDownloading = false;
let isPopupOpen = false;
let animationInterval = null;
let isGlowState = false;
let isCompleteState = false;

// Theo dõi trạng thái đóng/mở của cửa sổ popup bằng cơ chế Port Connection
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    isPopupOpen = true;
    port.onDisconnect.addListener(() => {
      isPopupOpen = false;
    });
  }
});

// Initialize action badge style
chrome.action.setBadgeBackgroundColor({ color: '#0078d4' });

// Disable native Chrome download shelf / bubble UI
if (chrome.downloads.setUiOptions) {
  chrome.downloads.setUiOptions({ enabled: false });
}

// Listen for new downloads
chrome.downloads.onCreated.addListener((item) => {
  // Đảm bảo vô hiệu hóa bong bóng tải mặc định của Chrome
  if (chrome.downloads.setUiOptions) {
    chrome.downloads.setUiOptions({ enabled: false });
  }

  sessionDownloadIds.add(item.id);
  activeDownloads[item.id] = {
    id: item.id,
    filename: getBasename(item.filename),
    totalBytes: item.totalBytes || 0,
    bytesReceived: item.bytesReceived || 0,
    state: item.state || 'in_progress',
    error: item.error || null
  };
  
  // Tự động hiển thị popup khi bắt đầu tải xuống
  chrome.action.openPopup().catch((err) => {
    console.warn("Could not open popup automatically:", err);
  });

  updateBadgeAndAnimation();
  broadcastProgress();
});

// Listen for changes in downloads
chrome.downloads.onChanged.addListener((delta) => {
  // Đảm bảo vô hiệu hóa bong bóng tải mặc định của Chrome trong suốt tiến trình thay đổi
  if (chrome.downloads.setUiOptions) {
    chrome.downloads.setUiOptions({ enabled: false });
  }
  sessionDownloadIds.add(delta.id);
  const id = delta.id;
  if (!activeDownloads[id]) {
    // If we missed onCreated, fetch the complete item
    chrome.downloads.search({ id: id }, (items) => {
      if (items && items[0]) {
        const item = items[0];
        activeDownloads[id] = {
          id: item.id,
          filename: getBasename(item.filename),
          totalBytes: item.totalBytes,
          bytesReceived: item.bytesReceived,
          state: item.state,
          error: item.error
        };
        handleDelta(id, delta);
      }
    });
  } else {
    handleDelta(id, delta);
  }
});

// Helper to process changed event
function handleDelta(id, delta) {
  const item = activeDownloads[id];
  
  if (delta.state) {
    item.state = delta.state.current;
  }
  if (delta.error) {
    item.error = delta.error.current;
  }
  if (delta.bytesReceived) {
    item.bytesReceived = delta.bytesReceived.current;
  }
  if (delta.totalBytes) {
    item.totalBytes = delta.totalBytes.current;
  } else if (delta.filename) {
    item.filename = getBasename(delta.filename.current);
  }

  // Handle completion or failure
  if (item.state === 'complete' || item.state === 'interrupted') {
    broadcastProgressToActiveTab(item, 'download-complete');
    delete activeDownloads[id];
  } else {
    broadcastProgressToActiveTab(item, 'download-progress');
  }

  updateBadgeAndAnimation();
}

// Cập nhật badge tiến độ tải xuống và hiệu ứng nhấp nháy từ dữ liệu gốc của trình duyệt
/********************************************************************************
 * SỬA ĐỔI CHÍNH: Thay đổi checkmark Unicode to bằng biểu tượng checkmark nhỏ gọn *
 * vẽ động bằng OffscreenCanvas để tối ưu hóa thiết kế.                          *
 ********************************************************************************/
function updateBadgeAndAnimation() {
  chrome.downloads.search({ state: 'in_progress' }, (items) => {
    // Lọc bằng sessionDownloadIds để chỉ tính toán tiến trình cho các tệp đang tải trong phiên hiện tại
    let activeItems = (items || []).filter(item => 
      !item.paused && sessionDownloadIds.has(item.id)
    );
    
    // Loại bỏ các tệp tin chưa bắt đầu nhận dữ liệu (bytesReceived === 0) 
    // để tránh các tệp bị nghẽn/chờ xác nhận kéo tụt chỉ số phần trăm của tệp đang chạy.
    const downloadingItems = activeItems.filter(item => item.bytesReceived > 0);
    if (downloadingItems.length > 0) {
      activeItems = downloadingItems;
    }

    if (activeItems.length === 0) {
      if (wasDownloading) {
        // Vừa tải xong: hiển thị Icon hoàn thành với checkmark (chỉ hiển thị nếu popup không mở)
        if (!isPopupOpen) {
          showCompletionBadge();
        } else {
          isCompleteState = false;
          stopAnimation();
        }
        wasDownloading = false;
      } else {
        // Kiểm tra để không xóa nhầm Icon checkmark đang hiển thị
        if (!isCompleteState) {
          chrome.action.setBadgeText({ text: '' });
          stopAnimation();
        }
      }
      clearProgressAnimation();
      return;
    }

    // Đang tải: đặt flag wasDownloading = true và reset trạng thái hoàn tất
    wasDownloading = true;
    isCompleteState = false;
    startAnimation();

    let totalBytes = 0;
    let bytesReceived = 0;
    let indeterminate = false;

    activeItems.forEach(item => {
      if (item.totalBytes > 0) {
        totalBytes += item.totalBytes;
        bytesReceived += item.bytesReceived;
      } else {
        indeterminate = true;
      }
    });

    // Reset màu nền Badge về màu xanh dương mặc định khi đang tải
    chrome.action.setBadgeBackgroundColor({ color: '#0078d4' });

    if (indeterminate || totalBytes === 0) {
      chrome.action.setBadgeText({ text: '...' });
    } else {
      const percent = Math.floor((bytesReceived / totalBytes) * 100);
      chrome.action.setBadgeText({ text: `${percent}%` });
    }
  });
}

// Vẽ biểu tượng hoàn thành với vòng tròn màu xanh lá và dấu checkmark trắng nhỏ sắc nét
async function drawCompleteIcon() {
  try {
    const sizes = [16, 32, 48];
    const imageDatas = {};

    for (const size of sizes) {
      const response = await fetch(chrome.runtime.getURL(`icon${size}.png`));
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);

      const canvas = new OffscreenCanvas(size, size);
      const ctx = canvas.getContext('2d');

      // Vẽ icon gốc
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();

      // Tính toán kích thước và vị trí của badge xanh lá cây
      // Phù hợp hoàn hảo với góc dưới bên phải
      const radius = size * 0.22; // Ví dụ: 3.5 cho 16, 7 cho 32, 10.5 cho 48
      const cx = size - radius - 1;
      const cy = size - radius - 1;

      // Vẽ hình tròn màu xanh lá (#10c15c)
      ctx.fillStyle = '#10c15c';
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      ctx.fill();

      // Vẽ dấu checkmark trắng mảnh
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = size >= 32 ? 1.5 : 1.0;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();

      // Tọa độ tương đối của checkmark dựa trên tâm cx, cy và radius
      const startX = cx - radius * 0.45;
      const startY = cy;
      const midX = cx - radius * 0.1;
      const midY = cy + radius * 0.35;
      const endX = cx + radius * 0.45;
      const endY = cy - radius * 0.25;

      ctx.moveTo(startX, startY);
      ctx.lineTo(midX, midY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      imageDatas[size] = ctx.getImageData(0, 0, size, size);
    }

    await chrome.action.setIcon({ imageData: imageDatas });
  } catch (err) {
    console.error("Lỗi khi vẽ biểu tượng hoàn thành:", err);
    // Phương án dự phòng: Sử dụng badge text chứa dấu checkmark nhạt ✓
    chrome.action.setBadgeBackgroundColor({ color: '#10c15c' });
    chrome.action.setBadgeText({ text: '✓' });
  }
}

// Hiển thị Badge checkmark xanh lá cây sáng nổi bật khi hoàn thành tải xuống
function showCompletionBadge() {
  isCompleteState = true;
  chrome.action.setBadgeText({ text: '' }); // Xóa badge text tiến trình cũ
  drawCompleteIcon();
}

// Khởi chạy hoạt ảnh biểu tượng nhấp nháy phát sáng (Glow)
function startAnimation() {
  if (animationInterval) return;
  
  animationInterval = setInterval(() => {
    isGlowState = !isGlowState;
    const path = isGlowState ? {
      "16": "icon_glow16.png",
      "32": "icon_glow32.png",
      "48": "icon_glow48.png"
    } : {
      "16": "icon16.png",
      "32": "icon32.png",
      "48": "icon48.png"
    };

    chrome.action.setIcon({ path: path }).catch(() => {});
  }, 800);
}

// Chỉ xóa bỏ interval hoạt ảnh tiến trình mà không ghi đè biểu tượng
function clearProgressAnimation() {
  if (animationInterval) {
    clearInterval(animationInterval);
    animationInterval = null;
  }
  isGlowState = false;
}

// Dừng hoạt ảnh nhấp nháy và khôi phục biểu tượng mặc định
function stopAnimation() {
  clearProgressAnimation();
  chrome.action.setIcon({
    path: {
      "16": "icon16.png",
      "32": "icon32.png",
      "48": "icon48.png"
    }
  }).catch(() => {});
}

// Broadcast progress of all active downloads
function broadcastProgress() {
  Object.keys(activeDownloads).forEach(id => {
    broadcastProgressToActiveTab(activeDownloads[id], 'download-progress');
  });
}

// Send progress detail to a specific tab
function sendProgressToTab(tabId, item, type = 'download-progress') {
  chrome.tabs.sendMessage(tabId, {
    type: type,
    detail: item
  }).catch(() => {}); // Ignore errors if tab doesn't have content script loaded
}

// Broadcast progress to the currently active tab (handling last focused window to avoid popup window conflict)
function broadcastProgressToActiveTab(item, type = 'download-progress') {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    if (tabs && tabs.length > 0 && tabs[0].id) {
      sendProgressToTab(tabs[0].id, item, type);
    } else {
      chrome.tabs.query({ active: true }, (tabs) => {
        if (tabs && tabs.length > 0 && tabs[0].id) {
          sendProgressToTab(tabs[0].id, item, type);
        }
      });
    }
  });
}

// Listen for tab switching to resume rendering on the newly active tab
chrome.tabs.onActivated.addListener((activeInfo) => {
  Object.keys(activeDownloads).forEach(id => {
    sendProgressToTab(activeInfo.tabId, activeDownloads[id], 'download-progress');
  });
});

// Listen for message from content script to open file
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'open-file') {
    chrome.downloads.open(request.id);
  } else if (request.action === 'get-session-downloads') {
    sendResponse({ sessionDownloadIds: Array.from(sessionDownloadIds) });
  } else if (request.action === 'clear-complete-badge') {
    isCompleteState = false;
    chrome.action.setBadgeText({ text: '' });
    stopAnimation(); // Khôi phục biểu tượng mặc định
  }
  return true;
});

// Helper to get file basename
function getBasename(path) {
  if (!path) return 'Unknown File';
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1];
}

// Đăng ký các sự kiện lifecycle của extension để ẩn download UI mặc định càng sớm càng tốt
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.downloads.setUiOptions) {
    chrome.downloads.setUiOptions({ enabled: false });
  }
});

chrome.runtime.onStartup.addListener(() => {
  if (chrome.downloads.setUiOptions) {
    chrome.downloads.setUiOptions({ enabled: false });
  }
});

// Đồng bộ trạng thái Badge và hoạt ảnh ngay khi Service Worker khởi động
updateBadgeAndAnimation();

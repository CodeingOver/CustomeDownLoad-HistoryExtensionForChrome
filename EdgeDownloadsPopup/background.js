let activeDownloads = {};
let sessionDownloadIds = new Set();
let wasDownloading = false;
let isPopupOpen = false;
let animationInterval = null;
let isGlowState = false;
let isCompleteState = false;
let progressInterval = null;
let completeIconImageDataCache = null; // Bộ đệm lưu trữ dữ liệu ảnh hoàn thành để tránh dựng lại Canvas liên tục
const serviceWorkerStartedAt = Date.now();
const STARTUP_AUTO_OPEN_GRACE_MS = 5000;
const RESTORED_DOWNLOAD_SKEW_MS = 2000;
let hasCompletedStartupDownloadScan = false;

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

disableNativeDownloadUi('service-worker-load');

// Listen for new downloads
chrome.downloads.onCreated.addListener((item) => {
  const shouldNotifyToast = shouldNotifyDownloadToast(item);

  sessionDownloadIds.add(item.id);
  activeDownloads[item.id] = {
    id: item.id,
    filename: getBasename(item.filename),
    totalBytes: item.totalBytes || 0,
    bytesReceived: item.bytesReceived || 0,
    state: item.state || 'in_progress',
    paused: item.paused || false,
    error: item.error || null,
    notifyToast: shouldNotifyToast
  };
  
  // Chỉ tự động hiển thị popup cho lượt tải mới, không mở khi Chrome khôi phục download cũ lúc startup.
  if (shouldAutoOpenPopupForCreatedDownload(item)) {
    chrome.action.openPopup().catch((err) => {
      console.warn("Could not open popup automatically:", err);
    });
  }

  updateBadgeAndAnimation();
  broadcastProgress();
});

function shouldAutoOpenPopupForCreatedDownload(item) {
  const startedAt = item.startTime ? Date.parse(item.startTime) : NaN;
  if (!Number.isNaN(startedAt) && startedAt < serviceWorkerStartedAt - RESTORED_DOWNLOAD_SKEW_MS) {
    return false;
  }

  if (!hasCompletedStartupDownloadScan && Date.now() - serviceWorkerStartedAt < STARTUP_AUTO_OPEN_GRACE_MS) {
    return false;
  }

  return true;
}

function shouldNotifyDownloadToast(item) {
  if (item.error === 'USER_CANCELED') {
    return false;
  }

  const startedAt = item.startTime ? Date.parse(item.startTime) : NaN;
  if (!Number.isNaN(startedAt) && startedAt < serviceWorkerStartedAt - RESTORED_DOWNLOAD_SKEW_MS) {
    return false;
  }

  return true;
}

function canBroadcastDownloadToast(item) {
  return item && item.notifyToast !== false && item.error !== 'USER_CANCELED';
}

function disableNativeDownloadUi(source) {
  try {
    if (chrome.downloads.setUiOptions) {
      const result = chrome.downloads.setUiOptions({ enabled: false });
      if (result && typeof result.catch === 'function') {
        result.catch((err) => {
          console.warn(`[background.js] Không thể tắt Download UI bằng setUiOptions (${source}):`, err.message);
          disableLegacyDownloadShelf(source);
        });
      }
      return;
    }

    disableLegacyDownloadShelf(source);
  } catch (err) {
    console.warn(`[background.js] Không thể tắt Download UI mặc định (${source}):`, err.message);
    disableLegacyDownloadShelf(source);
  }
}

function disableLegacyDownloadShelf(source) {
  if (!chrome.downloads.setShelfEnabled) {
    return;
  }

  try {
    chrome.downloads.setShelfEnabled(false);
    console.log(`[background.js] Đã tắt Download Shelf mặc định (${source}).`);
  } catch (err) {
    console.warn(`[background.js] Không thể tắt Download Shelf mặc định (${source}):`, err.message);
  }
}

// Listen for changes in downloads
chrome.downloads.onChanged.addListener((delta) => {
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
          paused: item.paused || false,
          error: item.error,
          notifyToast: shouldNotifyDownloadToast(item)
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
  if (!item) {
    console.warn(`[handleDelta] Không tìm thấy item với ID: ${id} trong activeDownloads.`);
    return;
  }
  
  const isStateChange = delta.state !== undefined;
  const isErrorChange = delta.error !== undefined;
  const isPausedChange = delta.paused !== undefined;
  const isFilenameChange = delta.filename !== undefined;
  const isCritical = isStateChange || isErrorChange || isPausedChange || isFilenameChange;
  
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
  if (delta.paused) {
    item.paused = delta.paused.current;
  }

  console.log(`[handleDelta] ID: ${id}, State: ${item.state}, Bytes: ${item.bytesReceived}/${item.totalBytes}, Critical: ${isCritical}`);

  // Handle completion or failure
  if (item.state === 'complete' || item.state === 'interrupted') {
    if (canBroadcastDownloadToast(item)) {
      broadcastProgressToActiveTab(item, 'download-complete');
    }
    delete activeDownloads[id];
    updateBadgeAndAnimation();
  } else {
    // Chỉ cập nhật tiến trình nếu là thay đổi trạng thái quan trọng hoặc đã trôi qua ít nhất 1000ms
    const now = Date.now();
    if (isCritical || !item.lastUpdateTime || (now - item.lastUpdateTime >= 1000)) {
      item.lastUpdateTime = now;
      if (canBroadcastDownloadToast(item)) {
        broadcastProgressToActiveTab(item, 'download-progress');
      }
      updateBadgeAndAnimation();
    }
  }
}

// Cập nhật badge tiến độ tải xuống và hiệu ứng nhấp nháy từ dữ liệu in-memory activeDownloads
/********************************************************************************
 * SỬA ĐỔI CHÍNH: Đồng bộ hoàn hảo việc tính toán Badge tiến độ và hoạt ảnh     *
 * thông qua biến lưu trữ đồng bộ activeDownloads thay vì truy vấn không đồng bộ*
 * của chrome.downloads.search, nhằm triệt tiêu lỗi hiển thị của nhiều tệp cùng lúc.*
 ********************************************************************************/
function updateBadgeAndAnimation() {
  console.log("[updateBadgeAndAnimation] Toàn bộ activeDownloads:", JSON.stringify(activeDownloads));
  
  // Lọc lấy danh sách các tệp đang tải thực sự từ activeDownloads bộ nhớ
  let activeItems = Object.values(activeDownloads).filter(item => 
    item.state === 'in_progress' && !item.paused
  );
  
  console.log("[updateBadgeAndAnimation] Danh sách activeItems (đang tải & không paused):", JSON.stringify(activeItems));
  
  // Loại bỏ các tệp tin chưa bắt đầu nhận dữ liệu (bytesReceived === 0) 
  // để tránh các tệp bị nghẽn/chờ xác nhận kéo tụt chỉ số phần trăm của tệp đang chạy.
  const downloadingItems = activeItems.filter(item => item.bytesReceived > 0);
  if (downloadingItems.length > 0) {
    activeItems = downloadingItems;
  }

  if (activeItems.length === 0) {
    console.log("[updateBadgeAndAnimation] Không có tệp nào đang tải (activeItems rỗng).");
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
    closeOffscreenDocument();
    return;
  }

  // Đang tải: đặt flag wasDownloading = true và reset trạng thái hoàn tất
  ensureOffscreenDocument();
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
    console.log("[updateBadgeAndAnimation] Đang tải ở chế độ không xác định (indeterminate).");
    chrome.action.setBadgeText({ text: '...' });
  } else {
    const percent = Math.floor((bytesReceived / totalBytes) * 100);
    console.log(`[updateBadgeAndAnimation] Đang tải: ${percent}% (Tổng: ${bytesReceived}/${totalBytes})`);
    chrome.action.setBadgeText({ text: `${percent}%` });
  }
}

let isCreatingOffscreen = false;

async function ensureOffscreenDocument() {
  if (isCreatingOffscreen) return;
  
  if (chrome.runtime.getContexts) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    if (contexts.length > 0) {
      chrome.runtime.sendMessage({ action: 'start-polling' }).catch(() => {});
      return;
    }
  }
  
  isCreatingOffscreen = true;
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['LOCAL_STORAGE'],
      justification: 'Keep service worker alive and poll download progress'
    });
    console.log("[background.js] Đã tạo thành công Offscreen Document.");
    chrome.runtime.sendMessage({ action: 'start-polling' }).catch(() => {});
  } catch (err) {
    console.error("[background.js] Lỗi khi tạo Offscreen Document:", err);
  } finally {
    isCreatingOffscreen = false;
  }
}

async function closeOffscreenDocument() {
  if (chrome.runtime.getContexts) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    if (contexts.length > 0) {
      try {
        await chrome.offscreen.closeDocument();
        console.log("[background.js] Đã đóng Offscreen Document.");
      } catch (err) {
        console.error("[background.js] Lỗi khi đóng Offscreen Document:", err);
      }
    }
  }
}

// Vẽ biểu tượng hoàn thành với vòng tròn màu xanh lá và dấu checkmark trắng nhỏ sắc nét
async function drawCompleteIcon() {
  try {
    if (completeIconImageDataCache) {
      await chrome.action.setIcon({ imageData: completeIconImageDataCache });
      return;
    }

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

    completeIconImageDataCache = imageDatas; // Lưu lại bộ đệm
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
  }, 1500);
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
    const item = activeDownloads[id];
    if (canBroadcastDownloadToast(item)) {
      broadcastProgressToActiveTab(item, 'download-progress');
    }
  });
}

// Send progress detail to extension views such as the popup
function sendProgressToPopup(item, type = 'download-progress') {
  chrome.runtime.sendMessage({
    type: type,
    detail: item
  }).catch(() => {});
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
  sendProgressToPopup(item, type);

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
    const item = activeDownloads[id];
    if (canBroadcastDownloadToast(item)) {
      sendProgressToTab(activeInfo.tabId, item, 'download-progress');
    }
  });
});

// Listen for message from content script to open file
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'open-file') {
    chrome.downloads.open(request.id).catch((err) => {
      console.warn("[background.js] Không thể mở tệp:", err.message);
    });
  } else if (request.action === 'get-session-downloads') {
    sendResponse({ sessionDownloadIds: Array.from(sessionDownloadIds) });
  } else if (request.action === 'clear-complete-badge') {
    isCompleteState = false;
    chrome.action.setBadgeText({ text: '' });
    stopAnimation(); // Khôi phục biểu tượng mặc định
  } else if (request.action === 'polling-tick') {
    chrome.downloads.search({ state: 'in_progress' }, (items) => {
      if (!items || items.length === 0) {
        closeOffscreenDocument();
        
        // Cập nhật lại activeDownloads của các tệp đã tải xong hoặc lỗi
        Object.keys(activeDownloads).forEach(id => {
          chrome.downloads.search({ id: parseInt(id) }, (details) => {
            if (details && details[0]) {
              const detail = details[0];
              if (detail.state === 'complete' || detail.state === 'interrupted') {
                delete activeDownloads[id];
              }
            } else {
              delete activeDownloads[id];
            }
            updateBadgeAndAnimation();
          });
        });
        return;
      }

      const updatedIds = new Set(items.map(item => item.id));

      // Thêm hoặc cập nhật các tệp đang tải vào activeDownloads
      items.forEach(item => {
        const currentItem = activeDownloads[item.id];
        const lastTime = currentItem ? currentItem.lastUpdateTime : null;
        const notifyToast = currentItem ? currentItem.notifyToast : shouldNotifyDownloadToast(item);
        activeDownloads[item.id] = {
          id: item.id,
          filename: getBasename(item.filename),
          totalBytes: item.totalBytes || 0,
          bytesReceived: item.bytesReceived || 0,
          state: item.state || 'in_progress',
          paused: item.paused || false,
          error: item.error || null,
          lastUpdateTime: lastTime,
          notifyToast: notifyToast
        };
        sessionDownloadIds.add(item.id);
      });

      // Dọn dẹp các tệp đã hoàn thành không còn trong danh sách gửi về
      Object.keys(activeDownloads).forEach(id => {
        const numericId = parseInt(id);
        if (!updatedIds.has(numericId)) {
          chrome.downloads.search({ id: numericId }, (details) => {
            if (details && details[0]) {
              const detail = details[0];
              if (detail.state === 'complete' || detail.state === 'interrupted') {
                delete activeDownloads[id];
              }
            } else {
              delete activeDownloads[id];
            }
            updateBadgeAndAnimation();
          });
        }
      });

      updateBadgeAndAnimation();
      broadcastProgress();
    });
  }
});

// Helper to get file basename
function getBasename(path) {
  if (!path) return 'Unknown File';
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1];
}

// Đăng ký các sự kiện lifecycle của extension để ẩn download UI mặc định càng sớm càng tốt
chrome.runtime.onInstalled.addListener(() => {
  disableNativeDownloadUi('runtime-installed');
});

chrome.runtime.onStartup.addListener(() => {
  disableNativeDownloadUi('runtime-startup');
});

// Khởi tạo activeDownloads từ các lượt tải đang chạy trong trình duyệt khi Service Worker khởi động
chrome.downloads.search({ state: 'in_progress' }, (items) => {
  if (items) {
    items.forEach(item => {
      activeDownloads[item.id] = {
        id: item.id,
        filename: getBasename(item.filename),
        totalBytes: item.totalBytes || 0,
        bytesReceived: item.bytesReceived || 0,
        state: item.state || 'in_progress',
        paused: item.paused || false,
        error: item.error || null,
        notifyToast: shouldNotifyDownloadToast(item)
      };
      sessionDownloadIds.add(item.id);
    });
  }
  updateBadgeAndAnimation();
  if (items && items.length > 0) {
    ensureOffscreenDocument();
  }
  hasCompletedStartupDownloadScan = true;
});

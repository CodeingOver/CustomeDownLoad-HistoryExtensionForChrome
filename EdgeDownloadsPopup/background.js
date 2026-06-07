let activeDownloads = {};
let sessionDownloadIds = new Set();
let animationInterval = null;
let isGlowState = false;

// Initialize action badge style
chrome.action.setBadgeBackgroundColor({ color: '#0078d4' });

// Disable native Chrome download shelf / bubble UI
if (chrome.downloads.setUiOptions) {
  chrome.downloads.setUiOptions({ enabled: false });
}

// Listen for new downloads
chrome.downloads.onCreated.addListener((item) => {
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
function updateBadgeAndAnimation() {
  chrome.downloads.search({ state: 'in_progress' }, (items) => {
    // Chỉ tính toán tiến trình cho các tệp đang thực sự tải (loại bỏ tệp tạm dừng)
    const activeItems = (items || []).filter(item => !item.paused);
    
    if (activeItems.length === 0) {
      chrome.action.setBadgeText({ text: '' });
      stopAnimation();
      return;
    }

    // Đang có tệp tải xuống: kích hoạt hoạt ảnh nhấp nháy
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

    if (indeterminate || totalBytes === 0) {
      chrome.action.setBadgeText({ text: '...' });
    } else {
      const percent = Math.floor((bytesReceived / totalBytes) * 100);
      chrome.action.setBadgeText({ text: `${percent}%` });
    }
  });
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

// Dừng hoạt ảnh nhấp nháy và khôi phục biểu tượng mặc định
function stopAnimation() {
  if (animationInterval) {
    clearInterval(animationInterval);
    animationInterval = null;
  }
  isGlowState = false;
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

// Broadcast progress to the currently active tab
function broadcastProgressToActiveTab(item, type = 'download-progress') {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs.length > 0 && tabs[0].id) {
      sendProgressToTab(tabs[0].id, item, type);
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
  }
  return true;
});

// Helper to get file basename
function getBasename(path) {
  if (!path) return 'Unknown File';
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1];
}

// Đồng bộ trạng thái Badge và hoạt ảnh ngay khi Service Worker khởi động
updateBadgeAndAnimation();

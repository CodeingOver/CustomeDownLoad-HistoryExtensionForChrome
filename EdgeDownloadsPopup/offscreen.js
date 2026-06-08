// Offscreen document script that drives lightweight progress polling while keeping the Service Worker alive.
const DEBUG = false;
let progressInterval = null;
const PROGRESS_POLL_INTERVAL_MS = 3000;

function debugLog(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'start-polling') {
    startPolling();
    sendResponse({ success: true });
  } else if (message.action === 'stop-polling') {
    stopPolling();
    sendResponse({ success: true });
  }
});

// Tự động khởi chạy polling khi load
startPolling();

function startPolling() {
  if (progressInterval) return;

  debugLog("[offscreen.js] Khởi chạy vòng lặp polling tiến trình mỗi 3 giây.");

  progressInterval = setInterval(() => {
    // Gửi tick về Service Worker để đọc bytesReceived vì onChanged không phát sự kiện cho từng byte.
    chrome.runtime.sendMessage({
      action: 'polling-tick'
    }).catch(() => {
      // SW có thể đang ngủ, tin nhắn gửi đi sẽ tự động đánh thức nó dậy
    });
  }, PROGRESS_POLL_INTERVAL_MS);
}

function stopPolling() {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
    debugLog("[offscreen.js] Đã dừng vòng lặp nhịp tim.");
  }
}

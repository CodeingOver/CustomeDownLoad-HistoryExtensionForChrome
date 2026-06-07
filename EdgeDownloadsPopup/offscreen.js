// Offscreen document script that acts as a lightweight heartbeat to keep the Service Worker alive.
let progressInterval = null;
const HEARTBEAT_INTERVAL_MS = 25000;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'start-polling') {
    startPolling();
    sendResponse({ success: true });
  } else if (message.action === 'stop-polling') {
    stopPolling();
    sendResponse({ success: true });
  }
});

// Tự động khởi chạy heartbeat khi load
startPolling();

function startPolling() {
  if (progressInterval) return;

  console.log("[offscreen.js] Khởi chạy vòng lặp phát nhịp tim keep-alive mỗi 25 giây.");

  progressInterval = setInterval(() => {
    // Gửi nhịp tim về Service Worker để giữ worker còn thức; tiến trình lấy từ onChanged.
    chrome.runtime.sendMessage({
      action: 'polling-tick'
    }).catch(() => {
      // SW có thể đang ngủ, tin nhắn gửi đi sẽ tự động đánh thức nó dậy
    });
  }, HEARTBEAT_INTERVAL_MS);
}

function stopPolling() {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
    console.log("[offscreen.js] Đã dừng vòng lặp nhịp tim.");
  }
}

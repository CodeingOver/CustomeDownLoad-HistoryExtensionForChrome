// Offscreen document script that acts as a heartbeat tick emitter to keep the Service Worker alive and trigger progress updates.
let progressInterval = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'start-polling') {
    startPolling();
    sendResponse({ success: true });
  } else if (message.action === 'stop-polling') {
    stopPolling();
    sendResponse({ success: true });
  }
});

// Tự động khởi chạy polling heartbeat khi load
startPolling();

function startPolling() {
  if (progressInterval) return;
  
  console.log("[offscreen.js] Khởi chạy vòng lặp phát nhịp tim (heartbeat tick) mỗi 1 giây.");
  
  progressInterval = setInterval(() => {
    // Gửi nhịp tim về Service Worker để kích hoạt truy vấn tiến trình
    chrome.runtime.sendMessage({
      action: 'polling-tick'
    }).catch(() => {
      // SW có thể đang ngủ, tin nhắn gửi đi sẽ tự động đánh thức nó dậy
    });
  }, 1000);
}

function stopPolling() {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
    console.log("[offscreen.js] Đã dừng vòng lặp nhịp tim.");
  }
}

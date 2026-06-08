let activeDownloads = {};
let sessionDownloadIds = new Set();
const DEBUG = false;
let wasDownloading = false;
let isPopupOpen = false;
let animationInterval = null;
let isGlowState = false;
let isCompleteState = false;
let progressInterval = null;
const serviceWorkerStartedAt = Date.now();
const STARTUP_AUTO_OPEN_GRACE_MS = 5000;
const RESTORED_DOWNLOAD_SKEW_MS = 2000;
const PROGRESS_BATCH_INTERVAL_MS = 3000;
let hasCompletedStartupDownloadScan = false;
let progressBatchTimer = null;
let lastTerminalDownloadState = null;
const SESSION_DOWNLOAD_IDS_KEY = 'sessionDownloadIds';
const DEFAULT_ICON_PATHS = {
  "16": "icon16.png",
  "32": "icon32.png",
  "48": "icon48.png"
};
const GLOW_ICON_PATHS = {
  "16": "icon_glow16.png",
  "32": "icon_glow32.png",
  "48": "icon_glow48.png"
};
const STATE_OVERLAY_CONFIGS = {
  pause: {
    backgroundColor: '#6b6b6b',
    overlayPrefix: 'pause_icon'
  },
  complete: {
    backgroundColor: '#10c15c',
    overlayPrefix: 'complete_icon'
  }
};
const stateOverlayIconCache = {};
const sessionDownloadIdsLoadedPromise = loadSessionDownloadIds();

function debugLog(...args) {
  if (DEBUG) {
    console.log(...args.map(arg => (typeof arg === 'function' ? arg() : arg)));
  }
}

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
  rememberSessionDownloadId(item.id);
  activeDownloads[item.id] = {
    id: item.id,
    filename: getBasename(item.filename),
    totalBytes: item.totalBytes || 0,
    bytesReceived: item.bytesReceived || 0,
    state: item.state || 'in_progress',
    paused: item.paused || false,
    error: item.error || null
  };
  lastTerminalDownloadState = null;
  
  // Chỉ tự động hiển thị popup cho lượt tải mới, không mở khi Chrome khôi phục download cũ lúc startup.
  if (shouldAutoOpenPopupForCreatedDownload(item)) {
    chrome.action.openPopup().catch((err) => {
      console.warn("Could not open popup automatically:", err);
    });
  }

  updateBadgeAndAnimation();
  scheduleProgressBatch();
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

function disableNativeDownloadUi(source) {
  try {
    if (!chrome.downloads.setUiOptions) {
      return;
    }

    const result = chrome.downloads.setUiOptions({ enabled: false });
    if (result && typeof result.catch === 'function') {
      result.catch((err) => {
        console.warn(`[background.js] Không thể tắt Download UI bằng setUiOptions (${source}):`, err.message);
      });
    }
  } catch (err) {
    console.warn(`[background.js] Không thể tắt Download UI mặc định (${source}):`, err.message);
  }
}

// Listen for changes in downloads
chrome.downloads.onChanged.addListener((delta) => {
  rememberSessionDownloadId(delta.id);
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

  debugLog(`[handleDelta] ID: ${id}, State: ${item.state}, Bytes: ${item.bytesReceived}/${item.totalBytes}, Critical: ${isCritical}`);

  // Handle completion or failure
  if (item.state === 'complete' || item.state === 'interrupted') {
    sendProgressToPopup(item, 'download-complete');
    lastTerminalDownloadState = item.state;
    delete activeDownloads[id];
    updateBadgeAndAnimation();
  } else {
    // Chỉ cập nhật tiến trình nếu là thay đổi trạng thái quan trọng hoặc đã trôi qua ít nhất 1000ms
    const now = Date.now();
    if (isCritical || !item.lastUpdateTime || (now - item.lastUpdateTime >= 1000)) {
      item.lastUpdateTime = now;
      scheduleProgressBatch();
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
  debugLog("[updateBadgeAndAnimation] Toàn bộ activeDownloads:", () => JSON.stringify(activeDownloads));

  const pausedItems = Object.values(activeDownloads).filter(item =>
    item &&
    item.state === 'in_progress' &&
    item.paused
  );
  
  // Lọc lấy danh sách các tệp đang tải thực sự từ activeDownloads bộ nhớ
  let activeItems = Object.values(activeDownloads).filter(item => 
    item.state === 'in_progress' && !item.paused
  );
  
  debugLog("[updateBadgeAndAnimation] Danh sách activeItems (đang tải & không paused):", () => JSON.stringify(activeItems));
  
  // Loại bỏ các tệp tin chưa bắt đầu nhận dữ liệu (bytesReceived === 0) 
  // để tránh các tệp bị nghẽn/chờ xác nhận kéo tụt chỉ số phần trăm của tệp đang chạy.
  const downloadingItems = activeItems.filter(item => item.bytesReceived > 0);
  if (downloadingItems.length > 0) {
    activeItems = downloadingItems;
  }

  if (activeItems.length === 0) {
    debugLog("[updateBadgeAndAnimation] Không có tệp nào đang tải (activeItems rỗng).");
    if (pausedItems.length > 0) {
      debugLog("[updateBadgeAndAnimation] Tất cả lượt tải đang bị tạm dừng.");
      wasDownloading = true;
      isCompleteState = false;
      chrome.action.setBadgeText({ text: '' });
      // Chỉ dừng nhấp nháy glow, không set icon mặc định để tránh ghi đè overlay pause bất đồng bộ.
      clearProgressAnimation();
      showPausedIcon();
      closeOffscreenDocument();
      return;
    }

    if (wasDownloading) {
      // Vừa tải xong: hiển thị Icon hoàn thành với checkmark (chỉ hiển thị nếu popup không mở)
      if (lastTerminalDownloadState === 'complete' && !isPopupOpen) {
        showCompletionBadge();
      } else {
        isCompleteState = false;
        chrome.action.setBadgeText({ text: '' });
        stopAnimation();
      }
      wasDownloading = false;
      lastTerminalDownloadState = null;
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
  lastTerminalDownloadState = null;
  if (!animationInterval) {
    setActionIcon(DEFAULT_ICON_PATHS);
  }
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
    debugLog("[updateBadgeAndAnimation] Đang tải ở chế độ không xác định (indeterminate).");
    chrome.action.setBadgeText({ text: '...' });
  } else {
    const percent = Math.floor((bytesReceived / totalBytes) * 100);
    debugLog(`[updateBadgeAndAnimation] Đang tải: ${percent}% (Tổng: ${bytesReceived}/${totalBytes})`);
    chrome.action.setBadgeText({ text: `${percent}%` });
  }
}

let offscreenCreationPromise = null;

async function ensureOffscreenDocument() {
  if (offscreenCreationPromise) {
    return offscreenCreationPromise;
  }

  offscreenCreationPromise = ensureOffscreenDocumentInternal().finally(() => {
    offscreenCreationPromise = null;
  });

  return offscreenCreationPromise;
}

async function ensureOffscreenDocumentInternal() {
  if (chrome.runtime.getContexts) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    if (contexts.length > 0) {
      chrome.runtime.sendMessage({ action: 'start-polling' }).catch(() => {});
      return;
    }
  }
  
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['LOCAL_STORAGE'],
      justification: 'Keep service worker alive and poll download progress'
    });
    debugLog("[background.js] Đã tạo thành công Offscreen Document.");
    chrome.runtime.sendMessage({ action: 'start-polling' }).catch(() => {});
  } catch (err) {
    if (err && err.message && err.message.includes('Only a single offscreen document may be created')) {
      chrome.runtime.sendMessage({ action: 'start-polling' }).catch(() => {});
      return;
    }

    console.error("[background.js] Lỗi khi tạo Offscreen Document:", err);
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
        debugLog("[background.js] Đã đóng Offscreen Document.");
      } catch (err) {
        console.error("[background.js] Lỗi khi đóng Offscreen Document:", err);
      }
    }
  }
}

// Hiển thị icon checkmark khi hoàn thành tải xuống
function showCompletionBadge() {
  isCompleteState = true;
  chrome.action.setBadgeText({ text: '' }); // Xóa badge text tiến trình cũ
  drawStateOverlayIcon('complete');
}

// Hiển thị icon pause khi toàn bộ lượt tải đang tạm dừng
function showPausedIcon() {
  chrome.action.setBadgeText({ text: '' });
  drawStateOverlayIcon('pause');
}

async function drawStateOverlayIcon(state) {
  const config = STATE_OVERLAY_CONFIGS[state];
  if (!config) return;

  try {
    if (stateOverlayIconCache[state]) {
      await chrome.action.setIcon({ imageData: stateOverlayIconCache[state] });
      return;
    }

    const imageDatas = {};
    for (const size of [16, 32, 48]) {
      const [baseBitmap, overlayBitmap] = await Promise.all([
        loadBitmap(`icon${size}.png`),
        loadBitmap(`${config.overlayPrefix}${size}.png`)
      ]);

      const canvas = new OffscreenCanvas(size, size);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(baseBitmap, 0, 0, size, size);

      const radius = size * 0.27;
      const cx = size - radius - 1;
      const cy = size - radius - 1;
      const overlaySize = Math.ceil(radius * 1.25);
      const overlayX = cx - overlaySize / 2;
      const overlayY = cy - overlaySize / 2;

      ctx.fillStyle = config.backgroundColor;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      const overlayCanvas = new OffscreenCanvas(overlaySize, overlaySize);
      const overlayCtx = overlayCanvas.getContext('2d');
      overlayCtx.drawImage(overlayBitmap, 0, 0, overlaySize, overlaySize);
      overlayCtx.globalCompositeOperation = 'source-in';
      overlayCtx.fillStyle = '#ffffff';
      overlayCtx.fillRect(0, 0, overlaySize, overlaySize);
      ctx.drawImage(overlayCanvas, overlayX, overlayY);

      baseBitmap.close();
      overlayBitmap.close();
      imageDatas[size] = ctx.getImageData(0, 0, size, size);
    }

    stateOverlayIconCache[state] = imageDatas;
    await chrome.action.setIcon({ imageData: imageDatas });
  } catch (err) {
    console.warn(`[background.js] Không thể vẽ icon overlay ${state}:`, err.message);
    setActionIcon(DEFAULT_ICON_PATHS);
  }
}

async function loadBitmap(path) {
  const response = await fetch(chrome.runtime.getURL(path));
  const blob = await response.blob();
  return createImageBitmap(blob);
}

// Khởi chạy hoạt ảnh biểu tượng nhấp nháy phát sáng (Glow)
function startAnimation() {
  if (animationInterval) return;
  
  animationInterval = setInterval(() => {
    isGlowState = !isGlowState;
    const path = isGlowState ? GLOW_ICON_PATHS : DEFAULT_ICON_PATHS;

    setActionIcon(path);
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
  setActionIcon(DEFAULT_ICON_PATHS);
}

function setActionIcon(path) {
  chrome.action.setIcon({ path }).catch((err) => {
    console.warn("[background.js] Không thể cập nhật icon:", err.message);
  });
}

function getProgressSyncItems() {
  return Object.values(activeDownloads).filter(item => (
    item &&
    item.state === 'in_progress'
  ));
}

function scheduleProgressBatch(delay = PROGRESS_BATCH_INTERVAL_MS) {
  if (progressBatchTimer) {
    return;
  }

  progressBatchTimer = setTimeout(() => {
    progressBatchTimer = null;
    broadcastProgressBatch();
  }, delay);
}

function broadcastProgressBatch(items = getProgressSyncItems()) {
  if (!items || items.length === 0) {
    return;
  }

  sendProgressBatchToPopup(items);
}

// Send progress detail to extension views such as the popup
function sendProgressToPopup(item, type = 'download-progress') {
  chrome.runtime.sendMessage({
    type: type,
    detail: item
  }).catch(() => {});
}

function sendProgressBatchToPopup(items) {
  chrome.runtime.sendMessage({
    type: 'sync-all-progress',
    details: items
  }).catch(() => {});
}

function handleProgressPollingTick() {
  chrome.downloads.search({ state: 'in_progress' }, (items) => {
    if (!items || items.length === 0) {
      closeOffscreenDocument();
      return;
    }

    let progressChanged = false;

    items.forEach(item => {
      const currentItem = activeDownloads[item.id];
      if (!currentItem || currentItem.state !== 'in_progress') {
        return;
      }

      const bytesReceived = item.bytesReceived || 0;
      const totalBytes = item.totalBytes || 0;

      if (currentItem.bytesReceived !== bytesReceived || currentItem.totalBytes !== totalBytes) {
        currentItem.bytesReceived = bytesReceived;
        currentItem.totalBytes = totalBytes;
        progressChanged = true;
      }
    });

    if (progressChanged) {
      updateBadgeAndAnimation();
      broadcastProgressBatch();
    }
  });
}

// Listen for messages from extension views
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'get-session-downloads') {
    sessionDownloadIdsLoadedPromise.then(() => {
      sendResponse({ sessionDownloadIds: Array.from(sessionDownloadIds) });
    });
    return true;
  } else if (request.action === 'clear-complete-badge') {
    const hasActiveDownloads = Object.values(activeDownloads).some(item =>
      item &&
      item.state === 'in_progress'
    );

    if (hasActiveDownloads) {
      isCompleteState = false;
      updateBadgeAndAnimation();
      return;
    }

    isCompleteState = false;
    chrome.action.setBadgeText({ text: '' });
    stopAnimation(); // Khôi phục biểu tượng mặc định
  } else if (request.action === 'polling-tick') {
    handleProgressPollingTick();
  }
});

// Helper to get file basename
function getBasename(path) {
  if (!path) return 'Unknown File';
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1];
}

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
        error: item.error || null
      };
      rememberSessionDownloadId(item.id);
    });
  }
  updateBadgeAndAnimation();
  if (items && items.length > 0) {
    ensureOffscreenDocument();
  }
  hasCompletedStartupDownloadScan = true;
});

function rememberSessionDownloadId(id) {
  if (id === undefined || id === null || sessionDownloadIds.has(id)) {
    return;
  }

  sessionDownloadIds.add(id);
  sessionDownloadIdsLoadedPromise.then(() => {
    persistSessionDownloadIds();
  });
}

async function loadSessionDownloadIds() {
  try {
    const result = await storageSessionGet(SESSION_DOWNLOAD_IDS_KEY);
    const storedIds = result[SESSION_DOWNLOAD_IDS_KEY];
    if (Array.isArray(storedIds)) {
      storedIds.forEach(id => {
        if (Number.isInteger(id)) {
          sessionDownloadIds.add(id);
        }
      });
    }
  } catch (err) {
    console.warn("[background.js] Không thể tải danh sách download trong phiên:", err.message);
  }
}

function persistSessionDownloadIds() {
  storageSessionSet({
    [SESSION_DOWNLOAD_IDS_KEY]: Array.from(sessionDownloadIds)
  }).catch((err) => {
    console.warn("[background.js] Không thể lưu danh sách download trong phiên:", err.message);
  });
}

function storageSessionGet(key) {
  return new Promise((resolve) => {
    if (!chrome.storage || !chrome.storage.session) {
      resolve({});
      return;
    }

    chrome.storage.session.get(key, (result) => {
      if (chrome.runtime.lastError) {
        console.warn("[background.js] Lỗi đọc chrome.storage.session:", chrome.runtime.lastError.message);
        resolve({});
        return;
      }

      resolve(result || {});
    });
  });
}

function storageSessionSet(value) {
  return new Promise((resolve, reject) => {
    if (!chrome.storage || !chrome.storage.session) {
      resolve();
      return;
    }

    chrome.storage.session.set(value, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve();
    });
  });
}

// ============================================================
// FirefoxDownloadsPopup/background.js
// Firefox port of EdgeDownloadsPopup/background.js
//
// Key changes from the Chrome/Edge version:
//  - Removed Offscreen Document API (not available in Firefox)
//  - Uses setInterval directly for progress polling (persistent background page)
//  - Replaced chrome.storage.session → browser.storage.local (prefix 'ff_session_')
//  - Removed disableNativeDownloadUi() (downloads.setUiOptions unavailable in Firefox)
//  - Removed chrome.action.openPopup() (unavailable in Firefox)
//  - Uses browser.browserAction instead of chrome.action
// ============================================================

// Use Firefox's 'browser' namespace or fall back to 'chrome' (polyfill compatibility)
const _browser = typeof browser !== 'undefined' ? browser : chrome;

let activeDownloads = {};
let sessionDownloadIds = new Set();
const DEBUG = false;
let wasDownloading = false;
let isPopupOpen = false;
let animationInterval = null;
let isGlowState = false;
let isCompleteState = false;
const serviceWorkerStartedAt = Date.now();
const STARTUP_AUTO_OPEN_GRACE_MS = 5000;
const RESTORED_DOWNLOAD_SKEW_MS = 2000;
const PROGRESS_POLL_INTERVAL_MS = 3000;
let hasCompletedStartupDownloadScan = false;
let progressBatchTimer = null;
let lastTerminalDownloadState = null;
let isBrowserStartup = false;

// Firefox has no storage.session — using storage.local with prefix 'ff_session_'
const SESSION_STATE_KEY = 'ff_session_downloadState';

let downloadSessionId = null;
let progressPollingInterval = null; // Replaces Offscreen Document polling

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

function debugLog(...args) {
  if (DEBUG) {
    console.log(...args.map(arg => (typeof arg === 'function' ? arg() : arg)));
  }
}

// ============================================================
// Initialise session
// ============================================================
const sessionDownloadIdsLoadedPromise = loadSessionDownloadIds();

// Track popup open/close state via Port Connection
_browser.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    isPopupOpen = true;
    port.onDisconnect.addListener(() => {
      isPopupOpen = false;
    });
  }
});

// Initialize action badge style
_browser.browserAction.setBadgeBackgroundColor({ color: '#0078d4' });

_browser.runtime.onStartup.addListener(() => {
  resetDownloadSession();
});

// ============================================================
// Listen for download events
// ============================================================

_browser.downloads.onCreated.addListener(async (item) => {
  await sessionDownloadIdsLoadedPromise;

  if (item.state === 'in_progress') {
    rememberSessionDownloadId(item.id);
  }

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

  // NOTE: openPopup() is not called because Firefox does not support browserAction.openPopup() from background

  updateBadgeAndAnimation();
  scheduleProgressBatch();
});

_browser.downloads.onChanged.addListener((delta) => {
  const id = delta.id;
  if (!activeDownloads[id]) {
    _browser.downloads.search({ id: id }, (items) => {
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

function handleDelta(id, delta) {
  const item = activeDownloads[id];
  if (!item) {
    console.warn(`[handleDelta] Item not found for ID: ${id} in activeDownloads.`);
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

  if (item.state === 'complete' || item.state === 'interrupted') {
    sendProgressToPopup(item, 'download-complete');
    lastTerminalDownloadState = item.state;
    delete activeDownloads[id];
    updateBadgeAndAnimation();
  } else {
    const now = Date.now();
    if (isCritical || !item.lastUpdateTime || (now - item.lastUpdateTime >= 1000)) {
      item.lastUpdateTime = now;
      scheduleProgressBatch();
      updateBadgeAndAnimation();
    }
  }
}

// ============================================================
// Badge and animation
// ============================================================

function updateBadgeAndAnimation() {
  debugLog("[updateBadgeAndAnimation] All activeDownloads:", () => JSON.stringify(activeDownloads));

  const pausedItems = Object.values(activeDownloads).filter(item =>
    item &&
    item.state === 'in_progress' &&
    item.paused
  );

  let activeItems = Object.values(activeDownloads).filter(item =>
    item.state === 'in_progress' && !item.paused
  );

  const downloadingItems = activeItems.filter(item => item.bytesReceived > 0);
  if (downloadingItems.length > 0) {
    activeItems = downloadingItems;
  }

  if (activeItems.length === 0) {
    if (pausedItems.length > 0) {
      wasDownloading = true;
      isCompleteState = false;
      _browser.browserAction.setBadgeText({ text: '' });
      clearProgressAnimation();
      showPausedIcon();
      stopProgressPolling(); // Stop polling when no active downloads
      return;
    }

    if (wasDownloading) {
      if (lastTerminalDownloadState === 'complete' && !isPopupOpen) {
        showCompletionBadge();
      } else {
        isCompleteState = false;
        _browser.browserAction.setBadgeText({ text: '' });
        stopAnimation();
      }
      wasDownloading = false;
      lastTerminalDownloadState = null;
    } else {
      if (!isCompleteState) {
        _browser.browserAction.setBadgeText({ text: '' });
        stopAnimation();
      }
    }
    clearProgressAnimation();
    stopProgressPolling();
    return;
  }

  // Active in_progress downloads exist — ensure polling is running
  startProgressPolling();
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

  _browser.browserAction.setBadgeBackgroundColor({ color: '#0078d4' });

  if (indeterminate || totalBytes === 0) {
    _browser.browserAction.setBadgeText({ text: '...' });
  } else {
    const percent = Math.floor((bytesReceived / totalBytes) * 100);
    _browser.browserAction.setBadgeText({ text: `${percent}%` });
  }
}

// ============================================================
// Progress Polling (replaces Offscreen Document)
// Firefox background page is persistent so setInterval can be used directly.
// ============================================================

function startProgressPolling() {
  if (progressPollingInterval) return;
  debugLog("[background.js] Starting progress polling loop (Firefox persistent background).");
  progressPollingInterval = setInterval(() => {
    handleProgressPollingTick();
  }, PROGRESS_POLL_INTERVAL_MS);
}

function stopProgressPolling() {
  if (progressPollingInterval) {
    clearInterval(progressPollingInterval);
    progressPollingInterval = null;
    debugLog("[background.js] Progress polling loop stopped.");
  }
}

// ============================================================
// State Overlay Icons
// ============================================================

function showCompletionBadge() {
  isCompleteState = true;
  _browser.browserAction.setBadgeText({ text: '' });
  drawStateOverlayIcon('complete');
}

function showPausedIcon() {
  _browser.browserAction.setBadgeText({ text: '' });
  drawStateOverlayIcon('pause');
}

async function drawStateOverlayIcon(state) {
  const config = STATE_OVERLAY_CONFIGS[state];
  if (!config) return;

  try {
    if (stateOverlayIconCache[state]) {
      await _browser.browserAction.setIcon({ imageData: stateOverlayIconCache[state] });
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
    await _browser.browserAction.setIcon({ imageData: imageDatas });
  } catch (err) {
    console.warn(`[background.js] Failed to draw icon overlay '${state}':`, err.message);
    setActionIcon(DEFAULT_ICON_PATHS);
  }
}

async function loadBitmap(path) {
  const response = await fetch(_browser.runtime.getURL(path));
  const blob = await response.blob();
  return createImageBitmap(blob);
}

function startAnimation() {
  if (animationInterval) return;
  animationInterval = setInterval(() => {
    isGlowState = !isGlowState;
    const path = isGlowState ? GLOW_ICON_PATHS : DEFAULT_ICON_PATHS;
    setActionIcon(path);
  }, 1500);
}

function clearProgressAnimation() {
  if (animationInterval) {
    clearInterval(animationInterval);
    animationInterval = null;
  }
  isGlowState = false;
}

function stopAnimation() {
  clearProgressAnimation();
  setActionIcon(DEFAULT_ICON_PATHS);
}

function setActionIcon(path) {
  _browser.browserAction.setIcon({ path }).catch((err) => {
    console.warn("[background.js] Failed to update icon:", err.message);
  });
}

// ============================================================
// Progress batching
// ============================================================

function getProgressSyncItems() {
  return Object.values(activeDownloads).filter(item => (
    item &&
    item.state === 'in_progress'
  ));
}

function scheduleProgressBatch(delay = 500) {
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

function sendProgressToPopup(item, type = 'download-progress') {
  _browser.runtime.sendMessage({
    type: type,
    detail: item
  }).catch(() => {});
}

function sendProgressBatchToPopup(items) {
  _browser.runtime.sendMessage({
    type: 'sync-all-progress',
    details: items
  }).catch(() => {});
}

function handleProgressPollingTick() {
  _browser.downloads.search({ state: 'in_progress' }, (items) => {
    if (!items || items.length === 0) {
      stopProgressPolling();
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

// ============================================================
// Message listeners
// ============================================================

_browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
    _browser.browserAction.setBadgeText({ text: '' });
    stopAnimation();
  }
});

// ============================================================
// Helper functions
// ============================================================

function getBasename(path) {
  if (!path) return 'Unknown File';
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1];
}

// ============================================================
// Initialise activeDownloads from any in-progress downloads when the background page loads
// ============================================================

_browser.downloads.search({ state: 'in_progress' }, (items) => {
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
    startProgressPolling();
  }
  hasCompletedStartupDownloadScan = true;
});

// ============================================================
// Session management (using storage.local instead of storage.session)
// ============================================================

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
    const result = await storageLocalGet(SESSION_STATE_KEY);
    const storedState = result[SESSION_STATE_KEY];
    if (storedState && typeof storedState.sessionId === 'string' && Array.isArray(storedState.ids)) {
      downloadSessionId = storedState.sessionId;
      storedState.ids.forEach(id => {
        if (Number.isInteger(id)) {
          sessionDownloadIds.add(id);
        }
      });
      isBrowserStartup = false;
      return;
    }

    // No previous state found: this is a fresh browser startup
    isBrowserStartup = true;
    setTimeout(() => {
      isBrowserStartup = false;
    }, 10000);

    downloadSessionId = createDownloadSessionId();
    persistSessionDownloadIds();
  } catch (err) {
    console.warn("[background.js] Failed to load session download list:", err.message);
    downloadSessionId = createDownloadSessionId();
  }
}

function persistSessionDownloadIds() {
  if (!downloadSessionId) {
    downloadSessionId = createDownloadSessionId();
  }

  storageLocalSet({
    [SESSION_STATE_KEY]: {
      sessionId: downloadSessionId,
      ids: Array.from(sessionDownloadIds)
    }
  }).catch((err) => {
    console.warn("[background.js] Failed to persist session download list:", err.message);
  });
}

function resetDownloadSession() {
  sessionDownloadIds.clear();
  downloadSessionId = createDownloadSessionId();
  persistSessionDownloadIds();
}

function createDownloadSessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function storageLocalGet(key) {
  return new Promise((resolve) => {
    _browser.storage.local.get(key, (result) => {
      if (_browser.runtime.lastError) {
        console.warn("[background.js] Error reading storage.local:", _browser.runtime.lastError.message);
        resolve({});
        return;
      }
      resolve(result || {});
    });
  });
}

function storageLocalSet(value) {
  return new Promise((resolve, reject) => {
    _browser.storage.local.set(value, () => {
      if (_browser.runtime.lastError) {
        reject(new Error(_browser.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

// Clean up session state when the extension is suspended / browser closes (if supported)
if (_browser.runtime.onSuspend) {
  _browser.runtime.onSuspend.addListener(() => {
    stopProgressPolling();
  });
}

const DEFAULT_ICON_PATHS = {
  "16": "icon16.png",
  "32": "icon32.png",
  "48": "icon48.png"
};

const DARK_BG_ICON_PATHS = {
  "16": "icon_dark16.png",
  "32": "icon_dark32.png",
  "48": "icon_dark48.png"
};

let useDarkBgIcon = false;
let creatingOffscreenPromise = null;

async function hasOffscreenDocument() {
  if ('getContexts' in chrome.runtime) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [chrome.runtime.getURL('offscreen.html')]
    });
    return contexts && contexts.length > 0;
  }
  if ('offscreen' in chrome && 'hasDocument' in chrome.offscreen) {
    return await chrome.offscreen.hasDocument();
  }
  return false;
}

async function ensureOffscreenDocument() {
  if (await hasOffscreenDocument()) {
    return;
  }
  if (creatingOffscreenPromise) {
    await creatingOffscreenPromise;
    return;
  }
  creatingOffscreenPromise = chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: [chrome.offscreen.Reason.MATCH_MEDIA],
    justification: 'Detect system color scheme for extension toolbar icon'
  });
  try {
    await creatingOffscreenPromise;
  } finally {
    creatingOffscreenPromise = null;
  }
}

async function closeOffscreenDocument() {
  if (await hasOffscreenDocument()) {
    await chrome.offscreen.closeDocument().catch(() => {});
  }
}

function applyIconTheme(isLight) {
  useDarkBgIcon = !!isLight;
  chrome.storage.local.set({ useDarkBgIcon: useDarkBgIcon });
  chrome.action.setIcon({
    path: useDarkBgIcon ? DARK_BG_ICON_PATHS : DEFAULT_ICON_PATHS
  }).catch(() => {});
}

// Khởi tạo trạng thái icon từ storage khi Service Worker khởi động
chrome.storage.local.get('useDarkBgIcon', (res) => {
  if (res && res.useDarkBgIcon !== undefined) {
    useDarkBgIcon = !!res.useDarkBgIcon;
    chrome.action.setIcon({
      path: useDarkBgIcon ? DARK_BG_ICON_PATHS : DEFAULT_ICON_PATHS
    }).catch(() => {});
  } else {
    // Chưa có thông tin theme (vừa cài đặt): kích hoạt offscreen để phát hiện tức thì
    ensureOffscreenDocument().catch(() => {});
  }
});

// Lắng nghe sự kiện cài đặt extension
chrome.runtime.onInstalled.addListener(() => {
  ensureOffscreenDocument().catch(() => {});
});

// Lắng nghe thông báo theme-detected từ content script, offscreen hoặc popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && (request.action === 'theme-detected' || request.action === 'set-icon-theme')) {
    const isLight = request.useDarkBgIcon !== undefined ? !!request.useDarkBgIcon : !!request.isLight;
    applyIconTheme(isLight);
    
    // Nếu tin nhắn đến từ offscreen, đóng offscreen document để giải phóng RAM
    if (request.source === 'offscreen') {
      closeOffscreenDocument().catch(() => {});
    }

    if (typeof sendResponse === 'function') {
      sendResponse({ success: true, useDarkBgIcon });
    }
  }
});

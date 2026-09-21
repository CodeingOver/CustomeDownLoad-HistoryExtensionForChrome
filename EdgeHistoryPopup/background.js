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
  }
});

// Lắng nghe thông báo theme-detected từ content script hoặc popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && (request.action === 'theme-detected' || request.action === 'set-icon-theme')) {
    const isLight = request.useDarkBgIcon !== undefined ? !!request.useDarkBgIcon : !!request.isLight;
    applyIconTheme(isLight);
    if (typeof sendResponse === 'function') {
      sendResponse({ success: true, useDarkBgIcon });
    }
  }
});

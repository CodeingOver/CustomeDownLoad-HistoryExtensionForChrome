(() => {
  'use strict';

  // Tránh nạp lại nhiều lần trong cùng một context
  if (window.__edgeHistoryContentScriptLoaded) {
    return;
  }
  window.__edgeHistoryContentScriptLoaded = true;

  const isTopWindow = (window === window.top);
  if (!isTopWindow) return;

  // Tự động phát hiện và đồng bộ chế độ icon theo theme người dùng (Light/Dark)
  function syncTheme() {
    try {
      if (window.matchMedia) {
        const isLight = window.matchMedia('(prefers-color-scheme: light)').matches;
        chrome.runtime.sendMessage({ action: 'theme-detected', isLight }).catch(() => {});
      }
    } catch (e) {}
  }

  syncTheme();

  try {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', syncTheme);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(syncTheme);
    }
  } catch (e) {}
})();

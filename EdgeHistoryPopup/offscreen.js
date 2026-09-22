// Offscreen document script phát hiện theme trình duyệt / hệ điều hành qua matchMedia
function reportTheme() {
  try {
    if (window.matchMedia) {
      const isLight = window.matchMedia('(prefers-color-scheme: light)').matches;
      chrome.runtime.sendMessage({ action: 'theme-detected', isLight, source: 'offscreen' }).catch(() => {});
    }
  } catch (e) {}
}

reportTheme();

try {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', reportTheme);
  } else if (mediaQuery.addListener) {
    mediaQuery.addListener(reportTheme);
  }
} catch (e) {}

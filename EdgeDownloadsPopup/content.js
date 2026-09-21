(() => {
  'use strict';

  // Tránh nạp lại nhiều lần trong cùng một context
  if (window.__edgeDownloadsContentScriptLoaded) {
    return;
  }
  window.__edgeDownloadsContentScriptLoaded = true;

  const isTopWindow = (window === window.top);
  let lastClickPos = null;
  let lastClickTime = 0;

  // 1. Ghi nhận vị trí click chuột của người dùng
  window.addEventListener(
    'pointerdown',
    (event) => {
      if (event.isPrimary !== false) {
        lastClickPos = { x: event.clientX, y: event.clientY };
        lastClickTime = Date.now();

        // Nếu click diễn ra bên trong iframe, chuyển tiếp thông tin lên top window
        if (!isTopWindow) {
          try {
            window.top.postMessage(
              {
                type: '__EDGE_DL_CLICK__',
                x: event.screenX,
                y: event.screenY
              },
              '*'
            );
          } catch (e) {}
        }
      }
    },
    { capture: true, passive: true }
  );

  // 2. Top window lắng nghe sự kiện click chuyển tiếp từ các iframe con
  if (isTopWindow) {
    window.addEventListener('message', (event) => {
      if (event && event.data && event.data.type === '__EDGE_DL_CLICK__') {
        lastClickTime = Date.now();
        // Nếu có tọa độ screen, tính toán tương đối sang viewport hiện tại
        if (typeof event.data.x === 'number' && typeof event.data.y === 'number') {
          const winX = window.screenX || 0;
          const winY = window.screenY || 0;
          const relX = event.data.x - winX;
          const relY = event.data.y - winY;
          if (relX > 0 && relX < window.innerWidth && relY > 0 && relY < window.innerHeight) {
            lastClickPos = { x: relX, y: relY };
          }
        }
      }
    });

    // 3. Lắng nghe thông báo từ background Service Worker khi có tệp bắt đầu tải
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message && message.action === 'download-started-fly') {
        // Chỉ kích hoạt hoạt ảnh nếu tab này đang hiển thị với người dùng
        if (document.visibilityState === 'visible') {
          playChromeStraightFlyAnimation();
        }
        if (typeof sendResponse === 'function') {
          sendResponse({ received: true });
        }
      }
    });

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
  }


  /**
   * Tạo hoạt ảnh bay thẳng phong cách Chrome khi nhấn tải:
   * - Chip tròn nhỏ (26px) màu xanh Chrome (#1a73e8) với icon mũi tên tải xuống màu trắng.
   * - Bay thẳng một đường dứt khoát từ vị trí click chuột (hoặc giữa màn hình) thẳng về icon tiện ích góc trên bên phải.
   * - Tốc độ cực nhanh (~280ms), không rườm rà, lặn thẳng vào thanh công cụ và biến mất ngay lập tức.
   */
  function playChromeStraightFlyAnimation() {
    try {
      // 1. Tọa độ xuất phát
      const now = Date.now();
      let startX, startY;

      if (lastClickPos && now - lastClickTime < 5000) {
        startX = Math.min(Math.max(16, lastClickPos.x), window.innerWidth - 16);
        startY = Math.min(Math.max(16, lastClickPos.y), window.innerHeight - 16);
      } else {
        startX = window.innerWidth / 2;
        startY = window.innerHeight * 0.45;
      }

      // 2. Tọa độ đích đến (vị trí icon extension ở thanh công cụ góc trên bên phải)
      const targetX = Math.max(20, window.innerWidth - 65);
      const targetY = -8; // Bay thẳng vào thanh công cụ phía trên

      // 3. Container cô lập bằng Shadow DOM
      let container = document.getElementById('__chrome_straight_dl_anim_host__');
      let shadow;

      if (!container) {
        container = document.createElement('div');
        container.id = '__chrome_straight_dl_anim_host__';
        container.style.cssText = [
          'position: fixed',
          'top: 0',
          'left: 0',
          'width: 100vw',
          'height: 100vh',
          'pointer-events: none',
          'z-index: 2147483647',
          'overflow: hidden',
          'margin: 0',
          'padding: 0',
          'border: none',
          'background: transparent'
        ].join(' !important;') + ' !important;';

        shadow = container.attachShadow({ mode: 'open' });
        (document.body || document.documentElement).appendChild(container);
      } else {
        shadow = container.shadowRoot;
      }

      // 4. Chip tròn nhỏ màu xanh Chrome
      const chip = document.createElement('div');
      chip.setAttribute('style', [
        'position: absolute',
        'top: 0',
        'left: 0',
        'width: 26px',
        'height: 26px',
        'border-radius: 50%',
        'background: #1a73e8',
        'box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25)',
        'display: flex',
        'align-items: center',
        'justify-content: center',
        'color: #ffffff',
        'will-change: transform, opacity',
        'pointer-events: none',
        'user-select: none'
      ].join('; '));

      // Biểu tượng mũi tên tải xuống Material Design
      chip.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:block;flex-shrink:0;">
          <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
        </svg>
      `;

      shadow.appendChild(chip);

      // 5. Hoạt ảnh bay thẳng tắp (Straight-line vector trajectory) cực nhanh (~280ms)
      const animation = chip.animate(
        [
          {
            transform: `translate3d(${startX - 13}px, ${startY - 13}px, 0) scale(0.9)`,
            opacity: 1,
            offset: 0
          },
          {
            transform: `translate3d(${startX + (targetX - startX) * 0.15 - 13}px, ${startY + (targetY - startY) * 0.15 - 13}px, 0) scale(1)`,
            opacity: 1,
            offset: 0.15
          },
          {
            transform: `translate3d(${targetX - 13}px, ${targetY - 13}px, 0) scale(0.35)`,
            opacity: 0.1,
            offset: 1
          }
        ],
        {
          duration: 280,
          easing: 'cubic-bezier(0.2, 0, 0, 1)',
          fill: 'forwards'
        }
      );

      // 6. Xóa ngay khi chạm đích, không hiệu ứng rườm rà
      animation.onfinish = () => {
        chip.remove();
        if (shadow && shadow.children.length === 0 && container.parentNode) {
          container.parentNode.removeChild(container);
        }
      };
    } catch (err) {
      // Bỏ qua lỗi trong môi trường tab đặc biệt
    }
  }
})();

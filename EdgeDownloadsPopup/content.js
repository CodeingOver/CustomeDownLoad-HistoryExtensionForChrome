// Listen for progress updates from background service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'download-progress' || message.type === 'download-complete') {
    handleDownloadMessage(message.type, message.detail);
  }
});

function handleDownloadMessage(type, item) {
  let shadowHost = document.getElementById('edge-downloads-shadow-host');
  if (!shadowHost) {
    shadowHost = document.createElement('div');
    shadowHost.id = 'edge-downloads-shadow-host';
    shadowHost.style.position = 'fixed';
    shadowHost.style.top = '16px';
    shadowHost.style.right = '16px';
    shadowHost.style.zIndex = '999999999';
    shadowHost.style.pointerEvents = 'none'; // Let clicks pass through empty space
    document.body.appendChild(shadowHost);

    const shadowRoot = shadowHost.attachShadow({ mode: 'open' });

    // Inject styles
    const style = document.createElement('style');
    style.textContent = getShadowStyles();
    shadowRoot.appendChild(style);

    const container = document.createElement('div');
    container.id = 'toast-container';
    shadowRoot.appendChild(container);
  }

  const container = shadowHost.shadowRoot.getElementById('toast-container');
  const cardId = `download-card-${item.id}`;
  let card = shadowHost.shadowRoot.getElementById(cardId);

  if (!card) {
    card = document.createElement('div');
    card.id = cardId;
    card.className = 'download-toast-card';
    container.appendChild(card);
  }

  const percent = item.totalBytes > 0 ? Math.floor((item.bytesReceived / item.totalBytes) * 100) : 0;
  const isComplete = type === 'download-complete' || item.state === 'complete';
  const isInterrupted = item.state === 'interrupted';

  let stateText = '';
  if (isComplete) {
    stateText = 'Done';
  } else if (isInterrupted) {
    stateText = `Failed (${item.error || 'Interrupted'})`;
  } else {
    stateText = item.totalBytes > 0 
      ? `${formatBytes(item.bytesReceived)} of ${formatBytes(item.totalBytes)}` 
      : `${formatBytes(item.bytesReceived)}`;
  }

  // Set card contents
  card.innerHTML = `
    <div class="card-body">
      <div class="card-icon">
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z" fill="#ffffff"/>
        </svg>
      </div>
      <div class="card-details">
        <div class="filename" title="${escapeHtml(item.filename)}">${escapeHtml(item.filename)}</div>
        <div class="status-text">${stateText}</div>
      </div>
      <div class="card-action">
        ${isComplete ? `
          <button class="open-btn" title="Open file">Open</button>
        ` : isInterrupted ? `
          <span class="error-indicator">✕</span>
        ` : `
          <div class="progress-container">
            <svg class="progress-ring" width="32" height="32">
              <circle class="progress-ring-bg" stroke="rgba(255, 255, 255, 0.1)" stroke-width="3" fill="transparent" r="13" cx="16" cy="16"/>
              <circle class="progress-ring-fill" stroke="#60cdff" stroke-width="3" fill="transparent" r="13" cx="16" cy="16"/>
            </svg>
            <span class="progress-percent">${percent}%</span>
          </div>
        `}
      </div>
    </div>
  `;

  // Draw circular progress ring
  if (!isComplete && !isInterrupted) {
    const ring = card.querySelector('.progress-ring-fill');
    if (ring) {
      const radius = 13;
      const circumference = 2 * Math.PI * radius;
      ring.style.strokeDasharray = `${circumference} ${circumference}`;
      const offset = circumference - (percent / 100) * circumference;
      ring.style.strokeDashoffset = offset;
    }
  }

  // Handle completion actions
  if (isComplete && !card.dataset.completedHandled) {
    card.dataset.completedHandled = 'true';
    card.classList.add('completed');
    
    // Add open button action
    const openBtn = card.querySelector('.open-btn');
    if (openBtn) {
      openBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'open-file', id: item.id });
        card.remove();
        checkCleanupShadowHost(shadowHost, container);
      });
    }

    // Trigger particles explosion!
    triggerParticles(card);

    // Auto remove card after 5 seconds
    setTimeout(() => {
      if (card && card.parentNode) {
        card.classList.add('slide-out');
        card.addEventListener('animationend', () => {
          card.remove();
          checkCleanupShadowHost(shadowHost, container);
        });
      }
    }, 5000);
  }
}

function checkCleanupShadowHost(shadowHost, container) {
  if (container.children.length === 0) {
    shadowHost.remove();
  }
}

// Particle explosion animation helper
function triggerParticles(card) {
  const rect = card.getBoundingClientRect();
  const particleCount = 24;
  
  for (let i = 0; i < particleCount; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    
    // Set random velocity vectors
    const angle = Math.random() * Math.PI * 2;
    const distance = 40 + Math.random() * 60;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    
    // Set variables for CSS transition
    p.style.setProperty('--dx', `${dx}px`);
    p.style.setProperty('--dy', `${dy}px`);
    
    // Random color
    const colors = ['#60cdff', '#ffffff', '#0078d4', '#47c947'];
    p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    
    // Center it in the progress area (right side of the card)
    p.style.right = '24px';
    p.style.top = '22px';
    
    card.appendChild(p);
    
    // Remove particle after animation
    p.addEventListener('animationend', () => p.remove());
  }
}

// Format bytes to readable string
function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Escape HTML utility
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Fluent Design Acrylic Toast Card styling
function getShadowStyles() {
  return `
    #toast-container {
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: 330px;
    }

    .download-toast-card {
      position: relative;
      background: rgba(32, 32, 32, 0.85);
      backdrop-filter: blur(20px) saturate(1.5);
      -webkit-backdrop-filter: blur(20px) saturate(1.5);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 12px 14px;
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      pointer-events: auto; /* Allow interaction */
      animation: slideIn 0.3s cubic-bezier(0.1, 0.9, 0.2, 1) forwards;
      overflow: hidden;
    }

    .download-toast-card.slide-out {
      animation: slideOut 0.3s cubic-bezier(0.8, 0, 0.9, 0.1) forwards;
    }

    .card-body {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
    }

    .card-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.05);
      flex-shrink: 0;
    }

    .card-details {
      flex-grow: 1;
      min-width: 0;
    }

    .filename {
      color: #ffffff;
      font-size: 13.5px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 2px;
    }

    .status-text {
      color: rgba(255, 255, 255, 0.6);
      font-size: 11.5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .card-action {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      flex-shrink: 0;
    }

    /* Circular Progress Ring */
    .progress-container {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
    }

    .progress-ring {
      transform: rotate(-90deg);
      transform-origin: 50% 50%;
    }

    .progress-percent {
      position: absolute;
      color: #60cdff;
      font-size: 8.5px;
      font-weight: 600;
    }

    /* Open Button */
    .open-btn {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      color: #ffffff;
      font-size: 11px;
      font-weight: 500;
      padding: 5px 8px;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }

    .open-btn:hover {
      background: rgba(255, 255, 255, 0.15);
      border-color: rgba(255, 255, 255, 0.2);
    }

    .error-indicator {
      color: #ff5f5f;
      font-weight: bold;
      font-size: 14px;
    }

    /* Glow completed card style */
    .download-toast-card.completed {
      border-color: rgba(96, 205, 255, 0.3);
      box-shadow: 0 0 16px rgba(96, 205, 255, 0.15), 0 8px 32px rgba(0, 0, 0, 0.4);
    }

    /* Animation Keyframes */
    @keyframes slideIn {
      from {
        transform: translateX(360px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(360px);
        opacity: 0;
      }
    }

    /* Particles styles */
    .particle {
      position: absolute;
      width: 5px;
      height: 5px;
      border-radius: 50%;
      pointer-events: none;
      animation: explode 0.8s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
    }

    @keyframes explode {
      0% {
        transform: translate(0, 0) scale(1);
        opacity: 1;
      }
      100% {
        transform: translate(var(--dx), var(--dy)) scale(0.3);
        opacity: 0;
      }
    }
  `;
}

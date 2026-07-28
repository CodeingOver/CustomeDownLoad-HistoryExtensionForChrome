// ============================================================
// FirefoxDownloadsPopup/popup.js
// Firefox port of EdgeDownloadsPopup/popup.js
//
// Key changes from the Chrome/Edge version:
//  - Removed chrome.downloads.getFileIcon (not supported in Firefox)
//    → Uses SVG fallback icon only
//  - Replaced 'chrome://downloads' → 'about:downloads'
//  - Uses 'browser' namespace or falls back to 'chrome'
// ============================================================

const _browser = typeof browser !== 'undefined' ? browser : chrome;

document.addEventListener('DOMContentLoaded', function () {
  // Elements
  const list = document.getElementById('downloads-list');
  const emptyState = document.getElementById('empty-state');
  const searchInput = document.getElementById('search-input');
  const searchContainer = document.getElementById('search-container');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  const footerContainer = document.getElementById('footer-container');
  const rowTemplate = document.getElementById('download-row-template');

  const btnOpenFolder = document.getElementById('btn-open-folder');
  const btnToggleSearch = document.getElementById('btn-toggle-search');
  const btnMoreOptions = document.getElementById('btn-more-options');
  const moreDropdown = document.getElementById('more-dropdown');
  const menuOpenPage = document.getElementById('menu-open-page');
  const menuClearAll = document.getElementById('menu-clear-all');
  const btnSeeMore = document.getElementById('btn-see-more');

  let searchTimeout = null;
  let forceShowAll = false;
  let loadRequestId = 0;
  const downloadItems = new Map();

  // Connect to background to signal that the popup is open
  _browser.runtime.connect({ name: 'popup' });

  // Clear complete badge if shown when user opens popup
  _browser.runtime.sendMessage({ action: 'clear-complete-badge' });

  // Initial load
  loadDownloads();

  btnSeeMore.addEventListener('click', () => {
    forceShowAll = true;
    loadDownloads();
  });

  // Real-time downloads monitoring
  _browser.downloads.onCreated.addListener(() => {
    loadDownloads();
  });

  _browser.downloads.onChanged.addListener((delta) => {
    const hasCriticalChange = delta.state || delta.paused || delta.error || delta.filename || delta.exists;
    if (hasCriticalChange) {
      loadDownloads();
    }
  });

  _browser.runtime.onMessage.addListener((message) => {
    if (!message) return;

    if (message.type === 'sync-all-progress') {
      (message.details || []).forEach(updateDownloadProgress);
      return;
    }

    if (!message.detail) return;

    if (message.type === 'download-complete') {
      loadDownloads(searchInput.value);
      return;
    }

    if (message.type === 'download-progress') {
      updateDownloadProgress(message.detail);
    }
  });

  list.addEventListener('click', (event) => {
    const actionElement = event.target.closest('[data-action]');
    const row = event.target.closest('.download-item');
    if (!row || !list.contains(row)) return;

    const item = downloadItems.get(Number(row.dataset.id));
    if (!item) return;

    if (actionElement && list.contains(actionElement)) {
      event.stopPropagation();
      handleDownloadAction(actionElement.dataset.action, item, row);
      return;
    }

    if (item.state === 'complete' && item.exists) {
      openDownload(item.id);
    }
  });

  // Action Buttons
  btnOpenFolder.addEventListener('click', () => {
    _browser.downloads.showDefaultFolder();
  });

  btnToggleSearch.addEventListener('click', () => {
    searchContainer.classList.toggle('hidden');
    if (!searchContainer.classList.contains('hidden')) {
      searchInput.focus();
    } else {
      searchInput.value = '';
      clearSearchBtn.classList.add('hidden');
      loadDownloads();
    }
  });

  btnMoreOptions.addEventListener('click', (e) => {
    e.stopPropagation();
    moreDropdown.classList.toggle('hidden');
  });

  document.addEventListener('click', () => {
    moreDropdown.classList.add('hidden');
  });

  menuOpenPage.addEventListener('click', () => {
    // Firefox: open the downloads page via about:downloads
    _browser.tabs.create({ url: 'about:downloads' });
  });

  menuClearAll.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all download history? (This will not delete the actual files)')) {
      _browser.downloads.erase({}, () => {
        loadDownloads();
      });
    }
  });

  // Search input events
  searchInput.addEventListener('input', () => {
    const value = searchInput.value;
    if (value.trim() !== '') {
      clearSearchBtn.classList.remove('hidden');
    } else {
      clearSearchBtn.classList.add('hidden');
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      loadDownloads(value);
    }, 200);
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.classList.add('hidden');
    searchInput.focus();
    loadDownloads();
  });

  // Main Loader
  function loadDownloads(query = searchInput.value) {
    const currentRequestId = ++loadRequestId;
    const requestedQuery = query;

    _browser.runtime.sendMessage({ action: 'get-session-downloads' }, (response) => {
      if (currentRequestId !== loadRequestId) return;

      const sessionIds = (response && response.sessionDownloadIds) || [];

      const searchOptions = {
        limit: 50,
        orderBy: ['-startTime']
      };
      if (query.trim() !== '') {
        searchOptions.query = [query];
      }

      _browser.downloads.search(searchOptions, function (items) {
        if (currentRequestId !== loadRequestId || requestedQuery !== searchInput.value) return;

        list.textContent = '';
        downloadItems.clear();

        let validItems = items.filter(item => item.filename);
        const sessionIdSet = new Set(sessionIds);

        const hasSessionItems = validItems.some(item => isCurrentSessionItem(item, sessionIdSet));
        const hasActiveItems = validItems.some(item => item.state === 'in_progress');
        const isCollapsedView = (hasSessionItems || hasActiveItems) && !forceShowAll;

        if (isCollapsedView) {
          const collapsedItems = validItems.filter(item =>
            item.state === 'in_progress' || isCurrentSessionItem(item, sessionIdSet)
          );
          footerContainer.classList.toggle('hidden', collapsedItems.length >= validItems.length);
          validItems = collapsedItems;
        } else {
          footerContainer.classList.add('hidden');
        }

        if (!validItems || validItems.length === 0) {
          emptyState.classList.remove('hidden');
          return;
        }

        emptyState.classList.add('hidden');

        const fragment = document.createDocumentFragment();
        validItems.forEach(item => {
          downloadItems.set(item.id, item);
          const row = createDownloadRow(item);
          fragment.appendChild(row);
        });
        list.appendChild(fragment);
      });
    });
  }

  function isCurrentSessionItem(item, sessionIdSet) {
    return sessionIdSet.has(item.id) && !isRemovedDownload(item);
  }

  function isRemovedDownload(item) {
    return !item.exists && item.state === 'complete';
  }

  // Helper to safely render SVG without innerHTML (avoids AMO linter warnings)
  function setSVGContent(container, svgMarkup) {
    container.textContent = '';
    if (!svgMarkup) return;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgMarkup, 'image/svg+xml');
      if (doc.documentElement && doc.documentElement.tagName.toLowerCase() === 'svg') {
        container.appendChild(doc.documentElement);
      }
    } catch {
      // Fallback if parsing fails
    }
  }

  // Row Renderer
  function createDownloadRow(item) {
    const li = rowTemplate.content.firstElementChild.cloneNode(true);
    li.dataset.id = item.id;

    const filename = getBasename(item.filename);
    const ext = filename.split('.').pop().toLowerCase();

    const isRemoved = isRemovedDownload(item);

    const iconDiv = li.querySelector('[data-role="file-icon"]');
    // Firefox does not support downloads.getFileIcon — always use SVG fallback
    setSVGContent(iconDiv, getFileIconSVG(ext, isRemoved));

    const titleSpan = li.querySelector('[data-role="file-name"]');
    titleSpan.textContent = filename;
    if (isRemoved) {
      titleSpan.classList.add('removed');
    }

    // State management
    if (item.state === 'in_progress') {
      li.querySelector('[data-role="status-label"]').classList.remove('hidden');
      li.querySelector('[data-role="progress-container"]').classList.remove('hidden');
      li.querySelector('[data-role="inline-actions"]').classList.remove('hidden');
      updateDownloadRowProgress(li, item);
    } else if (item.state === 'complete') {
      if (isRemoved) {
        const statusLabel = li.querySelector('[data-role="status-label"]');
        statusLabel.classList.remove('hidden');
        statusLabel.textContent = 'Removed';
      } else {
        li.querySelector('[data-action="open"]').classList.remove('hidden');
      }
    } else if (item.state === 'interrupted') {
      const statusLabel = li.querySelector('[data-role="status-label"]');
      statusLabel.classList.remove('hidden');
      statusLabel.textContent = getFailedStatusText(item);

      const failedActions = li.querySelector('[data-role="failed-actions"]');
      const resumeFailedLink = li.querySelector('[data-action="resume-failed"]');
      const retryLink = li.querySelector('[data-action="retry"]');
      if (item.canResume) {
        failedActions.classList.remove('hidden');
        resumeFailedLink.classList.remove('hidden');
      } else if (getRetryUrl(item)) {
        failedActions.classList.remove('hidden');
        retryLink.classList.remove('hidden');
      }
    }

    if (item.state === 'complete' && !isRemoved) {
      li.querySelector('[data-action="show-folder"]').classList.remove('hidden');
    }

    const fileExists = item.state === 'complete' && item.exists;
    li.querySelector('[data-action="delete"]').title = fileExists ? 'Delete file' : 'Remove from history';

    return li;
  }

  function handleDownloadAction(action, item, row) {
    if (action === 'toggle-pause') {
      if (item.paused) {
        _browser.downloads.resume(item.id);
      } else {
        _browser.downloads.pause(item.id);
      }
    } else if (action === 'cancel') {
      _browser.downloads.cancel(item.id);
    } else if (action === 'resume-failed') {
      resumeFailedDownload(item);
    } else if (action === 'retry') {
      retryDownload(item);
    } else if (action === 'open') {
      openDownload(item.id);
    } else if (action === 'show-folder') {
      _browser.downloads.show(item.id);
    } else if (action === 'delete') {
      deleteDownload(item, row);
    }
  }

  function resumeFailedDownload(item) {
    _browser.downloads.resume(item.id, () => {
      if (_browser.runtime.lastError) {
        console.warn("[popup.js] Failed to resume download:", _browser.runtime.lastError.message);
        if (getRetryUrl(item)) {
          retryDownload(item);
        }
        return;
      }
      loadDownloads(searchInput.value);
    });
  }

  function retryDownload(item) {
    const retryUrl = getRetryUrl(item);
    if (!retryUrl) return;

    _browser.downloads.download({
      url: retryUrl,
      conflictAction: 'uniquify'
    }, () => {
      if (_browser.runtime.lastError) {
        console.warn("[popup.js] Failed to retry download:", _browser.runtime.lastError.message);
        return;
      }
      loadDownloads(searchInput.value);
    });
  }

  function openDownload(id) {
    // browser.downloads.open() works in Firefox
    _browser.downloads.open(id);
  }

  function deleteDownload(item, row) {
    const fileExists = item.state === 'complete' && item.exists;
    if (fileExists) {
      _browser.downloads.removeFile(item.id, () => {
        if (_browser.runtime.lastError) {
          eraseDownload(item, row);
          return;
        }
        item.exists = false;
        downloadItems.set(item.id, item);
        row.replaceWith(createDownloadRow(item));
      });
      return;
    }
    eraseDownload(item, row);
  }

  function eraseDownload(item, row) {
    _browser.downloads.erase({ id: item.id }, () => {
      fadeOutRow(row, () => {
        downloadItems.delete(item.id);
        if (list.children.length === 0) {
          emptyState.classList.remove('hidden');
        }
      });
    });
  }

  function fadeOutRow(row, afterRemove) {
    row.style.opacity = '0';
    row.style.transform = 'translateX(-10px)';
    row.style.transition = 'opacity 0.2s, transform 0.2s';
    setTimeout(() => {
      row.remove();
      afterRemove();
    }, 200);
  }

  function updateDownloadProgress(item) {
    const row = list.querySelector(`.download-item[data-id="${item.id}"]`);
    if (!row) return;

    const cachedItem = downloadItems.get(item.id) || {};
    const mergedItem = { ...cachedItem, ...item };
    downloadItems.set(item.id, mergedItem);
    updateDownloadRowProgress(row, mergedItem);
  }

  function updateDownloadRowProgress(row, item) {
    const received = item.bytesReceived || 0;
    const total = item.totalBytes || 0;
    const pct = total > 0 ? Math.round((received / total) * 100) : 0;
    const sizeStr = formatBytes(received) + (total > 0 ? ` of ${formatBytes(total)}` : '');

    const statusLabel = row.querySelector('[data-role="status-label"]');
    if (statusLabel) {
      statusLabel.textContent = `${pct}% - ${sizeStr}`;
    }

    const fill = row.querySelector('[data-role="progress-fill"]');
    if (fill) {
      fill.style.width = `${pct}%`;
    }

    const pauseLink = row.querySelector('[data-action="toggle-pause"]');
    if (pauseLink) {
      pauseLink.textContent = item.paused ? 'Resume' : 'Pause';
    }
  }

  // Generic SVG file icon (Firefox has no getFileIcon, so this is always used)
  function getFileIconSVG(ext, isRemoved) {
    const opacity = isRemoved ? 0.4 : 1.0;
    // Icon colour by common file type
    const colorMap = {
      pdf: '#e53935', zip: '#fb8c00', rar: '#fb8c00', '7z': '#fb8c00',
      mp4: '#8e24aa', mkv: '#8e24aa', avi: '#8e24aa', mov: '#8e24aa',
      mp3: '#00897b', wav: '#00897b', flac: '#00897b',
      jpg: '#1e88e5', jpeg: '#1e88e5', png: '#1e88e5', gif: '#1e88e5', webp: '#1e88e5',
      doc: '#1565c0', docx: '#1565c0',
      xls: '#2e7d32', xlsx: '#2e7d32',
      ppt: '#bf360c', pptx: '#bf360c',
      exe: '#546e7a', msi: '#546e7a',
      js: '#f9a825', ts: '#1976d2', py: '#4caf50', html: '#ef6c00', css: '#7b1fa2',
    };
    const color = colorMap[ext] || '#9e9e9e';
    return `
      <svg viewBox="0 0 24 24" style="opacity: ${opacity}">
        <path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="${color}"/>
        <path d="M14 2v5h5z" fill="rgba(255,255,255,0.3)"/>
        <text x="12" y="18" text-anchor="middle" fill="white" font-size="5" font-family="sans-serif" font-weight="bold">${ext.toUpperCase().slice(0, 4)}</text>
      </svg>
    `;
  }

  function getBasename(path) {
    if (!path) return 'Unknown File';
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] || 'Unknown File';
  }

  function getRetryUrl(item) {
    return item.finalUrl || item.url || '';
  }

  function getFailedStatusText(item) {
    if (!item.error) {
      return 'Failed / Interrupted';
    }
    const readableError = item.error
      .toLowerCase()
      .split('_')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
    return `Failed / ${readableError}`;
  }

  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
});

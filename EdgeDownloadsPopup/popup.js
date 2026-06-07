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
  const iconCache = new Map(); // Bộ đệm lưu trữ icon của tệp để tránh gọi API getFileIcon liên tục
  const downloadItems = new Map();

  // Kết nối tới background để báo hiệu popup đang mở
  chrome.runtime.connect({ name: 'popup' });

  // Clear complete badge if shown when user opens popup
  chrome.runtime.sendMessage({ action: 'clear-complete-badge' });

  // Initial load
  loadDownloads();

  btnSeeMore.addEventListener('click', () => {
    forceShowAll = true;
    loadDownloads();
  });

  // Real-time downloads monitoring
  chrome.downloads.onCreated.addListener(() => {
    loadDownloads();
  });

  chrome.downloads.onChanged.addListener((delta) => {
    // Chỉ tải lại toàn bộ danh sách khi có sự thay đổi về trạng thái quan trọng (state, paused, error, filename, exists)
    const hasCriticalChange = delta.state || delta.paused || delta.error || delta.filename || delta.exists;
    if (hasCriticalChange) {
      loadDownloads();
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
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
    chrome.downloads.showDefaultFolder();
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
    chrome.tabs.create({ url: 'chrome://downloads' });
  });

  menuClearAll.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all download history? (This will not delete the actual files)')) {
      chrome.downloads.erase({}, () => {
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

    chrome.runtime.sendMessage({ action: 'get-session-downloads' }, (response) => {
      if (currentRequestId !== loadRequestId) return;

      const sessionIds = (response && response.sessionDownloadIds) || [];

      const searchOptions = { 
        limit: 50,
        orderBy: ['-startTime']
      };
      if (query.trim() !== '') {
        searchOptions.query = [query];
      }

      chrome.downloads.search(searchOptions, function (items) {
        if (currentRequestId !== loadRequestId || requestedQuery !== searchInput.value) return;

        list.innerHTML = '';
        downloadItems.clear();
        
        // Lọc bỏ các tệp tin chưa có tên (ví dụ tệp crdownload khi bắt đầu tải)
        let validItems = items.filter(item => item.filename);

        // Chế độ hiển thị thu gọn hoạt động khi:
        // - Có ít nhất một tệp tải xuống trong phiên làm việc này
        // - Người dùng chưa bấm nút "See more" để xem toàn bộ lịch sử (forceShowAll là false)
        const isCollapsedView = sessionIds.length > 0 && !forceShowAll;

        if (isCollapsedView) {
          // Chỉ giữ lại các tệp đang tải hoặc được tải trong phiên này
          validItems = validItems.filter(item => 
            item.state === 'in_progress' || sessionIds.includes(item.id)
          );
          footerContainer.classList.remove('hidden');
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

  // Row Renderer
  function createDownloadRow(item) {
    const li = rowTemplate.content.firstElementChild.cloneNode(true);
    li.dataset.id = item.id;

    // File name and extension
    const filename = getBasename(item.filename);
    const ext = filename.split('.').pop().toLowerCase();

    // Check if the file is removed from disk
    const isRemoved = !item.exists && item.state === 'complete';

    const iconDiv = li.querySelector('[data-role="file-icon"]');
    iconDiv.innerHTML = getFileIconSVG(ext, isRemoved);

    // Sử dụng bộ đệm iconCache nếu đã được tải để tránh gọi getFileIcon liên tục (tối ưu hóa tài nguyên OS)
    if (iconCache.has(item.id)) {
      const iconUrl = iconCache.get(item.id);
      if (iconUrl) {
        const img = document.createElement('img');
        img.src = iconUrl;
        img.alt = ext;
        if (isRemoved) {
          img.style.opacity = '0.4';
        }
        iconDiv.innerHTML = '';
        iconDiv.appendChild(img);
      }
    } else {
      // Fetch native file icon from OS/Chrome
      chrome.downloads.getFileIcon(item.id, { size: 32 }, (iconUrl) => {
        // Clear runtime lastError if file doesn't exist to avoid console errors
        if (chrome.runtime.lastError) {
          return;
        }
        if (iconUrl) {
          iconCache.set(item.id, iconUrl); // Lưu vào bộ đệm
          if (!li.isConnected || li.dataset.id !== String(item.id)) {
            return;
          }
          const img = document.createElement('img');
          img.src = iconUrl;
          img.alt = ext;
          if (isRemoved) {
            img.style.opacity = '0.4';
          }
          iconDiv.innerHTML = '';
          iconDiv.appendChild(img);
        }
      });
    }

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

    // Show in folder button (only if download is complete and not removed)
    if (item.state === 'complete' && !isRemoved) {
      li.querySelector('[data-action="show-folder"]').classList.remove('hidden');
    }

    // Check if the file still exists to decide function
    const fileExists = item.state === 'complete' && item.exists;
    li.querySelector('[data-action="delete"]').title = fileExists ? 'Delete file' : 'Remove from history';

    return li;
  }

  function handleDownloadAction(action, item, row) {
    if (action === 'toggle-pause') {
      if (item.paused) {
        chrome.downloads.resume(item.id);
      } else {
        chrome.downloads.pause(item.id);
      }
    } else if (action === 'cancel') {
      chrome.downloads.cancel(item.id);
    } else if (action === 'resume-failed') {
      resumeFailedDownload(item);
    } else if (action === 'retry') {
      retryDownload(item);
    } else if (action === 'open') {
      openDownload(item.id);
    } else if (action === 'show-folder') {
      chrome.downloads.show(item.id);
    } else if (action === 'delete') {
      deleteDownload(item, row);
    }
  }

  function resumeFailedDownload(item) {
    chrome.downloads.resume(item.id, () => {
      if (chrome.runtime.lastError) {
        console.warn("[popup.js] Không thể tiếp tục lượt tải:", chrome.runtime.lastError.message);
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

    chrome.downloads.download({
      url: retryUrl,
      conflictAction: 'uniquify'
    }, () => {
      if (chrome.runtime.lastError) {
        console.warn("[popup.js] Không thể tải lại tệp:", chrome.runtime.lastError.message);
        return;
      }

      loadDownloads(searchInput.value);
    });
  }

  function openDownload(id) {
    chrome.downloads.open(id).catch((err) => {
      console.warn("[popup.js] Không thể mở tệp:", err.message);
    });
  }

  function deleteDownload(item, row) {
    const fileExists = item.state === 'complete' && item.exists;
    if (fileExists) {
      chrome.downloads.removeFile(item.id, () => {
        if (chrome.runtime.lastError) {
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
    chrome.downloads.erase({ id: item.id }, () => {
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

  // Default generic document fallback icon
  function getFileIconSVG(ext, isRemoved) {
    const opacity = isRemoved ? 0.4 : 1.0;
    return `
      <svg viewBox="0 0 24 24" style="opacity: ${opacity}">
        <path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#9e9e9e"/>
        <path d="M14 2v5h5z" fill="#e0e0e0"/>
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

  // Format File Bytes
  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
});

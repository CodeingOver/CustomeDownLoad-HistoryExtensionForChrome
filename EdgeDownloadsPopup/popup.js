document.addEventListener('DOMContentLoaded', function () {
  // Elements
  const list = document.getElementById('downloads-list');
  const emptyState = document.getElementById('empty-state');
  const searchInput = document.getElementById('search-input');
  const searchContainer = document.getElementById('search-container');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  
  const btnOpenFolder = document.getElementById('btn-open-folder');
  const btnToggleSearch = document.getElementById('btn-toggle-search');
  const btnMoreOptions = document.getElementById('btn-more-options');
  const moreDropdown = document.getElementById('more-dropdown');
  const menuOpenPage = document.getElementById('menu-open-page');
  const menuClearAll = document.getElementById('menu-clear-all');
  const btnSeeMore = document.getElementById('btn-see-more');

  let searchTimeout = null;
  let forceShowAll = false;

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

  chrome.downloads.onChanged.addListener(() => {
    // Throttle or just reload downloads to get updated states
    loadDownloads();
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
  function loadDownloads(query = '') {
    chrome.runtime.sendMessage({ action: 'get-session-downloads' }, (response) => {
      const sessionIds = (response && response.sessionDownloadIds) || [];

      const searchOptions = { 
        limit: 50,
        orderBy: ['-startTime']
      };
      if (query.trim() !== '') {
        searchOptions.query = [query];
      }

      chrome.downloads.search(searchOptions, function (items) {
        list.innerHTML = '';
        
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
          document.getElementById('footer-container').classList.remove('hidden');
        } else {
          document.getElementById('footer-container').classList.add('hidden');
        }

        if (!validItems || validItems.length === 0) {
          emptyState.classList.remove('hidden');
          return;
        }

        emptyState.classList.add('hidden');

        validItems.forEach(item => {
          const row = createDownloadRow(item);
          list.appendChild(row);
        });
      });
    });
  }

  // Row Renderer
  function createDownloadRow(item) {
    const li = document.createElement('li');
    li.className = 'download-item';
    li.dataset.id = item.id;

    // File name and extension
    const fullPath = item.filename || '';
    const filename = fullPath.substring(fullPath.lastIndexOf('\\') + 1) || 'Unknown File';
    const ext = filename.split('.').pop().toLowerCase();

    // Check if the file is removed from disk
    const isRemoved = !item.exists && item.state === 'complete';

    // File Icon
    const iconDiv = document.createElement('div');
    iconDiv.className = 'file-icon';
    iconDiv.innerHTML = getFileIconSVG(ext, isRemoved);

    // Fetch native file icon from OS/Chrome
    chrome.downloads.getFileIcon(item.id, { size: 32 }, (iconUrl) => {
      // Clear runtime lastError if file doesn't exist to avoid console errors
      if (chrome.runtime.lastError) {
        return;
      }
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
    });

    // Content container
    const contentDiv = document.createElement('div');
    contentDiv.className = 'item-content';

    // Filename Title
    const titleSpan = document.createElement('span');
    titleSpan.className = 'file-name';
    titleSpan.textContent = filename;
    if (isRemoved) {
      titleSpan.classList.add('removed');
    }

    contentDiv.appendChild(titleSpan);

    // State management
    if (item.state === 'in_progress') {
      // Progress calculation
      const received = item.bytesReceived;
      const total = item.totalBytes;
      const pct = total > 0 ? Math.round((received / total) * 100) : 0;
      const sizeStr = formatBytes(received) + (total > 0 ? ` of ${formatBytes(total)}` : '');
      
      // Status label
      const statusLabel = document.createElement('span');
      statusLabel.className = 'status-label';
      statusLabel.textContent = `${pct}% - ${sizeStr}`;
      contentDiv.appendChild(statusLabel);

      // Progress bar
      const progressContainer = document.createElement('div');
      progressContainer.className = 'progress-container';
      const bg = document.createElement('div');
      bg.className = 'progress-bar-bg';
      const fill = document.createElement('div');
      fill.className = 'progress-bar-fill';
      fill.style.width = `${pct}%`;
      bg.appendChild(fill);
      progressContainer.appendChild(bg);
      contentDiv.appendChild(progressContainer);

      // Pause/Cancel controls
      const controlsInline = document.createElement('div');
      controlsInline.className = 'download-actions-inline';
      
      const pauseLink = document.createElement('span');
      pauseLink.className = 'action-link';
      pauseLink.textContent = item.paused ? 'Resume' : 'Pause';
      pauseLink.addEventListener('click', (e) => {
        e.stopPropagation();
        if (item.paused) {
          chrome.downloads.resume(item.id);
        } else {
          chrome.downloads.pause(item.id);
        }
      });

      const cancelLink = document.createElement('span');
      cancelLink.className = 'action-link';
      cancelLink.textContent = 'Cancel';
      cancelLink.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.downloads.cancel(item.id);
      });

      controlsInline.appendChild(pauseLink);
      controlsInline.appendChild(cancelLink);
      contentDiv.appendChild(controlsInline);

    } else if (item.state === 'complete') {
      if (isRemoved) {
        const statusLabel = document.createElement('span');
        statusLabel.className = 'status-label';
        statusLabel.textContent = 'Removed';
        contentDiv.appendChild(statusLabel);
      } else {
        const openLink = document.createElement('span');
        openLink.className = 'open-link';
        openLink.textContent = 'Open file';
        openLink.addEventListener('click', (e) => {
          e.stopPropagation();
          chrome.downloads.open(item.id);
        });
        contentDiv.appendChild(openLink);

        // Click on the entire row opens the file too
        li.addEventListener('click', () => {
          chrome.downloads.open(item.id);
        });
      }
    } else if (item.state === 'interrupted') {
      const statusLabel = document.createElement('span');
      statusLabel.className = 'status-label';
      statusLabel.textContent = 'Failed / Interrupted';
      contentDiv.appendChild(statusLabel);
    }

    // Hover Controls (Show in folder, Erase from history list)
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'item-controls';

    // Show in folder button (only if download is complete and not removed)
    if (item.state === 'complete' && !isRemoved) {
      const showFolderBtn = document.createElement('button');
      showFolderBtn.className = 'control-btn';
      showFolderBtn.title = 'Show in folder';
      showFolderBtn.innerHTML = `
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">
          <path d="M2.5 4.5A1.5 1.5 0 0 1 4 3h3.5a1.5 1.5 0 0 1 1 .4l1.2 1.2a1.5 1.5 0 0 0 1 .4H16a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 16 15H4a1.5 1.5 0 0 1-1.5-1.5v-9z"/>
        </svg>
      `;
      showFolderBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.downloads.show(item.id);
      });
      controlsDiv.appendChild(showFolderBtn);
    }

    // Erase/Delete button (trash)
    const eraseBtn = document.createElement('button');
    eraseBtn.className = 'control-btn btn-delete';
    
    // Check if the file still exists to decide function
    const fileExists = item.state === 'complete' && item.exists;
    if (fileExists) {
      eraseBtn.title = 'Delete file';
      eraseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.downloads.removeFile(item.id, () => {
          if (chrome.runtime.lastError) {
            // Fallback to erase if removing file fails
            chrome.downloads.erase({ id: item.id }, () => {
              // Fade out animation
              li.style.opacity = '0';
              li.style.transform = 'translateX(-10px)';
              li.style.transition = 'opacity 0.2s, transform 0.2s';
              setTimeout(() => {
                li.remove();
                if (list.querySelectorAll('.download-item').length === 0) {
                  emptyState.classList.remove('hidden');
                }
              }, 200);
            });
          } else {
            // Success: update the item state to exists = false, and re-render the row
            item.exists = false;
            const newLi = createDownloadRow(item);
            li.replaceWith(newLi);
          }
        });
      });
    } else {
      eraseBtn.title = 'Remove from history';
      eraseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.downloads.erase({ id: item.id }, () => {
          // Fade out animation
          li.style.opacity = '0';
          li.style.transform = 'translateX(-10px)';
          li.style.transition = 'opacity 0.2s, transform 0.2s';
          setTimeout(() => {
            li.remove();
            if (list.querySelectorAll('.download-item').length === 0) {
              emptyState.classList.remove('hidden');
            }
          }, 200);
        });
      });
    }

    eraseBtn.innerHTML = `
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">
        <path d="M3 5h14M7 5V3.5A1.5 1.5 0 0 1 8.5 2h3A1.5 1.5 0 0 1 13 3.5V5m2.5 0v10.5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5V5h11z"/>
      </svg>
    `;
    controlsDiv.appendChild(eraseBtn);

    li.appendChild(iconDiv);
    li.appendChild(contentDiv);
    li.appendChild(controlsDiv);

    return li;
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

  // Format File Bytes
  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  // Polling mượt mà thời gian thực khi popup đang mở
  const progressInterval = setInterval(() => {
    chrome.downloads.search({ state: 'in_progress' }, (items) => {
      if (!items || items.length === 0) {
        return;
      }
      items.forEach(item => {
        const row = list.querySelector(`.download-item[data-id="${item.id}"]`);
        if (row) {
          const received = item.bytesReceived;
          const total = item.totalBytes;
          const pct = total > 0 ? Math.round((received / total) * 100) : 0;
          const sizeStr = formatBytes(received) + (total > 0 ? ` of ${formatBytes(total)}` : '');
          
          // Cập nhật nhãn phần trăm và dung lượng
          const statusLabel = row.querySelector('.status-label');
          if (statusLabel) {
            statusLabel.textContent = `${pct}% - ${sizeStr}`;
          }
          
          // Cập nhật thanh tiến trình
          const fill = row.querySelector('.progress-bar-fill');
          if (fill) {
            fill.style.width = `${pct}%`;
          }
        }
      });
    });
  }, 1000);

  // Dọn dẹp interval khi popup đóng
  window.addEventListener('unload', () => {
    clearInterval(progressInterval);
  });
});

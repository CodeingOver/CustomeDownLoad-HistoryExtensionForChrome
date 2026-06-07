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

  let searchTimeout = null;

  // Initial load
  loadDownloads();

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
    const searchOptions = { limit: 50 };
    if (query.trim() !== '') {
      searchOptions.query = [query];
    }

    chrome.downloads.search(searchOptions, function (items) {
      list.innerHTML = '';
      
      // Filter out files that don't have filename yet (e.g. crdownload files starting up)
      const validItems = items.filter(item => item.filename);

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
        <svg viewBox="0 0 16 16" width="12" height="12">
          <path fill="currentColor" d="M1.5 3A1.5 1.5 0 0 1 3 1.5h3.84a1.5 1.5 0 0 1 1.06.44l1.32 1.32c.1.1.23.15.37.15H13A1.5 1.5 0 0 1 14.5 5v7.5A1.5 1.5 0 0 1 13 14H3a1.5 1.5 0 0 1-1.5-1.5V3zM3 2.5a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5V5a.5.5 0 0 0-.5-.5H9.13a1.5 1.5 0 0 1-1.06-.44L6.75 2.74A.5.5 0 0 0 6.4 2.6H3v-.1z"/>
        </svg>
      `;
      showFolderBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.downloads.show(item.id);
      });
      controlsDiv.appendChild(showFolderBtn);
    }

    // Erase button (trash)
    const eraseBtn = document.createElement('button');
    eraseBtn.className = 'control-btn btn-delete';
    eraseBtn.title = 'Remove from download history';
    eraseBtn.innerHTML = `
      <svg viewBox="0 0 16 16" width="12" height="12">
        <path fill="currentColor" d="M5.5 1v1h5V1h-5zM3 3h10v1H3V3zm1 2h8v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5zm2 1v7h1V6H6zm3 0v7h1V6H9z"/>
      </svg>
    `;
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
    controlsDiv.appendChild(eraseBtn);

    li.appendChild(iconDiv);
    li.appendChild(contentDiv);
    li.appendChild(controlsDiv);

    return li;
  }

  // Vector icon selector for file types
  function getFileIconSVG(ext, isRemoved) {
    const opacity = isRemoved ? 0.4 : 1.0;
    
    // 1. Word Document (.docx, .doc) - Blue with 'W'
    if (['docx', 'doc', 'odt'].includes(ext)) {
      return `
        <svg viewBox="0 0 24 24" style="opacity: ${opacity}">
          <rect x="2" y="2" width="20" height="20" rx="3" fill="#185abd"/>
          <path d="M7 6.5h3L12 14l2-7.5h3l-3.5 12h-3L7 6.5z" fill="#ffffff"/>
        </svg>
      `;
    }

    // 2. Excel spreadsheet (.xlsx, .xls, .csv) - Green with 'X'
    if (['xlsx', 'xls', 'csv', 'ods'].includes(ext)) {
      return `
        <svg viewBox="0 0 24 24" style="opacity: ${opacity}">
          <rect x="2" y="2" width="20" height="20" rx="3" fill="#107c41"/>
          <path d="M7 6.5h3.5L12 11l1.5-4.5H17l-3.5 6 3.5 6h-3.5L12 14l-1.5 4.5H7l3.5-6L7 6.5z" fill="#ffffff"/>
        </svg>
      `;
    }

    // 3. PDF file (.pdf) - Red with generic PDF logo/sheet
    if (ext === 'pdf') {
      return `
        <svg viewBox="0 0 24 24" style="opacity: ${opacity}">
          <rect x="2" y="2" width="20" height="20" rx="3" fill="#e01b1b"/>
          <path d="M6 6v12h12V6H6zm1 1h10v10H7V7zm2 2v2h6V9H9z" fill="#ffffff"/>
          <text x="12" y="15" font-family="Segoe UI, sans-serif" font-weight="900" font-size="6px" fill="#ffffff" text-anchor="middle">PDF</text>
        </svg>
      `;
    }

    // 4. Compressed files (.zip, .rar, .7z, .tar, .gz) - Yellow zipped folder
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return `
        <svg viewBox="0 0 24 24" style="opacity: ${opacity}">
          <path d="M20 6h-8l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z" fill="#d0a400"/>
          <path d="M10 6h4v8h-4z" fill="#eaeaea"/>
          <path d="M11 7h2v1h-2zm0 2h2v1h-2zm0 2h2v1h-2z" fill="#555555"/>
        </svg>
      `;
    }

    // 5. Java files (.jar, .java, .class) - Java Orange Cup
    if (['jar', 'java', 'class'].includes(ext)) {
      return `
        <svg viewBox="0 0 24 24" style="opacity: ${opacity}">
          <rect x="2" y="2" width="20" height="20" rx="3" fill="#e76f51"/>
          <path d="M9 19c0 1 1.5 1 3 1s3 0 3-1-1.5-1-3-1-3 0-3 1zm-1-4c0 1.5 1.5 2.5 4 2.5s4-1 4-2.5V9H8v6zm6-4h2V9h-2v2z" fill="#ffffff"/>
        </svg>
      `;
    }

    // 6. Text files (.txt, .log, .md, .ini, .json, .xml) - Grey Document
    if (['txt', 'log', 'md', 'ini', 'json', 'xml', 'css', 'js', 'html'].includes(ext)) {
      return `
        <svg viewBox="0 0 24 24" style="opacity: ${opacity}">
          <path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#757575"/>
          <path d="M14 2v5h5z" fill="#bdbdbd"/>
          <path d="M7 10h10v1H7zm0 3h10v1H7zm0 3h7v1H7z" fill="#ffffff"/>
        </svg>
      `;
    }

    // 7. Image files (.png, .jpg, .jpeg, .gif, .svg, .webp) - Teal/Green Image Icon
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) {
      return `
        <svg viewBox="0 0 24 24" style="opacity: ${opacity}">
          <rect x="2" y="2" width="20" height="20" rx="3" fill="#008080"/>
          <circle cx="8.5" cy="8.5" r="2.5" fill="#ffffff"/>
          <path d="M4 19l6-8 4 5 2-3 4 6H4z" fill="#ffffff"/>
        </svg>
      `;
    }

    // Default Fallback file icon - Grey Document icon
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
});

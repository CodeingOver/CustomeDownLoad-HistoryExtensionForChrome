document.addEventListener('DOMContentLoaded', function () {
  // Elements
  const tabs = document.querySelectorAll('.tab');
  const list = document.getElementById('history-list');
  const listWrapper = document.querySelector('.list-wrapper');
  const emptyState = document.getElementById('empty-state');
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  const btnClearData = document.getElementById('btn-clear-data');
  const btnMoreOptions = document.getElementById('btn-more-options');
  const moreDropdown = document.getElementById('more-dropdown');
  const menuOpenPage = document.getElementById('menu-open-page');
  const menuClearAll = document.getElementById('menu-clear-all');
  const btnPin = document.getElementById('btn-pin');

  let activeTabId = 'tab-all';
  let searchTimeout = null;
  let oldestTimestamp = null;
  let isLoading = false;
  let hasMore = true;
  const PAGE_SIZE = 50;

  // Initial load
  loadActiveTab();

  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeTabId = tab.id;
      loadActiveTab();
    });
  });

  // Scroll to load more history
  listWrapper.addEventListener('scroll', () => {
    if (activeTabId === 'tab-all') {
      const threshold = 30;
      if (listWrapper.scrollTop + listWrapper.clientHeight >= listWrapper.scrollHeight - threshold) {
        fetchHistory(searchInput.value, true);
      }
    }
  });

  // Action Buttons
  btnClearData.addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://settings/clearBrowserData' });
  });

  btnMoreOptions.addEventListener('click', (e) => {
    e.stopPropagation();
    moreDropdown.classList.toggle('hidden');
  });

  document.addEventListener('click', () => {
    moreDropdown.classList.add('hidden');
  });

  menuOpenPage.addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://history/' });
  });

  menuClearAll.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all history list? (This will open settings to clear history)')) {
      chrome.tabs.create({ url: 'chrome://settings/clearBrowserData' });
    }
  });

  btnPin.addEventListener('click', () => {
    alert('Pinning is simulated! Chrome Extension popups are always top-level dialogs.');
  });

  // Search input events
  searchInput.addEventListener('input', () => {
    const value = searchInput.value;
    if (value.trim() !== '') {
      clearSearchBtn.classList.remove('hidden');
    } else {
      clearSearchBtn.classList.add('hidden');
    }

    // Debounce search
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      loadActiveTab(value);
    }, 200);
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.classList.add('hidden');
    searchInput.focus();
    loadActiveTab();
  });

  // Main Loader
  function loadActiveTab(query = '') {
    list.innerHTML = '';
    emptyState.classList.add('hidden');
    oldestTimestamp = null;
    isLoading = false;
    hasMore = true;

    if (activeTabId === 'tab-all') {
      fetchHistory(query);
    } else if (activeTabId === 'tab-closed') {
      fetchRecentlyClosed(query);
    }
  }

  // --- 1. History Tab ---
  function fetchHistory(queryText = '', isNextPage = false) {
    if (isLoading || !hasMore) return;
    isLoading = true;

    const searchOptions = { text: queryText, maxResults: PAGE_SIZE };
    if (oldestTimestamp) {
      searchOptions.endTime = oldestTimestamp;
    }

    chrome.history.search(searchOptions, function (data) {
      isLoading = false;
      if (!data || data.length === 0) {
        hasMore = false;
        if (!isNextPage) {
          showEmptyState();
        }
        return;
      }

      if (data.length < PAGE_SIZE) {
        hasMore = false;
      }

      const lastItem = data[data.length - 1];
      oldestTimestamp = lastItem.lastVisitTime;

      // Group items
      const groups = groupHistoryItems(data);
      renderGroupedHistory(groups, isNextPage);
    });
  }

  function groupHistoryItems(items) {
    const groups = {};

    items.forEach(item => {
      const date = new Date(item.lastVisitTime);
      const groupName = formatDateHeader(date);

      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(item);
    });

    return groups;
  }

  function renderGroupedHistory(groups, isNextPage = false) {
    const groupNames = Object.keys(groups);
    
    // Sort group names in reverse chronological order
    groupNames.sort((a, b) => {
      return new Date(b.split(' - ')[1] || b) - new Date(a.split(' - ')[1] || a);
    });

    groupNames.forEach(name => {
      // Filter out duplicate items first
      const uniqueItems = groups[name].filter(item => {
        const existing = list.querySelector(`.history-item[data-url="${CSS.escape(item.url)}"]`);
        if (existing) {
          const itemsWithSameUrl = list.querySelectorAll(`.history-item[data-url="${CSS.escape(item.url)}"]`);
          for (let row of itemsWithSameUrl) {
            if (row.dataset.time == item.lastVisitTime) {
              return false; // duplicate
            }
          }
        }
        return true;
      });

      // If no unique items in this group, do not render group header or items
      if (uniqueItems.length === 0) return;

      let groupHeaderLi = null;

      // Check if header already exists
      const headers = list.querySelectorAll('.group-header');
      if (headers.length > 0) {
        const lastHeader = headers[headers.length - 1];
        if (lastHeader.textContent === name) {
          groupHeaderLi = lastHeader;
        }
      }

      if (!groupHeaderLi) {
        groupHeaderLi = document.createElement('li');
        groupHeaderLi.className = 'group-header';
        groupHeaderLi.textContent = name;
        list.appendChild(groupHeaderLi);
      }

      // Group Items
      uniqueItems.forEach(item => {
        const itemLi = createHistoryItemRow(item);
        list.appendChild(itemLi);
      });
    });
  }

  function createHistoryItemRow(item) {
    const li = document.createElement('li');
    li.className = 'history-item';
    li.dataset.url = item.url;
    li.dataset.time = item.lastVisitTime;
    li.title = `${item.title || item.url}\n${item.url}`;

    // Icon container
    const iconDiv = document.createElement('div');
    iconDiv.className = 'item-icon';
    const img = document.createElement('img');
    img.src = getFaviconUrl(item.url);
    img.onerror = () => {
      // Fallback SVG if favicon fails to load
      img.style.display = 'none';
      iconDiv.innerHTML = `
        <svg viewBox="0 0 16 16" width="16" height="16">
          <path fill="currentColor" d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm0 1c3.86 0 7 3.14 7 7a6.96 6.96 0 0 1-1.63 4.47L11.5 10.6A3.5 3.5 0 0 0 8 7a3.5 3.5 0 0 0-3.5 3.6l-1.87 1.87A6.96 6.96 0 0 1 1 8c0-3.86 3.14-7 7-7zM2.08 12.08l1.87-1.87C4.1 12.05 5.9 13 8 13c2.1 0 3.9-.95 4.05-2.79l1.87 1.87A6.97 6.97 0 0 1 8 15a6.97 6.97 0 0 1-5.92-2.92z"/>
        </svg>
      `;
    };
    iconDiv.appendChild(img);

    // Title
    const titleSpan = document.createElement('span');
    titleSpan.className = 'item-title';
    titleSpan.textContent = item.title || item.url;

    // Time
    const timeSpan = document.createElement('span');
    timeSpan.className = 'item-time';
    timeSpan.textContent = formatTime(item.lastVisitTime);

    // Delete Button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'item-delete';
    deleteBtn.title = 'Remove from history';
    deleteBtn.innerHTML = `
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
        <path d="M4 4l12 12M16 4L4 16"/>
      </svg>
    `;

    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.history.deleteUrl({ url: item.url }, () => {
        // Fade out and remove from list
        li.style.opacity = '0';
        li.style.transform = 'translateX(-10px)';
        li.style.transition = 'opacity 0.2s, transform 0.2s';
        setTimeout(() => {
          li.remove();
          // Check if group has items, if not, remove header
          checkAndCleanHeaders();
        }, 200);
      });
    });

    li.appendChild(iconDiv);
    li.appendChild(titleSpan);
    li.appendChild(timeSpan);
    li.appendChild(deleteBtn);

    // Open link in new tab on click
    li.addEventListener('click', () => {
      chrome.tabs.create({ url: item.url });
      window.close();
    });

    return li;
  }

  // --- 2. Recently Closed Tab ---
  function fetchRecentlyClosed(queryText = '') {
    if (!chrome.sessions || !chrome.sessions.getRecentlyClosed) {
      showEmptyState();
      return;
    }

    chrome.sessions.getRecentlyClosed({ maxResults: 25 }, function (sessions) {
      if (!sessions || sessions.length === 0) {
        showEmptyState();
        return;
      }

      // Filter by query if searching
      const query = queryText.toLowerCase();
      const filtered = sessions.filter(session => {
        if (!query) return true;
        if (session.tab) {
          return (session.tab.title || '').toLowerCase().includes(query) || (session.tab.url || '').toLowerCase().includes(query);
        } else if (session.window && session.window.tabs) {
          return session.window.tabs.some(tab => 
            (tab.title || '').toLowerCase().includes(query) || (tab.url || '').toLowerCase().includes(query)
          );
        }
        return false;
      });

      if (filtered.length === 0) {
        showEmptyState();
        return;
      }

      // Render Header
      const headerLi = document.createElement('li');
      headerLi.className = 'group-header';
      headerLi.textContent = 'Recently closed';
      list.appendChild(headerLi);

      filtered.forEach(session => {
        if (session.tab) {
          const tab = session.tab;
          const li = createSessionRow(tab.title || tab.url, tab.url, session.lastModified, () => {
            chrome.sessions.restore(tab.sessionId);
            window.close();
          });
          list.appendChild(li);
        } else if (session.window) {
          const win = session.window;
          const label = `Window (${win.tabs.length} tabs)`;
          const firstTabUrl = win.tabs[0] ? win.tabs[0].url : '';
          const li = createSessionRow(label, firstTabUrl, session.lastModified, () => {
            chrome.sessions.restore(win.sessionId);
            window.close();
          }, true);
          list.appendChild(li);
        }
      });
    });
  }

  function createSessionRow(title, url, timestamp, restoreCallback, isWindow = false) {
    const li = document.createElement('li');
    li.className = 'history-item';
    li.title = isWindow ? title : `${title}\n${url}`;

    // Icon
    const iconDiv = document.createElement('div');
    iconDiv.className = 'item-icon';
    if (isWindow) {
      iconDiv.innerHTML = `
        <svg viewBox="0 0 16 16" width="16" height="16">
          <path fill="currentColor" d="M2.5 2h11A1.5 1.5 0 0 1 15 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9A1.5 1.5 0 0 1 2.5 2zM2 3.5v9c0 .28.22.5.5.5h11a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-11a.5.5 0 0 0-.5.5zm1.5 2h9v1h-9v-1z"/>
        </svg>
      `;
    } else {
      const img = document.createElement('img');
      img.src = getFaviconUrl(url);
      img.onerror = () => {
        img.style.display = 'none';
        iconDiv.innerHTML = `
          <svg viewBox="0 0 16 16" width="16" height="16">
            <path fill="currentColor" d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm0 1c3.86 0 7 3.14 7 7a6.96 6.96 0 0 1-1.63 4.47L11.5 10.6A3.5 3.5 0 0 0 8 7a3.5 3.5 0 0 0-3.5 3.6l-1.87 1.87A6.96 6.96 0 0 1 1 8c0-3.86 3.14-7 7-7zM2.08 12.08l1.87-1.87C4.1 12.05 5.9 13 8 13c2.1 0 3.9-.95 4.05-2.79l1.87 1.87A6.97 6.97 0 0 1 8 15a6.97 6.97 0 0 1-5.92-2.92z"/>
          </svg>
        `;
      };
      iconDiv.appendChild(img);
    }

    // Title
    const titleSpan = document.createElement('span');
    titleSpan.className = 'item-title';
    titleSpan.textContent = title;

    // Time
    const timeSpan = document.createElement('span');
    timeSpan.className = 'item-time';
    timeSpan.textContent = formatTime(timestamp * 1000); // sessions uses seconds

    li.appendChild(iconDiv);
    li.appendChild(titleSpan);
    li.appendChild(timeSpan);

    li.addEventListener('click', restoreCallback);

    return li;
  }



  // --- Helper Functions ---

  function showEmptyState() {
    list.innerHTML = '';
    emptyState.classList.remove('hidden');
  }

  function getFaviconUrl(url) {
    try {
      const parsedUrl = new URL(url);
      return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(parsedUrl.origin)}&size=32`;
    } catch (e) {
      return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`;
    }
  }

  function formatTime(timestamp) {
    const date = new Date(timestamp);
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'AM' : 'PM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutesStr} ${ampm}`;
  }

  function formatDateHeader(date) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const dayName = days[date.getDay()];
    const monthName = months[date.getMonth()];
    const dayNum = date.getDate();
    const year = date.getFullYear();

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return `Today - ${dayName}, ${monthName} ${dayNum}, ${year}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday - ${dayName}, ${monthName} ${dayNum}, ${year}`;
    } else {
      return `${dayName}, ${monthName} ${dayNum}, ${year}`;
    }
  }

  function checkAndCleanHeaders() {
    const items = list.querySelectorAll('li');
    let lastHeader = null;
    let itemCountForHeader = 0;

    items.forEach(item => {
      if (item.classList.contains('group-header')) {
        if (lastHeader && itemCountForHeader === 0) {
          lastHeader.remove();
        }
        lastHeader = item;
        itemCountForHeader = 0;
      } else if (item.classList.contains('history-item')) {
        itemCountForHeader++;
      }
    });

    // Clean up trailing header
    if (lastHeader && itemCountForHeader === 0) {
      lastHeader.remove();
    }

    // If completely empty, show empty state
    if (list.querySelectorAll('.history-item').length === 0) {
      showEmptyState();
    }
  }
});

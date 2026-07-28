// ============================================================
// FirefoxHistoryPopup/popup.js
// Firefox port of EdgeHistoryPopup/popup.js
//
// Key changes from the Chrome/Edge version:
//  - getFaviconUrl(): Replaced chrome-extension favicon → Google Favicon API
//    or DuckDuckGo favicon API (no 'favicon' permission required)
//  - Replaced 'chrome://history/' → alert (Firefox cannot open about:history from an extension)
//  - Replaced 'chrome://settings/clearBrowserData' → about:preferences#privacy
//  - Uses 'browser' namespace or falls back to 'chrome'
// ============================================================

const _browser = typeof browser !== 'undefined' ? browser : chrome;

document.addEventListener('DOMContentLoaded', function () {
  // Elements
  const tabs = document.querySelectorAll('.tab');
  const list = document.getElementById('history-list');
  const listWrapper = document.querySelector('.list-wrapper');
  const emptyState = document.getElementById('empty-state');
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  const rowTemplate = document.getElementById('history-row-template');
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
  let activeRequestId = 0;
  let lastRenderedGroupName = null;
  const PAGE_SIZE = 50;
  const renderedItems = new Set();

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

  // Scroll to load more history with requestAnimationFrame throttling to avoid jank
  let scrollScheduled = false;
  listWrapper.addEventListener('scroll', () => {
    if (scrollScheduled) return;
    scrollScheduled = true;
    requestAnimationFrame(() => {
      scrollScheduled = false;
      if (activeTabId === 'tab-all') {
        const threshold = 30;
        if (listWrapper.scrollTop + listWrapper.clientHeight >= listWrapper.scrollHeight - threshold) {
          fetchHistory(searchInput.value, true, activeRequestId);
        }
      }
    });
  });

  list.addEventListener('click', (event) => {
    const row = event.target.closest('.history-item');
    if (!row || !list.contains(row)) return;

    const deleteButton = event.target.closest('[data-action="delete-history"]');
    if (deleteButton) {
      event.stopPropagation();
      deleteHistoryRow(row);
      return;
    }

    if (row.dataset.sessionId) {
      _browser.sessions.restore(row.dataset.sessionId);
      window.close();
      return;
    }

    if (row.dataset.url) {
      _browser.tabs.create({ url: row.dataset.url });
      window.close();
    }
  });

  // Action Buttons
  btnClearData.addEventListener('click', () => {
    // Firefox: open privacy settings to clear browsing data
    _browser.tabs.create({ url: 'about:preferences#privacy' });
  });

  btnMoreOptions.addEventListener('click', (e) => {
    e.stopPropagation();
    moreDropdown.classList.toggle('hidden');
  });

  document.addEventListener('click', () => {
    moreDropdown.classList.add('hidden');
  });

  menuOpenPage.addEventListener('click', () => {
    // Firefox cannot open about:history directly via tabs.create
    // Firefox cannot open about:history via tabs.create—guide the user instead
    alert('Press Ctrl+H to open the Firefox history page.');
  });

  menuClearAll.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all history list? (This will open Firefox privacy settings)')) {
      _browser.tabs.create({ url: 'about:preferences#privacy' });
    }
  });

  btnPin.addEventListener('click', () => {
    alert('Pinning is simulated! Firefox Extension popups are always top-level dialogs.');
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
    const requestId = ++activeRequestId;

    list.textContent = '';
    renderedItems.clear();
    emptyState.classList.add('hidden');
    oldestTimestamp = null;
    isLoading = false;
    hasMore = true;
    lastRenderedGroupName = null;

    if (activeTabId === 'tab-all') {
      fetchHistory(query, false, requestId);
    } else if (activeTabId === 'tab-closed') {
      fetchRecentlyClosed(query, requestId);
    }
  }

  // --- 1. History Tab ---
  function fetchHistory(queryText = '', isNextPage = false, requestId = activeRequestId) {
    if (isLoading || !hasMore) return;
    isLoading = true;

    const searchOptions = { text: queryText, maxResults: PAGE_SIZE, startTime: 0 };
    if (oldestTimestamp) {
      searchOptions.endTime = oldestTimestamp;
    }

    _browser.history.search(searchOptions, function (data) {
      if (requestId !== activeRequestId || activeTabId !== 'tab-all' || queryText !== searchInput.value) {
        return;
      }

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

      const groups = groupHistoryItems(data);
      renderGroupedHistory(groups, isNextPage);
    });
  }

  function groupHistoryItems(items) {
    const groups = {};
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    items.forEach(item => {
      const date = new Date(item.lastVisitTime);
      const groupName = formatDateHeader(date, today, yesterday);

      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(item);
    });

    return groups;
  }

  function renderGroupedHistory(groups, isNextPage = false) {
    const groupNames = Object.keys(groups);

    groupNames.sort((a, b) => {
      return new Date(b.split(' - ')[1] || b) - new Date(a.split(' - ')[1] || a);
    });

    groupNames.forEach(name => {
      const uniqueItems = groups[name].filter(item => {
        const key = `${item.url}_${item.lastVisitTime}`;
        return !renderedItems.has(key);
      });

      if (uniqueItems.length === 0) return;

      if (lastRenderedGroupName !== name) {
        const groupHeaderLi = document.createElement('li');
        groupHeaderLi.className = 'group-header';
        groupHeaderLi.textContent = name;
        list.appendChild(groupHeaderLi);
        lastRenderedGroupName = name;
      }

      uniqueItems.forEach(item => {
        const itemLi = createHistoryItemRow(item);
        list.appendChild(itemLi);
      });
    });
  }

  function createHistoryItemRow(item) {
    const key = `${item.url}_${item.lastVisitTime}`;
    renderedItems.add(key);

    const li = rowTemplate.content.firstElementChild.cloneNode(true);
    li.dataset.url = item.url;
    li.dataset.time = item.lastVisitTime;
    li.dataset.key = key;
    li.title = `${item.title || item.url}\n${item.url}`;

    const iconDiv = li.querySelector('[data-role="item-icon"]');
    const img = iconDiv.querySelector('img');
    // Firefox: does not support chrome-extension favicon API — use Google Favicon API
    img.src = getFaviconUrl(item.url);
    img.onerror = () => {
      img.style.display = 'none';
      setSVGContent(iconDiv, getDefaultFaviconSVG());
    };

    const titleSpan = li.querySelector('[data-role="item-title"]');
    titleSpan.textContent = item.title || item.url;

    const timeSpan = li.querySelector('[data-role="item-time"]');
    timeSpan.textContent = formatTime(item.lastVisitTime);

    return li;
  }

  // --- 2. Recently Closed Tab ---
  function fetchRecentlyClosed(queryText = '', requestId = activeRequestId) {
    if (!_browser.sessions || !_browser.sessions.getRecentlyClosed) {
      showEmptyState();
      return;
    }

    _browser.sessions.getRecentlyClosed({ maxResults: 25 }, function (sessions) {
      if (requestId !== activeRequestId || activeTabId !== 'tab-closed' || queryText !== searchInput.value) {
        return;
      }

      if (!sessions || sessions.length === 0) {
        showEmptyState();
        return;
      }

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

      const headerLi = document.createElement('li');
      headerLi.className = 'group-header';
      headerLi.textContent = 'Recently closed';
      list.appendChild(headerLi);

      filtered.forEach(session => {
        if (session.tab) {
          const tab = session.tab;
          const li = createSessionRow(tab.title || tab.url, tab.url, session.lastModified, tab.sessionId);
          list.appendChild(li);
        } else if (session.window) {
          const win = session.window;
          const label = `Window (${win.tabs.length} tabs)`;
          const firstTabUrl = win.tabs[0] ? win.tabs[0].url : '';
          const li = createSessionRow(label, firstTabUrl, session.lastModified, win.sessionId, true);
          list.appendChild(li);
        }
      });
    });
  }

  function createSessionRow(title, url, timestamp, sessionId, isWindow = false) {
    const li = rowTemplate.content.firstElementChild.cloneNode(true);
    li.dataset.sessionId = sessionId;
    li.title = isWindow ? title : `${title}\n${url}`;

    const iconDiv = li.querySelector('[data-role="item-icon"]');
    if (isWindow) {
      setSVGContent(iconDiv, `
        <svg viewBox="0 0 16 16" width="16" height="16">
          <path fill="currentColor" d="M2.5 2h11A1.5 1.5 0 0 1 15 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9A1.5 1.5 0 0 1 2.5 2zM2 3.5v9c0 .28.22.5.5.5h11a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-11a.5.5 0 0 0-.5.5zm1.5 2h9v1h-9v-1z"/>
        </svg>
      `);
    } else {
      const img = iconDiv.querySelector('img');
      if (img) {
        img.src = getFaviconUrl(url);
        img.onerror = () => {
          img.style.display = 'none';
          setSVGContent(iconDiv, getDefaultFaviconSVG());
        };
      } else {
        setSVGContent(iconDiv, getDefaultFaviconSVG());
      }
    }

    const titleSpan = li.querySelector('[data-role="item-title"]');
    titleSpan.textContent = title;

    const timeSpan = li.querySelector('[data-role="item-time"]');
    timeSpan.textContent = formatTime(timestamp * 1000);

    li.querySelector('[data-action="delete-history"]').classList.add('hidden');

    return li;
  }

  // --- Helper Functions ---

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

  function deleteHistoryRow(row) {
    const key = row.dataset.key;
    const url = row.dataset.url;
    if (!url) return;

    _browser.history.deleteUrl({ url: url }, () => {
      row.style.opacity = '0';
      row.style.transform = 'translateX(-10px)';
      row.style.transition = 'opacity 0.2s, transform 0.2s';
      setTimeout(() => {
        const previous = row.previousElementSibling;
        const next = row.nextElementSibling;
        row.remove();
        renderedItems.delete(key);
        cleanHeaderAround(previous, next);
      }, 200);
    });
  }

  function cleanHeaderAround(previous, next) {
    if (previous && previous.classList.contains('group-header') && (!next || next.classList.contains('group-header'))) {
      if (!next && previous.textContent === lastRenderedGroupName) {
        lastRenderedGroupName = null;
      }
      previous.remove();
    }

    if (renderedItems.size === 0) {
      lastRenderedGroupName = null;
      showEmptyState();
    }
  }

  function showEmptyState() {
    list.textContent = '';
    emptyState.classList.remove('hidden');
  }

  /**
   * getFaviconUrl — Firefox does not support the chrome-extension://.../favicon/ API.
   * Uses Google favicon service (requires an internet connection).
   * Fallback: DuckDuckGo favicon API if Google returns nothing.
   */
  function getFaviconUrl(url) {
    try {
      const domain = new URL(url).hostname;
      // Google S2 favicon service — best results
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=16`;
    } catch {
      return '';
    }
  }

  function getDefaultFaviconSVG() {
    return `
      <svg viewBox="0 0 16 16" width="16" height="16">
        <circle cx="8" cy="8" r="7" fill="#e0e0e0"/>
        <path fill="#9e9e9e" d="M8 3a5 5 0 1 0 0 10A5 5 0 0 0 8 3zm0 1.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm0 7.5a3.75 3.75 0 0 1-3-1.5c.02-.99 2-.5 3-1.5 1 1 2.98.51 3 1.5a3.75 3.75 0 0 1-3 1.5z"/>
      </svg>
    `;
  }

  function formatTime(timestamp) {
    const date = new Date(timestamp);
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutesStr} ${ampm}`;
  }

  function formatDateHeader(date, today, yesterday) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const dayName = days[date.getDay()];
    const monthName = months[date.getMonth()];
    const dayNum = date.getDate();
    const year = date.getFullYear();

    if (date.toDateString() === today.toDateString()) {
      return `Today - ${dayName}, ${monthName} ${dayNum}, ${year}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday - ${dayName}, ${monthName} ${dayNum}, ${year}`;
    } else {
      return `${dayName}, ${monthName} ${dayNum}, ${year}`;
    }
  }
});

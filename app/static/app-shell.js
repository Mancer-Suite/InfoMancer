(() => {
  const body = document.body;
  if (!body) return;

  const csrfToken = body.dataset.csrfToken || '';
  const ensureCsrf = (form) => {
    if (!csrfToken || !form?.matches?.('form[method="post" i]')) return;
    if (form.querySelector('input[name="csrf_token"]')) return;
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'csrf_token';
    input.value = csrfToken;
    form.prepend(input);
  };
  document.querySelectorAll('form[method="post" i]').forEach(ensureCsrf);
  /* Library surfaces and dialogs can hydrate forms after initial page setup. Add the
     token at submit time as the final shell boundary so dynamically inserted native
     forms receive the same CSRF protection as server-rendered forms. */
  document.addEventListener('submit', (event) => ensureCsrf(event.target), true);

  const flash = document.getElementById('flash-message');
  if (flash) {
    const url = new URL(window.location.href);
    ['message', 'return_to', 'return_label', 'match_notice', 'account_notice'].forEach((key) => {
      url.searchParams.delete(key);
    });
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    const timeout = Math.max(0, Number(flash.dataset.flashTimeout || 5000));
    window.setTimeout(() => flash.remove(), timeout);
  }

  const search = document.getElementById('global-search');
  const searchInput = document.getElementById('global-search-input');
  const searchToggle = document.getElementById('global-search-toggle');
  const searchHistoryToggle = document.getElementById('global-search-history');
  const searchSuggestions = document.getElementById('global-search-suggestions');
  const menu = document.getElementById('site-menu');
  const menuToggle = document.getElementById('site-menu-toggle');
  const menuPanel = document.getElementById('site-menu-panel');
  const sidebarToggle = document.getElementById('sidebar-collapse-toggle');
  const sidebarResize = document.getElementById('sidebar-resize-handle');

  let searchSuggestionTimer = 0;
  let searchSuggestionController = null;
  let searchRequestVersion = 0;

  const cancelPendingSearchRequests = () => {
    window.clearTimeout(searchSuggestionTimer);
    searchSuggestionTimer = 0;
    searchSuggestionController?.abort();
    searchSuggestionController = null;
    searchRequestVersion += 1;
  };

  const updateSearchToggleLabel = () => {
    if (!searchToggle || !searchInput || !search) return;
    const open = search.classList.contains('open');
    searchToggle.setAttribute('aria-label', !open
      ? 'Open library search'
      : searchInput.value.trim() ? 'Submit library search' : 'Close library search');
  };

  const settleClosedSearch = ({restoreFocus = false} = {}) => {
    cancelPendingSearchRequests();
    if (searchSuggestions) searchSuggestions.hidden = true;
    if (searchInput && document.activeElement === searchInput) searchInput.blur();
    if (restoreFocus) searchToggle?.focus({preventScroll: true});
  };

  const setSearchOpen = (open, {restoreFocus = false} = {}) => {
    if (!search || !searchToggle || !searchInput) return;
    search.classList.toggle('open', open);
    searchToggle.setAttribute('aria-expanded', String(open));
    updateSearchToggleLabel();
    if (!open) {
      settleClosedSearch({restoreFocus});
      return;
    }
    // iOS needs focus in the same user activation as the tap, not after a timer.
    if (search.classList.contains('open')) searchInput.focus({preventScroll: true});
  };

  const setMenuOpen = (open) => {
    if (!menu || !menuToggle || !menuPanel) return;
    menu.classList.toggle('open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
    menuPanel.setAttribute('aria-hidden', String(!open));
  };

  const setSidebarCollapsed = (collapsed) => {
    body.classList.toggle('sidebar-collapsed', collapsed);
    if (sidebarToggle) {
      sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
      sidebarToggle.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
      sidebarToggle.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
    }
    try {
      localStorage.setItem('infomancer-sidebar-collapsed', collapsed ? '1' : '0');
    } catch (_error) {}
  };

  const applySidebarWidth = (width, save = false) => {
    const nextWidth = Math.min(380, Math.max(220, Math.round(Number(width) || 258)));
    document.documentElement.style.setProperty('--app-sidebar-width', `${nextWidth}px`);
    if (!save) return;
    try { localStorage.setItem('infomancer-sidebar-width', String(nextWidth)); } catch (_error) {}
  };

  sidebarToggle?.addEventListener('click', () => {
    setSidebarCollapsed(!body.classList.contains('sidebar-collapsed'));
  });
  if (sidebarToggle) setSidebarCollapsed(body.classList.contains('sidebar-collapsed'));

  sidebarResize?.addEventListener('pointerdown', (event) => {
    if (body.classList.contains('sidebar-collapsed')) return;
    event.preventDefault();
    sidebarResize.setPointerCapture(event.pointerId);
    body.classList.add('sidebar-resizing');
    const move = (moveEvent) => applySidebarWidth(moveEvent.clientX);
    const finish = (upEvent) => {
      applySidebarWidth(upEvent.clientX, true);
      body.classList.remove('sidebar-resizing');
      sidebarResize.removeEventListener('pointermove', move);
      sidebarResize.removeEventListener('pointerup', finish);
      sidebarResize.removeEventListener('pointercancel', finish);
    };
    sidebarResize.addEventListener('pointermove', move);
    sidebarResize.addEventListener('pointerup', finish);
    sidebarResize.addEventListener('pointercancel', finish);
  });
  sidebarResize?.addEventListener('dblclick', () => applySidebarWidth(258, true));

  const historyOption = (item) => ({
    value: item.query,
    label: item.query,
    type: 'Recent search',
    detail: '',
  });

  const renderSearchOptions = (suggestions, includeClear = false) => {
    if (!searchSuggestions || !searchInput || !search) return;
    const options = suggestions.map((suggestion) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.setAttribute('role', 'option');
      const strong = document.createElement('strong');
      const small = document.createElement('small');
      strong.textContent = suggestion.label;
      small.textContent = suggestion.detail
        ? `${suggestion.type} · ${suggestion.detail}`
        : suggestion.type;
      option.append(strong, small);
      option.addEventListener('click', () => {
        searchInput.value = suggestion.value;
        searchSuggestions.hidden = true;
        search.requestSubmit();
      });
      return option;
    });
    if (includeClear && options.length) {
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'search-history-clear';
      clear.textContent = 'Clear search history';
      clear.addEventListener('click', async () => {
        try {
          const response = await fetch('/api/search-history/clear', {
            method: 'POST',
            credentials: 'same-origin',
            headers: csrfToken ? {'X-CSRF-Token': csrfToken} : {},
          });
          if (response.ok) searchSuggestions.hidden = true;
        } catch (_error) {}
      });
      options.push(clear);
    }
    searchSuggestions.replaceChildren(...options);
    searchSuggestions.hidden = options.length === 0;
  };

  const recentSearches = async (signal) => {
    const response = await fetch('/api/search-history', {
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return (data.history || []).map(historyOption);
  };

  const showRecentSearches = async () => {
    if (!searchSuggestions || !search?.classList.contains('open')) return;
    cancelPendingSearchRequests();
    const version = searchRequestVersion;
    const controller = new AbortController();
    searchSuggestionController = controller;
    try {
      const recent = await recentSearches(controller.signal);
      if (version !== searchRequestVersion || !search.classList.contains('open')) return;
      renderSearchOptions(recent, true);
    } catch (error) {
      if (error.name !== 'AbortError' && version === searchRequestVersion) {
        searchSuggestions.hidden = true;
      }
    } finally {
      if (searchSuggestionController === controller) searchSuggestionController = null;
    }
  };

  const updateGlobalSearchSuggestions = async () => {
    if (!searchInput || !searchSuggestions || !search?.classList.contains('open')) return;
    const query = searchInput.value.trim();
    if (query.length < 2) {
      if (query) {
        cancelPendingSearchRequests();
        searchSuggestions.hidden = true;
      } else {
        await showRecentSearches();
      }
      return;
    }
    cancelPendingSearchRequests();
    const version = searchRequestVersion;
    const controller = new AbortController();
    searchSuggestionController = controller;
    const url = new URL('/api/library-suggestions', window.location.origin);
    url.searchParams.set('q', query);
    url.searchParams.set('kind', 'all');
    try {
      const response = await fetch(url, {
        credentials: 'same-origin',
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const [data, recent] = await Promise.all([
        response.json(),
        recentSearches(controller.signal).catch(() => []),
      ]);
      if (version !== searchRequestVersion
        || !search.classList.contains('open')
        || searchInput.value.trim() !== query) return;
      const normalized = query.toLocaleLowerCase();
      const recentMatches = recent.filter((item) => item.value.toLocaleLowerCase().includes(normalized));
      const seen = new Set(recentMatches.map((item) => item.value.toLocaleLowerCase()));
      const combined = recentMatches.concat(
        (data.suggestions || []).filter((item) => !seen.has(item.value.toLocaleLowerCase())),
      ).slice(0, 10);
      renderSearchOptions(combined, recentMatches.length > 0);
    } catch (error) {
      if (error.name !== 'AbortError' && version === searchRequestVersion) {
        searchSuggestions.hidden = true;
      }
    } finally {
      if (searchSuggestionController === controller) searchSuggestionController = null;
    }
  };

  searchToggle?.addEventListener('click', () => {
    if (!search || !searchInput) return;
    if (!search.classList.contains('open')) {
      setMenuOpen(false);
      setSearchOpen(true);
    } else if (searchInput.value.trim()) {
      search.requestSubmit();
    } else {
      setSearchOpen(false);
    }
  });

  searchHistoryToggle?.addEventListener('click', async () => {
    setMenuOpen(false);
    setSearchOpen(true);
    await showRecentSearches();
  });

  searchInput?.addEventListener('input', () => {
    cancelPendingSearchRequests();
    if (searchSuggestions) searchSuggestions.hidden = true;
    updateSearchToggleLabel();
    if (search?.classList.contains('open')) {
      searchSuggestionTimer = window.setTimeout(updateGlobalSearchSuggestions, 160);
    }
  });
  searchInput?.addEventListener('focus', () => {
    if (!search?.classList.contains('open')) {
      searchInput.blur();
      return;
    }
    updateGlobalSearchSuggestions();
  });
  searchInput?.addEventListener('keydown', async (event) => {
    if (event.key === 'ArrowDown' && searchSuggestions) {
      event.preventDefault();
      if (searchSuggestions.hidden) await updateGlobalSearchSuggestions();
      searchSuggestions.querySelector('button')?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setSearchOpen(false, {restoreFocus: true});
    }
  });

  searchSuggestions?.addEventListener('keydown', (event) => {
    const options = [...searchSuggestions.querySelectorAll('button')];
    const index = options.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' && options.length) {
      event.preventDefault();
      options[(index + 1) % options.length].focus();
    } else if (event.key === 'ArrowUp' && options.length) {
      event.preventDefault();
      if (index <= 0) searchInput?.focus();
      else options[index - 1].focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setSearchOpen(false, {restoreFocus: true});
    }
  });

  menuToggle?.addEventListener('click', () => {
    const open = !menu?.classList.contains('open');
    if (open) setSearchOpen(false);
    setMenuOpen(open);
  });

  const actionMenus = '.series-menu, .episode-menu, .account-menu';
  document.querySelectorAll('details a[href^="/titles/"][href$="/organize"]').forEach((organizeLink) => {
    const match = organizeLink.getAttribute('href')?.match(/^\/titles\/(\d+)\/organize$/);
    const parentMenu = organizeLink.closest('details');
    if (!match || !parentMenu || parentMenu.querySelector('a[href^="/titles/"][href*="/libraries"]')) return;
    const add = document.createElement('a');
    add.href = `/titles/${match[1]}/libraries?return_to=${encodeURIComponent(location.pathname + location.search)}`;
    add.textContent = 'Add to Libraries';
    add.dataset.organizeDialog = '';
    organizeLink.before(add);
  });

  const currentTitle = location.pathname.match(/^\/titles\/(\d+)/)?.[1];
  if (currentTitle) {
    document.querySelectorAll('details.episode-menu').forEach((episodeMenu) => {
      if (episodeMenu.querySelector('a[href*="/libraries"]') || !episodeMenu.querySelector('a[href^="/files/"]')) return;
      const panel = episodeMenu.querySelector(':scope > div');
      if (!panel) return;
      const add = document.createElement('a');
      add.href = `/titles/${currentTitle}/libraries?return_to=${encodeURIComponent(location.pathname + location.search)}`;
      add.textContent = 'Add Series to Libraries';
      add.dataset.organizeDialog = '';
      panel.prepend(add);
    });
  }

  const dismissSearchOutside = (event) => {
    if (search?.classList.contains('open') && !search.contains(event.target)) {
      setSearchOpen(false);
    }
  };
  // pointerdown handles touch dismissal promptly; click covers other input methods.
  document.addEventListener('pointerdown', dismissSearchOutside);
  document.addEventListener('click', (event) => {
    if (menu && !menu.contains(event.target)) setMenuOpen(false);
    dismissSearchOutside(event);
    document.querySelectorAll(`${actionMenus}[open]`).forEach((actionMenu) => {
      if (!actionMenu.contains(event.target)) actionMenu.removeAttribute('open');
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    setMenuOpen(false);
    if (search?.classList.contains('open')) setSearchOpen(false, {restoreFocus: true});
    document.querySelectorAll(`${actionMenus}[open]`).forEach((actionMenu) => actionMenu.removeAttribute('open'));
  });
})();
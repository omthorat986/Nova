/**
 * NOVA Space Observatory — Shared Social Platform Client (js/social.js)
 * Clean, modular API client, authentication state, shared navigation,
 * toast notifications, and lightweight starfield renderer.
 */

export const API = {
  async request(url, options = {}) {
    if (typeof window !== 'undefined' && window.API && window.API.fetch) {
      return window.API.fetch(url, options);
    }
    try {
      const res = await fetch(url, {
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json',
          ...(options.headers || {})
        },
        ...options
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const error = new Error((data.error && data.error.message) || data.error || `HTTP ${res.status}`);
        error.status = res.status;
        error.data = data;
        throw error;
      }
      return data;
    } catch (err) {
      throw err;
    }
  },

  get(url, options = {}) {
    if (typeof window !== 'undefined' && window.API) return window.API.get(url, options);
    return this.request(url, { ...options, method: 'GET' });
  },

  post(url, body, options = {}) {
    if (typeof window !== 'undefined' && window.API) return window.API.post(url, body, options);
    return this.request(url, {
      ...options,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      body: JSON.stringify(body)
    });
  },

  patch(url, body, options = {}) {
    if (typeof window !== 'undefined' && window.API) return window.API.patch(url, body, options);
    return this.request(url, {
      ...options,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      body: JSON.stringify(body)
    });
  },

  delete(url, body = null, options = {}) {
    if (typeof window !== 'undefined' && window.API) return window.API.delete(url, body, options);
    return this.request(url, {
      ...options,
      method: 'DELETE',
      ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {})
    });
  },

  upload(url, formData, options = {}) {
    if (typeof window !== 'undefined' && window.API) return window.API.upload(url, formData, options);
    return this.request(url, {
      ...options,
      method: 'POST',
      body: formData
    });
  }
};

export const AuthState = {
  user: null,
  isLoaded: false,

  async fetchUser() {
    try {
      const res = await API.get('/api/me', { silent: true });
      this.user = res.user;
    } catch (e) {
      this.user = null;
    } finally {
      this.isLoaded = true;
      document.dispatchEvent(new CustomEvent('nova:auth:updated', { detail: this.user }));
    }
    return this.user;
  },

  isLoggedIn() {
    return !!this.user;
  },

  isCurator() {
    return this.user && (this.user.role === 'curator' || this.user.role === 'admin' || this.user.role === 'moderator');
  },

  isAdmin() {
    return this.user && this.user.role === 'admin';
  },

  async logout() {
    if (typeof UI !== 'undefined' && UI.confirm) {
      const ok = await UI.confirm({
        title: 'TERMINATE SESSION',
        message: 'Are you sure you want to log out of your NOVA observatory account?',
        confirmText: 'LOG OUT',
        cancelText: 'CANCEL',
        danger: true
      });
      if (!ok) return;
    }
    try {
      await API.post('/api/logout', {});
    } catch (e) {}
    this.user = null;
    window.location.href = '/login';
  }
};

export function showToast(message, type = 'info', options = {}) {
  if (typeof UI !== 'undefined' && UI.toast) {
    if (type === 'success') return UI.toast.success(message, '', options);
    if (type === 'error') return UI.toast.error(message, '', options);
    if (type === 'warning' || type === 'warn') return UI.toast.warning(message, '', options);
    return UI.toast.info(message, '', options);
  }

  let container = document.getElementById('nova-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'nova-toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `nova-toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

export function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function timeAgo(timestamp) {
  if (!timestamp) return 'JUST NOW';
  const now = new Date();
  const date = new Date(timestamp.includes('Z') ? timestamp : timestamp + 'Z');
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return `${Math.max(1, seconds)}S AGO`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}M AGO`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}H AGO`;
  const days = Math.floor(hours / 24);
  return `${days}D AGO`;
}

/**
 * Universal Shared Navbar & Telemetry HUD Component
 */
export async function triggerComposer(options = {}) {
  if (!AuthState.isLoggedIn()) {
    showLoggedOutComposerPrompt();
    return;
  }

  // Lazy-load composer module
  if (!window.NOVAComposer) {
    if (typeof UI !== 'undefined' && UI.progressBar) UI.progressBar.start();
    try {
      const module = await import('/js/composer.js');
      window.NOVAComposer = module.Composer;
    } catch (err) {
      if (typeof UI !== 'undefined' && UI.toast) UI.toast.error('Failed to load dispatch composer: ' + err.message);
      return;
    } finally {
      if (typeof UI !== 'undefined' && UI.progressBar) UI.progressBar.done();
    }
  }

  // Detect context agency if on an agency dossier page
  let agency = options.agency;
  if (!agency) {
    const agencyMatch = window.location.pathname.match(/^\/agenc(?:y|ies)\/([a-zA-Z0-9_-]+)/);
    if (agencyMatch) {
      agency = agencyMatch[1];
    } else {
      const urlAg = new URLSearchParams(window.location.search).get('agency');
      if (urlAg) agency = urlAg;
    }
  }

  window.NOVAComposer.openModal({
    agency: agency || '',
    ...options
  });
}

export function showLoggedOutComposerPrompt() {
  document.querySelectorAll('.nova-ui-modal-backdrop').forEach(m => m.remove());

  const backdrop = document.createElement('div');
  backdrop.className = 'nova-ui-modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-labelledby', 'auth-prompt-title');

  const currentUrl = window.location.pathname + window.location.search;
  const nextUrl = currentUrl.includes('action=compose') 
    ? currentUrl 
    : (currentUrl + (currentUrl.includes('?') ? '&' : '?') + 'action=compose');

  backdrop.innerHTML = `
    <div class="nova-ui-modal-window" tabindex="-1">
      <div class="nova-ui-modal-header">
        <span class="nova-ui-modal-tag">// AUTHENTICATION REQUIRED</span>
      </div>
      <h2 class="nova-ui-modal-title" id="auth-prompt-title">LOG IN TO TRANSMIT</h2>
      <div class="nova-ui-modal-body">
        Authentication is required to broadcast observation dispatches and submit scientific telemetry to space agency channels.
      </div>
      <div class="nova-ui-modal-actions" style="flex-wrap: wrap; gap: 8px;">
        <button type="button" class="nova-ui-btn nova-ui-btn-cancel" id="btn-auth-prompt-cancel">[CANCEL]</button>
        <a href="/login?next=${encodeURIComponent(nextUrl)}" class="nova-ui-btn nova-ui-btn-confirm" id="btn-auth-prompt-login" style="text-decoration: none; text-align: center;">[AUTH // LOG IN]</a>
        <a href="/register?next=${encodeURIComponent(nextUrl)}" class="nova-ui-btn nova-ui-btn-confirm" style="text-decoration: none; text-align: center; background: rgba(92,200,255,0.15); color: var(--accent-cyan); border-color: var(--accent-cyan);">[CREATE ACCOUNT]</a>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  try {
    sessionStorage.setItem('nova_auto_compose', '1');
  } catch (e) {}

  const cancelBtn = backdrop.querySelector('#btn-auth-prompt-cancel');
  const closePrompt = () => {
    backdrop.style.opacity = '0';
    backdrop.style.transition = 'opacity 0.18s ease';
    setTimeout(() => backdrop.remove(), 200);
  };
  if (cancelBtn) cancelBtn.addEventListener('click', closePrompt);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closePrompt();
  });
  backdrop.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePrompt();
  });

  const loginBtn = backdrop.querySelector('#btn-auth-prompt-login');
  if (loginBtn) loginBtn.focus();
}

export const SharedNav = {
  init(activeTab = '') {
    const navContainer = document.getElementById('shared-navbar-container');
    if (!navContainer) return;

    const currentPath = window.location.pathname;

    navContainer.innerHTML = `
      <header class="shared-navbar">
        <div class="nav-left-group">
          <a href="/" class="nav-brand-group">
            <div class="brand-orbital-icon"></div>
            <div class="brand-title-wrap">
              <span class="brand-logo-text">NOVA</span>
              <span class="brand-subtext">// DEEP SPACE OBSERVATORY</span>
            </div>
          </a>

          <ul class="nav-links-menu">
            <li>
              <a href="/" class="nav-link-item ${currentPath === '/' || currentPath === '/index.html' ? 'active' : ''}">
                <span>[01]</span>
                <span>HOME</span>
              </a>
            </li>
            <li>
              <a href="/social" class="nav-link-item ${currentPath.startsWith('/social') || currentPath.startsWith('/popular') ? 'active' : ''}">
                <span>[02]</span>
                <span>SOCIAL</span>
              </a>
            </li>
            <li>
              <a href="/agencies" class="nav-link-item ${currentPath.startsWith('/agencies') || currentPath.startsWith('/agency') ? 'active' : ''}">
                <span>[03]</span>
                <span>AGENCIES</span>
              </a>
            </li>
          </ul>
        </div>

        <div class="nav-center-group">
          <form class="nav-search-wrap" id="nav-search-form" action="/agencies" method="GET">
            <svg class="nav-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="search" id="nav-search-input" name="q" class="nav-search-input" placeholder="Search dispatches, agencies... ( / )" autocomplete="off" aria-label="Search dispatches, agencies, and observers" />
            <span class="nav-search-kbd">/</span>
          </form>
        </div>

        <div class="nav-actions-wrap">
          <button type="button" class="btn-topbar-post" id="btn-topbar-post" title="Transmit Observation Dispatch (Shortcut: C)" aria-label="Create Post">
            <span>[ + POST ]</span>
          </button>

          <button type="button" class="nav-bell-btn" id="nav-notifications-bell" aria-label="Observatory Notifications" title="System Telemetry Alerts">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <span class="nav-bell-dot"></span>
          </button>

          <div id="nav-auth-controls">
            <div class="skeleton-box" style="width: 110px; height: 32px;"></div>
          </div>

          <button type="button" class="nav-mobile-toggle" id="nav-mobile-toggle" aria-label="Toggle navigation drawer" aria-expanded="false" title="Menu">
            <span class="nav-toggle-icon">☰</span>
          </button>
        </div>
      </header>

      <!-- Full-screen / Off-canvas Mobile Navigation Drawer -->
      <div class="shared-mobile-drawer" id="shared-mobile-drawer" aria-hidden="true">
        <div class="drawer-backdrop" id="nav-drawer-backdrop"></div>
        <aside class="drawer-panel" role="dialog" aria-modal="true" aria-label="Navigation Drawer">
          <div class="drawer-header">
            <div class="drawer-brand">
              <div class="brand-orbital-icon"></div>
              <div class="brand-title-wrap">
                <span class="brand-logo-text">NOVA</span>
                <span class="brand-subtext">// OBSERVATORY</span>
              </div>
            </div>
            <button type="button" class="drawer-close-btn" id="nav-drawer-close-btn" aria-label="Close menu">✕</button>
          </div>

          <div class="drawer-search-wrap">
            <form class="drawer-search-form" action="/agencies" method="GET">
              <input type="search" name="q" class="drawer-search-input" placeholder="Search dispatches, agencies..." aria-label="Search" autocomplete="off" />
              <button type="submit" class="drawer-search-btn" aria-label="Submit search">⌕</button>
            </form>
          </div>

          <nav class="drawer-nav-menu">
            <div class="drawer-group-label">// PRIMARY NAVIGATION</div>
            <a href="/" class="drawer-nav-item ${currentPath === '/' || currentPath === '/index.html' ? 'active' : ''}">
              <span class="mono-label">[01]</span>
              <span>HOME BASE</span>
            </a>
            <a href="/social" class="drawer-nav-item ${currentPath.startsWith('/social') || currentPath.startsWith('/popular') ? 'active' : ''}">
              <span class="mono-label">[02]</span>
              <span>SOCIAL FEED</span>
            </a>
            <a href="/agencies" class="drawer-nav-item ${currentPath.startsWith('/agencies') || currentPath.startsWith('/agency') ? 'active' : ''}">
              <span class="mono-label">[03]</span>
              <span>SPACE AGENCIES</span>
            </a>
            <a href="/submit" class="drawer-nav-item ${currentPath.startsWith('/submit') ? 'active' : ''}">
              <span class="mono-label">[04]</span>
              <span>TRANSMIT DISPATCH</span>
            </a>

            <div class="drawer-group-label">// CHANNELS & TOPICS</div>
            <a href="/popular" class="drawer-nav-item">
              <span class="mono-sublabel">◈</span>
              <span>Popular Dispatches</span>
            </a>
            <a href="/social?cat=Launches" class="drawer-nav-item">
              <span class="mono-sublabel">🚀</span>
              <span>Launch Manifest</span>
            </a>
            <a href="/social?cat=Astronomy" class="drawer-nav-item">
              <span class="mono-sublabel">🔭</span>
              <span>Astronomy & JWST</span>
            </a>
            <a href="/social?cat=Missions" class="drawer-nav-item">
              <span class="mono-sublabel">🛰</span>
              <span>Active Missions</span>
            </a>
            <a href="/agency/general" class="drawer-nav-item">
              <span class="mono-sublabel">[GEN]</span>
              <span>General Space Channel</span>
            </a>

            <div class="drawer-group-label">// STATION PROTOCOLS</div>
            <a href="/contact" class="drawer-nav-item">
              <span class="mono-sublabel">📡</span>
              <span>Mission Control Contact</span>
            </a>
            <a href="/privacy" class="drawer-nav-item">
              <span class="mono-sublabel">🛡</span>
              <span>Privacy Protocol</span>
            </a>
            <a href="/terms" class="drawer-nav-item">
              <span class="mono-sublabel">📜</span>
              <span>Terms of Use</span>
            </a>
          </nav>

          <div class="drawer-auth-box" id="drawer-auth-box"></div>
        </aside>
      </div>
    `;

    // Ensure mobile Floating Action Button (FAB) exists on the page
    this.setupMobileFAB();

    // Bind triggers
    this.bindTopbarActions();

    this.renderAuthControls();
    document.addEventListener('nova:auth:updated', () => {
      this.renderAuthControls();
      this.checkAutoComposeOnLogin();
    });

    this.setupFooterHUD();
    this.setupKeyboardShortcuts();
    this.checkAutoComposeOnLogin();
  },

  setupMobileFAB() {
    let fab = document.getElementById('fab-create-post');
    if (!fab) {
      fab = document.createElement('button');
      fab.type = 'button';
      fab.className = 'fab-create-post';
      fab.id = 'fab-create-post';
      fab.setAttribute('aria-label', 'Create Dispatch');
      fab.setAttribute('title', 'Transmit Observation Dispatch (C)');
      fab.innerHTML = `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square"><path d="M12 5v14M5 12h14"/></svg>
      `;
      document.body.appendChild(fab);

      fab.addEventListener('click', () => triggerComposer());

      // Scroll direction detection: hide on scroll down, show on scroll up
      let lastScrollY = window.scrollY;
      const updateFabVisibility = (currentY) => {
        if (currentY > lastScrollY && currentY > 60) {
          fab.classList.add('fab-hidden');
        } else {
          fab.classList.remove('fab-hidden');
        }
        lastScrollY = currentY;
      };
      window.addEventListener('scroll', () => {
        updateFabVisibility(window.scrollY);
      }, { passive: true });
      const centerFeed = document.querySelector('.social-center-feed');
      if (centerFeed) {
        centerFeed.addEventListener('scroll', () => {
          updateFabVisibility(centerFeed.scrollTop);
        }, { passive: true });
      }
    }
  },

  bindTopbarActions() {
    const postBtn = document.getElementById('btn-topbar-post');
    if (postBtn) {
      postBtn.addEventListener('click', () => triggerComposer());
    }

    const bellBtn = document.getElementById('nav-notifications-bell');
    if (bellBtn) {
      bellBtn.addEventListener('click', () => {
        if (typeof UI !== 'undefined' && UI.toast) {
          UI.toast.info('Deep space observatory telemetry arrays & agency feeds operational.', 'TELEMETRY STATUS');
        }
      });
    }

    const searchForm = document.getElementById('nav-search-form');
    if (searchForm) {
      searchForm.addEventListener('submit', (e) => {
        const inp = document.getElementById('nav-search-input');
        if (!inp || !inp.value.trim()) {
          e.preventDefault();
        }
      });
    }

    // Mobile Navigation Drawer Toggling
    const toggleBtn = document.getElementById('nav-mobile-toggle');
    const drawer = document.getElementById('shared-mobile-drawer');
    const closeBtn = document.getElementById('nav-drawer-close-btn');
    const backdrop = document.getElementById('nav-drawer-backdrop');

    const openDrawer = () => {
      if (!drawer) return;
      drawer.classList.add('open');
      drawer.setAttribute('aria-hidden', 'false');
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
      document.body.classList.add('nav-drawer-locked');
    };

    const closeDrawer = () => {
      if (!drawer) return;
      drawer.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true');
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('nav-drawer-locked');
    };

    if (toggleBtn) toggleBtn.addEventListener('click', openDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (backdrop) backdrop.addEventListener('click', closeDrawer);

    // Close on link click inside drawer
    if (drawer) {
      drawer.querySelectorAll('.drawer-nav-item').forEach(item => {
        item.addEventListener('click', closeDrawer);
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer && drawer.classList.contains('open')) {
        closeDrawer();
      }
    });
  },

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Shortcut C: Open composer (when not typing in an input/textarea/select)
      if (e.key === 'c' || e.key === 'C') {
        const active = document.activeElement;
        const tag = active ? active.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || (active && active.isContentEditable)) {
          return;
        }
        if (document.querySelector('.composer-modal-backdrop') || document.querySelector('.nova-ui-modal-backdrop')) {
          return;
        }
        e.preventDefault();
        triggerComposer();
      } else if (e.key === '/') {
        const active = document.activeElement;
        const tag = active ? active.tagName.toLowerCase() : '';
        if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
          const searchInput = document.getElementById('nav-search-input');
          if (searchInput && searchInput.offsetParent !== null) {
            e.preventDefault();
            searchInput.focus();
          } else {
            const drawer = document.getElementById('shared-mobile-drawer');
            const drawerSearch = document.querySelector('.drawer-search-input');
            if (drawer && drawerSearch) {
              e.preventDefault();
              drawer.classList.add('open');
              drawer.setAttribute('aria-hidden', 'false');
              document.body.style.overflow = 'hidden';
              drawerSearch.focus();
            }
          }
        }
      }
    });
  },

  checkAutoComposeOnLogin() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const isAutoCompose = urlParams.get('action') === 'compose' || sessionStorage.getItem('nova_auto_compose') === '1';
      if (isAutoCompose && AuthState.isLoggedIn()) {
        sessionStorage.removeItem('nova_auto_compose');
        if (urlParams.get('action') === 'compose') {
          urlParams.delete('action');
          const newSearch = urlParams.toString();
          const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
          window.history.replaceState({}, '', newUrl);
        }
        setTimeout(() => triggerComposer(), 180);
      }
    } catch (e) {}
  },

  renderAuthControls() {
    const controls = document.getElementById('nav-auth-controls');
    const drawerAuth = document.getElementById('drawer-auth-box');
    const nextParam = encodeURIComponent(window.location.pathname + window.location.search);

    if (!AuthState.isLoggedIn()) {
      if (controls) {
        controls.innerHTML = `
          <a href="/login?next=${nextParam}" class="btn-nav-auth">
            <span>[AUTH // LOGIN]</span>
          </a>
        `;
      }
      if (drawerAuth) {
        drawerAuth.innerHTML = `
          <div class="drawer-group-label">// AUTHENTICATION</div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            <a href="/login?next=${nextParam}" class="btn-tech btn-tech-primary" style="width:100%; justify-content:center;">[AUTH // LOG IN]</a>
            <a href="/register?next=${nextParam}" class="btn-tech btn-tech-secondary" style="width:100%; justify-content:center;">[REGISTER OBSERVER]</a>
          </div>
        `;
      }
      return;
    }

    const u = AuthState.user;
    const roleBadge = u.role !== 'observer' ? `<span class="user-badge-role ${u.role}">${escapeHTML(u.role.toUpperCase())}</span>` : '';
    const avatarHelper = window.NovaAvatar || (typeof NovaAvatar !== 'undefined' ? NovaAvatar : null);
    const avatarHtml = avatarHelper ? avatarHelper.render(u, { size: 'xs', link: false }) : '';
    const avatarHtmlLg = avatarHelper ? avatarHelper.render(u, { size: 'sm', link: false }) : '';

    if (controls) {
      controls.innerHTML = `
        <button class="nav-user-dropdown-btn" id="nav-user-menu-btn" aria-expanded="false" style="display:inline-flex; align-items:center; gap:8px;">
          ${avatarHtml}
          <span class="nav-user-name-text">@${escapeHTML(u.nickname)}</span>
          ${roleBadge}
          <span style="font-size: 8px;">▾</span>
        </button>

        <div class="dropdown-menu-box" id="nav-user-dropdown-menu">
          <a href="/u/${encodeURIComponent(u.nickname)}" class="dropdown-menu-item">
            <span>// PROFILE</span>
            <span class="mono-label">@${escapeHTML(u.nickname)}</span>
          </a>
          <a href="/u/${encodeURIComponent(u.nickname)}?tab=outreach" class="dropdown-menu-item">
            <span>// MY OUTREACH</span>
            <span class="mono-label">LOGS</span>
          </a>
          ${AuthState.isCurator() ? `
            <a href="/moderation" class="dropdown-menu-item" style="color:var(--accent-gold)">
              <span>// MODERATION</span>
              <span class="mono-label" style="color:var(--accent-gold)">QUEUE</span>
            </a>
          ` : ''}
          <div class="dropdown-divider"></div>
          <button class="dropdown-menu-item" id="nav-logout-btn" style="color:var(--accent-alert)">
            <span>// LOGOUT</span>
            <span>⎋</span>
          </button>
        </div>
      `;

      const btn = document.getElementById('nav-user-menu-btn');
      const menu = document.getElementById('nav-user-dropdown-menu');
      const logoutBtn = document.getElementById('nav-logout-btn');

      if (btn && menu) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          menu.classList.toggle('open');
        });
        document.addEventListener('click', (e) => {
          if (!menu.contains(e.target) && e.target !== btn) {
            menu.classList.remove('open');
          }
        });
      }

      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => AuthState.logout());
      }
    }

    if (drawerAuth) {
      drawerAuth.innerHTML = `
        <div class="drawer-group-label">// OBSERVER SESSION</div>
        <div class="drawer-user-card">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
            ${avatarHtmlLg}
            <div style="display:flex; flex-direction:column; min-width:0;">
              <span style="font-family:var(--font-mono); font-size:12px; font-weight:700; color:#fff; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">@${escapeHTML(u.nickname)}</span>
              <span style="font-family:var(--font-mono); font-size:10px; color:var(--accent-cyan);">${escapeHTML(u.role.toUpperCase())}</span>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <a href="/u/${encodeURIComponent(u.nickname)}" class="drawer-nav-item">
              <span class="mono-sublabel">👤</span>
              <span>View Profile</span>
            </a>
            <a href="/u/${encodeURIComponent(u.nickname)}?tab=outreach" class="drawer-nav-item">
              <span class="mono-sublabel">📡</span>
              <span>My Outreach Telemetry</span>
            </a>
            ${AuthState.isCurator() ? `
              <a href="/moderation" class="drawer-nav-item" style="color:var(--accent-gold);">
                <span class="mono-sublabel" style="color:var(--accent-gold);">⚖</span>
                <span>Moderation Console</span>
              </a>
            ` : ''}
            <button type="button" class="btn-tech btn-tech-secondary" id="drawer-logout-btn" style="margin-top:8px; width:100%; justify-content:center; color:var(--accent-alert); border-color:rgba(239,68,68,0.3);">
              <span>[LOGOUT // TERMINATE SESSION]</span>
            </button>
          </div>
        </div>
      `;

      const drawerLogoutBtn = document.getElementById('drawer-logout-btn');
      if (drawerLogoutBtn) {
        drawerLogoutBtn.addEventListener('click', () => AuthState.logout());
      }
    }
  },

  setupFooterHUD() {
    const footerContainer = document.getElementById('shared-footer-container');
    if (footerContainer) {
      footerContainer.innerHTML = `
        <footer class="shared-footer">
          <div>
            <span>NOVA OBSERVATORY</span>
            <span style="margin: 0 8px; opacity: 0.3;">|</span>
            <span>SPACE EXPLORATION & TELEMETRY NETWORK</span>
          </div>
          <div class="footer-telemetry">
            <span class="status-indicator">
              <span class="status-dot" id="hud-status-dot"></span>
              <span id="hud-status-text">SYS // ONLINE</span>
            </span>
          </div>
        </footer>
      `;
    }

    const checkHealth = async () => {
      const dot = document.getElementById('hud-status-dot');
      const text = document.getElementById('hud-status-text');
      if (!dot || !text) return;

      try {
        const res = await fetch('/health', { cache: 'no-store' });
        if (res.ok) {
          dot.className = 'status-dot';
          text.textContent = 'SYS // ONLINE';
        } else {
          dot.className = 'status-dot offline';
          text.textContent = 'SYS // DEGRADED';
        }
      } catch (e) {
        dot.className = 'status-dot offline';
        text.textContent = 'SYS // OFFLINE';
      }
    };

    checkHealth();
    setInterval(checkHealth, 15000);
  }
};

/**
 * Calm Lightweight Starfield Background Canvas
 */
export function initStarfield(canvasId = 'starfield-canvas') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const stars = [];
  const STAR_COUNT = 90;

  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.7 + 0.3,
      speed: Math.random() * 0.15 + 0.05
    });
  }

  function render() {
    ctx.clearRect(0, 0, width, height);
    for (let star of stars) {
      ctx.fillStyle = `rgba(180, 220, 255, ${star.alpha})`;
      ctx.fillRect(star.x, star.y, star.size, star.size);
      star.y -= star.speed;
      if (star.y < 0) {
        star.y = height;
        star.x = Math.random() * width;
      }
    }
    requestAnimationFrame(render);
  }
  render();
}

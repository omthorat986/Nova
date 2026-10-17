/**
 * NOVA Space Observatory — Canonical PostCard Component (js/postcard.js)
 * Single shared renderer for all post dispatches across:
 * /social, /popular, /agency/<slug>, /u/<nickname>, search, and saved views.
 */

import NovaAvatar from '/js/avatar.js';

// Helper to escape HTML safely
export function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Relative time formatting
export function formatTimeAgo(dateStr) {
  if (!dateStr) return 'JUST NOW';
  const dt = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now - dt) / 1000);
  if (diffSec < 60) return 'JUST NOW';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}M AGO`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}H AGO`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}D AGO`;
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}

// Strip markup and generate plain-text excerpt
export function makeExcerpt(body, maxChars = 220) {
  if (!body) return { excerpt: '', truncated: false };
  const clean = String(body)
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length <= maxChars) {
    return { excerpt: clean, truncated: false };
  }
  let truncated = clean.slice(0, maxChars);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > Math.floor(maxChars * 0.6)) {
    truncated = truncated.slice(0, lastSpace);
  }
  truncated = truncated.replace(/[.,;:\-!?\s]+$/, '') + '...';
  return { excerpt: truncated, truncated: true };
}

// Save feed return state before navigating into /post/<id>
export function saveFeedReturnState() {
  try {
    const centerFeed = document.querySelector('.social-center-feed');
    const feedScroll = centerFeed ? centerFeed.scrollTop : 0;
    const winScroll = window.scrollY || document.documentElement.scrollTop || 0;
    const state = {
      scrollY: feedScroll > 0 ? feedScroll : winScroll,
      layout: localStorage.getItem('nova_stream_layout') || 'grid',
      filters: window.feedState ? window.feedState.activeFilters : null,
      fromUrl: window.location.pathname + window.location.search,
      timestamp: Date.now()
    };
    sessionStorage.setItem('nova_feed_return_state', JSON.stringify(state));
  } catch (err) {
    // SessionStorage quota or sandbox ignore
  }
}

// Restore feed return state on returning to feed
export function restoreFeedReturnState() {
  try {
    const raw = sessionStorage.getItem('nova_feed_return_state');
    if (!raw) return null;
    const state = JSON.parse(raw);
    sessionStorage.removeItem('nova_feed_return_state');
    return state;
  } catch (err) {
    return null;
  }
}

/**
 * Creates canonical PostCard HTMLElement (List or Grid layout)
 */
export function createPostCard(post, options = {}) {
  const layout = options.layout || 'grid';
  const hideAgency = Boolean(options.hideAgencyBadge);
  const isOwner = Boolean(options.isOwner);
  const isCurator = Boolean(options.isCurator);
  const canDelete = isOwner || isCurator;
  const likedClass = (post.user_liked || post.viewer_vote === 1) ? 'liked' : '';
  const score = post.score !== undefined ? post.score : (post.likes_count || 0);
  const commentsCount = post.comment_count !== undefined ? post.comment_count : (post.comments_count || (post.comments ? post.comments.length : 0));

  const authorNick = (post.author && post.author.nickname) ? post.author.nickname : (post.author_nickname || 'anonymous');
  const agSlug = post.agency_slug || (post.agency ? post.agency.slug : 'general');
  const agCode = post.agency_code || (post.agency ? post.agency.code : 'GEN');
  const agInitials = post.agency_initials || (post.agency ? post.agency.initials : 'GEN');
  const isGeneral = agSlug === 'general';
  const channelLabel = isGeneral ? 'CHANNEL // GENERAL' : `AGENCY // ${agCode}`;

  const authorObj = post.author || {
    id: post.user_id,
    nickname: authorNick,
    avatar_url: post.author_avatar_url,
    avatar_color: post.author_avatar_color,
    role: post.author_role || (post.is_curator ? 'curator' : 'observer')
  };

  const agencyObj = post.agency || {
    slug: agSlug,
    code: agCode,
    initials: agInitials,
    logo_url: post.agency_logo_url,
    has_logo: post.agency_has_logo,
    name: post.agency_name || channelLabel
  };

  // Image handling
  const imgUrls = post.image_urls || (post.image_url ? [post.image_url] : []);
  const mainImg = imgUrls.length > 0 ? imgUrls[0] : null;
  const extraImgsCount = imgUrls.length > 1 ? imgUrls.length - 1 : 0;
  const isTextOnly = !mainImg;

  // Excerpt & Truncation
  let excerptText = post.excerpt;
  let isTruncated = post.truncated;
  if (excerptText === undefined) {
    const ex = makeExcerpt(post.body || '', 220);
    excerptText = ex.excerpt;
    isTruncated = ex.truncated;
  }

  const card = document.createElement('article');
  card.className = `post-card post-card-${layout} ${isTextOnly ? 'text-only-post' : ''}`;
  card.id = `post-${post.id}`;
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'article');
  card.setAttribute('aria-label', `Dispatch: ${post.title}`);

  if (options.highlight) {
    card.classList.add('post-card-highlight');
    setTimeout(() => card.classList.remove('post-card-highlight'), 2200);
  }

  const avatarHelper = window.NovaAvatar || NovaAvatar;

  card.innerHTML = `
    <!-- CARD HEADER (Clean left-aligned row) -->
    <div class="post-header-line">
      <div class="post-header-top-row">
        <div class="post-header-left">
          ${!hideAgency ? `
            <a href="/agency/${encodeURIComponent(agSlug)}" class="agency-badge-pill" title="${escapeHTML(channelLabel)}">
              ${avatarHelper ? avatarHelper.renderAgency(agencyObj, { size: 'xs' }) : `<span class="agency-initials-badge">${escapeHTML(agInitials)}</span>`}
              <span class="agency-badge-name">${escapeHTML(channelLabel)}</span>
            </a>
            <span class="post-header-divider">•</span>
          ` : ''}
          <div class="author-block" style="display:inline-flex; align-items:center; gap:6px;">
            ${avatarHelper ? avatarHelper.render(authorObj, { size: 'xs', link: false }) : ''}
            <a href="/u/${encodeURIComponent(authorNick)}" class="author-name-link" data-tooltip="@${escapeHTML(authorNick)}" title="@${escapeHTML(authorNick)}">@${escapeHTML(authorNick)}</a>
          </div>
          <span class="post-header-divider">•</span>
          <span class="post-time">${formatTimeAgo(post.created_at)}</span>
          ${post._isSessionNew ? `<span class="session-new-badge">NEW</span>` : ''}
        </div>

        <div class="post-header-right">
          <span class="topic-tag-pill">${escapeHTML(post.topic || post.category || 'Other')}</span>
          <div style="position: relative;">
            <button type="button" class="post-menu-trigger" data-action="toggle-post-menu" data-post-id="${post.id}" aria-label="More options">•••</button>
            <div class="post-context-menu" id="menu-${post.id}" style="display:none;">
              <a href="/agency/${encodeURIComponent(agSlug)}" class="context-menu-item">// VIEW CHANNEL</a>
              <button type="button" class="context-menu-item" data-action="copy-post-link" data-post-id="${post.id}">[COPY LINK]</button>
              <button type="button" class="context-menu-item" data-action="report" data-post-id="${post.id}" style="color:var(--accent-gold, #fbbf24);">[REPORT]</button>
              ${canDelete ? `
                <button type="button" class="context-menu-item" data-action="delete-post" data-post-id="${post.id}" style="color:var(--accent-alert, #ef4444);">[PURGE]</button>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- POST TITLE WITH NATIVE LINK -->
    <h3 class="post-title">
      <a href="/post/${post.id}" class="post-title-link">${escapeHTML(post.title)}</a>
    </h3>

    <!-- BODY PREVIEW EXCERPT -->
    <div class="post-body-excerpt">${escapeHTML(excerptText)}</div>
    ${isTruncated ? `
      <a href="/post/${post.id}" class="post-read-more">[ READ MORE → ]</a>
    ` : ''}

    <!-- FIXED MEDIA FRAME (FIRST IMAGE) -->
    ${mainImg ? `
      <div class="post-image-frame" data-action="open-lightbox" data-img-src="${escapeHTML(mainImg)}" data-img-title="${escapeHTML(post.title)}" title="Click to view astrophotography attachment in full resolution">
        <div class="post-image-skeleton">
          <div class="skeleton-shimmer"></div>
        </div>
        <img src="${escapeHTML(mainImg)}" class="post-image-main" alt="${escapeHTML(post.title)}" loading="lazy" />
        ${extraImgsCount > 0 ? `
          <div class="post-media-badge-count">+${extraImgsCount}</div>
        ` : ''}
      </div>
    ` : ''}

    <!-- PINNED CARD FOOTER -->
    <div class="post-actions-row">
      <div class="post-action-group">
        <button type="button" class="btn-post-action ${likedClass}" data-action="like" data-post-id="${post.id}" aria-label="Upvote dispatch">
          <span class="post-action-icon">▲</span>
          <span class="likes-count" id="post-score-${post.id}">${score}</span>
          <span class="post-action-label">UPVOTE</span>
        </button>
        <button type="button" class="btn-post-action" data-action="toggle-comments" data-post-comment-btn data-post-id="${post.id}" aria-label="View commentary logs">
          <span class="post-action-icon">💬</span>
          <span class="comments-count">${commentsCount}</span>
          <span class="post-action-label">LOGS</span>
        </button>
      </div>
      <div class="post-action-group">
        <button type="button" class="btn-post-action" data-action="copy-post-link" data-post-id="${post.id}" aria-label="Share dispatch link">
          <span class="post-action-icon">⎘</span>
          <span class="post-action-label">SHARE</span>
        </button>
        ${canDelete ? `
          <button type="button" class="btn-post-action" data-action="delete-post" data-post-id="${post.id}" style="color:var(--accent-alert, #ef4444);" aria-label="Purge dispatch">
            <span class="post-action-icon">×</span>
            <span class="post-action-label">PURGE</span>
          </button>
        ` : ''}
      </div>
    </div>
  `;

  // Image loading listener to smoothly swap in image and prevent layout shift
  if (mainImg) {
    const imgEl = card.querySelector('.post-image-main');
    const skeletonEl = card.querySelector('.post-image-skeleton');
    if (imgEl) {
      if (imgEl.complete && imgEl.naturalWidth > 0) {
        imgEl.classList.add('loaded');
        if (skeletonEl) skeletonEl.remove();
      } else {
        imgEl.addEventListener('load', () => {
          imgEl.classList.add('loaded');
          if (skeletonEl) skeletonEl.remove();
        });
        imgEl.addEventListener('error', () => {
          if (skeletonEl) skeletonEl.remove();
        });
      }
    }
  }

  // Entire card is clickable to open /post/<id>, ignoring buttons, links, menu, and lightbox
  card.addEventListener('click', (e) => {
    // 1. Comments button [💬 LOGS]
    const logsBtn = e.target.closest('[data-action="toggle-comments"]');
    if (logsBtn) {
      e.preventDefault();
      e.stopPropagation();
      saveFeedReturnState();
      if (typeof window.showPostDetail === 'function') {
        window.history.pushState(null, '', `/post/${post.id}#comments-section`);
        window.showPostDetail(post.id).then(() => {
          setTimeout(() => {
            const commSec = document.getElementById('comments-section');
            if (commSec) commSec.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        });
      } else {
        window.location.href = `/post/${post.id}#comments-section`;
      }
      return;
    }

    // 2. Copy dispatch link
    const copyBtn = e.target.closest('[data-action="copy-post-link"]');
    if (copyBtn) {
      e.preventDefault();
      e.stopPropagation();
      const url = `${window.location.origin}/post/${post.id}`;
      navigator.clipboard.writeText(url).then(() => {
        if (typeof window.showToast === 'function') {
          window.showToast('Dispatch permalink copied to clipboard', 'success');
        }
        card.querySelectorAll('.post-context-menu').forEach(m => m.style.display = 'none');
      });
      return;
    }

    // 3. Context menu toggle
    const menuBtn = e.target.closest('[data-action="toggle-post-menu"]');
    if (menuBtn) {
      e.preventDefault();
      e.stopPropagation();
      const menu = card.querySelector(`#menu-${post.id}`);
      if (menu) {
        const isOpen = menu.style.display === 'block';
        document.querySelectorAll('.post-context-menu').forEach(m => m.style.display = 'none');
        menu.style.display = isOpen ? 'none' : 'block';
      }
      return;
    }

    // 4. Native post link (title, read more)
    const postLink = e.target.closest('a[href^="/post/"]');
    if (postLink && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
      if (typeof window.showPostDetail === 'function') {
        e.preventDefault();
        saveFeedReturnState();
        window.history.pushState(null, '', `/post/${post.id}`);
        window.showPostDetail(post.id);
        return;
      }
    }

    // 5. Ignore other interactive elements
    const interactive = e.target.closest('button, a, input, textarea, .post-menu-trigger, .post-context-menu, [data-action="open-lightbox"]');
    if (interactive) return;

    // 6. Default card click opens full post view
    saveFeedReturnState();
    if (typeof window.showPostDetail === 'function') {
      window.history.pushState(null, '', `/post/${post.id}`);
      window.showPostDetail(post.id);
    } else {
      window.location.href = `/post/${post.id}`;
    }
  });

  // Keyboard accessibility: Enter on focused card opens post
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const interactive = e.target.closest('button, a, input, textarea');
      if (interactive && interactive !== card) return;
      saveFeedReturnState();
      if (typeof window.showPostDetail === 'function') {
        window.history.pushState(null, '', `/post/${post.id}`);
        window.showPostDetail(post.id);
      } else {
        window.location.href = `/post/${post.id}`;
      }
    }
  });

  return card;
}

/**
 * Creates canonical Compact Post Row HTMLElement
 */
export function createCompactCard(post, options = {}) {
  const hideAgency = Boolean(options.hideAgencyBadge);
  const authorNick = (post.author && post.author.nickname) ? post.author.nickname : (post.author_nickname || 'anonymous');
  const agSlug = post.agency_slug || (post.agency ? post.agency.slug : 'general');
  const agCode = post.agency_code || (post.agency ? post.agency.code : 'GEN');
  const agInitials = post.agency_initials || (post.agency ? post.agency.initials : 'GEN');
  const commentsCount = post.comment_count !== undefined ? post.comment_count : (post.comments_count || (post.comments ? post.comments.length : 0));
  const score = post.score !== undefined ? post.score : (post.likes_count || 0);

  const authorObj = post.author || {
    id: post.user_id,
    nickname: authorNick,
    avatar_url: post.author_avatar_url,
    avatar_color: post.author_avatar_color,
    role: post.author_role || (post.is_curator ? 'curator' : 'observer')
  };

  const agencyObj = post.agency || {
    slug: agSlug,
    code: agCode,
    initials: agInitials,
    logo_url: post.agency_logo_url,
    has_logo: post.agency_has_logo,
    name: post.agency_name || agCode
  };

  const avatarHelper = window.NovaAvatar || NovaAvatar;

  const row = document.createElement('article');
  row.className = 'compact-post-item';
  row.id = `post-${post.id}`;
  row.setAttribute('tabindex', '0');
  row.setAttribute('role', 'article');
  row.setAttribute('aria-label', `Dispatch: ${post.title}`);

  row.innerHTML = `
    <div class="compact-post-left">
      ${!hideAgency ? `
        <a href="/agency/${encodeURIComponent(agSlug)}" style="display:inline-flex; align-items:center; text-decoration:none;" title="AGENCY // ${escapeHTML(agCode)}">
          ${avatarHelper ? avatarHelper.renderAgency(agencyObj, { size: 'xs' }) : `<span class="agency-initials-badge">${escapeHTML(agInitials)}</span>`}
        </a>
        <a href="/agency/${encodeURIComponent(agSlug)}" class="mono-label" style="font-size:10px; color:var(--accent-cyan); text-decoration:none;">${escapeHTML(agCode)}</a>
        <span class="post-header-divider">•</span>
      ` : ''}
      <a href="/post/${post.id}" class="compact-post-title">${escapeHTML(post.title)}</a>
      ${post._isSessionNew ? `<span class="session-new-badge">NEW</span>` : ''}
    </div>
    <div class="compact-post-meta">
      <span class="topic-tag-pill">${escapeHTML(post.topic || post.category || 'Other')}</span>
      <div style="display:inline-flex; align-items:center; gap:5px;">
        ${avatarHelper ? avatarHelper.render(authorObj, { size: 'xs', link: false }) : ''}
        <a href="/u/${encodeURIComponent(authorNick)}" class="author-name-link" style="max-width:90px;" data-tooltip="@${escapeHTML(authorNick)}" title="@${escapeHTML(authorNick)}">@${escapeHTML(authorNick)}</a>
      </div>
      <span class="post-time">${formatTimeAgo(post.created_at)}</span>
      <span style="color:var(--accent-cyan, #5cc8ff); font-weight:600; font-family:var(--font-mono);">▲ ${score}</span>
      <span style="color:var(--text-muted, #94a3b8); font-family:var(--font-mono);">💬 ${commentsCount}</span>
    </div>
  `;

  row.addEventListener('click', (e) => {
    const postLink = e.target.closest('a[href^="/post/"]');
    if (postLink && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
      if (typeof window.showPostDetail === 'function') {
        e.preventDefault();
        saveFeedReturnState();
        window.history.pushState(null, '', `/post/${post.id}`);
        window.showPostDetail(post.id);
        return;
      }
    }
    if (e.target.closest('a, button, input')) return;
    saveFeedReturnState();
    if (typeof window.showPostDetail === 'function') {
      window.history.pushState(null, '', `/post/${post.id}`);
      window.showPostDetail(post.id);
    } else {
      window.location.href = `/post/${post.id}`;
    }
  });

  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (e.target.closest('a, button, input') && e.target !== row) return;
      saveFeedReturnState();
      if (typeof window.showPostDetail === 'function') {
        window.history.pushState(null, '', `/post/${post.id}`);
        window.showPostDetail(post.id);
      } else {
        window.location.href = `/post/${post.id}`;
      }
    }
  });

  return row;
}

/**
 * Shared dynamic Masonry Grid controller
 * Formula: cols = Math.max(1, Math.floor((W + gap) / (minColWidth + gap)))
 * minColWidth = 340px, gap = 16px, columns flex: 1 1 0 (width: 0)
 */
export class MasonryGrid {
  constructor(container, options = {}) {
    this.container = container;
    this.minColWidth = options.minColWidth || 340;
    this.gap = options.gap || 16;
    this.columns = [];
    this.cards = [];
    this._resizeTimer = null;
    this._resizeObserver = null;
    this.init();
  }

  calcNumCols() {
    const w = this.container.getBoundingClientRect().width || this.container.clientWidth || window.innerWidth;
    return Math.max(1, Math.floor((w + this.gap) / (this.minColWidth + this.gap)));
  }

  init() {
    if (typeof ResizeObserver !== 'undefined' && this.container) {
      this._resizeObserver = new ResizeObserver(() => {
        clearTimeout(this._resizeTimer);
        this._resizeTimer = setTimeout(() => {
          const currentLayout = localStorage.getItem('nova_stream_layout') || 'grid';
          if (currentLayout !== 'grid') return;
          const targetCols = this.calcNumCols();
          if (targetCols !== this.columns.length && this.cards.length > 0) {
            this.rebuild();
          }
        }, 100);
      });
      this._resizeObserver.observe(this.container);
    } else {
      window.addEventListener('resize', () => {
        clearTimeout(this._resizeTimer);
        this._resizeTimer = setTimeout(() => {
          const currentLayout = localStorage.getItem('nova_stream_layout') || 'grid';
          if (currentLayout !== 'grid') return;
          const targetCols = this.calcNumCols();
          if (targetCols !== this.columns.length && this.cards.length > 0) {
            this.rebuild();
          }
        }, 150);
      });
    }
  }

  setupColumns(numCols) {
    this.container.innerHTML = '';
    this.columns = [];
    for (let i = 0; i < numCols; i++) {
      const col = document.createElement('div');
      col.className = 'masonry-column';
      col.setAttribute('data-col-index', String(i));
      this.container.appendChild(col);
      this.columns.push(col);
    }
  }

  getShortestColumn() {
    if (this.columns.length === 0) {
      this.setupColumns(this.calcNumCols());
    }
    if (this.columns.length === 1) return this.columns[0];
    let shortest = this.columns[0];
    let minH = shortest.offsetHeight;
    for (let i = 1; i < this.columns.length; i++) {
      const h = this.columns[i].offsetHeight;
      if (h < minH) {
        minH = h;
        shortest = this.columns[i];
      }
    }
    return shortest;
  }

  distributeCards(cardElements) {
    this.cards = Array.from(cardElements);
    const targetCols = this.calcNumCols();
    this.setupColumns(targetCols);
    for (const card of this.cards) {
      const col = this.getShortestColumn();
      col.appendChild(card);
    }
  }

  rebuild() {
    if (this.cards.length === 0) return;
    this.distributeCards(this.cards);
  }

  prependCard(cardElement) {
    if (this.columns.length === 0) {
      this.setupColumns(this.calcNumCols());
    }
    const targetCol = this.getShortestColumn();
    targetCol.prepend(cardElement);
    this.cards.unshift(cardElement);
  }

  removeCard(cardId) {
    const el = document.getElementById(cardId);
    if (el) el.remove();
    this.cards = this.cards.filter(c => c.id !== cardId);
  }

  destroy() {
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
  }
}

// Safely escape HTML and linkify plain URLs
export function formatSafeBody(text) {
  if (!text) return '';
  const escaped = escapeHTML(text);
  // Linkify URLs with rel="noopener noreferrer nofollow"
  return escaped.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer nofollow" class="body-link">${url}</a>`;
  });
}

// Global browser window attachment for both module and non-module script tags
if (typeof window !== 'undefined') {
  window.PostCard = {
    createPostCard,
    createCompactCard,
    makeExcerpt,
    saveFeedReturnState,
    restoreFeedReturnState,
    escapeHTML,
    formatTimeAgo,
    formatSafeBody,
    MasonryGrid
  };
}

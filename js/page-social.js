import { API, AuthState, SharedNav, initStarfield, showToast, escapeHTML, timeAgo } from '/js/social.js';
import NovaAvatar from '/js/avatar.js';
import { feedState } from '/js/feed-state.js';
import {
  createPostCard,
  createCompactCard,
  saveFeedReturnState,
  restoreFeedReturnState,
  formatSafeBody,
  formatTimeAgo,
  MasonryGrid
} from '/js/postcard.js';

initStarfield('starfield-canvas');
SharedNav.init('social');

let currentTab = 'global';
let currentCategory = 'All';
let currentSort = 'new';
let currentAgencyFilter = '';
let launchesData = [];

// Layout management: list, grid, compact (persisted in shared localStorage key)
let currentLayout = localStorage.getItem('nova_stream_layout') || localStorage.getItem('nova_feed_layout');
if (!currentLayout || !['list', 'grid', 'compact'].includes(currentLayout)) {
  currentLayout = window.innerWidth >= 1400 ? 'grid' : 'list';
}

// Parse URL query params for initial agency or tab filters
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('tab') === 'following') currentTab = 'following';
if (urlParams.get('agency')) currentAgencyFilter = urlParams.get('agency');
if (urlParams.get('cat')) currentCategory = urlParams.get('cat');
if (urlParams.get('sort')) currentSort = urlParams.get('sort');
if (window.location.pathname === '/popular') currentSort = 'hot';

// Sync feedState initial state
feedState.setLayout(currentLayout);
feedState.setFilter('tab', currentTab);
feedState.setFilter('category', currentCategory);
feedState.setFilter('sort', currentSort);
feedState.setFilter('agency', currentAgencyFilter);

// Detect specific single post request via /post/<id>
const postPathMatch = window.location.pathname.match(/^\/post\/(\d+)/);
let targetPostId = postPathMatch ? postPathMatch[1] : (window.location.hash.match(/#post-(\d+)/) ? window.location.hash.match(/#post-(\d+)/)[1] : null);

const postsContainer = document.getElementById('posts-container');
const agencyFilterBanner = document.getElementById('active-agency-banner');

// Apply layout class immediately
if (postsContainer) {
  postsContainer.className = `posts-stream-${currentLayout}`;
}
updateLayoutButtons();

let masonryGrid = null;
if (postsContainer) {
  masonryGrid = new MasonryGrid(postsContainer);
}


/* ==============================================================================
   REAL-TIME POLLING & UPDATES (Page Visibility API + Exponential Backoff)
   ============================================================================== */
let pollTimer = null;
let pollIntervalMs = 30000; // 30s
let isPollingActive = false;

async function pollFeedUpdates() {
  if (document.visibilityState !== 'visible') return;

  const latestId = feedState.getLatestPostId();
  const visibleCards = Array.from(document.querySelectorAll('.post-card'))
    .map(el => el.id.replace('post-', ''))
    .filter(Boolean)
    .slice(0, 40);

  let url = `/api/feed/updates?since=${latestId}&tab=${encodeURIComponent(currentTab)}`;
  if (currentAgencyFilter) url += `&agency=${encodeURIComponent(currentAgencyFilter)}`;
  if (currentCategory && currentCategory !== 'All') url += `&category=${encodeURIComponent(currentCategory)}`;
  if (visibleCards.length > 0) url += `&ids=${visibleCards.join(',')}`;

  try {
    const res = await API.get(url);
    pollIntervalMs = 30000; // Reset backoff on successful response

    // 1. Process new dispatches from other observers
    if (res.new_posts && res.new_posts.length > 0) {
      const genuinelyNewCount = feedState.addPendingUpdates(res.new_posts);
      if (genuinelyNewCount > 0) {
        showNewDispatchesPill(feedState.pendingNewPosts.length);
      }
    }

    // 2. Batch refresh vote counts and comments on visible cards without re-render
    if (res.updates && res.updates.length > 0) {
      feedState.updatePostStats(res.updates);
      res.updates.forEach(u => {
        const card = document.getElementById(`post-${u.id}`);
        if (card) {
          const likesEl = card.querySelector('.likes-count');
          if (likesEl && u.likes_count !== undefined) likesEl.textContent = u.likes_count;
          const commsEl = card.querySelector('.comments-count');
          if (commsEl && u.comments_count !== undefined) commsEl.textContent = u.comments_count;
        }
      });
    }
  } catch (err) {
    // Exponential backoff on errors: 30s -> 60s -> 120s max
    pollIntervalMs = Math.min(pollIntervalMs * 2, 120000);
  } finally {
    scheduleNextPoll();
  }
}

function scheduleNextPoll() {
  clearTimeout(pollTimer);
  if (document.visibilityState === 'visible') {
    pollTimer = setTimeout(pollFeedUpdates, pollIntervalMs);
  }
}

function showNewDispatchesPill(count) {
  const detail = document.getElementById('post-detail-view');
  if (detail && detail.style.display !== 'none' && !detail.classList.contains('detail-hidden')) return;
  if (window.location.pathname.startsWith('/post/')) return;

  const container = document.getElementById('new-dispatches-pill-container');
  const label = document.getElementById('new-dispatches-label');
  if (!container || !label) return;
  label.textContent = count === 1 ? '[ 1 NEW DISPATCH ]' : `[ ${count} NEW DISPATCHES ]`;
  container.style.display = 'flex';
}

function hideNewDispatchesPill() {
  const container = document.getElementById('new-dispatches-pill-container');
  if (container) container.style.display = 'none';
}

const pillBtn = document.getElementById('btn-new-dispatches');
if (pillBtn) {
  pillBtn.addEventListener('click', () => {
    const newPosts = feedState.flushPendingUpdates();
    hideNewDispatchesPill();
    if (!newPosts || newPosts.length === 0) return;

    // Prepend cards to view
    newPosts.reverse().forEach(post => {
      insertCardAtTop(post, true);
      updateRecentDispatchesWidget(post);
      incrementPostsTodayCounter();
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// Sync feedState events with UI components
feedState.subscribe((event, data) => {
  if (event === 'pending_updates_count') {
    if (data.count > 0) showNewDispatchesPill(data.count);
    else hideNewDispatchesPill();
  } else if (event === 'pending_flushed') {
    hideNewDispatchesPill();
  } else if (event === 'post_deleted') {
    const card = document.getElementById(`post-${data.postId}`);
    if (card) {
      card.classList.add('post-card-purging');
      setTimeout(() => {
        if (currentLayout === 'grid' && masonryGrid) {
          masonryGrid.removeCard(card.id);
        } else {
          card.remove();
        }
        checkEmptyState();
      }, 200);
    }
  } else if (event === 'stats_updated') {
    if (data.updates) {
      data.updates.forEach(u => {
        const card = document.getElementById(`post-${u.id}`);
        if (card) {
          const scoreEl = card.querySelector(`#post-score-${u.id}`);
          if (scoreEl && u.score !== undefined) scoreEl.textContent = u.score;
          const commBtn = card.querySelector('[data-post-comment-btn]');
          if (commBtn && (u.comment_count !== undefined || u.comments_count !== undefined)) {
            const count = u.comment_count !== undefined ? u.comment_count : u.comments_count;
            const countSpan = commBtn.querySelector('.comments-count') || commBtn.querySelector('.action-count');
            if (countSpan) countSpan.textContent = count;
          }
        }
      });
    }
  } else if (event === 'filter_changed') {
    if (data.key === 'category') currentCategory = data.value;
    else if (data.key === 'tab') currentTab = data.value;
    else if (data.key === 'sort') currentSort = data.value;
    else if (data.key === 'agency') currentAgencyFilter = data.value;
    updateActiveFilterUI();
    renderFilteredPosts();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    pollFeedUpdates();
  } else {
    clearTimeout(pollTimer);
  }
});

/* ==============================================================================
   FEED NAVIGATION & CONTROLS
   ============================================================================== */
// Feed Tabs: Global vs Following
const tabGlobal = document.getElementById('tab-feed-global');
const tabFollowing = document.getElementById('tab-feed-following');

if (tabGlobal) {
  tabGlobal.addEventListener('click', () => {
    currentTab = 'global';
    feedState.setFilter('tab', currentTab);
    tabGlobal.classList.add('active');
    tabGlobal.setAttribute('aria-selected', 'true');
    if (tabFollowing) {
      tabFollowing.classList.remove('active');
      tabFollowing.setAttribute('aria-selected', 'false');
    }
    loadPosts();
  });
}

if (tabFollowing) {
  tabFollowing.addEventListener('click', () => {
    if (!AuthState.isLoggedIn()) {
      showToast('Please sign in to view your Following feed', 'info');
      window.location.href = '/login?next=/social';
      return;
    }
    currentTab = 'following';
    feedState.setFilter('tab', currentTab);
    tabFollowing.classList.add('active');
    tabFollowing.setAttribute('aria-selected', 'true');
    if (tabGlobal) {
      tabGlobal.classList.remove('active');
      tabGlobal.setAttribute('aria-selected', 'false');
    }
    loadPosts();
  });
}

// Sort Controls
document.querySelectorAll('#sort-controls .sort-chip-btn').forEach(btn => {
  if (btn.dataset.sort === currentSort) {
    document.querySelectorAll('#sort-controls .sort-chip-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  btn.addEventListener('click', () => {
    document.querySelectorAll('#sort-controls .sort-chip-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentSort = btn.dataset.sort;
    feedState.setFilter('sort', currentSort);
    loadPosts();
  });
});

// Layout Toggles: LIST, GRID, COMPACT
document.querySelectorAll('#layout-toggle .layout-toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const layout = btn.dataset.layout;
    setLayout(layout);
  });
});

function setLayout(layout) {
  if (!['list', 'grid', 'compact'].includes(layout)) return;
  currentLayout = layout;
  localStorage.setItem('nova_stream_layout', layout);
  localStorage.setItem('nova_feed_layout', layout);
  feedState.setLayout(layout);
  if (postsContainer) {
    postsContainer.className = `posts-stream-${layout}`;
  }
  updateLayoutButtons();
  renderFilteredPosts();
}
window.setLayout = setLayout;

function updateLayoutButtons() {
  document.querySelectorAll('#layout-toggle .layout-toggle-btn').forEach(btn => {
    if (btn.dataset.layout === currentLayout) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// Category chips
document.querySelectorAll('.cat-chip').forEach(chip => {
  if (chip.dataset.cat.toLowerCase() === currentCategory.toLowerCase()) {
    document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
  }
  chip.addEventListener('click', () => {
    document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    currentCategory = chip.dataset.cat;
    feedState.setFilter('category', currentCategory);
    renderFilteredPosts();
  });
});

function updateActiveFilterUI() {
  // Update category chips
  document.querySelectorAll('.cat-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.cat.toLowerCase() === currentCategory.toLowerCase());
  });

  // Update agency banner
  if (agencyFilterBanner) {
    if (currentAgencyFilter) {
      agencyFilterBanner.style.display = 'block';
      agencyFilterBanner.innerHTML = `
        <div style="background: rgba(92,200,255,0.06); border: 1px solid var(--accent-cyan); border-radius: var(--radius-tech); padding: 10px 16px; display: flex; justify-content: space-between; align-items: center;">
          <span class="mono-label" style="color: var(--accent-cyan);">FILTERED BY CHANNEL: // ${escapeHTML(currentAgencyFilter.toUpperCase())}</span>
          <button class="btn-tech btn-tech-secondary" id="btn-clear-agency-filter" style="font-size: 9px; padding: 2px 8px;">[CLEAR FILTER ✕]</button>
        </div>
      `;
      const clearBtn = document.getElementById('btn-clear-agency-filter');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          currentAgencyFilter = '';
          feedState.setFilter('agency', '');
          agencyFilterBanner.style.display = 'none';
          loadPosts();
        });
      }
    } else {
      agencyFilterBanner.style.display = 'none';
    }
  }

  // Update tabs
  const tabG = document.getElementById('tab-feed-global');
  const tabF = document.getElementById('tab-feed-following');
  if (tabG) tabG.classList.toggle('active', currentTab === 'global');
  if (tabF) tabF.classList.toggle('active', currentTab === 'following');
}

// Load Posts from Backend API
async function loadPosts() {
  // If target post ID requested via /post/<id>, render full post view directly
  if (targetPostId) {
    showPostDetail(targetPostId);
    return;
  }

  if (typeof UI !== 'undefined' && UI.skeleton) {
    UI.skeleton(postsContainer, 4);
  } else {
    postsContainer.innerHTML = `
      <div class="hairline-card" style="padding: 30px;">
        <div class="skeleton-box" style="height: 18px; width: 40%; margin-bottom: 12px;"></div>
        <div class="skeleton-box" style="height: 14px; width: 90%; margin-bottom: 8px;"></div>
        <div class="skeleton-box" style="height: 14px; width: 70%;"></div>
      </div>
    `;
  }

  updateActiveFilterUI();

  try {
    let url = `/api/feed?tab=${encodeURIComponent(currentTab)}&sort=${encodeURIComponent(currentSort)}`;
    if (currentAgencyFilter) url += `&agency=${encodeURIComponent(currentAgencyFilter)}`;
    const res = await API.get(url);
    const rawPosts = res.posts || res.feed || [];
    feedState.setPosts(rawPosts);
    renderFilteredPosts();

    // Check if returning from post detail with saved scroll position
    const returnState = restoreFeedReturnState();
    if (returnState && returnState.scrollY) {
      setTimeout(() => {
        window.scrollTo({ top: returnState.scrollY, behavior: 'instant' });
      }, 50);
    }
  } catch (err) {
    postsContainer.innerHTML = `
      <div class="empty-state-card">
        <div class="empty-state-title">// TELEMETRY FEED UNAVAILABLE</div>
        <div class="empty-state-desc">${escapeHTML(err.message)}</div>
      </div>
    `;
  }
}

// Render Filtered Posts using Canonical PostCard component
function renderFilteredPosts() {
  const visible = feedState.getVisiblePosts();

  if (visible.length === 0) {
    postsContainer.innerHTML = `
      <div class="empty-state-card">
        <div class="empty-state-title">// NO DISPATCHES RECORDED</div>
        <div class="empty-state-desc">No transmissions found in this frequency. Transmit an observation dispatch to begin.</div>
      </div>
    `;
    return;
  }

  // COMPACT VIEW: single clean row per post
  if (currentLayout === 'compact') {
    postsContainer.innerHTML = '';
    visible.forEach(post => {
      postsContainer.appendChild(createCompactCard(post));
    });
    return;
  }

  // LIST VIEW: 100% width cards with max-width 78ch text inside
  if (currentLayout === 'list') {
    postsContainer.innerHTML = '';
    visible.forEach(post => {
      postsContainer.appendChild(createPostCard(post, { layout: 'list' }));
    });
    return;
  }

  // GRID VIEW: Masonry Layout via JS Column Distribution
  const cardElements = visible.map(post => createPostCard(post, { layout: 'grid' }));
  if (masonryGrid) {
    masonryGrid.distributeCards(cardElements);
  }
}

// Insert single card at top (for optimistic post create & pill prepend)
function insertCardAtTop(post, highlight = true) {
  const emptyState = postsContainer.querySelector('.empty-state-card');
  if (emptyState) emptyState.remove();

  if (currentLayout === 'compact') {
    const cardEl = createCompactCard(post);
    if (highlight) {
      cardEl.classList.add('post-card-highlight');
      setTimeout(() => cardEl.classList.remove('post-card-highlight'), 2200);
    }
    postsContainer.prepend(cardEl);
    return;
  }

  if (currentLayout === 'list') {
    const cardEl = createPostCard(post, { layout: 'list', highlight });
    postsContainer.prepend(cardEl);
    return;
  }

  // GRID VIEW: Insert into shortest column to keep existing cards stable
  if (currentLayout === 'grid' && masonryGrid) {
    const cardEl = createPostCard(post, { layout: 'grid', highlight });
    masonryGrid.prependCard(cardEl);
  }
}

/* ==============================================================================
   FULL POST DETAIL VIEW (/post/<id>)
   ============================================================================== */
async function showPostDetail(postId) {
  const detailContainer = document.getElementById('post-detail-view');
  const agencyWidget = document.getElementById('post-detail-agency-widget');
  const filterBar = document.querySelector('.unified-sticky-filter-bar');
  const pillContainer = document.getElementById('new-dispatches-pill-container');

  if (postsContainer) {
    postsContainer.classList.add('stream-hidden');
    postsContainer.style.setProperty('display', 'none', 'important');
  }
  if (filterBar) {
    filterBar.style.setProperty('display', 'none', 'important');
  }
  if (pillContainer) {
    pillContainer.style.setProperty('display', 'none', 'important');
  }
  if (agencyFilterBanner) {
    agencyFilterBanner.style.setProperty('display', 'none', 'important');
  }

  if (!detailContainer) return;
  detailContainer.classList.remove('detail-hidden');
  detailContainer.removeAttribute('hidden');
  detailContainer.style.setProperty('display', 'flex', 'important');
  detailContainer.innerHTML = `
    <div class="full-post-back-bar">
      <button type="button" class="btn-back-stream" id="btn-back-to-stream">[ ← BACK TO STREAM ]</button>
      <span class="mono-label" style="font-size:10px; color:var(--text-muted);">DISPATCH // #${postId}</span>
    </div>
    <div class="hairline-card" style="padding: 30px;">
      <div class="skeleton-box" style="height: 24px; width: 60%; margin-bottom: 16px;"></div>
      <div class="skeleton-box" style="height: 16px; width: 90%; margin-bottom: 10px;"></div>
      <div class="skeleton-box" style="height: 16px; width: 75%; margin-bottom: 24px;"></div>
      <div class="skeleton-box" style="height: 280px; width: 100%;"></div>
    </div>
  `;

  document.getElementById('btn-back-to-stream').addEventListener('click', () => {
    returnToStream();
  });

  try {
    const res = await API.get(`/api/posts/${postId}`);
    const post = res.post;
    if (!post) throw new Error('Dispatch could not be retrieved from orbital archives');

    document.title = `NOVA // Dispatch #${post.id} - ${post.title}`;

    // Add to RECENT POSTS
    addRecentlyViewedPost(post);

    // Render post detail
    renderPostDetail(post, detailContainer);

    if (window.location.hash === '#comments-section') {
      setTimeout(() => {
        const commSec = document.getElementById('comments-section');
        if (commSec) commSec.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }

    // Render agency widget in right rail
    if (agencyWidget && post.agency) {
      agencyWidget.style.display = 'block';
      agencyWidget.innerHTML = `
        <div class="agency-dossier-widget">
          <div class="agency-dossier-header">
            <div style="display:inline-flex; align-items:center;">${NovaAvatar.renderAgency(post.agency, { size: 'md' })}</div>
            <div>
              <div class="mono-label" style="font-size: 10px; color: var(--accent-cyan);">${escapeHTML(post.agency.code || 'AGENCY')}</div>
              <div class="agency-dossier-name">${escapeHTML(post.agency.name)}</div>
            </div>
          </div>
          <div class="agency-dossier-desc">${escapeHTML(post.agency.description || 'Scientific telemetry, mission operations, and observational archives.')}</div>
          <div style="display: flex; gap: 8px; align-items: center; justify-content: space-between;">
            <a href="/agency/${encodeURIComponent(post.agency.slug)}" class="btn-tech btn-tech-secondary" style="font-size: 10px; text-decoration: none;">[VIEW CHANNEL →]</a>
            <button type="button" class="btn-tech btn-tech-primary" data-action="follow-agency-widget" data-agency-slug="${escapeHTML(post.agency.slug)}" style="font-size: 10px;">
              ${post.agency.is_following ? '[FOLLOWING]' : '[FOLLOW]'}
            </button>
          </div>
        </div>
      `;
    }
  } catch (err) {
    detailContainer.innerHTML = `
      <div class="full-post-back-bar">
        <button type="button" class="btn-back-stream" id="btn-back-to-stream-err">[ ← BACK TO STREAM ]</button>
      </div>
      <div class="empty-state-card" style="padding: 40px;">
        <div class="empty-state-title">// DISPATCH NOT FOUND (404)</div>
        <div class="empty-state-desc">${escapeHTML(err.message)}</div>
      </div>
    `;
    const errBack = document.getElementById('btn-back-to-stream-err');
    if (errBack) errBack.addEventListener('click', () => returnToStream());
  }
}

function returnToStream() {
  const detailContainer = document.getElementById('post-detail-view');
  const agencyWidget = document.getElementById('post-detail-agency-widget');
  const filterBar = document.querySelector('.unified-sticky-filter-bar');
  const pillContainer = document.getElementById('new-dispatches-pill-container');

  if (detailContainer) {
    detailContainer.classList.add('detail-hidden');
    detailContainer.setAttribute('hidden', '');
    detailContainer.style.setProperty('display', 'none', 'important');
    detailContainer.innerHTML = '';
  }
  if (agencyWidget) {
    agencyWidget.style.setProperty('display', 'none', 'important');
  }
  if (postsContainer) {
    postsContainer.classList.remove('stream-hidden');
    postsContainer.style.removeProperty('display');
  }
  if (filterBar) {
    filterBar.style.removeProperty('display');
  }
  if (pillContainer) {
    pillContainer.style.removeProperty('display');
  }
  if (agencyFilterBanner && currentAgencyFilter) {
    agencyFilterBanner.style.removeProperty('display');
  }

  const returnState = restoreFeedReturnState();
  if (returnState && returnState.fromUrl && returnState.fromUrl.startsWith('/agency/')) {
    window.location.href = returnState.fromUrl;
    return;
  }

  window.history.pushState(null, '', '/social');
  document.title = 'NOVA // Social Transmissions & Dispatches';

  if (!feedState.posts || feedState.posts.length === 0) {
    targetPostId = null;
    loadPosts();
  }

  if (returnState) {
    if (returnState.layout && returnState.layout !== currentLayout) {
      setLayout(returnState.layout);
    }
    if (returnState.scrollY) {
      setTimeout(() => {
        window.scrollTo({ top: returnState.scrollY, behavior: 'instant' });
      }, 50);
    }
  }
}

window.showPostDetail = showPostDetail;
window.returnToStream = returnToStream;

window.addEventListener('popstate', () => {
  const m = window.location.pathname.match(/^\/post\/(\d+)/);
  if (m) {
    showPostDetail(m[1]);
  } else {
    returnToStream();
  }
});

function renderPostDetail(post, container) {
  const isOwner = AuthState.user && (AuthState.user.id === post.user_id || (post.author && AuthState.user.id === post.author.id));
  const canDelete = isOwner || AuthState.isCurator();
  const likedClass = (post.user_liked || post.viewer_vote === 1) ? 'liked' : '';
  const score = post.score !== undefined ? post.score : (post.likes_count || 0);
  const authorNick = (post.author && post.author.nickname) ? post.author.nickname : (post.author_nickname || 'anonymous');
  const agSlug = post.agency_slug || (post.agency ? post.agency.slug : 'general');
  const agCode = post.agency_code || (post.agency ? post.agency.code : 'GEN');
  const agInitials = post.agency_initials || (post.agency ? post.agency.initials : 'GEN');
  const isGeneral = agSlug === 'general';
  const channelLabel = isGeneral ? 'CHANNEL // GENERAL' : `AGENCY // ${agCode}`;

  const imgUrls = post.image_urls || (post.image_url ? [post.image_url] : []);
  let currentImgIndex = 0;

  const comments = post.comments || [];

  container.innerHTML = `
    <div class="full-post-back-bar">
      <button type="button" class="btn-back-stream" id="btn-back-to-stream">[ ← BACK TO STREAM ]</button>
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="mono-label" style="font-size:10px; color:var(--text-muted);">${escapeHTML(channelLabel)}</span>
        <span class="post-header-divider">•</span>
        <span class="topic-tag-pill">${escapeHTML(post.topic || post.category || 'Other')}</span>
      </div>
    </div>

    <article class="full-post-article">
      <!-- HEADER ROW -->
      <div class="post-header-line">
        <div class="post-header-top-row">
          <div class="post-header-left">
            ${!isGeneral ? `
              <a href="/agency/${encodeURIComponent(agSlug)}" class="agency-badge-pill" title="${escapeHTML(channelLabel)}">
                ${NovaAvatar.renderAgency(post.agency || { slug: agSlug, code: agCode, initials: agInitials, logo_url: post.agency_logo_url }, { size: 'xs' })}
                <span class="agency-badge-name">${escapeHTML(channelLabel)}</span>
              </a>
              <span class="post-header-divider">•</span>
            ` : ''}
            <div class="author-block" style="display:inline-flex; align-items:center; gap:6px;">
              ${NovaAvatar.render(post.author || { nickname: authorNick, id: post.user_id }, { size: 'sm', link: false })}
              <a href="/u/${encodeURIComponent(authorNick)}" class="author-name-link" data-tooltip="@${escapeHTML(authorNick)}" title="@${escapeHTML(authorNick)}">@${escapeHTML(authorNick)}</a>
            </div>
            <span class="post-header-divider">•</span>
            <span class="post-time">${formatTimeAgo(post.created_at)}</span>
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

      <!-- FULL TITLE (Unconstrained) -->
      <h1 class="full-post-title">${escapeHTML(post.title)}</h1>

      <!-- IMAGES CAROUSEL -->
      ${imgUrls.length > 0 ? `
        <div class="full-post-carousel">
          <div class="carousel-stage" id="carousel-stage" title="Click to view in full resolution lightbox">
            <img src="${escapeHTML(imgUrls[0])}" id="carousel-main-img" alt="${escapeHTML(post.title)}" />
            ${imgUrls.length > 1 ? `
              <button type="button" class="carousel-nav-btn btn-prev" id="btn-carousel-prev" aria-label="Previous image">❮</button>
              <button type="button" class="carousel-nav-btn btn-next" id="btn-carousel-next" aria-label="Next image">❯</button>
              <div class="carousel-counter-badge" id="carousel-counter">IMAGE 1 OF ${imgUrls.length}</div>
            ` : ''}
          </div>
          ${imgUrls.length > 1 ? `
            <div class="carousel-thumbnails" id="carousel-thumbs">
              ${imgUrls.map((u, idx) => `
                <div class="carousel-thumb ${idx === 0 ? 'active' : ''}" data-index="${idx}">
                  <img src="${escapeHTML(u)}" alt="Thumb ${idx + 1}" />
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      ` : ''}

      <!-- FULL BODY (Preserves line breaks, safe links, no clamp) -->
      <div class="full-post-body">${formatSafeBody(post.body)}</div>

      <!-- ACTIONS BAR -->
      <div class="full-post-actions-bar">
        <div class="post-action-group">
          <button type="button" class="btn-post-action ${likedClass}" id="detail-like-btn" data-action="like" data-post-id="${post.id}" aria-label="Upvote dispatch">
            <span class="post-action-icon">▲</span>
            <span class="likes-count" id="detail-score">${score}</span>
            <span class="post-action-label">UPVOTE</span>
          </button>
          <a href="#comments-section" class="btn-post-action" id="detail-logs-anchor" style="text-decoration:none;" aria-label="View comments">
            <span class="post-action-icon">💬</span>
            <span class="comments-count" id="detail-comments-count">${comments.length}</span>
            <span class="post-action-label">LOGS</span>
          </a>
        </div>
        <div class="post-action-group">
          <button type="button" class="btn-post-action" id="detail-share-btn" data-action="copy-post-link" data-post-id="${post.id}">
            <span class="post-action-icon">⎘</span>
            <span class="post-action-label">SHARE</span>
          </button>
          <button type="button" class="btn-post-action" id="detail-save-btn">
            <span class="post-action-icon">⬡</span>
            <span class="post-action-label">SAVE</span>
          </button>
          <button type="button" class="btn-post-action" data-action="report" data-post-id="${post.id}" style="color:var(--accent-gold, #fbbf24);">
            <span class="post-action-icon">!</span>
            <span class="post-action-label">REPORT</span>
          </button>
          ${canDelete ? `
            <button type="button" class="btn-post-action" data-action="delete-post" data-post-id="${post.id}" style="color:var(--accent-alert, #ef4444);">
              <span class="post-action-icon">×</span>
              <span class="post-action-label">PURGE</span>
            </button>
          ` : ''}
        </div>
      </div>

      <!-- COMMENTS SECTION -->
      <section id="comments-section" class="full-post-comments-wrap">
        <div class="full-post-comments-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="mono-label">// TRANSMISSION COMMENTARY LOGS</span>
            <span class="widget-count-badge" id="commentary-count-badge">[${comments.length}]</span>
          </div>
        </div>

        <div class="full-post-comment-form-wrap">
          ${AuthState.isLoggedIn() ? `
            <form id="full-post-comment-form">
              <textarea class="form-textarea" id="full-comment-input" rows="3" placeholder="Append observation commentary to transmission buffer..." maxlength="300" required style="width:100%; margin-bottom:8px; font-size:13px;"></textarea>
              <div style="display:flex; justify-content:flex-end;">
                <button type="submit" class="btn-tech btn-tech-primary" style="padding:6px 16px; font-size:11px;">[TRANSMIT COMMENT]</button>
              </div>
            </form>
          ` : `
            <div class="mono-sublabel" style="text-align:center; padding:16px; background:rgba(255,255,255,0.03); border:var(--border-subtle); border-radius:var(--radius-tech, 3px);">
              <a href="/login?next=${encodeURIComponent(window.location.pathname)}" style="color:var(--accent-cyan); text-decoration:none;">Sign in to append transmission commentary logs →</a>
            </div>
          `}
        </div>

        <div class="comments-list" id="full-post-comments-list">
          ${comments.map(c => `
            <div class="comment-item" style="padding:12px 14px; margin-bottom:10px;">
              <div class="comment-header" style="display:flex; align-items:center; gap:8px;">
                ${NovaAvatar.render(c.author, { size: 'xs', link: false })}
                <a href="/u/${encodeURIComponent(c.author ? c.author.nickname : 'observer')}" class="author-name-link">@${escapeHTML(c.author ? c.author.nickname : 'observer')}</a>
                <span class="post-header-divider">•</span>
                <span class="post-time">${formatTimeAgo(c.created_at)}</span>
              </div>
              <div style="font-size:13px; color:#cbd5e1; margin-top:6px; line-height:1.5; white-space:pre-wrap;">${escapeHTML(c.comment)}</div>
            </div>
          `).join('')}
          ${comments.length === 0 ? `
            <div class="mono-sublabel" id="no-comments-msg" style="padding:16px; text-align:center;">// NO COMMENTARY LOGS APPENDED YET. BE THE FIRST OBSERVER TO TRANSMIT.</div>
          ` : ''}
        </div>
      </section>
    </article>
  `;

  // Hook back button
  const backBtn = container.querySelector('#btn-back-to-stream');
  if (backBtn) backBtn.addEventListener('click', () => returnToStream());

  // Hook smooth scroll to comments from actions bar
  const logsAnchor = container.querySelector('#detail-logs-anchor');
  if (logsAnchor) {
    logsAnchor.addEventListener('click', (e) => {
      e.preventDefault();
      const commSec = document.getElementById('comments-section');
      if (commSec) commSec.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Hook save button
  const saveBtn = container.querySelector('#detail-save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      try {
        const raw = localStorage.getItem('nova_saved_posts');
        let saved = raw ? JSON.parse(raw) : [];
        if (saved.includes(post.id)) {
          saved = saved.filter(id => id !== post.id);
          showToast('Dispatch removed from saved archives', 'info');
        } else {
          saved.push(post.id);
          showToast('Dispatch saved to personal telemetry archives', 'success');
        }
        localStorage.setItem('nova_saved_posts', JSON.stringify(saved));
      } catch (e) {
        showToast('Dispatch saved', 'success');
      }
    });
  }

  // Hook carousel
  if (imgUrls.length > 0) {
    const stage = container.querySelector('#carousel-stage');
    const mainImg = container.querySelector('#carousel-main-img');
    const counter = container.querySelector('#carousel-counter');
    const thumbs = container.querySelectorAll('.carousel-thumb');

    function updateCarousel(idx) {
      currentImgIndex = (idx + imgUrls.length) % imgUrls.length;
      if (mainImg) mainImg.src = imgUrls[currentImgIndex];
      if (counter) counter.textContent = `IMAGE ${currentImgIndex + 1} OF ${imgUrls.length}`;
      thumbs.forEach((t, i) => {
        t.classList.toggle('active', i === currentImgIndex);
      });
    }

    const prevBtn = container.querySelector('#btn-carousel-prev');
    const nextBtn = container.querySelector('#btn-carousel-next');
    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        updateCarousel(currentImgIndex - 1);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        updateCarousel(currentImgIndex + 1);
      });
    }

    thumbs.forEach(t => {
      t.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(t.dataset.index, 10);
        updateCarousel(idx);
      });
    });

    if (stage) {
      stage.addEventListener('click', () => {
        openLightbox(imgUrls[currentImgIndex], post.title);
      });
    }
  }

  // Hook comment submission
  const commentForm = container.querySelector('#full-post-comment-form');
  if (commentForm) {
    commentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('full-comment-input');
      const text = (input ? input.value : '').trim();
      if (!text) return;

      try {
        const res = await API.post(`/api/posts/${post.id}/comments`, { comment: text });
        if (!post.comments) post.comments = [];
        post.comments.push(res.comment);
        feedState.addComment(post.id, res.comment);

        const list = document.getElementById('full-post-comments-list');
        const emptyMsg = document.getElementById('no-comments-msg');
        if (emptyMsg) emptyMsg.remove();

        const item = document.createElement('div');
        item.className = 'comment-item';
        item.style.padding = '12px 14px';
        item.style.marginBottom = '10px';
        item.innerHTML = `
          <div class="comment-header" style="display:flex; align-items:center; gap:8px;">
            ${NovaAvatar.render(res.comment.author, { size: 'xs', link: false })}
            <a href="/u/${encodeURIComponent(res.comment.author.nickname)}" class="author-name-link">@${escapeHTML(res.comment.author.nickname)}</a>
            <span class="post-header-divider">•</span>
            <span class="post-time">JUST NOW</span>
          </div>
          <div style="font-size:13px; color:#cbd5e1; margin-top:6px; line-height:1.5; white-space:pre-wrap;">${escapeHTML(res.comment.comment)}</div>
        `;
        list.appendChild(item);
        input.value = '';

        const badge = document.getElementById('commentary-count-badge');
        const countEl = document.getElementById('detail-comments-count');
        const newCount = post.comments.length;
        if (badge) badge.textContent = `[${newCount}]`;
        if (countEl) countEl.textContent = newCount;

        showToast('Comment appended to transmission logs', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }
}

function addRecentlyViewedPost(post) {
  try {
    const raw = localStorage.getItem('nova_recently_viewed_posts');
    let list = raw ? JSON.parse(raw) : [];
    list = list.filter(item => item.id !== post.id);
    list.unshift({
      id: post.id,
      title: post.title,
      author_nickname: (post.author && post.author.nickname) ? post.author.nickname : (post.author_nickname || 'observer'),
      created_at: post.created_at
    });
    if (list.length > 8) list = list.slice(0, 8);
    localStorage.setItem('nova_recently_viewed_posts', JSON.stringify(list));
    loadRecentPosts();
  } catch (e) {
    // ignore
  }
}


function checkEmptyState() {
  const visible = feedState.getVisiblePosts();
  if (visible.length === 0) {
    postsContainer.innerHTML = `
      <div class="empty-state-card">
        <div class="empty-state-title">// NO DISPATCHES RECORDED</div>
        <div class="empty-state-desc">No transmissions found in this frequency. Transmit an observation dispatch to begin.</div>
      </div>
    `;
  }
}

/* ==============================================================================
   DEPENDENT WIDGET UPDATERS (No full reload needed)
   ============================================================================== */
function incrementPostsTodayCounter() {
  const pCount = document.getElementById('hdr-posts-today');
  if (pCount) {
    const current = parseInt(pCount.textContent, 10);
    pCount.textContent = isNaN(current) ? '1' : String(current + 1);
  }
}

function updateRecentDispatchesWidget(newPost) {
  const container = document.getElementById('recent-posts-widget-content');
  if (!container) return;

  if (container.querySelector('.mono-sublabel')) {
    container.innerHTML = '';
  }

  const authorNick = newPost.author_nickname || (newPost.author && newPost.author.nickname) || 'observer';
  const item = document.createElement('div');
  item.className = 'widget-item';
  item.style.cssText = 'padding:8px 12px; border-bottom:var(--border-subtle);';
  item.innerHTML = `
    <div>
      <a href="/post/${newPost.id}" style="font-size:12px; font-weight:600; color:#fff; text-decoration:none; display:block; line-height:1.35; margin-bottom:4px;">${escapeHTML(newPost.title)}</a>
      <div class="mono-sublabel" style="font-size:10px;">@${escapeHTML(authorNick)} • JUST NOW</div>
    </div>
  `;
  container.prepend(item);

  while (container.children.length > 4) {
    container.removeChild(container.lastElementChild);
  }
}

function updateProfilePostCount() {
  const profileCountEl = document.getElementById('profile-posts-count') || document.querySelector('.user-dispatch-count');
  if (profileCountEl) {
    const cur = parseInt(profileCountEl.textContent, 10);
    profileCountEl.textContent = isNaN(cur) ? '1' : String(cur + 1);
  }
}

/* ==============================================================================
   OPTIMISTIC SUBMIT EVENT LISTENER (nova:post:created)
   ============================================================================== */
document.addEventListener('nova:post:created', (e) => {
  const post = e.detail && e.detail.post;
  if (!post) return;

  // Prevent default so composer doesn't emit duplicate generic toast
  e.preventDefault();

  const agSlug = post.agency_slug || (post.agency ? post.agency.slug : 'general');
  const agName = post.agency_name || (post.agency ? post.agency.name : (post.agency_code || agSlug.toUpperCase()));

  const matches = feedState.matchesFilters(post);

  if (matches) {
    feedState.addPostOptimistic(post);
    insertCardAtTop(post, true);

    incrementPostsTodayCounter();
    updateRecentDispatchesWidget(post);
    updateProfilePostCount();

    if (window.scrollY > 80) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (typeof UI !== 'undefined' && UI.toast) {
      UI.toast.success('Observation dispatch broadcast to global planetary network!', 'DISPATCH BROADCAST');
    }
  } else {
    // Does not match active filters: store in client store, update counters & recent widget
    feedState.posts.unshift(post);
    incrementPostsTodayCounter();
    updateRecentDispatchesWidget(post);
    updateProfilePostCount();

    if (typeof UI !== 'undefined' && UI.toast) {
      UI.toast.action(
        `Posted to ${agName}.`,
        '[VIEW]',
        () => {
          // Switch to matching view
          currentAgencyFilter = agSlug;
          currentCategory = post.topic || post.category || 'All';
          currentTab = 'global';

          feedState.setFilter('agency', currentAgencyFilter);
          feedState.setFilter('category', currentCategory);
          feedState.setFilter('tab', currentTab);

          updateActiveFilterUI();
          renderFilteredPosts();
          window.scrollTo({ top: 0, behavior: 'smooth' });

          setTimeout(() => {
            const card = document.getElementById(`post-${post.id}`);
            if (card) {
              card.classList.add('post-card-highlight');
              setTimeout(() => card.classList.remove('post-card-highlight'), 2200);
            }
          }, 100);
        },
        'DISPATCH BROADCAST',
        'success'
      );
    }
  }
});

/* ==============================================================================
   THEMED IMAGE LIGHTBOX HANDLERS
   ============================================================================== */
function openLightbox(src, title) {
  const modal = document.getElementById('nova-lightbox');
  const img = document.getElementById('lightbox-img');
  const cap = document.getElementById('lightbox-caption');
  const titleEl = document.getElementById('lightbox-title');
  if (!modal || !img) return;

  img.src = src;
  if (titleEl) titleEl.textContent = title ? `// DISPATCH // ${title.toUpperCase()}` : '// ASTROPHOTOGRAPHY DISPATCH';
  if (cap) cap.textContent = title || '';

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const modal = document.getElementById('nova-lightbox');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}

const lightboxCloseBtn = document.getElementById('lightbox-close');
if (lightboxCloseBtn) {
  lightboxCloseBtn.addEventListener('click', closeLightbox);
}

const lightboxModal = document.getElementById('nova-lightbox');
if (lightboxModal) {
  lightboxModal.addEventListener('click', (e) => {
    if (e.target === lightboxModal) closeLightbox();
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeLightbox();
  }
});

/* ==============================================================================
   RIGHT RAIL WIDGETS & TELEMETRY
   ============================================================================== */
// Live Telemetry Header Counters
async function loadTelemetryCounters() {
  const pCount = document.getElementById('hdr-posts-today');
  const oCount = document.getElementById('hdr-active-observers');
  const lNext = document.getElementById('hdr-next-launch');

  try {
    const stats = await API.get('/api/telemetry/stats');
    if (pCount) pCount.textContent = stats.posts_today || '14';
    if (oCount) oCount.textContent = stats.active_observers || '42';
    if (lNext && stats.next_launch && stats.next_launch.net) {
      lNext.setAttribute('data-countdown-target', stats.next_launch.net);
      updateCountdownElement(lNext, stats.next_launch.net);
    }
  } catch (e) {
    if (pCount) pCount.textContent = '14';
    if (oCount) oCount.textContent = '38';
    if (lNext) {
      const fallbackTarget = '2026-10-22T08:15:00Z';
      lNext.setAttribute('data-countdown-target', fallbackTarget);
      updateCountdownElement(lNext, fallbackTarget);
    }
  }
}

// Countdown Formatting Function
function formatCountdown(targetDateStr) {
  if (!targetDateStr) return 'T- 05D 12H 00M 00S';
  const target = new Date(targetDateStr.includes('Z') ? targetDateStr : targetDateStr + 'Z').getTime();
  const now = Date.now();
  const diff = target - now;

  if (diff <= 0) return 'T+ MISSION ACTIVE';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diff % (1000 * 60)) / 1000);

  const pad = (n) => String(n).padStart(2, '0');
  return `T- ${pad(days)}D ${pad(hours)}H ${pad(mins)}M ${pad(secs)}S`;
}

function updateCountdownElement(el, targetStr) {
  if (!el) return;
  el.textContent = formatCountdown(targetStr);
}

function updateAllLiveCountdowns() {
  const hdrLaunch = document.getElementById('hdr-next-launch');
  if (hdrLaunch && hdrLaunch.dataset.countdownTarget) {
    updateCountdownElement(hdrLaunch, hdrLaunch.dataset.countdownTarget);
  }

  document.querySelectorAll('.launch-live-timer').forEach(el => {
    const target = el.dataset.launchTime;
    if (target) {
      updateCountdownElement(el, target);
    }
  });
}

function formatFullDate(dateStr) {
  if (!dateStr || dateStr === 'TBD') return 'DATE PENDING';
  try {
    const d = new Date(dateStr.includes('Z') ? dateStr : dateStr + 'Z');
    if (isNaN(d.getTime())) return dateStr;
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const mins = String(d.getUTCMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${mins} UTC`;
  } catch (e) {
    return dateStr;
  }
}

// Top Agencies Widget (Right Rail: All 8+ with Equal Row Heights)
async function loadTopAgencies() {
  const container = document.getElementById('top-agencies-widget-content');
  if (!container) return;
  try {
    const res = await API.get('/api/agencies');
    const agencies = res.agencies || [];
    if (agencies.length === 0) {
      container.innerHTML = '<div class="mono-sublabel" style="padding:10px;">NO AGENCIES CONFIGURED</div>';
      return;
    }

    container.innerHTML = agencies.map(a => `
      <div class="agency-widget-row">
        <div class="agency-widget-meta">
          ${NovaAvatar.renderAgency(a, { size: 'xs' })}
          <div class="agency-widget-info">
            <a href="/agency/${encodeURIComponent(a.slug)}" class="agency-widget-name">${escapeHTML(a.short_code || a.code)}</a>
            <span class="agency-widget-count">${a.followers_count || 0} FOLLOWERS</span>
          </div>
        </div>
        <button class="btn-tech ${a.is_following ? 'btn-tech-secondary' : 'btn-tech-primary'}" style="padding:4px 10px; font-size:9px;" data-action="follow-agency-widget" data-agency-slug="${escapeHTML(a.slug)}">
          ${a.is_following ? '[FOLLOWING]' : '[FOLLOW]'}
        </button>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = '<div class="mono-sublabel" style="padding:10px;">AGENCY TELEMETRY OFFLINE</div>';
  }
}

// Left Sidebar: Followed Agencies or Suggested Agencies
async function loadFollowedAgenciesSidebar() {
  const container = document.getElementById('sidebar-followed-agencies');
  if (!container) return;
  try {
    const res = await API.get('/api/agencies');
    const agencies = res.agencies || [];
    const followed = agencies.filter(a => a.is_following);
    feedState.setFollowedAgencies(followed.map(a => a.slug));

    if (followed.length > 0) {
      container.innerHTML = `
        <ul class="sidebar-nav-list" style="margin-top:6px;">
          ${followed.map(a => `
            <li class="sidebar-nav-item">
              <a href="/agency/${encodeURIComponent(a.slug)}" style="display:flex; align-items:center; gap:8px;" data-tooltip="${escapeHTML(a.name)}">
                ${NovaAvatar.renderAgency(a, { size: 'xs' })}
                <span class="sidebar-nav-text">${escapeHTML(a.short_code || a.name)}</span>
              </a>
            </li>
          `).join('')}
        </ul>
      `;
    } else {
      const suggested = agencies.slice(0, 4);
      container.innerHTML = `
        <div class="sidebar-expanded-text" style="font-family:var(--font-mono); font-size:9px; color:var(--text-mono); margin:6px 0 8px;">
          // SUGGESTED CHANNELS:
        </div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          ${suggested.map(a => `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:4px 6px; background:rgba(255,255,255,0.02); border:var(--border-subtle); border-radius:var(--radius-tech);">
              <a href="/agency/${encodeURIComponent(a.slug)}" style="display:flex; align-items:center; gap:6px; text-decoration:none;" data-tooltip="${escapeHTML(a.name)}">
                ${NovaAvatar.renderAgency(a, { size: 'xs' })}
                <span class="sidebar-nav-text" style="font-family:var(--font-mono); font-size:10px; color:#fff;">${escapeHTML(a.short_code || a.code)}</span>
              </a>
              <button class="btn-tech btn-tech-secondary sidebar-expanded-text" style="padding:2px 6px; font-size:8px;" data-action="follow-agency-widget" data-agency-slug="${escapeHTML(a.slug)}">[+FOLLOW]</button>
            </div>
          `).join('')}
        </div>
      `;
    }
  } catch (e) {
    container.innerHTML = '<div class="mono-sublabel" style="font-size:10px;">Offline</div>';
  }
}

// Recent Posts Widget (Right Rail)
async function loadRecentPosts() {
  const container = document.getElementById('recent-posts-widget-content');
  if (!container) return;
  try {
    const rawLocal = localStorage.getItem('nova_recently_viewed_posts');
    const localPosts = rawLocal ? JSON.parse(rawLocal) : [];

    const res = await API.get('/api/feed?limit=6&sort=new');
    const apiPosts = res.posts || [];

    const seen = new Set();
    const merged = [];
    localPosts.forEach(p => {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        merged.push(p);
      }
    });
    apiPosts.forEach(p => {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        merged.push(p);
      }
    });

    const displayPosts = merged.slice(0, 4);
    if (displayPosts.length === 0) {
      container.innerHTML = '<div class="mono-sublabel" style="padding:10px;">NO RECENT DISPATCHES</div>';
      return;
    }
    container.innerHTML = displayPosts.map(p => `
      <div class="widget-item" style="padding:8px 12px; border-bottom:var(--border-subtle);">
        <div>
          <a href="/post/${p.id}" style="font-size:12px; font-weight:600; color:#fff; text-decoration:none; display:block; line-height:1.35; margin-bottom:4px;">${escapeHTML(p.title)}</a>
          <div class="mono-sublabel" style="font-size:10px;">@${escapeHTML(p.author ? p.author.nickname : (p.author_nickname || 'observer'))} • ${timeAgo(p.created_at)}</div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = '<div class="mono-sublabel" style="padding:10px;">OFFLINE</div>';
  }
}

// Upcoming Launches Widget (Right Rail: Full Date & Countdown)
async function loadLaunches() {
  const container = document.getElementById('launches-widget-content');
  if (!container) return;
  try {
    const res = await API.get('/api/launches');
    launchesData = (res.launches || []).slice(0, 4);
    if (launchesData.length === 0) {
      container.innerHTML = '<div class="mono-sublabel" style="padding:10px;">NO LAUNCHES SCHEDULED</div>';
      return;
    }
    container.innerHTML = launchesData.map(l => {
      const isGo = (l.status || '').toUpperCase().includes('GO');
      return `
        <div class="launch-widget-item">
          <div class="launch-title-wrap">${escapeHTML(l.name)}</div>
          <div class="launch-meta-line">
            <span>${escapeHTML(l.provider || 'AEROSPACE')}</span>
            <span>•</span>
            <span>${formatFullDate(l.launch_date)}</span>
          </div>
          <div class="launch-status-row">
            <span class="launch-status-chip ${isGo ? 'go' : ''}">${escapeHTML(l.status || 'SCHEDULED')}</span>
            <span class="launch-live-timer" data-launch-time="${escapeHTML(l.launch_date || '')}">
              ${formatCountdown(l.launch_date)}
            </span>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    container.innerHTML = '<div class="mono-sublabel" style="padding:10px; color:var(--accent-alert);">LAUNCH TELEMETRY OFFLINE</div>';
  }
}

// Official Agency News Widget (Right Rail: Latest 5)
async function loadAgencyNews() {
  const container = document.getElementById('agency-news-widget-content');
  if (!container) return;
  try {
    const res = await API.get('/api/agencies/nasa/news');
    const items = (res.items || []).slice(0, 5);
    if (items.length === 0) {
      container.innerHTML = '<div class="mono-sublabel" style="padding:10px;">NO TELEMETRY NEWS</div>';
      return;
    }
    container.innerHTML = items.map(n => `
      <div class="widget-item" style="display:block; padding:10px 12px; border-bottom:var(--border-subtle);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <span class="official-feed-badge" style="font-size:8px;">[ OFFICIAL FEED ]</span>
          <span class="mono-sublabel" style="font-size:9px;">${timeAgo(n.published_at)}</span>
        </div>
        <div style="font-size:11px; font-weight:600; color:#fff; line-height:1.4;">${escapeHTML(n.title)}</div>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = '<div class="mono-sublabel" style="padding:10px;">FEED OFFLINE</div>';
  }
}

// Active Observers Widget (Right Rail)
async function loadActiveObservers() {
  const container = document.getElementById('active-observers-widget-content');
  if (!container) return;
  try {
    const res = await API.get('/api/observers');
    const observers = res.observers || [];
    if (observers.length === 0) {
      container.innerHTML = '<div class="mono-sublabel" style="padding:10px;">OBSERVATORY NETWORK QUIET</div>';
      return;
    }
    container.innerHTML = observers.map(u => `
      <div class="widget-item" style="padding:8px 12px; border-bottom:var(--border-subtle);">
        <div style="display:flex; align-items:center; gap:8px;">
          ${NovaAvatar.render(u, { size: 'sm', link: false })}
          <div>
            <a href="/u/${encodeURIComponent(u.nickname)}" class="author-name-link" style="color:#fff; font-size:11px;" data-tooltip="@${escapeHTML(u.nickname)}">@${escapeHTML(u.nickname)}</a>
            <div class="mono-sublabel" style="font-size:9px;">${u.role ? u.role.toUpperCase() : 'OBSERVER'}</div>
          </div>
        </div>
        <a href="/u/${encodeURIComponent(u.nickname)}" class="btn-tech btn-tech-secondary" style="padding:2px 8px; font-size:9px; text-decoration:none;">[PROFILE]</a>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = '<div class="mono-sublabel" style="padding:10px;">OBSERVERS OFFLINE</div>';
  }
}

// Follow Agency Helper
window.novaHandleFollowAgency = async (slug, btn) => {
  if (!AuthState.isLoggedIn()) {
    showToast('Please sign in to follow agencies', 'info');
    window.location.href = '/login?next=/social';
    return;
  }
  try {
    const isFollowing = btn.textContent.includes('FOLLOWING');
    if (isFollowing) {
      await API.delete(`/api/agencies/${encodeURIComponent(slug)}/follow`);
      btn.textContent = '[FOLLOW]';
      btn.classList.remove('btn-tech-secondary');
      btn.classList.add('btn-tech-primary');
      showToast(`Unfollowed ${slug.toUpperCase()}`, 'info');
    } else {
      await API.post(`/api/agencies/${encodeURIComponent(slug)}/follow`, {});
      btn.textContent = '[FOLLOWING]';
      btn.classList.remove('btn-tech-primary');
      btn.classList.add('btn-tech-secondary');
      showToast(`Now following ${slug.toUpperCase()}!`, 'success');
    }
    loadFollowedAgenciesSidebar();
    loadTopAgencies();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

/* ==============================================================================
   DOCUMENT EVENT DELEGATION
   ============================================================================== */
document.addEventListener('click', async (e) => {
  // Lightbox trigger click
  const lightboxTrigger = e.target.closest('[data-action="open-lightbox"]');
  if (lightboxTrigger) {
    const src = lightboxTrigger.getAttribute('data-img-src');
    const title = lightboxTrigger.getAttribute('data-img-title');
    if (src) {
      openLightbox(src, title);
    }
    return;
  }

  // Close context menus if clicking outside
  if (!e.target.closest('.post-context-menu') && !e.target.closest('[data-action="toggle-post-menu"]')) {
    document.querySelectorAll('.post-context-menu').forEach(m => m.style.display = 'none');
  }

  // Handle collapsible widget toggles
  const collapseBtn = e.target.closest('.widget-collapse-btn');
  if (collapseBtn) {
    const targetId = collapseBtn.getAttribute('data-toggle-target');
    const targetEl = document.getElementById(targetId);
    if (targetEl) {
      const isCollapsed = targetEl.classList.toggle('collapsed');
      collapseBtn.textContent = isCollapsed ? '[ + ]' : '[ − ]';
    }
    return;
  }

  // Saved shortcut anchor
  const savedShortcut = e.target.closest('#nav-saved-shortcut');
  if (savedShortcut) {
    e.preventDefault();
    showToast('Saved observations telemetry archive displayed', 'info');
    currentSort = 'top';
    feedState.setFilter('sort', 'top');
    loadPosts();
    return;
  }

  const btn = e.target.closest('button');
  if (!btn) return;

  const action = btn.getAttribute('data-action');
  const postId = btn.getAttribute('data-post-id');
  const slug = btn.getAttribute('data-agency-slug');

  if (action === 'follow-agency-pill' && slug) {
    await window.novaHandleFollowAgency(slug, btn);
    btn.style.display = 'none';
  } else if (action === 'follow-agency-widget' && slug) {
    await window.novaHandleFollowAgency(slug, btn);
  } else if (action === 'follow-agency-menu' && slug) {
    await window.novaHandleFollowAgency(slug, btn);
    document.querySelectorAll('.post-context-menu').forEach(m => m.style.display = 'none');
  } else if (action === 'toggle-post-menu' && postId) {
    const menu = document.getElementById(`menu-${postId}`) || document.getElementById(`grid-menu-${postId}`);
    if (menu) {
      const isOpen = menu.style.display === 'block';
      document.querySelectorAll('.post-context-menu').forEach(m => m.style.display = 'none');
      menu.style.display = isOpen ? 'none' : 'block';
    }
  } else if (action === 'copy-post-link' && postId) {
    const url = `${window.location.origin}/post/${postId}`;
    navigator.clipboard.writeText(url).then(() => {
      showToast('Dispatch permalink copied to clipboard', 'success');
      document.querySelectorAll('.post-context-menu').forEach(m => m.style.display = 'none');
    });
  } else if (action === 'like' && postId) {
    if (!AuthState.isLoggedIn()) {
      showToast('Please sign in to upvote', 'info');
      return;
    }
    // Optimistic toggle in feedState
    const updatedPost = feedState.likePostOptimistic(parseInt(postId, 10));
    if (updatedPost) {
      const counter = btn.querySelector('.likes-count');
      if (counter) counter.textContent = updatedPost.likes_count;
      if (updatedPost.user_liked) btn.classList.add('liked');
      else btn.classList.remove('liked');
    }
    try {
      const res = await API.post(`/api/posts/${postId}/like`, {});
      const counter = btn.querySelector('.likes-count');
      if (counter) counter.textContent = res.likes_count;
      if (res.liked) btn.classList.add('liked');
      else btn.classList.remove('liked');
    } catch (err) {
      showToast(err.message, 'error');
    }
  } else if (action === 'toggle-comments' && postId) {
    if (typeof showPostDetail === 'function') {
      saveFeedReturnState();
      window.history.pushState(null, '', `/post/${postId}#comments-section`);
      showPostDetail(postId).then(() => {
        setTimeout(() => {
          const commSec = document.getElementById('comments-section');
          if (commSec) commSec.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      });
    } else {
      saveFeedReturnState();
      window.location.href = `/post/${postId}#comments-section`;
    }
  } else if (action === 'report' && postId) {
    if (!AuthState.isLoggedIn()) {
      showToast('Please sign in to report content', 'info');
      return;
    }
    const reportModal = document.getElementById('report-modal');
    if (reportModal) {
      document.getElementById('report-post-id').value = postId;
      document.getElementById('report-reason').value = '';
      reportModal.classList.add('open');
    }
  } else if (action === 'delete-post' && postId) {
    const ok = typeof UI !== 'undefined' && UI.confirm
      ? await UI.confirm({
          title: 'PURGE DISPATCH',
          message: 'Permanently remove this observation dispatch from planetary telemetry?',
          confirmText: 'PURGE',
          cancelText: 'CANCEL',
          danger: true
        })
      : true;
    if (!ok) return;

    try {
      await API.delete(`/api/posts/${postId}`);
      const card = document.getElementById(`post-${postId}`);
      if (card) {
        card.classList.add('post-card-purging');
        setTimeout(() => {
          feedState.deletePost(parseInt(postId, 10));
          if (masonryGrid) masonryGrid.removeCard(`post-${postId}`);
          else card.remove();
          checkEmptyState();
        }, 250);
      }
      showToast('Dispatch purged', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
});

// Dynamic Comment Submission
document.addEventListener('submit', async (e) => {
  const form = e.target.closest('[data-comment-form]');
  if (!form) return;
  e.preventDefault();

  const postId = form.getAttribute('data-comment-form');
  const input = form.querySelector('.comment-input');
  const text = (input ? input.value : '').trim();
  if (!text) return;

  try {
    const res = await API.post(`/api/posts/${postId}/comments`, { comment: text });
    feedState.addComment(parseInt(postId, 10), res.comment);

    // Update comment counter on post action button
    const card = document.getElementById(`post-${postId}`);
    if (card) {
      const commCount = card.querySelector('.comments-count');
      if (commCount) {
        const cur = parseInt(commCount.textContent, 10) || 0;
        commCount.textContent = cur + 1;
      }
    }

    const list = document.getElementById(`comments-list-${postId}`);
    if (list) {
      const item = document.createElement('div');
      item.className = 'comment-item';
      item.innerHTML = `
        <div class="comment-header">
          <span class="author-name-link">@${escapeHTML(res.comment.author.nickname)}</span>
          <span class="post-time">JUST NOW</span>
        </div>
        <div style="font-size:12px; color:#cbd5e1; margin-top:4px;">${escapeHTML(res.comment.comment)}</div>
      `;
      list.appendChild(item);
    }
    input.value = '';
    showToast('Comment appended to transmission logs', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// Report modal close
const reportModalClose = document.getElementById('report-modal-close');
if (reportModalClose) {
  reportModalClose.addEventListener('click', () => {
    document.getElementById('report-modal').classList.remove('open');
  });
}

// Report form submit
const reportForm = document.getElementById('report-form');
if (reportForm) {
  reportForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const postId = document.getElementById('report-post-id').value;
    const reason = document.getElementById('report-reason').value;
    try {
      await API.post(`/api/moderation/reports`, { post_id: postId, reason });
      showToast('Report submitted for curator review', 'success');
      document.getElementById('report-modal').classList.remove('open');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

/* ==============================================================================
   PAGE INITIALIZATION
   ============================================================================== */
window.loadPosts = loadPosts;

AuthState.fetchUser().then(() => {
  feedState.setCurrentUser(AuthState.user);
  loadFollowedAgenciesSidebar();
});

loadPosts();
loadTelemetryCounters();
loadTopAgencies();
loadFollowedAgenciesSidebar();
loadRecentPosts();
loadLaunches();
loadAgencyNews();
loadActiveObservers();

setInterval(updateAllLiveCountdowns, 1000);
scheduleNextPoll();


import { API, AuthState, SharedNav, initStarfield, showToast, escapeHTML, timeAgo } from '/js/social.js';
import NovaAvatar from '/js/avatar.js';
import { openImageEditor } from '/js/image-modal.js';
import { createPostCard, createCompactCard, MasonryGrid } from '/js/postcard.js';

initStarfield('starfield-canvas');
SharedNav.init('agencies');

// Parse slug from /agency/<slug> or /agencies/<slug>
const pathParts = window.location.pathname.split('/').filter(Boolean);
const agencySlug = pathParts[1] || 'general';

let currentAgency = null;
let currentSort = 'new';
let currentCategory = 'All';
let currentLayout = localStorage.getItem('nova_stream_layout') || localStorage.getItem('nova_feed_layout') || 'grid';
let agencyPosts = [];

const heroWrapper = document.getElementById('agency-hero-wrapper');
const heroGradient = document.getElementById('agency-hero-gradient');
const heroBadge = document.getElementById('agency-hero-badge');
const heroCode = document.getElementById('agency-hero-code');
const heroName = document.getElementById('agency-hero-name');
const heroCountry = document.getElementById('agency-hero-country');
const heroFollowers = document.getElementById('agency-hero-followers');
const heroDesc = document.getElementById('agency-hero-desc');
const heroFollowBtn = document.getElementById('btn-hero-follow-agency');
const officialLinks = document.getElementById('agency-official-links');

const postsContainer = document.getElementById('agency-posts-container');
const newsContainer = document.getElementById('agency-news-container');
const launchesContainer = document.getElementById('agency-launches-container');

let agencyMasonryGrid = null;
if (postsContainer) {
  postsContainer.className = `posts-stream-${currentLayout}`;
  agencyMasonryGrid = new MasonryGrid(postsContainer);
}

// Tab Navigation
const tabButtons = document.querySelectorAll('.agency-tab-btn');
const tabPanes = {
  posts: document.getElementById('pane-posts'),
  news: document.getElementById('pane-news'),
  launches: document.getElementById('pane-launches'),
  outreach: document.getElementById('pane-outreach')
};

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const target = btn.dataset.tab;
    Object.keys(tabPanes).forEach(paneKey => {
      if (tabPanes[paneKey]) {
        tabPanes[paneKey].style.display = (paneKey === target) ? 'block' : 'none';
      }
    });

    if (target === 'news') loadAgencyNews();
    else if (target === 'launches') loadAgencyLaunches();
    else if (target === 'posts') loadAgencyPosts();
  });
});

// Sort controls
const sortButtons = document.querySelectorAll('#posts-sort-bar button');
sortButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    sortButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentSort = btn.dataset.sort;
    loadAgencyPosts();
  });
});

// Shared layout toggles: LIST, GRID, COMPACT
function updateAgencyLayoutButtons() {
  document.querySelectorAll('#agency-layout-toggle .layout-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.layout === currentLayout);
  });
  if (postsContainer) {
    postsContainer.className = `posts-stream-${currentLayout}`;
  }
}
updateAgencyLayoutButtons();

document.querySelectorAll('#agency-layout-toggle .layout-toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentLayout = btn.dataset.layout;
    localStorage.setItem('nova_stream_layout', currentLayout);
    localStorage.setItem('nova_feed_layout', currentLayout);
    updateAgencyLayoutButtons();
    renderAgencyPosts();
  });
});

// Topic chips
document.querySelectorAll('#agency-category-pills .cat-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#agency-category-pills .cat-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    currentCategory = chip.dataset.cat;
    renderAgencyPosts();
  });
});

async function init() {
  await AuthState.fetchUser();
  try {
    const res = await API.get(`/api/agencies/${encodeURIComponent(agencySlug)}`);
    currentAgency = res.agency;
    if (!currentAgency) throw new Error('Agency dossier not located');

    document.title = `NOVA // Agency Dossier - ${currentAgency.name}`;
    renderHero();
    loadAgencyPosts();
  } catch (err) {
    if (heroWrapper) {
      heroWrapper.innerHTML = `
        <div class="empty-state-card" style="padding: 40px;">
          <div class="empty-state-title">// AGENCY CHANNEL NOT FOUND (404)</div>
          <div class="empty-state-desc">${escapeHTML(err.message)}</div>
          <a href="/agencies" class="btn-tech btn-tech-secondary" style="margin-top: 14px;">[RETURN TO AGENCIES DIRECTORY]</a>
        </div>
      `;
    }
  }
}

function renderHero() {
  const a = currentAgency;
  if (!a) return;

  const isCurator = AuthState.isCurator();

  if (heroGradient) {
    if (a.banner_url) {
      heroGradient.style.background = `url('${escapeHTML(a.banner_url)}') center/cover no-repeat`;
    } else if (a.banner_gradient) {
      heroGradient.style.background = a.banner_gradient;
    }

    const existingEditBanner = document.getElementById('curator-edit-banner-btn');
    if (existingEditBanner) existingEditBanner.remove();

    if (isCurator) {
      const editBannerBtn = document.createElement('button');
      editBannerBtn.type = 'button';
      editBannerBtn.id = 'curator-edit-banner-btn';
      editBannerBtn.className = 'btn-tech btn-tech-secondary';
      editBannerBtn.style.cssText = 'position:absolute; top:12px; right:12px; z-index:10; font-size:10px; padding:4px 10px;';
      editBannerBtn.innerHTML = '<span>[ EDIT BANNER ]</span>';
      editBannerBtn.addEventListener('click', () => {
        openImageEditor({
          type: 'agency_banner',
          slug: a.slug,
          allowRemove: Boolean(a.banner_url || a.banner_key),
          onSuccess: (res) => {
            a.banner_url = res.banner_url;
            renderHero();
          },
          onRemove: () => {
            a.banner_url = null;
            renderHero();
          }
        });
      });
      heroGradient.style.position = 'relative';
      heroGradient.appendChild(editBannerBtn);
    }
  }

  if (heroBadge) {
    heroBadge.style.background = 'transparent';
    heroBadge.style.border = 'none';
    heroBadge.style.boxShadow = 'none';
    heroBadge.innerHTML = `
      <div style="position:relative; display:inline-block;">
        ${NovaAvatar.renderAgency(a, { size: 'lg' })}
        ${isCurator ? `
          <button type="button" id="curator-edit-logo-btn" class="btn-tech btn-tech-secondary" style="position:absolute; bottom:-20px; left:50%; transform:translateX(-50%); font-size:8px; padding:2px 6px; white-space:nowrap; z-index:10;">
            [ EDIT LOGO ]
          </button>
        ` : ''}
      </div>
    `;

    if (isCurator) {
      const editLogoBtn = heroBadge.querySelector('#curator-edit-logo-btn');
      if (editLogoBtn) {
        editLogoBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openImageEditor({
            type: 'agency_logo',
            slug: a.slug,
            allowRemove: Boolean(a.logo_url || a.logo_key),
            onSuccess: (res) => {
              a.logo_url = res.logo_url;
              a.has_logo = true;
              renderHero();
            },
            onRemove: () => {
              a.logo_url = null;
              a.has_logo = false;
              renderHero();
            }
          });
        });
      }
    }
  }

  if (heroCode) {
    heroCode.textContent = a.slug === 'general' ? 'CHANNEL // GENERAL' : `AGENCY // ${a.code || a.short_code}`;
  }
  if (heroName) {
    heroName.textContent = a.name;
  }
  if (heroCountry) {
    heroCountry.textContent = `Territory / Domain: ${a.country || 'Global'}`;
  }
  if (heroFollowers) {
    heroFollowers.textContent = a.followers_count || 0;
  }
  if (heroDesc) {
    heroDesc.textContent = a.description || a.short_description || '';
  }

  // Official verified links
  if (officialLinks) {
    officialLinks.innerHTML = `
      ${a.website_url ? `
        <a href="${escapeHTML(a.website_url)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-cyan); text-decoration:none;">
          [ OFFICIAL PORTAL ↗ ]
        </a>
      ` : ''}
      ${a.contact_url ? `
        <a href="${escapeHTML(a.contact_url)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-gold); text-decoration:none;">
          [ OFFICIAL OUTREACH & CONTACT ↗ ]
        </a>
      ` : ''}
    `;
  }

  // Follow button
  updateFollowBtnState(a.is_following);
}

function updateFollowBtnState(isFollowing) {
  if (!heroFollowBtn) return;
  if (isFollowing) {
    heroFollowBtn.textContent = '[ FOLLOWING ]';
    heroFollowBtn.classList.remove('btn-tech-primary');
    heroFollowBtn.classList.add('btn-tech-secondary');
  } else {
    heroFollowBtn.textContent = '[ FOLLOW ]';
    heroFollowBtn.classList.remove('btn-tech-secondary');
    heroFollowBtn.classList.add('btn-tech-primary');
  }
}

if (heroFollowBtn) {
  heroFollowBtn.addEventListener('click', async () => {
    if (!AuthState.isLoggedIn()) {
      showToast('Please sign in to follow agencies', 'info');
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    if (!currentAgency) return;

    try {
      if (currentAgency.is_following) {
        const res = await API.delete(`/api/agencies/${encodeURIComponent(currentAgency.slug)}/follow`);
        currentAgency.is_following = false;
        currentAgency.followers_count = res.followers_count;
        updateFollowBtnState(false);
        if (heroFollowers) heroFollowers.textContent = res.followers_count;
        showToast(`Unfollowed ${currentAgency.name}`, 'info');
      } else {
        const res = await API.post(`/api/agencies/${encodeURIComponent(currentAgency.slug)}/follow`, {});
        currentAgency.is_following = true;
        currentAgency.followers_count = res.followers_count;
        updateFollowBtnState(true);
        if (heroFollowers) heroFollowers.textContent = res.followers_count;
        showToast(`Now following ${currentAgency.name}!`, 'success');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ==========================================
// TAB 1: POSTS (Tagged to Agency)
// ==========================================
async function loadAgencyPosts() {
  if (!postsContainer || !currentAgency) return;
  if (typeof UI !== 'undefined' && UI.skeleton) {
    UI.skeleton(postsContainer, 3);
  }

  try {
    const res = await API.get(`/api/feed?agency=${encodeURIComponent(currentAgency.slug)}&sort=${currentSort}`);
    agencyPosts = res.posts || [];
    renderAgencyPosts();
  } catch (err) {
    postsContainer.innerHTML = `
      <div class="empty-state-card">
        <div class="empty-state-title">// TELEMETRY FEED UNAVAILABLE</div>
        <div class="empty-state-desc">${escapeHTML(err.message)}</div>
      </div>
    `;
  }
}

// Listen for dispatches created from the unified composer modal
document.addEventListener('nova:post:created', (e) => {
  const newPost = e.detail && e.detail.post;
  if (!newPost || !currentAgency) return;
  if (newPost.agency_slug === currentAgency.slug || String(newPost.agency_id) === String(currentAgency.id)) {
    if (currentSort === 'new') {
      agencyPosts.unshift(newPost);
      renderAgencyPosts();
      const firstEl = document.getElementById(`post-${newPost.id}`);
      if (firstEl) firstEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      loadAgencyPosts();
    }
  }
});

function renderAgencyPosts() {
  if (!postsContainer) return;

  const visible = agencyPosts.filter(p => {
    if (currentCategory === 'All') return true;
    const cat = p.topic || p.category || 'Other';
    return cat.toLowerCase() === currentCategory.toLowerCase();
  });

  if (visible.length === 0) {
    postsContainer.innerHTML = `
      <div class="empty-state-card" style="padding: 30px;">
        <div class="empty-state-title">// NO DISPATCHES LOGGED FOR THIS AGENCY</div>
        <div class="empty-state-desc">No transmissions currently assigned to this channel frequency. Broadcast the first observation dispatch to this agency.</div>
        <button type="button" class="btn-tech btn-tech-primary" id="btn-agency-empty-compose" style="margin-top: 14px;">[ + TRANSMIT DISPATCH ]</button>
      </div>
    `;
    const btn = document.getElementById('btn-agency-empty-compose');
    if (btn) {
      btn.addEventListener('click', async () => {
        const mod = await import('/js/social.js');
        mod.triggerComposer({ agency: currentAgency ? currentAgency.slug : '' });
      });
    }
    return;
  }

  const isOwner = (p) => AuthState.user && (AuthState.user.id === p.user_id || (p.author && AuthState.user.id === p.author.id));

  // COMPACT VIEW
  if (currentLayout === 'compact') {
    postsContainer.innerHTML = '';
    visible.forEach(p => {
      postsContainer.appendChild(createCompactCard(p, { hideAgencyBadge: true }));
    });
    return;
  }

  // LIST VIEW
  if (currentLayout === 'list') {
    postsContainer.innerHTML = '';
    visible.forEach(p => {
      postsContainer.appendChild(createPostCard(p, {
        layout: 'list',
        hideAgencyBadge: true,
        isOwner: isOwner(p),
        isCurator: AuthState.isCurator()
      }));
    });
    return;
  }

  // GRID VIEW (Masonry)
  const cards = visible.map(p => createPostCard(p, {
    layout: 'grid',
    hideAgencyBadge: true,
    isOwner: isOwner(p),
    isCurator: AuthState.isCurator()
  }));
  if (agencyMasonryGrid) {
    agencyMasonryGrid.distributeCards(cards);
  }
}

// ==========================================
// TAB 2: NEWS (OFFICIAL FEED)
// ==========================================
async function loadAgencyNews() {
  if (!newsContainer || !currentAgency) return;
  if (typeof UI !== 'undefined' && UI.skeleton) UI.skeleton(newsContainer, 3);

  try {
    const res = await API.get(`/api/agencies/${encodeURIComponent(currentAgency.slug)}/news`);
    const items = res.items || [];
    if (items.length === 0) {
      newsContainer.innerHTML = `
        <div class="empty-state-card">
          <div class="empty-state-title">// NO OFFICIAL TELEMETRY DISPATCHES</div>
          <div class="empty-state-desc">Agency transmission buffer is currently silent.</div>
        </div>
      `;
      return;
    }

    newsContainer.innerHTML = items.map(n => `
      <article class="official-news-card">
        <div class="official-news-header">
          <span class="official-feed-badge">[ OFFICIAL FEED ]</span>
          <span class="mono-sublabel" style="font-size: 11px;">SOURCE: ${escapeHTML(n.agency_code || currentAgency.code || 'AGENCY')} RSS FEED • ${timeAgo(n.published_at)}</span>
        </div>
        <h3 class="official-news-headline">${escapeHTML(n.title)}</h3>
        <p class="official-news-summary">${escapeHTML(n.summary || '')}</p>
        ${n.link ? `
          <a href="${escapeHTML(n.link)}" target="_blank" rel="noopener noreferrer nofollow" class="official-news-link">
            [ READ DIRECT ON ${escapeHTML(n.agency_code || currentAgency.code || 'AGENCY')} PORTAL ↗ ]
          </a>
        ` : ''}
      </article>
    `).join('');
  } catch (err) {
    newsContainer.innerHTML = `
      <div class="empty-state-card">
        <div class="empty-state-title">// NEWS CONDUIT OFFLINE</div>
        <div class="empty-state-desc">${escapeHTML(err.message)}</div>
      </div>
    `;
  }
}

// ==========================================
// TAB 3: LAUNCHES
// ==========================================
async function loadAgencyLaunches() {
  if (!launchesContainer || !currentAgency) return;
  if (typeof UI !== 'undefined') UI.skeleton(launchesContainer, 3);

  try {
    const res = await API.get(`/api/agencies/${encodeURIComponent(currentAgency.slug)}/launches`);
    const launches = res.launches || [];
    if (launches.length === 0) {
      launchesContainer.innerHTML = `
        <div class="empty-state-card">
          <div class="empty-state-title">// NO ACTIVE LAUNCH WINDOWS SCHEDULED</div>
          <div class="empty-state-desc">No orbital manifests found in the immediate telemetry window for this agency.</div>
        </div>
      `;
      return;
    }

    launchesContainer.innerHTML = launches.map(l => `
      <div class="launch-manifest-item">
        <div>
          <div style="font-weight: 600; font-size: 14px; color: #fff; margin-bottom: 4px;">${escapeHTML(l.mission || l.name)}</div>
          <div class="mono-sublabel">${escapeHTML(l.vehicle || 'Orbital Booster')} • ${escapeHTML(l.pad || 'Spaceport')}</div>
          <div class="mono-label" style="font-size: 10px; color: var(--accent-cyan); margin-top: 4px;">T-MINUS / TARGET: ${escapeHTML(l.launch_date || 'TBD')}</div>
        </div>
        <div>
          <span class="mono-label" style="font-size: 10px; background: rgba(92,200,255,0.08); padding: 4px 10px; border-radius: var(--radius-tech); border: 1px solid var(--accent-cyan);">
            ${escapeHTML(l.status || 'SCHEDULED')}
          </span>
        </div>
      </div>
    `).join('');
  } catch (err) {
    launchesContainer.innerHTML = `
      <div class="empty-state-card">
        <div class="empty-state-title">// LAUNCH TELEMETRY OFFLINE</div>
        <div class="empty-state-desc">${escapeHTML(err.message)}</div>
      </div>
    `;
  }
}

// ==========================================
// TAB 4: RESEARCH OUTREACH
// ==========================================
const outreachForm = document.getElementById('outreach-composer-form');
const outreachCharCount = document.getElementById('outreach-char-count');
const outreachBody = document.getElementById('outreach-body');
const draftArea = document.getElementById('draft-result-area');

if (outreachBody && outreachCharCount) {
  outreachBody.addEventListener('input', () => {
    outreachCharCount.textContent = `${outreachBody.value.length} / 1500`;
  });
}

if (outreachForm) {
  outreachForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!AuthState.isLoggedIn()) {
      showToast('Please sign in to register research outreach', 'info');
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    if (!currentAgency) return;

    const subject = document.getElementById('outreach-subject').value.trim();
    const area = document.getElementById('outreach-area').value.trim();
    const message = outreachBody.value.trim();
    const pdfFile = document.getElementById('outreach-pdf').files[0];

    const formData = new FormData();
    formData.append('agency_id', currentAgency.id);
    formData.append('subject', subject);
    formData.append('research_area', area);
    formData.append('message', message);
    if (pdfFile) {
      formData.append('attachment', pdfFile);
    }

    const btn = document.getElementById('btn-submit-outreach');
    if (typeof UI !== 'undefined') UI.setLoading(btn, true, 'REGISTERING OUTREACH...');

    try {
      const res = await API.upload('/api/outreach', formData, { silent: false });
      showToast('Research outreach successfully catalogued!', 'success');

      if (draftArea) {
        draftArea.style.display = 'block';
        draftArea.innerHTML = `
          <div style="background: rgba(3, 7, 16, 0.95); border: 1px solid var(--accent-cyan); border-radius: var(--radius-tech); padding: 18px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <span class="mono-label" style="color: var(--accent-cyan);">// OFFICIAL SUBMISSION DRAFT GENERATED</span>
              <button class="btn-tech btn-tech-secondary" id="btn-copy-draft" style="font-size: 10px; padding: 4px 10px;">[COPY EMAIL DRAFT]</button>
            </div>
            <pre style="background: rgba(0, 0, 0, 0.4); padding: 14px; border-radius: var(--radius-tech); color: #fff; font-family: var(--font-mono); font-size: 11px; white-space: pre-wrap; word-break: break-word; line-height: 1.5;">${escapeHTML(res.email_draft)}</pre>
            <div style="margin-top: 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
              <span class="mono-sublabel">TRANSMISSION ID: #${res.outreach_id}</span>
              ${currentAgency.contact_url ? `
                <a href="${escapeHTML(currentAgency.contact_url)}" target="_blank" rel="noopener noreferrer" class="btn-tech btn-tech-primary" style="font-size: 11px; padding: 6px 14px;">
                  [OPEN ${escapeHTML(currentAgency.code || 'AGENCY')} SUBMISSION PORTAL ↗]
                </a>
              ` : ''}
            </div>
          </div>
        `;

        const copyBtn = document.getElementById('btn-copy-draft');
        if (copyBtn) {
          copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(res.email_draft).then(() => {
              showToast('Official draft copied to clipboard', 'success');
              copyBtn.textContent = '[COPIED ✓]';
              setTimeout(() => { copyBtn.textContent = '[COPY EMAIL DRAFT]'; }, 2000);
            });
          });
        }
      }

      outreachForm.reset();
      if (outreachCharCount) outreachCharCount.textContent = '0 / 1500';
    } catch (err) {
      // API.upload toasts errors automatically
    } finally {
      if (typeof UI !== 'undefined') UI.setLoading(btn, false);
    }
  });
}

// Global action delegates for like, comment, delete
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;

  const action = btn.getAttribute('data-action');
  const postId = btn.getAttribute('data-post-id');

  if (action === 'like' && postId) {
    if (!AuthState.isLoggedIn()) {
      showToast('Please sign in to upvote', 'info');
      return;
    }
    try {
      const res = await API.post(`/api/posts/${postId}/like`, {});
      const countEl = btn.querySelector('.likes-count');
      if (countEl) countEl.textContent = res.likes_count;
      if (res.liked) btn.classList.add('liked');
      else btn.classList.remove('liked');
    } catch (err) {
      showToast(err.message, 'error');
    }
  } else if (action === 'toggle-comments' && postId) {
    window.location.href = `/post/${postId}#comments-section`;
  } else if (action === 'delete-post' && postId) {
    const ok = typeof UI !== 'undefined' && UI.confirm
      ? await UI.confirm({
          title: 'PURGE DISPATCH',
          message: 'Permanently remove this observation dispatch?',
          confirmText: 'PURGE',
          cancelText: 'CANCEL',
          danger: true
        })
      : true;
    if (!ok) return;

    try {
      await API.delete(`/api/posts/${postId}`);
      const card = document.getElementById(`post-${postId}`);
      if (card) card.remove();
      showToast('Dispatch purged', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
});

// Dynamic comment submit delegate
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
    showToast('Comment appended', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

init();

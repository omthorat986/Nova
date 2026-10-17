import { API, AuthState, SharedNav, initStarfield, showToast, escapeHTML, timeAgo } from '/js/social.js';
import NovaAvatar from '/js/avatar.js';
import { openImageEditor } from '/js/image-modal.js';
import { createPostCard } from '/js/postcard.js';

initStarfield('starfield-canvas');
SharedNav.init('profile');

// Parse nickname from URL path /u/<nickname>
const pathParts = window.location.pathname.split('/');
const targetNickname = decodeURIComponent(pathParts[2] || '');

let profileUser = null;
let isOwner = false;
let currentTab = 'posts';

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('tab')) {
  currentTab = urlParams.get('tab');
}

async function initProfile() {
  if (!targetNickname) {
    window.location.href = '/social';
    return;
  }

  await AuthState.fetchUser();

  try {
    const res = await API.get(`/api/users/${encodeURIComponent(targetNickname)}`);
    profileUser = res.user;
    document.title = `NOVA // Observer Profile - @${profileUser.nickname}`;
    isOwner = Boolean(AuthState.user && profileUser && String(AuthState.user.id) === String(profileUser.id));

    renderHeader();
    setupTabs();
    loadTabContent(currentTab);
  } catch (err) {
    document.getElementById('profile-header').innerHTML = `
      <div class="empty-state-card" style="grid-column: 1 / -1;">
        <div class="empty-state-title">// OBSERVER DOSSIER NOT FOUND (404)</div>
        <div class="empty-state-desc">The callsign @${escapeHTML(targetNickname)} does not exist in the active telemetry registry.</div>
        <a href="/social" class="btn-tech btn-tech-secondary" style="margin-top: 16px;">[RETURN TO SOCIAL FEED]</a>
      </div>
    `;
    const tabsBar = document.getElementById('profile-tabs-bar');
    if (tabsBar) tabsBar.style.display = 'none';
  }
}

function renderHeader() {
  const header = document.getElementById('profile-header');
  const u = profileUser;
  const roleBadge = u.role !== 'observer' ? `<span class="user-badge-role ${u.role}">${escapeHTML(u.role.toUpperCase())}</span>` : '';
  const bannerBg = u.banner_url ? `url('${escapeHTML(u.banner_url)}')` : 'linear-gradient(135deg, #060b18 0%, #030611 50%, #0b1730 100%)';

  header.className = '';
  header.innerHTML = `
    <!-- BANNER ACROSS TOP -->
    <div class="profile-banner-container" id="profile-banner-box" style="background-image: ${bannerBg};">
      <div class="profile-banner-overlay"></div>
      ${isOwner ? `
        <button type="button" class="profile-banner-change-btn" id="btn-change-banner" title="Update panoramic profile banner (3:1)">
          [ CHANGE BANNER ]
        </button>
      ` : ''}
    </div>

    <!-- MAIN CARD WITH OVERLAPPING AVATAR -->
    <div class="profile-header-main-card">
      <div class="profile-avatar-overlap-row">
        <div class="${isOwner ? 'profile-avatar-owner-wrap' : ''}" id="profile-avatar-holder" title="${isOwner ? 'Click to change profile photo' : ''}">
          ${NovaAvatar.render(u, { size: 'xl', curatorBadge: true, statusDot: true })}
          ${isOwner ? `<button type="button" class="profile-avatar-change-btn" id="btn-change-avatar">[ CHANGE PHOTO ]</button>` : ''}
        </div>

        <div style="display:flex; align-items:center; gap:10px;">
          ${isOwner ? `
            <button class="btn-tech btn-tech-secondary" id="btn-toggle-settings">
              <span>[EDIT PROFILE]</span>
            </button>
          ` : `
            <button class="btn-tech ${u.is_following ? 'btn-tech-secondary' : 'btn-tech-primary'}" id="btn-follow-toggle">
              <span>${u.is_following ? '[UNFOLLOW]' : '[FOLLOW OBSERVER]'}</span>
            </button>
            <button class="btn-tech btn-tech-secondary" id="btn-report-profile" style="color:var(--accent-gold, #fbbf24);" title="Report profile photo or banner violation">
              <span>[REPORT]</span>
            </button>
          `}
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
        <h1 class="page-title" style="font-size: 22px;">@${escapeHTML(u.nickname)}</h1>
        ${roleBadge}
      </div>
      <p style="color: var(--text-muted); font-size: 13px; max-width: 640px; margin-bottom: 16px; line-height: 1.5;">
        ${u.bio ? escapeHTML(u.bio) : '<span style="font-style: italic; opacity: 0.6;">No scientific bio transmission yet.</span>'}
      </p>

      <div class="profile-stats-row">
        <div class="profile-stat-box">
          <span class="stat-number">${u.posts_count || 0}</span>
          <span class="stat-label">DISPATCHES</span>
        </div>
        <div class="profile-stat-box">
          <span class="stat-number" id="profile-follower-count">${u.followers_count || 0}</span>
          <span class="stat-label">FOLLOWERS</span>
        </div>
        <div class="profile-stat-box">
          <span class="stat-number">${u.following_count || 0}</span>
          <span class="stat-label">FOLLOWING</span>
        </div>
      </div>
    </div>
  `;

  if (isOwner) {
    const outreachTab = document.getElementById('tab-btn-outreach');
    const settingsTab = document.getElementById('tab-btn-settings');
    if (outreachTab) outreachTab.style.display = 'inline-block';
    if (settingsTab) settingsTab.style.display = 'inline-block';
    const settingsBtn = document.getElementById('btn-toggle-settings');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => switchTab('settings'));
    }

    const bannerBtn = document.getElementById('btn-change-banner');
    if (bannerBtn) {
      bannerBtn.addEventListener('click', () => {
        openImageEditor({
          type: 'banner',
          allowRemove: Boolean(u.banner_url || u.has_banner),
          onSuccess: (res) => {
            u.banner_url = res.banner_url;
            u.has_banner = Boolean(res.banner_url);
            renderHeader();
          },
          onRemove: () => {
            u.banner_url = null;
            u.has_banner = false;
            renderHeader();
          }
        });
      });
    }

    const avatarBtn = document.getElementById('btn-change-avatar');
    const avatarHolder = document.getElementById('profile-avatar-holder');
    const triggerAvatarEditor = () => {
      openImageEditor({
        type: 'avatar',
        allowRemove: Boolean(u.has_avatar),
        onSuccess: (res) => {
          u.avatar_url = res.avatar_url;
          u.has_avatar = true;
          u.avatar_updated_at = Date.now() / 1000;
          if (AuthState.user && AuthState.user.id === u.id) {
            AuthState.user.avatar_url = res.avatar_url;
            AuthState.user.has_avatar = true;
            AuthState.user.avatar_updated_at = u.avatar_updated_at;
          }
          renderHeader();
          if (SharedNav && typeof SharedNav.render === 'function') SharedNav.render();
          document.querySelectorAll(`img[data-nickname="${CSS.escape(u.nickname)}"]`).forEach(img => {
            img.src = res.avatar_url;
            img.srcset = `${res.avatar_url} 1x, ${res.avatar_url} 2x`;
          });
        },
        onRemove: () => {
          u.avatar_url = null;
          u.has_avatar = false;
          u.avatar_updated_at = Date.now() / 1000;
          if (AuthState.user && AuthState.user.id === u.id) {
            AuthState.user.avatar_url = null;
            AuthState.user.has_avatar = false;
            AuthState.user.avatar_updated_at = u.avatar_updated_at;
          }
          renderHeader();
          if (SharedNav && typeof SharedNav.render === 'function') SharedNav.render();
        }
      });
    };

    if (avatarBtn) avatarBtn.addEventListener('click', (e) => { e.stopPropagation(); triggerAvatarEditor(); });
    if (avatarHolder) avatarHolder.addEventListener('click', triggerAvatarEditor);
  } else {
    const reportBtn = document.getElementById('btn-report-profile');
    if (reportBtn) {
      reportBtn.addEventListener('click', async () => {
        const reason = typeof UI !== 'undefined' && UI.prompt
          ? await UI.prompt({
              title: 'REPORT PROFILE CONTENT',
              message: 'Please describe the policy violation (offensive photo/banner, impersonation, harassment):',
              placeholder: 'Specify violation details...',
              confirmText: '[SUBMIT REPORT]',
              cancelText: '[CANCEL]'
            })
          : null;
        if (reason && reason.trim()) {
          API.post('/api/report', { reported_user_id: u.id, reason: reason.trim() })
            .then(() => showToast('Report filed for curator investigation', 'success'))
            .catch(err => showToast(err.message, 'error'));
        }
      });
    }
    const followBtn = document.getElementById('btn-follow-toggle');
    followBtn.addEventListener('click', async () => {
      if (!AuthState.isLoggedIn()) {
        showToast('Please sign in to follow observers', 'info');
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      try {
        if (u.is_following) {
          const ok = typeof UI !== 'undefined' && UI.confirm
            ? await UI.confirm({
                title: 'TERMINATE SUBSCRIPTION',
                message: `Stop following telemetry dispatches from @${u.nickname}?`,
                confirmText: 'UNFOLLOW',
                cancelText: 'CANCEL'
              })
            : true;
          if (!ok) return;

          await API.delete(`/api/follow/${encodeURIComponent(u.nickname)}`);
          u.is_following = false;
          u.followers_count = Math.max(0, (u.followers_count || 0) - 1);
          followBtn.innerHTML = '<span>[FOLLOW OBSERVER]</span>';
          followBtn.className = 'btn-tech btn-tech-primary';
          showToast(`Unfollowed @${u.nickname}`, 'info');
        } else {
          await API.post(`/api/follow/${encodeURIComponent(u.nickname)}`, {});
          u.is_following = true;
          u.followers_count = (u.followers_count || 0) + 1;
          followBtn.innerHTML = '<span>[UNFOLLOW]</span>';
          followBtn.className = 'btn-tech btn-tech-secondary';
          showToast(`Following @${u.nickname}`, 'success');
        }
        document.getElementById('profile-follower-count').textContent = u.followers_count;
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }
}

function setupTabs() {
  document.querySelectorAll('.profile-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });
}

function switchTab(tabKey) {
  currentTab = tabKey;
  document.querySelectorAll('.profile-tab-btn').forEach(b => {
    if (b.dataset.tab === tabKey) b.classList.add('active');
    else b.classList.remove('active');
  });
  loadTabContent(tabKey);
}

async function loadTabContent(tabKey) {
  const container = document.getElementById('tab-content-area');
  if (!container) return;

  if (typeof UI !== 'undefined' && typeof UI.showSkeleton === 'function') {
    UI.showSkeleton(container, 3);
  } else if (typeof UI !== 'undefined' && typeof UI.skeleton === 'function') {
    UI.skeleton(container, 3);
  } else {
    container.innerHTML = `
      <div class="hairline-card" style="padding: 30px;">
        <div class="skeleton-box" style="height: 18px; width: 40%; margin-bottom: 12px;"></div>
        <div class="skeleton-box" style="height: 14px; width: 80%;"></div>
      </div>
    `;
  }

  try {
    if (tabKey === 'posts') {
      await renderPostsTab(container);
    } else if (tabKey === 'followers') {
      await renderFollowersTab(container);
    } else if (tabKey === 'following') {
      await renderFollowingTab(container);
    } else if (tabKey === 'outreach') {
      if (isOwner) await renderOutreachTab(container);
      else container.innerHTML = `<div class="empty-state-card"><div class="empty-state-title">// ACCESS RESTRICTED</div><div class="empty-state-desc">Only the observer may view their outreach logs.</div></div>`;
    } else if (tabKey === 'settings') {
      if (isOwner) renderSettingsTab(container);
      else container.innerHTML = `<div class="empty-state-card"><div class="empty-state-title">// ACCESS RESTRICTED</div><div class="empty-state-desc">Only the authenticated account owner may configure station telemetry settings.</div></div>`;
    } else {
      await renderPostsTab(container);
    }
  } catch (err) {
    console.error('Failed to load profile tab content:', err);
    container.innerHTML = `<div class="empty-state-card"><div class="empty-state-title">// TELEMETRY OFFLINE</div><div class="empty-state-desc">${escapeHTML(err.message || 'Error loading tab content')}</div></div>`;
  }
}

// 1. Posts Tab
async function renderPostsTab(container) {
  try {
    const res = await API.get(`/api/feed?tab=global`);
    const userPosts = (res.posts || res.feed || []).filter(p => p.author && p.author.nickname === profileUser.nickname);
    if (userPosts.length === 0) {
      container.innerHTML = `
        <div class="empty-state-card">
          <div class="empty-state-title">// NO DISPATCHES TRANSMITTED</div>
          <div class="empty-state-desc">This observer has not published any public astrophysical observations yet.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'posts-stream-list';
    userPosts.forEach(p => {
      wrapper.appendChild(createPostCard(p, {
        layout: 'list',
        isOwner: isOwner,
        isCurator: AuthState.isCurator()
      }));
    });
    container.appendChild(wrapper);
  } catch (err) {
    container.innerHTML = `<div class="empty-state-card"><div class="empty-state-title">// FEED OFFLINE</div></div>`;
  }
}

// 2. Followers Tab
function renderFollowersTab(container) {
  const followers = profileUser.followers || [];
  if (followers.length === 0) {
    container.innerHTML = `
      <div class="empty-state-card">
        <div class="empty-state-title">// NO FOLLOWERS LOGGED</div>
        <div class="empty-state-desc">No observers are currently receiving telemetry updates from this station.</div>
      </div>
    `;
    return;
  }
  container.innerHTML = followers.map(f => `
    <div class="user-list-item">
      <div style="display:flex; align-items:center; gap:12px;">
        ${NovaAvatar.render(f, { size: 'sm', link: false })}
        <div>
          <a href="/u/${encodeURIComponent(f.nickname)}" class="author-name-link">@${escapeHTML(f.nickname)}</a>
          <div class="mono-sublabel">${f.role ? f.role.toUpperCase() : 'OBSERVER STATION'}</div>
        </div>
      </div>
      <a href="/u/${encodeURIComponent(f.nickname)}" class="btn-tech btn-tech-secondary" style="padding:4px 10px; font-size:10px;">[VIEW PROFILE]</a>
    </div>
  `).join('');
}

// 3. Following Tab
function renderFollowingTab(container) {
  const following = profileUser.following || [];
  if (following.length === 0) {
    container.innerHTML = `
      <div class="empty-state-card">
        <div class="empty-state-title">// NOT FOLLOWING ANY OBSERVERS</div>
        <div class="empty-state-desc">This station is not subscribed to other observers yet.</div>
      </div>
    `;
    return;
  }
  container.innerHTML = following.map(f => `
    <div class="user-list-item">
      <div style="display:flex; align-items:center; gap:12px;">
        ${NovaAvatar.render(f, { size: 'sm', link: false })}
        <div>
          <a href="/u/${encodeURIComponent(f.nickname)}" class="author-name-link">@${escapeHTML(f.nickname)}</a>
          <div class="mono-sublabel">${f.role ? f.role.toUpperCase() : 'OBSERVER STATION'}</div>
        </div>
      </div>
      <a href="/u/${encodeURIComponent(f.nickname)}" class="btn-tech btn-tech-secondary" style="padding:4px 10px; font-size:10px;">[VIEW PROFILE]</a>
    </div>
  `).join('');
}

// 4. My Outreach Tab (Owner only)
async function renderOutreachTab(container) {
  try {
    const res = await API.get('/api/outreach/mine');
    const list = res.outreach || [];
    if (list.length === 0) {
      container.innerHTML = `
        <div class="empty-state-card">
          <div class="empty-state-title">// NO RESEARCH OUTREACH LOGGED</div>
          <div class="empty-state-desc">You have not dispatched any scientific research proposals or agency inquiries yet.</div>
          <a href="/agencies" class="btn-tech btn-tech-primary" style="margin-top: 16px;">[EXPLORE AGENCIES & DISPATCH OUTREACH]</a>
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(item => `
      <div class="outreach-table-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span class="mono-label" style="color:var(--accent-gold);">${escapeHTML(item.agency_name || 'AGENCY')}</span>
          <span class="mono-sublabel">${timeAgo(item.created_at)}</span>
        </div>
        <h4 style="color:#fff; font-size:14px; margin-bottom:6px;">${escapeHTML(item.subject)}</h4>
        <p style="font-size:12px; color:var(--text-muted); line-height:1.4; margin-bottom:12px; white-space:pre-wrap;">${escapeHTML(item.body)}</p>
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:var(--border-subtle); padding-top:8px;">
          <span class="mono-label" style="font-size:10px;">STATUS: [${escapeHTML(item.status.toUpperCase())}]</span>
          ${item.agency_contact_url ? `
            <a href="${escapeHTML(item.agency_contact_url)}" target="_blank" rel="noopener noreferrer" class="btn-tech btn-tech-secondary" style="padding:4px 10px; font-size:10px;">
              [OFFICIAL PORTAL ↗]
            </a>
          ` : ''}
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div class="empty-state-card"><div class="empty-state-title">// OUTREACH LOGS OFFLINE</div></div>`;
  }
}

// 5. Settings & Privacy Tab (Owner only)
function renderSettingsTab(container) {
  const u = AuthState.user || profileUser || {};
  container.innerHTML = `
    <div class="hairline-card" style="padding: 24px;">
      <div class="private-badge-row">
        <span class="mono-label" style="color: var(--accent-cyan); margin-right: 6px;">[ SECURE ]</span>
        <span>CONFIDENTIAL OBSERVER CREDENTIALS (NEVER EXPOSED PUBLICLY)</span>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; padding: 14px; background: rgba(3,7,16,0.5); border: var(--border-subtle); border-radius: var(--radius-tech);">
        <div>
          <span class="mono-sublabel">REGISTERED FULL NAME</span>
          <div style="font-weight: 600; color: #fff; margin-top: 2px;">${escapeHTML(u.name || u.full_name || u.nickname || '')}</div>
        </div>
        <div>
          <span class="mono-sublabel">ACCOUNT EMAIL</span>
          <div style="font-weight: 600; color: #fff; margin-top: 2px;">${escapeHTML(u.email || '')}</div>
        </div>
      </div>

      <!-- AVATAR & BANNER MEDIA SECTION -->
      <div class="card-header-bar" style="margin-bottom: 16px;">
        <span class="mono-label">// OBSERVER STATION BRANDING & PHOTOS</span>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px;">
        <!-- AVATAR CARD -->
        <div style="background: rgba(3,7,16,0.5); border: var(--border-subtle); border-radius: var(--radius-tech); padding: 16px;">
          <div class="mono-sublabel" style="margin-bottom: 10px;">PROFILE PHOTO (SQUARE)</div>
          <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 12px;">
            <div id="settings-avatar-preview">
              ${NovaAvatar.render(u, { size: 'lg' })}
            </div>
            <div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
                <button type="button" class="btn-tech btn-tech-primary" id="settings-btn-upload-avatar" style="padding: 5px 12px; font-size: 10px;">
                  [ UPLOAD ]
                </button>
                ${u.has_avatar ? `
                  <button type="button" class="btn-tech btn-tech-danger" id="settings-btn-remove-avatar" style="padding: 5px 12px; font-size: 10px;">
                    [ REMOVE ]
                  </button>
                ` : ''}
              </div>
              <div class="mono-sublabel" style="font-size: 9px; color: var(--accent-cyan);">Your photo is public.</div>
            </div>
          </div>
        </div>

        <!-- BANNER CARD -->
        <div style="background: rgba(3,7,16,0.5); border: var(--border-subtle); border-radius: var(--radius-tech); padding: 16px;">
          <div class="mono-sublabel" style="margin-bottom: 10px;">PANORAMIC BANNER (3:1)</div>
          <div style="margin-bottom: 12px;">
            <div id="settings-banner-preview" style="height: 60px; width: 100%; border-radius: 2px; border: 1px solid rgba(92,200,255,0.25); background: ${u.banner_url ? `url('${escapeHTML(u.banner_url)}') center/cover` : 'linear-gradient(135deg, #060b18, #0b1730)'}; margin-bottom: 10px;"></div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
              <button type="button" class="btn-tech btn-tech-primary" id="settings-btn-upload-banner" style="padding: 5px 12px; font-size: 10px;">
                [ UPLOAD BANNER ]
              </button>
              ${u.banner_url || u.has_banner ? `
                <button type="button" class="btn-tech btn-tech-danger" id="settings-btn-remove-banner" style="padding: 5px 12px; font-size: 10px;">
                  [ REMOVE BANNER ]
                </button>
              ` : ''}
            </div>
            <div class="mono-sublabel" style="font-size: 9px; color: var(--accent-cyan);">Your banner is public.</div>
          </div>
        </div>
      </div>

      <div class="card-header-bar">
        <span class="mono-label">// EDIT PUBLIC STATION PROFILE</span>
      </div>

      <form id="edit-profile-form">
        <div class="form-group">
          <label class="form-label" for="edit-nickname">CALLSIGN NICKNAME (PUBLIC)</label>
          <input type="text" class="form-input" id="edit-nickname" value="${escapeHTML(u.nickname)}" maxlength="20" required />
        </div>

        <div class="form-group">
          <label class="form-label" for="edit-bio">STATION BIOGRAPHY (MAX 160 CHARS)</label>
          <textarea class="form-textarea" id="edit-bio" rows="2" maxlength="160" placeholder="Astronomical focus, telescope gear, observatory location...">${escapeHTML(u.bio || '')}</textarea>
        </div>

        <button type="submit" class="btn-tech btn-tech-primary" id="btn-save-profile">
          <span>[SAVE PROFILE CHANGES]</span>
        </button>
      </form>

      <hr style="border: none; border-top: var(--border-subtle); margin: 32px 0 24px;" />

      <div class="card-header-bar">
        <span class="mono-label" style="color: var(--accent-alert);">// ACCOUNT SAFETY & SESSION CONTROLS</span>
      </div>

      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        <button type="button" class="btn-tech btn-tech-secondary" id="btn-logout-all-devices">
          <span>[LOG OUT ALL DEVICES]</span>
        </button>
        <button type="button" class="btn-tech btn-tech-danger" id="btn-delete-account">
          <span>[PERMANENTLY DELETE ACCOUNT]</span>
        </button>
      </div>
    </div>
  `;

  // Hook settings avatar & banner editor triggers
  const upAvBtn = document.getElementById('settings-btn-upload-avatar');
  if (upAvBtn) {
    upAvBtn.addEventListener('click', () => {
      openImageEditor({
        type: 'avatar',
        allowRemove: Boolean(u.has_avatar),
        onSuccess: (res) => {
          u.avatar_url = res.avatar_url;
          u.has_avatar = true;
          u.avatar_updated_at = Date.now() / 1000;
          if (profileUser && profileUser.id === u.id) {
            profileUser.avatar_url = res.avatar_url;
            profileUser.has_avatar = true;
            profileUser.avatar_updated_at = u.avatar_updated_at;
          }
          renderHeader();
          renderSettingsTab(container);
          if (SharedNav && typeof SharedNav.render === 'function') SharedNav.render();
        },
        onRemove: () => {
          u.avatar_url = null;
          u.has_avatar = false;
          u.avatar_updated_at = Date.now() / 1000;
          if (profileUser && profileUser.id === u.id) {
            profileUser.avatar_url = null;
            profileUser.has_avatar = false;
            profileUser.avatar_updated_at = u.avatar_updated_at;
          }
          renderHeader();
          renderSettingsTab(container);
          if (SharedNav && typeof SharedNav.render === 'function') SharedNav.render();
        }
      });
    });
  }

  const rmAvBtn = document.getElementById('settings-btn-remove-avatar');
  if (rmAvBtn) {
    rmAvBtn.addEventListener('click', async () => {
      const ok = typeof UI !== 'undefined' && UI.confirm
        ? await UI.confirm({
            title: 'REMOVE PROFILE PHOTO',
            message: 'Remove profile photo and restore default monogram?',
            confirmText: '[REMOVE]',
            cancelText: '[CANCEL]',
            danger: true
          })
        : true;
      if (!ok) return;
      try {
        await API.delete('/api/me/avatar');
        u.avatar_url = null;
        u.has_avatar = false;
        if (profileUser) { profileUser.avatar_url = null; profileUser.has_avatar = false; }
        showToast('Profile photo removed', 'success');
        renderHeader();
        renderSettingsTab(container);
        if (SharedNav && typeof SharedNav.render === 'function') SharedNav.render();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  const upBanBtn = document.getElementById('settings-btn-upload-banner');
  if (upBanBtn) {
    upBanBtn.addEventListener('click', () => {
      openImageEditor({
        type: 'banner',
        allowRemove: Boolean(u.banner_url || u.has_banner),
        onSuccess: (res) => {
          u.banner_url = res.banner_url;
          u.has_banner = true;
          if (profileUser && profileUser.id === u.id) {
            profileUser.banner_url = res.banner_url;
            profileUser.has_banner = true;
          }
          renderHeader();
          renderSettingsTab(container);
        },
        onRemove: () => {
          u.banner_url = null;
          u.has_banner = false;
          if (profileUser && profileUser.id === u.id) {
            profileUser.banner_url = null;
            profileUser.has_banner = false;
          }
          renderHeader();
          renderSettingsTab(container);
        }
      });
    });
  }

  const rmBanBtn = document.getElementById('settings-btn-remove-banner');
  if (rmBanBtn) {
    rmBanBtn.addEventListener('click', async () => {
      const ok = typeof UI !== 'undefined' && UI.confirm
        ? await UI.confirm({
            title: 'REMOVE PANORAMIC BANNER',
            message: 'Remove panoramic banner and restore celestial gradient?',
            confirmText: '[REMOVE BANNER]',
            cancelText: '[CANCEL]',
            danger: true
          })
        : true;
      if (!ok) return;
      try {
        await API.delete('/api/me/banner');
        u.banner_url = null;
        u.has_banner = false;
        if (profileUser) { profileUser.banner_url = null; profileUser.has_banner = false; }
        showToast('Banner removed', 'success');
        renderHeader();
        renderSettingsTab(container);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  document.getElementById('edit-profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nickname = document.getElementById('edit-nickname').value.trim();
    const bio = document.getElementById('edit-bio').value.trim();

    const formData = new FormData();
    formData.append('nickname', nickname);
    formData.append('bio', bio);

    const btn = document.getElementById('btn-save-profile');
    if (typeof UI !== 'undefined') UI.setLoading(btn, true, 'SAVING...');

    try {
      const res = await API.upload('/api/me', formData);
      showToast('Profile updated successfully', 'success');
      await AuthState.fetchUser();
      setTimeout(() => {
        window.location.href = `/u/${encodeURIComponent(res.user.nickname)}`;
      }, 300);
    } catch (err) {
      showToast(err.message, 'error');
      if (typeof UI !== 'undefined') UI.setLoading(btn, false);
    }
  });

  document.getElementById('btn-logout-all-devices').addEventListener('click', async () => {
    const ok = typeof UI !== 'undefined' && UI.confirm
      ? await UI.confirm({
          title: 'LOG OUT ALL DEVICES',
          message: 'Invalidate all active sessions across all browsers and devices?',
          confirmText: 'TERMINATE SESSIONS',
          cancelText: 'CANCEL'
        })
      : true;
    if (!ok) return;

    try {
      await API.post('/api/logout-all', {});
      showToast('All sessions invalidated', 'success');
      setTimeout(() => {
        window.location.href = '/login';
      }, 500);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('btn-delete-account').addEventListener('click', async () => {
    const ok = typeof UI !== 'undefined' && UI.confirm
      ? await UI.confirm({
          title: 'DELETE ACCOUNT PERMANENTLY',
          message: 'This will irreversibly delete your observer account, all published dispatches, uploads, and data. Are you absolutely certain?',
          confirmText: 'CONFIRM ACCOUNT DELETION',
          cancelText: 'CANCEL',
          danger: true
        })
      : false;
    if (!ok) return;

    try {
      await API.delete('/api/me');
      showToast('Account purged from observatory registry', 'success');
      setTimeout(() => {
        window.location.href = '/';
      }, 600);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

initProfile();

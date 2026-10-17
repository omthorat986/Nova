import { API, AuthState, SharedNav, initStarfield, showToast, escapeHTML } from '/js/social.js';
import NovaAvatar from '/js/avatar.js';

initStarfield('starfield-canvas');
SharedNav.init('agencies');

const container = document.getElementById('agencies-grid-container');
const searchInput = document.getElementById('agencies-search-input');
let allAgencies = [];

async function loadAgencies() {
  await AuthState.fetchUser();
  if (typeof UI !== 'undefined') UI.skeleton(container, 6);
  try {
    const res = await API.get('/api/agencies');
    allAgencies = res.agencies || [];
    renderAgencies(allAgencies);
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state-card" style="grid-column: 1 / -1;">
        <div class="empty-state-title">// AGENCY DIRECTORY OFFLINE</div>
        <div class="empty-state-desc">${escapeHTML(err.message)}</div>
      </div>
    `;
  }
}

function renderAgencies(agencies) {
  if (agencies.length === 0) {
    container.innerHTML = `
      <div class="empty-state-card" style="grid-column: 1 / -1;">
        <div class="empty-state-title">// NO AGENCIES MATCHING SEARCH</div>
        <div class="empty-state-desc">No organizations found matching your search query. Try searching by short code (e.g. NASA, ESA, ISRO) or country.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = agencies.map(agency => {
    const slug = agency.slug || agency.code.toLowerCase();
    const isGeneral = slug === 'general';
    const channelBadge = isGeneral ? 'CHANNEL // GENERAL' : `AGENCY // ${agency.code || agency.short_code}`;

    return `
      <div class="agency-card" id="agency-card-${agency.id}" style="position: relative; overflow: hidden;">
        <div style="height: 6px; width: 100%; position: absolute; top: 0; left: 0; background: ${escapeHTML(agency.banner_gradient || 'linear-gradient(135deg, #0b3d91 0%, #1e1b4b 100%)')};"></div>
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
            <div style="display: inline-flex; align-items: center;">
              ${NovaAvatar.renderAgency(agency, { size: 'md' })}
            </div>
            <div style="text-align: right;">
              <span class="mono-label" style="color: var(--accent-cyan); font-size: 10px; display: block;">${escapeHTML(channelBadge)}</span>
              <span class="mono-sublabel" style="font-size: 10px;">${escapeHTML(agency.country)}</span>
            </div>
          </div>
          <h3 class="agency-title" style="margin-top: 14px;">
            <a href="/agency/${encodeURIComponent(slug)}" style="color: #fff; text-decoration: none;">${escapeHTML(agency.name)}</a>
          </h3>
          <p class="agency-desc">${escapeHTML(agency.description || '')}</p>
        </div>

        <div class="agency-actions">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="mono-sublabel" style="font-size: 10px;">${agency.followers_count || 0} FOLLOWERS</span>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn-tech ${agency.is_following ? 'btn-tech-secondary' : 'btn-tech-primary'}" style="padding: 5px 12px; font-size: 10px;" data-action="follow-agency" data-agency-slug="${escapeHTML(slug)}">
              ${agency.is_following ? '[FOLLOWING]' : '[FOLLOW]'}
            </button>
            <a href="/agency/${encodeURIComponent(slug)}" class="btn-tech btn-tech-secondary" style="padding: 5px 12px; font-size: 10px; text-decoration: none;">
              [DOSSIER →]
            </a>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

if (searchInput) {
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase().trim();
    if (!q) {
      renderAgencies(allAgencies);
      return;
    }
    const filtered = allAgencies.filter(a =>
      (a.name && a.name.toLowerCase().includes(q)) ||
      (a.code && a.code.toLowerCase().includes(q)) ||
      (a.slug && a.slug.toLowerCase().includes(q)) ||
      (a.country && a.country.toLowerCase().includes(q)) ||
      (a.description && a.description.toLowerCase().includes(q))
    );
    renderAgencies(filtered);
  });
}

window.novaFollowAgency = async (slug, btn) => {
  if (!AuthState.isLoggedIn()) {
    showToast('Please sign in to follow agencies', 'info');
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    return;
  }
  try {
    const isFollowing = btn.textContent.includes('FOLLOWING');
    if (isFollowing) {
      await API.delete(`/api/agencies/${encodeURIComponent(slug)}/follow`);
      btn.textContent = '[FOLLOW]';
      btn.className = 'btn-tech btn-tech-primary';
      const ag = allAgencies.find(a => a.slug === slug);
      if (ag) ag.is_following = false;
      showToast('Unfollowed agency channel', 'info');
    } else {
      await API.post(`/api/agencies/${encodeURIComponent(slug)}/follow`, {});
      btn.textContent = '[FOLLOWING]';
      btn.className = 'btn-tech btn-tech-secondary';
      const ag = allAgencies.find(a => a.slug === slug);
      if (ag) ag.is_following = true;
      showToast('Now following agency feed updates!', 'success');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
};

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="follow-agency"]');
  if (btn) {
    const slug = btn.getAttribute('data-agency-slug');
    window.novaFollowAgency(slug, btn);
  }
});

loadAgencies();

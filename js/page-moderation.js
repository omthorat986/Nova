import { API, AuthState, SharedNav, initStarfield, showToast, escapeHTML, timeAgo } from '/js/social.js';
import NovaAvatar from '/js/avatar.js';

initStarfield('starfield-canvas');
SharedNav.init('moderation');

const container = document.getElementById('reports-queue-container');

async function loadReports() {
  await AuthState.fetchUser();
  if (!AuthState.isCurator()) {
    container.innerHTML = `
      <div class="empty-state-card" style="border-color: var(--accent-alert);">
        <div class="empty-state-title" style="color: var(--accent-alert);">// ACCESS DENIED (403 FORBIDDEN)</div>
        <div class="empty-state-desc">This console is restricted to verified Curators and System Administrators.</div>
      </div>
    `;
    return;
  }

  if (typeof UI !== 'undefined') UI.skeleton(container, 3);
  try {
    const res = await API.get('/api/reports');
    const reports = res.reports || [];
    renderReports(reports);
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state-card">
        <div class="empty-state-title">// UNABLE TO RETRIEVE REPORTS</div>
        <div class="empty-state-desc">${escapeHTML(err.message)}</div>
      </div>
    `;
  }
}

function renderReports(reports) {
  if (reports.length === 0) {
    container.innerHTML = `
      <div class="empty-state-card">
        <div class="empty-state-title" style="color: var(--accent-success);">// ALL SIGNALS NOMINAL • QUEUE CLEAR</div>
        <div class="empty-state-desc">No active flags or content violations in the curation queue. Scientific integrity maintained.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = reports.map(r => `
    <div class="report-card" id="report-${r.id}">
      <div class="report-header">
        <div style="display:flex; align-items:center; gap:8px;">
          ${r.reported_user ? NovaAvatar.render(r.reported_user, { size: 'xs', link: false }) : ''}
          <span class="mono-label" style="color: var(--accent-gold);">REPORT #${r.id}</span>
          <span class="mono-sublabel" style="margin-left: 8px;">FILED BY: @${escapeHTML(r.reporter_nickname || 'anonymous')}</span>
          ${r.reported_nickname ? `<span class="mono-sublabel" style="color:var(--accent-cyan); margin-left: 8px;">TARGET: @${escapeHTML(r.reported_nickname)}</span>` : ''}
        </div>
        <span class="mono-sublabel">${timeAgo(r.created_at)}</span>
      </div>

      <div style="font-size: 13px; margin-bottom: 6px;">
        <strong class="mono-label" style="color: var(--accent-alert);">REPORTED REASON:</strong>
        <span style="color: #fff; margin-left: 6px;">${escapeHTML(r.reason)}</span>
      </div>

      ${r.post_id ? `
        <div class="report-target-snippet">
          <div class="mono-sublabel" style="margin-bottom: 4px;">TARGET DISPATCH #${r.post_id}:</div>
          <div style="font-weight: 600; color: #fff; font-size: 13px;">${escapeHTML(r.post_title || 'Untitled Post')}</div>
          <div style="color: var(--text-muted); font-size: 12px; margin-top: 4px;">${escapeHTML(r.post_snippet || '')}</div>
        </div>
      ` : ''}

      <div class="curator-actions-bar">
        <button class="btn-tech btn-tech-secondary" style="font-size: 10px; padding: 6px 12px;" data-report-action="dismiss" data-report-id="${r.id}">
          [DISMISS]
        </button>
        ${r.post_id ? `
          <button class="btn-tech btn-tech-danger" style="font-size: 10px; padding: 6px 12px;" data-report-action="delete_post" data-report-id="${r.id}">
            [REMOVE CONTENT]
          </button>
        ` : ''}
        ${(r.reported_user_id || r.author_id) ? `
          <button class="btn-tech btn-tech-danger" style="font-size: 10px; padding: 6px 12px;" data-report-action="remove_avatar" data-report-id="${r.id}">
            [PURGE AVATAR]
          </button>
          <button class="btn-tech btn-tech-danger" style="font-size: 10px; padding: 6px 12px;" data-report-action="remove_banner" data-report-id="${r.id}">
            [PURGE BANNER]
          </button>
        ` : ''}
        <button class="btn-tech btn-tech-danger" style="font-size: 10px; padding: 6px 12px; background: rgba(239,68,68,0.25);" data-report-action="suspend_user" data-report-id="${r.id}">
          [SUSPEND OBSERVER]
        </button>
      </div>
    </div>
  `).join('');
}

window.novaReportAction = async (reportId, action) => {
  if (action === 'suspend_user') {
    const ok = typeof UI !== 'undefined' && UI.confirm
      ? await UI.confirm({
          title: 'SUSPEND OBSERVER',
          message: 'Are you sure you want to suspend this observer account? They will be locked out of the observatory.',
          confirmText: 'SUSPEND OBSERVER',
          cancelText: 'CANCEL',
          danger: true
        })
      : true;
    if (!ok) return;
  } else if (action === 'delete_post') {
    const ok = typeof UI !== 'undefined' && UI.confirm
      ? await UI.confirm({
          title: 'REMOVE DISPATCH',
          message: 'Permanently remove this reported dispatch from global telemetry?',
          confirmText: 'REMOVE DISPATCH',
          cancelText: 'CANCEL',
          danger: true
        })
      : true;
    if (!ok) return;
  } else if (action === 'remove_avatar') {
    const ok = typeof UI !== 'undefined' && UI.confirm
      ? await UI.confirm({
          title: 'PURGE PROFILE PHOTO',
          message: 'Permanently remove target observer photo and revert to initials badge?',
          confirmText: 'PURGE AVATAR',
          cancelText: 'CANCEL',
          danger: true
        })
      : true;
    if (!ok) return;
  } else if (action === 'remove_banner') {
    const ok = typeof UI !== 'undefined' && UI.confirm
      ? await UI.confirm({
          title: 'PURGE PROFILE BANNER',
          message: 'Permanently remove target observer panoramic banner?',
          confirmText: 'PURGE BANNER',
          cancelText: 'CANCEL',
          danger: true
        })
      : true;
    if (!ok) return;
  }

  try {
    await API.post(`/api/reports/${reportId}/action`, { action });
    const card = document.getElementById(`report-${reportId}`);
    if (card) card.remove();
    showToast(`Action '${action}' applied to report #${reportId}`, 'success');
    if (container.querySelectorAll('.report-card').length === 0) {
      loadReports();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
};

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-report-action]');
  if (btn) {
    const action = btn.getAttribute('data-report-action');
    const id = btn.getAttribute('data-report-id');
    window.novaReportAction(id, action);
  }
});

// Agency Channel Curation
let loadedAgencies = [];
const agencySelect = document.getElementById('mod-agency-select');
const agencyForm = document.getElementById('mod-agency-form');
const agencyDesc = document.getElementById('mod-agency-desc');
const agencyWeb = document.getElementById('mod-agency-website');
const agencyContact = document.getElementById('mod-agency-contact');
const saveBtn = document.getElementById('btn-save-agency-meta');

async function loadCuratorAgencies() {
  if (!agencySelect) return;
  try {
    const res = await API.get('/api/agencies');
    loadedAgencies = res.agencies || [];
    agencySelect.innerHTML = '<option value="" disabled selected>Select agency to curate...</option>' +
      loadedAgencies.map(a => `<option value="${a.slug}">[${escapeHTML(a.code || a.short_code)}] ${escapeHTML(a.name)}</option>`).join('');
  } catch (err) {
    agencySelect.innerHTML = '<option disabled>Error loading channels</option>';
  }
}

if (agencySelect) {
  agencySelect.addEventListener('change', () => {
    const selectedSlug = agencySelect.value;
    const ag = loadedAgencies.find(a => a.slug === selectedSlug);
    if (!ag) return;
    agencyDesc.value = ag.description || '';
    agencyWeb.value = ag.website_url || '';
    agencyContact.value = ag.contact_url || '';
    agencyForm.style.display = 'block';
  });
}

if (agencyForm) {
  agencyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const selectedSlug = agencySelect.value;
    if (!selectedSlug) return;

    if (typeof UI !== 'undefined') UI.setLoading(saveBtn, true, 'SAVING...');
    try {
      const payload = {
        description: agencyDesc.value.trim(),
        website_url: agencyWeb.value.trim(),
        contact_url: agencyContact.value.trim()
      };
      await API.patch(`/api/agencies/${encodeURIComponent(selectedSlug)}`, payload);
      showToast(`Agency [${selectedSlug.toUpperCase()}] updated successfully!`, 'success');

      // Update cached memory
      const ag = loadedAgencies.find(a => a.slug === selectedSlug);
      if (ag) {
        ag.description = payload.description;
        ag.website_url = payload.website_url;
        ag.contact_url = payload.contact_url;
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      if (typeof UI !== 'undefined') UI.setLoading(saveBtn, false);
    }
  });
}

loadReports();
loadCuratorAgencies();

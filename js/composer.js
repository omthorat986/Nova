/**
 * NOVA Space Observatory — Unified Dispatch Composer (js/composer.js)
 * Production-grade composer component shared between Modal dialog and standalone /submit page.
 * Features:
 * - Searchable agency channel selector (8 agencies + General Space)
 * - 3 Tabs: Text | Images (drag & drop up to 4 images) | Link (URL validation)
 * - Live character counters (Title max 120, Body max 1000)
 * - Reactive validation enabling/disabling submit button
 * - Double-submit prevention with loading states
 * - Auto-saving draft in localStorage + restore banner
 * - Unsaved changes confirmation dialog on close
 * - Full accessibility: role="dialog", focus trap, focus restore, body scroll lock
 * - Zero native popups (styled UI confirm/toast)
 */

import { API, AuthState, escapeHTML, timeAgo } from '/js/social.js';

export const AGENCIES_LIST = [
  { slug: 'general', code: 'GENERAL', name: 'General Space', country: 'All Astronomy', initials: 'GEN' },
  { slug: 'nasa', code: 'NASA', name: 'NASA', country: 'United States', initials: 'NASA' },
  { slug: 'esa', code: 'ESA', name: 'ESA', country: 'European Space Agency', initials: 'ESA' },
  { slug: 'isro', code: 'ISRO', name: 'ISRO', country: 'India', initials: 'ISRO' },
  { slug: 'jaxa', code: 'JAXA', name: 'JAXA', country: 'Japan', initials: 'JAXA' },
  { slug: 'cnsa', code: 'CNSA', name: 'CNSA', country: 'China', initials: 'CNSA' },
  { slug: 'roscosmos', code: 'ROSCOSMOS', name: 'Roscosmos', country: 'Russia', initials: 'ROS' },
  { slug: 'csa', code: 'CSA', name: 'CSA', country: 'Canada', initials: 'CSA' },
  { slug: 'uaesa', code: 'UAESA', name: 'UAE Space Agency', country: 'UAE', initials: 'UAE' }
];

const TOPIC_TAGS = ['Other', 'Planets', 'Missions', 'Astronomy', 'Astrophysics', 'Launches', 'Research'];
const DRAFT_STORAGE_KEY = 'nova_composer_draft';

export class ComposerInstance {
  constructor(options = {}) {
    this.isModal = !!options.isModal;
    this.defaultAgency = options.agency || '';
    this.container = options.container || null;
    this.onSuccess = options.onSuccess || null;
    this.onClose = options.onClose || null;

    this.activeTab = 'text';
    this.selectedAgency = this.defaultAgency;
    this.attachedFiles = [];
    this.savedScrollY = 0;
    this.lastActiveElement = null;
    this.isSubmitting = false;

    this.rootEl = null;
  }

  render() {
    const el = document.createElement('div');
    el.className = this.isModal ? 'composer-modal-backdrop' : 'composer-standalone-wrapper';
    if (this.isModal) {
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.setAttribute('aria-labelledby', 'composer-modal-title');
    }

    el.innerHTML = `
      <div class="composer-modal-window" tabindex="-1">
        <!-- HEADER -->
        <header class="composer-header-bar">
          <div class="composer-header-left">
            <span class="mono-label" style="color: var(--accent-cyan); font-size: 10px;">// TRANSMISSION UPLINK</span>
            <h2 id="composer-modal-title" class="composer-title-text">NEW OBSERVATION DISPATCH</h2>
          </div>
          <div class="composer-header-right">
            ${this.isModal ? `
              <button type="button" class="btn-tech btn-tech-secondary composer-btn-cancel-header" id="composer-header-cancel" style="font-size: 10px; padding: 4px 10px;">
                [ CANCEL ]
              </button>
              <button type="button" class="composer-close-icon-btn" id="composer-close-btn" aria-label="Close composer">✕</button>
            ` : ''}
          </div>
        </header>

        <!-- DRAFT RESTORE BANNER (IF DRAFT EXISTS) -->
        <div class="composer-draft-banner" id="composer-draft-banner" style="display: none;">
          <span class="mono-label" id="composer-draft-time-label" style="font-size: 10px;">// DRAFT DETECTED</span>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn-tech btn-tech-primary" id="btn-restore-draft" style="font-size: 9px; padding: 2px 8px;">[RESTORE DRAFT]</button>
            <button type="button" class="btn-tech btn-tech-secondary" id="btn-discard-draft" style="font-size: 9px; padding: 2px 8px;">[DISCARD]</button>
          </div>
        </div>

        <!-- BODY SCROLL CONTAINER -->
        <div class="composer-body-scroll">
          <form id="composer-core-form" novalidate>
            <!-- 1. AGENCY SELECTOR & TOPIC TAG -->
            <div class="composer-channel-row">
              <div class="form-group composer-agency-group" style="margin-bottom: 0;">
                <label class="form-label" for="composer-agency-select">
                  <span>CHOOSE AGENCY / CHANNEL</span>
                  <span class="mono-sublabel" style="color: var(--accent-cyan);">* REQUIRED</span>
                </label>
                
                <!-- Custom Searchable Agency Picker -->
                <div class="custom-agency-picker" id="custom-agency-picker">
                  <div class="agency-picker-trigger" id="agency-picker-trigger" tabindex="0" role="combobox" aria-expanded="false" aria-haspopup="listbox">
                    <span id="agency-picker-label" class="agency-picker-current">Select space agency channel...</span>
                    <span class="agency-picker-arrow">▾</span>
                  </div>
                  <div class="agency-picker-dropdown" id="agency-picker-dropdown">
                    <div class="agency-picker-search-wrap">
                      <input type="text" class="agency-picker-search" id="agency-picker-search" placeholder="Filter agencies (NASA, ESA, JAXA...)" autocomplete="off" />
                    </div>
                    <ul class="agency-picker-list" id="agency-picker-list" role="listbox">
                      ${AGENCIES_LIST.map(a => `
                        <li class="agency-picker-item" data-slug="${escapeHTML(a.slug)}" role="option">
                          <span class="agency-initials-badge">${escapeHTML(a.initials)}</span>
                          <div class="agency-picker-item-meta">
                            <span class="agency-item-name">${escapeHTML(a.name)}</span>
                            <span class="agency-item-country">${escapeHTML(a.country)}</span>
                          </div>
                        </li>
                      `).join('')}
                    </ul>
                  </div>
                </div>

                <!-- Hidden native select for fallback and form sync -->
                <select id="composer-agency-select" name="agency_id" style="position: absolute; opacity: 0; pointer-events: none; height: 0; width: 0;" required>
                  <option value="" disabled ${!this.selectedAgency ? 'selected' : ''}>Select agency channel...</option>
                  ${AGENCIES_LIST.map(a => `
                    <option value="${escapeHTML(a.slug)}" ${this.selectedAgency === a.slug ? 'selected' : ''}>
                      ${escapeHTML(a.name)} (${escapeHTML(a.country)})
                    </option>
                  `).join('')}
                </select>
              </div>

              <div class="form-group composer-topic-group" style="margin-bottom: 0;">
                <label class="form-label" for="composer-topic-select">TOPIC TAG</label>
                <select class="form-select" id="composer-topic-select" name="category">
                  ${TOPIC_TAGS.map(t => `<option value="${t}">${t}</option>`).join('')}
                </select>
              </div>
            </div>

            <!-- 2. TABS BAR (Text | Images | Link) -->
            <div class="composer-tabs-nav" role="tablist">
              <button type="button" class="composer-tab-btn active" data-tab="text" role="tab" aria-selected="true">
                <span class="mono-label">◈</span>
                <span>TEXT DISPATCH</span>
              </button>
              <button type="button" class="composer-tab-btn" data-tab="images" role="tab" aria-selected="false">
                <span class="mono-label">▣</span>
                <span>ASTROPHOTOGRAPHY / IMAGES</span>
              </button>
              <button type="button" class="composer-tab-btn" data-tab="link" role="tab" aria-selected="false">
                <span class="mono-label">↗</span>
                <span>RESEARCH LINK</span>
              </button>
            </div>

            <!-- 3. TITLE INPUT WITH CHAR COUNTER -->
            <div class="form-group" style="margin-top: 16px;">
              <div class="composer-field-header">
                <label class="form-label" for="composer-title-input" style="margin-bottom: 0;">DISPATCH TITLE *</label>
                <span class="composer-char-count" id="composer-title-count">0 / 120</span>
              </div>
              <input type="text" class="form-input composer-title-input" id="composer-title-input" placeholder="e.g. M87* Relativistic Jet Multi-Band Photometry" maxlength="120" required autocomplete="off" />
            </div>

            <!-- 4. TAB CONTENTS -->
            <!-- TAB A: TEXT DISPATCH -->
            <div class="composer-pane" id="composer-pane-text">
              <div class="form-group">
                <div class="composer-field-header">
                  <label class="form-label" for="composer-body-input" style="margin-bottom: 0;">OBSERVATION LOG / SCIENTIFIC DATA (MAX 1000) *</label>
                  <span class="composer-char-count" id="composer-body-count">0 / 1000</span>
                </div>
                <textarea class="form-textarea composer-textarea" id="composer-body-input" rows="5" placeholder="Record coordinates, spectral analysis, telemetry findings, or theoretical astrophysics..." maxlength="1000" required></textarea>
              </div>
            </div>

            <!-- TAB B: IMAGES DISPATCH -->
            <div class="composer-pane" id="composer-pane-images" style="display: none;">
              <div class="composer-dropzone" id="composer-dropzone">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="margin-bottom: 8px; color: var(--accent-cyan);"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <div class="dropzone-primary-text">DRAG & DROP ASTROPHOTOGRAPHY HERE, OR CLICK TO BROWSE</div>
                <div class="dropzone-subtext">ATTACH UP TO 4 IMAGES • JPEG, PNG, WEBP (MAX 5 MB EACH)</div>
                <input type="file" id="composer-file-input" accept="image/jpeg,image/png,image/webp" multiple style="display: none;" />
              </div>

              <!-- PREVIEW GRID -->
              <div class="composer-images-grid" id="composer-images-grid" style="display: none;"></div>

              <div class="form-group" style="margin-top: 14px;">
                <div class="composer-field-header">
                  <label class="form-label" for="composer-image-caption" style="margin-bottom: 0;">IMAGE CAPTION & OBSERVATION LOG (OPTIONAL)</label>
                  <span class="composer-char-count" id="composer-image-caption-count">0 / 1000</span>
                </div>
                <textarea class="form-textarea composer-textarea" id="composer-image-caption" rows="3" placeholder="Optical telescope specs, ISO, exposure time, filtering wavelengths..." maxlength="1000"></textarea>
              </div>
            </div>

            <!-- TAB C: LINK DISPATCH -->
            <div class="composer-pane" id="composer-pane-link" style="display: none;">
              <div class="form-group">
                <label class="form-label" for="composer-link-input">EXTERNAL RESEARCH / MISSION URL *</label>
                <input type="url" class="form-input" id="composer-link-input" placeholder="https://arxiv.org/abs/... or https://nasa.gov/news/..." autocomplete="off" />
              </div>

              <div class="form-group">
                <div class="composer-field-header">
                  <label class="form-label" for="composer-link-commentary" style="margin-bottom: 0;">COMMENTARY / ABSTRACT SUMMARY (OPTIONAL)</label>
                  <span class="composer-char-count" id="composer-link-commentary-count">0 / 1000</span>
                </div>
                <textarea class="form-textarea composer-textarea" id="composer-link-commentary" rows="3" placeholder="Provide context, paper abstract, or mission significance..." maxlength="1000"></textarea>
              </div>
            </div>
          </form>
        </div>

        <!-- FOOTER BAR (KEYBOARD-SAFE & STICKY ON MOBILE) -->
        <footer class="composer-footer-bar">
          <div class="composer-footer-info">
            <span class="mono-sublabel" id="composer-validation-status">// AWAITING REQUIRED PARAMETERS</span>
          </div>
          <div class="composer-footer-actions">
            ${this.isModal ? `
              <button type="button" class="btn-tech btn-tech-secondary composer-btn-cancel-footer" id="composer-footer-cancel">
                [ CANCEL ]
              </button>
            ` : ''}
            <button type="button" class="btn-tech btn-tech-primary" id="composer-btn-submit" disabled>
              <svg class="post-btn-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square"><path d="M12 5v14M5 12h14"/></svg>
              <span>[ TRANSMIT DISPATCH ]</span>
            </button>
          </div>
        </footer>
      </div>
    `;

    this.rootEl = el;
    this.bindEvents();
    this.checkSavedDraft();
    this.updateAgencyUI(this.selectedAgency);
    this.validateForm();
    return el;
  }

  bindEvents() {
    const el = this.rootEl;
    if (!el) return;

    // 1. Modal close actions
    if (this.isModal) {
      const closeBtn = el.querySelector('#composer-close-btn');
      const headerCancel = el.querySelector('#composer-header-cancel');
      const footerCancel = el.querySelector('#composer-footer-cancel');

      const attemptClose = () => this.handleCloseAttempt();

      if (closeBtn) closeBtn.addEventListener('click', attemptClose);
      if (headerCancel) headerCancel.addEventListener('click', attemptClose);
      if (footerCancel) footerCancel.addEventListener('click', attemptClose);

      // Click on backdrop (outside modal window)
      el.addEventListener('click', (e) => {
        if (e.target === el) attemptClose();
      });

      // Keydown: Esc and Focus Trap
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          e.preventDefault();
          attemptClose();
        } else if (e.key === 'Tab') {
          this.trapFocus(e);
        }
      });
    }

    // 2. Tab Navigation
    el.querySelectorAll('.composer-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        this.switchTab(targetTab);
      });
    });

    // 3. Searchable Agency Picker
    this.bindAgencyPicker();

    // 4. Character Counters & Input Validation
    const titleInput = el.querySelector('#composer-title-input');
    const bodyInput = el.querySelector('#composer-body-input');
    const captionInput = el.querySelector('#composer-image-caption');
    const linkInput = el.querySelector('#composer-link-input');
    const commentaryInput = el.querySelector('#composer-link-commentary');

    const titleCount = el.querySelector('#composer-title-count');
    const bodyCount = el.querySelector('#composer-body-count');
    const captionCount = el.querySelector('#composer-image-caption-count');
    const commentaryCount = el.querySelector('#composer-link-commentary-count');

    const onInputChange = () => {
      if (titleInput && titleCount) titleCount.textContent = `${titleInput.value.length} / 120`;
      if (bodyInput && bodyCount) bodyCount.textContent = `${bodyInput.value.length} / 1000`;
      if (captionInput && captionCount) captionCount.textContent = `${captionInput.value.length} / 1000`;
      if (commentaryInput && commentaryCount) commentaryCount.textContent = `${commentaryInput.value.length} / 1000`;

      this.validateForm();
      this.saveDraftDebounced();
    };

    [titleInput, bodyInput, captionInput, linkInput, commentaryInput].forEach(inp => {
      if (inp) {
        inp.addEventListener('input', onInputChange);
        inp.addEventListener('change', onInputChange);
      }
    });

    // 5. Image Dropzone and File Picker
    this.bindDropzone();

    // 6. Submit Button Handler
    const submitBtn = el.querySelector('#composer-btn-submit');
    if (submitBtn) {
      submitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.submit();
      });
    }

    // 7. Draft restore / discard handlers
    const restoreBtn = el.querySelector('#btn-restore-draft');
    const discardBtn = el.querySelector('#btn-discard-draft');
    if (restoreBtn) restoreBtn.addEventListener('click', () => this.restoreDraft());
    if (discardBtn) discardBtn.addEventListener('click', () => this.discardDraft());
  }

  bindAgencyPicker() {
    const el = this.rootEl;
    const trigger = el.querySelector('#agency-picker-trigger');
    const dropdown = el.querySelector('#agency-picker-dropdown');
    const searchInput = el.querySelector('#agency-picker-search');
    const list = el.querySelector('#agency-picker-list');
    const nativeSelect = el.querySelector('#composer-agency-select');

    if (!trigger || !dropdown) return;

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.toggle('open');
      trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (isOpen && searchInput) {
        searchInput.value = '';
        this.filterAgencyItems('');
        setTimeout(() => searchInput.focus(), 50);
      }
    });

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.filterAgencyItems(searchInput.value.trim().toLowerCase());
      });
      searchInput.addEventListener('click', (e) => e.stopPropagation());
    }

    if (list) {
      list.querySelectorAll('.agency-picker-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const slug = item.getAttribute('data-slug');
          this.selectedAgency = slug;
          if (nativeSelect) nativeSelect.value = slug;
          this.updateAgencyUI(slug);
          dropdown.classList.remove('open');
          trigger.setAttribute('aria-expanded', 'false');
          trigger.focus();
          this.validateForm();
          this.saveDraftDebounced();
        });
      });
    }

    // Click outside to close agency dropdown
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && !trigger.contains(e.target)) {
        dropdown.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  filterAgencyItems(query) {
    const el = this.rootEl;
    if (!el) return;
    const items = el.querySelectorAll('.agency-picker-item');
    items.forEach(item => {
      const slug = item.getAttribute('data-slug') || '';
      const text = item.textContent.toLowerCase();
      if (!query || text.includes(query) || slug.includes(query)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  }

  updateAgencyUI(slug) {
    const el = this.rootEl;
    if (!el) return;
    const label = el.querySelector('#agency-picker-label');
    const nativeSelect = el.querySelector('#composer-agency-select');

    const agency = AGENCIES_LIST.find(a => a.slug === slug);
    if (agency) {
      this.selectedAgency = agency.slug;
      if (nativeSelect) nativeSelect.value = agency.slug;
      if (label) {
        label.innerHTML = `
          <span style="display:flex; align-items:center; gap:8px;">
            <span class="agency-initials-badge" style="font-size:9px; width:20px; height:20px;">${escapeHTML(agency.initials)}</span>
            <span style="color:#fff; font-weight:600;">${escapeHTML(agency.name)}</span>
            <span class="mono-sublabel" style="font-size:10px;">// ${escapeHTML(agency.country)}</span>
          </span>
        `;
      }
    } else {
      this.selectedAgency = '';
      if (nativeSelect) nativeSelect.value = '';
      if (label) label.textContent = 'Select space agency channel...';
    }
  }

  bindDropzone() {
    const el = this.rootEl;
    const dropzone = el.querySelector('#composer-dropzone');
    const fileInput = el.querySelector('#composer-file-input');

    if (!dropzone || !fileInput) return;

    dropzone.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files) {
        this.addFiles(Array.from(fileInput.files));
        fileInput.value = '';
      }
    });

    ['dragenter', 'dragover'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length) {
        this.addFiles(Array.from(dt.files));
      }
    });
  }

  addFiles(files) {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const MAX_SIZE = 5 * 1024 * 1024;

    for (const file of files) {
      if (this.attachedFiles.length >= 4) {
        if (typeof UI !== 'undefined') UI.toast.warn('Maximum 4 images allowed per dispatch transmission.');
        break;
      }
      if (!validTypes.includes(file.type)) {
        if (typeof UI !== 'undefined') UI.toast.error(`Invalid format: ${file.name}. Only JPEG, PNG, or WebP permitted.`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        if (typeof UI !== 'undefined') UI.toast.error(`File too large: ${file.name}. Limit is 5 MB.`);
        continue;
      }

      this.attachedFiles.push(file);
    }

    this.renderImagesPreview();
    this.validateForm();
  }

  removeFile(index) {
    this.attachedFiles.splice(index, 1);
    this.renderImagesPreview();
    this.validateForm();
  }

  renderImagesPreview() {
    const el = this.rootEl;
    const grid = el.querySelector('#composer-images-grid');
    if (!grid) return;

    if (this.attachedFiles.length === 0) {
      grid.style.display = 'none';
      grid.innerHTML = '';
      return;
    }

    grid.style.display = 'grid';
    grid.innerHTML = '';

    this.attachedFiles.forEach((file, index) => {
      const card = document.createElement('div');
      card.className = 'composer-image-preview-card';

      const img = document.createElement('img');
      img.className = 'composer-thumb-img';
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);

      const sizeKb = Math.round(file.size / 1024);
      card.innerHTML = `
        <button type="button" class="composer-thumb-remove-btn" data-index="${index}" title="Remove image" aria-label="Remove image">✕</button>
        <div class="composer-thumb-meta">
          <span class="composer-thumb-name">${escapeHTML(file.name)}</span>
          <span class="composer-thumb-size">${sizeKb} KB</span>
        </div>
      `;
      card.prepend(img);

      card.querySelector('.composer-thumb-remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeFile(index);
      });

      grid.appendChild(card);
    });
  }

  switchTab(tab) {
    this.activeTab = tab;
    const el = this.rootEl;
    if (!el) return;

    el.querySelectorAll('.composer-tab-btn').forEach(btn => {
      const isActive = btn.getAttribute('data-tab') === tab;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    const paneText = el.querySelector('#composer-pane-text');
    const paneImages = el.querySelector('#composer-pane-images');
    const paneLink = el.querySelector('#composer-pane-link');

    if (paneText) paneText.style.display = tab === 'text' ? 'block' : 'none';
    if (paneImages) paneImages.style.display = tab === 'images' ? 'block' : 'none';
    if (paneLink) paneLink.style.display = tab === 'link' ? 'block' : 'none';

    this.validateForm();
    this.saveDraftDebounced();
  }

  validateForm() {
    const el = this.rootEl;
    if (!el) return false;

    const titleInput = el.querySelector('#composer-title-input');
    const bodyInput = el.querySelector('#composer-body-input');
    const captionInput = el.querySelector('#composer-image-caption');
    const linkInput = el.querySelector('#composer-link-input');
    const commentaryInput = el.querySelector('#composer-link-commentary');
    const submitBtn = el.querySelector('#composer-btn-submit');
    const statusLabel = el.querySelector('#composer-validation-status');

    const agencyValid = !!this.selectedAgency;
    const titleVal = titleInput ? titleInput.value.trim() : '';
    const titleValid = titleVal.length >= 1 && titleVal.length <= 120;

    let contentValid = false;
    let hint = '';

    if (!agencyValid) {
      hint = '// PLEASE CHOOSE A SPACE AGENCY CHANNEL';
    } else if (!titleValid) {
      hint = titleVal.length === 0 ? '// TITLE REQUIRED (MAX 120 CHARS)' : '// TITLE EXCEEDS 120 CHARACTERS';
    } else {
      if (this.activeTab === 'text') {
        const bodyVal = bodyInput ? bodyInput.value.trim() : '';
        contentValid = bodyVal.length >= 1 && bodyVal.length <= 1000;
        if (!contentValid) hint = bodyVal.length === 0 ? '// OBSERVATION LOG BODY REQUIRED' : '// BODY EXCEEDS 1000 CHARS';
      } else if (this.activeTab === 'images') {
        const hasImages = this.attachedFiles.length > 0;
        const captionVal = captionInput ? captionInput.value.trim() : '';
        contentValid = (hasImages || captionVal.length > 0) && captionVal.length <= 1000;
        if (!contentValid) hint = '// AT LEAST 1 IMAGE OR CAPTION REQUIRED';
      } else if (this.activeTab === 'link') {
        const linkVal = linkInput ? linkInput.value.trim() : '';
        const isValidUrl = /^https?:\/\/.+/i.test(linkVal);
        const commVal = commentaryInput ? commentaryInput.value.trim() : '';
        contentValid = isValidUrl && commVal.length <= 1000;
        if (!contentValid) hint = !isValidUrl ? '// VALID HTTP(S) URL REQUIRED' : '// COMMENTARY EXCEEDS 1000 CHARS';
      }
    }

    const isValid = agencyValid && titleValid && contentValid;

    if (submitBtn) {
      submitBtn.disabled = !isValid || this.isSubmitting;
      submitBtn.setAttribute('aria-disabled', !isValid || this.isSubmitting ? 'true' : 'false');
    }

    if (statusLabel) {
      if (isValid) {
        statusLabel.textContent = '// PARAMETERS VERIFIED • READY TO TRANSMIT';
        statusLabel.style.color = 'var(--accent-success)';
      } else {
        statusLabel.textContent = hint || '// AWAITING REQUIRED PARAMETERS';
        statusLabel.style.color = 'var(--text-mono)';
      }
    }

    return isValid;
  }

  hasUnsavedContent() {
    const el = this.rootEl;
    if (!el) return false;

    const titleInput = el.querySelector('#composer-title-input');
    const bodyInput = el.querySelector('#composer-body-input');
    const captionInput = el.querySelector('#composer-image-caption');
    const linkInput = el.querySelector('#composer-link-input');
    const commentaryInput = el.querySelector('#composer-link-commentary');

    const title = titleInput ? titleInput.value.trim() : '';
    const body = bodyInput ? bodyInput.value.trim() : '';
    const caption = captionInput ? captionInput.value.trim() : '';
    const link = linkInput ? linkInput.value.trim() : '';
    const commentary = commentaryInput ? commentaryInput.value.trim() : '';

    return (
      title.length > 0 ||
      body.length > 0 ||
      caption.length > 0 ||
      link.length > 0 ||
      commentary.length > 0 ||
      this.attachedFiles.length > 0
    );
  }

  async handleCloseAttempt() {
    if (this.hasUnsavedContent()) {
      let discardConfirmed = false;
      if (typeof UI !== 'undefined' && UI.confirm) {
        discardConfirmed = await UI.confirm({
          title: 'DISCARD DISPATCH?',
          message: 'You have unsaved dispatch telemetry in the composer. Are you sure you want to discard your draft?',
          confirmText: 'DISCARD',
          cancelText: 'KEEP EDITING',
          danger: true
        });
      } else {
        discardConfirmed = true;
      }

      if (!discardConfirmed) return;
    }

    this.close();
  }

  saveDraftDebounced() {
    clearTimeout(this._draftTimer);
    this._draftTimer = setTimeout(() => {
      this.saveDraft();
    }, 400);
  }

  saveDraft() {
    const el = this.rootEl;
    if (!el) return;

    const title = (el.querySelector('#composer-title-input')?.value || '').trim();
    const body = (el.querySelector('#composer-body-input')?.value || '').trim();
    const caption = (el.querySelector('#composer-image-caption')?.value || '').trim();
    const link = (el.querySelector('#composer-link-input')?.value || '').trim();
    const commentary = (el.querySelector('#composer-link-commentary')?.value || '').trim();
    const topic = el.querySelector('#composer-topic-select')?.value || 'Other';

    if (!title && !body && !caption && !link && !commentary && !this.selectedAgency) {
      return;
    }

    const draftData = {
      agency: this.selectedAgency,
      activeTab: this.activeTab,
      topic,
      title,
      body,
      caption,
      link,
      commentary,
      timestamp: Date.now()
    };

    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));
    } catch (e) {}
  }

  checkSavedDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft || (!draft.title && !draft.body && !draft.link && !draft.caption)) return;

      const banner = this.rootEl.querySelector('#composer-draft-banner');
      const timeLabel = this.rootEl.querySelector('#composer-draft-time-label');
      if (banner) {
        banner.style.display = 'flex';
        if (timeLabel && draft.timestamp) {
          timeLabel.textContent = `// UNSAVED DRAFT SAVED ${timeAgo(new Date(draft.timestamp).toISOString())}`;
        }
      }
    } catch (e) {}
  }

  restoreDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft) return;

      const el = this.rootEl;
      if (draft.agency && (!this.defaultAgency || this.defaultAgency === 'general')) {
        this.updateAgencyUI(draft.agency);
      }

      if (draft.topic) {
        const topicSelect = el.querySelector('#composer-topic-select');
        if (topicSelect) topicSelect.value = draft.topic;
      }

      if (draft.title) {
        const titleInput = el.querySelector('#composer-title-input');
        if (titleInput) titleInput.value = draft.title;
      }

      if (draft.body) {
        const bodyInput = el.querySelector('#composer-body-input');
        if (bodyInput) bodyInput.value = draft.body;
      }

      if (draft.caption) {
        const capInput = el.querySelector('#composer-image-caption');
        if (capInput) capInput.value = draft.caption;
      }

      if (draft.link) {
        const linkInput = el.querySelector('#composer-link-input');
        if (linkInput) linkInput.value = draft.link;
      }

      if (draft.commentary) {
        const commInput = el.querySelector('#composer-link-commentary');
        if (commInput) commInput.value = draft.commentary;
      }

      if (draft.activeTab) {
        this.switchTab(draft.activeTab);
      }

      // Update counters
      const titleCount = el.querySelector('#composer-title-count');
      const bodyCount = el.querySelector('#composer-body-count');
      if (titleCount && draft.title) titleCount.textContent = `${draft.title.length} / 120`;
      if (bodyCount && draft.body) bodyCount.textContent = `${draft.body.length} / 1000`;

      const banner = el.querySelector('#composer-draft-banner');
      if (banner) banner.style.display = 'none';

      this.validateForm();
      if (typeof UI !== 'undefined') UI.toast.info('Draft telemetry restored successfully.');
    } catch (e) {}
  }

  discardDraft() {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      const banner = this.rootEl.querySelector('#composer-draft-banner');
      if (banner) banner.style.display = 'none';
      if (typeof UI !== 'undefined') UI.toast.info('Draft discarded.');
    } catch (e) {}
  }

  trapFocus(e) {
    const el = this.rootEl;
    if (!el) return;
    const focusables = el.querySelectorAll('button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  }

  lockScroll() {
    this.savedScrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${this.savedScrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
  }

  unlockScroll() {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    window.scrollTo(0, this.savedScrollY);
  }

  open() {
    this.lastActiveElement = document.activeElement;
    const rendered = this.render();
    document.body.appendChild(rendered);

    if (this.isModal) {
      this.lockScroll();
      // Hide mobile FAB while composer is open
      const fab = document.getElementById('fab-create-post');
      if (fab) fab.style.display = 'none';

      // Move focus inside
      setTimeout(() => {
        const firstFocus = this.selectedAgency 
          ? rendered.querySelector('#composer-title-input') 
          : rendered.querySelector('#agency-picker-trigger');
        if (firstFocus) firstFocus.focus();
      }, 60);
    }
  }

  close() {
    if (!this.rootEl) return;
    const el = this.rootEl;

    if (this.isModal) {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.18s ease';
      setTimeout(() => {
        this.unlockScroll();
        el.remove();
        this.rootEl = null;

        // Restore mobile FAB
        const fab = document.getElementById('fab-create-post');
        if (fab) fab.style.display = '';

        if (this.lastActiveElement && this.lastActiveElement.focus) {
          this.lastActiveElement.focus();
        }

        if (this.onClose) this.onClose();
      }, 180);
    } else {
      el.remove();
      this.rootEl = null;
    }
  }

  async submit() {
    if (!this.validateForm() || this.isSubmitting) return;

    const el = this.rootEl;
    const titleInput = el.querySelector('#composer-title-input');
    const bodyInput = el.querySelector('#composer-body-input');
    const captionInput = el.querySelector('#composer-image-caption');
    const linkInput = el.querySelector('#composer-link-input');
    const commentaryInput = el.querySelector('#composer-link-commentary');
    const topicSelect = el.querySelector('#composer-topic-select');
    const submitBtn = el.querySelector('#composer-btn-submit');

    const title = titleInput.value.trim();
    let finalBody = '';

    if (this.activeTab === 'text') {
      finalBody = bodyInput ? bodyInput.value.trim() : '';
    } else if (this.activeTab === 'images') {
      finalBody = (captionInput ? captionInput.value.trim() : '') || 'Astrophotography telemetry observation.';
    } else if (this.activeTab === 'link') {
      const link = (linkInput ? linkInput.value.trim() : '');
      const comm = (commentaryInput ? commentaryInput.value.trim() : '');
      finalBody = comm ? `${comm}\n\nReference: ${link}` : `Reference Link: ${link}`;
    }

    const category = topicSelect ? topicSelect.value : 'Other';

    // Clear previous inline errors
    if (typeof UI !== 'undefined') {
      UI.clearFieldErrors(el.querySelector('#composer-core-form'));
    }

    const formData = new FormData();
    formData.append('agency_id', this.selectedAgency);
    formData.append('title', title);
    formData.append('body', finalBody);
    formData.append('category', category);

    // Primary image
    if (this.attachedFiles.length > 0) {
      formData.append('image', this.attachedFiles[0]);
    }

    this.isSubmitting = true;
    if (typeof UI !== 'undefined') {
      UI.setLoading(submitBtn, true, 'TRANSMITTING DISPATCH...');
    }

    try {
      const res = await API.upload('/api/posts', formData, { silent: false });

      // Success
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch (e) {}

      if (this.isModal) {
        this.close();
      }

      // Prepend to feed or trigger custom event
      const event = new CustomEvent('nova:post:created', { detail: { post: res.post }, cancelable: true });
      const wasPrevented = !document.dispatchEvent(event);

      if (!wasPrevented && typeof UI !== 'undefined' && UI.toast) {
        UI.toast.success('Observation dispatch broadcast to global planetary network!', 'DISPATCH BROADCAST');
      }

      if (this.onSuccess) {
        this.onSuccess(res.post);
      }

      if (!this.isModal) {
        // Standalone fallback: redirect to social feed
        window.location.href = `/social?sort=new#post-${res.post.id}`;
      }
    } catch (err) {
      // Failure keeps the modal open and data intact
      this.isSubmitting = false;
      if (typeof UI !== 'undefined') {
        UI.setLoading(submitBtn, false);
        const errMsg = err.message || 'Telemetry transmission anomaly';
        UI.toast.error(errMsg, 'TRANSMISSION FAILED');

        if (err.data && err.data.error) {
          if (err.data.error.field === 'title' || errMsg.toLowerCase().includes('title')) {
            UI.fieldError(titleInput, errMsg);
          } else if (err.data.error.field === 'agency_id' || errMsg.toLowerCase().includes('agency')) {
            UI.fieldError(el.querySelector('#custom-agency-picker'), errMsg);
          } else {
            UI.fieldError(bodyInput || titleInput, errMsg);
          }
        }
      }
    }
  }
}

/**
 * Public Composer Controller
 */
export const Composer = {
  activeInstance: null,

  openModal(options = {}) {
    if (this.activeInstance) {
      this.activeInstance.close();
    }
    this.activeInstance = new ComposerInstance({ ...options, isModal: true });
    this.activeInstance.open();
    return this.activeInstance;
  },

  renderStandalone(containerSelector, options = {}) {
    const container = typeof containerSelector === 'string' ? document.querySelector(containerSelector) : containerSelector;
    if (!container) return null;
    container.innerHTML = '';
    const instance = new ComposerInstance({ ...options, isModal: false, container });
    const rendered = instance.render();
    container.appendChild(rendered);
    return instance;
  }
};

/**
 * NOVA Sky Gallery & Cloud Storage Client (js/gallery.js)
 * Manages Observer authentication, astrophotography uploads,
 * curator moderation queue, and health telemetry polling.
 */
import { spaceAudio } from './audio.js';

export class GalleryApp {
  constructor() {
    this.currentUser = null;
    this.authModal = document.getElementById('auth-modal');
    this.authBtn = document.getElementById('hud-auth-btn');
    this.authLabel = document.getElementById('hud-auth-label');
    this.authCloseBtn = document.getElementById('auth-modal-close');
    this.loginForm = document.getElementById('auth-login-form');
    this.registerForm = document.getElementById('auth-register-form');
    this.tabLogin = document.getElementById('auth-tab-login');
    this.tabRegister = document.getElementById('auth-tab-register');
    this.feedbackBanner = document.getElementById('auth-feedback-banner');

    this.uploadContainer = document.getElementById('gallery-upload-container');
    this.curatorContainer = document.getElementById('curator-queue-container');
    this.curatorGrid = document.getElementById('curator-cards-grid');
    this.publicGrid = document.getElementById('public-gallery-grid');

    this.sysStatusDot = document.getElementById('sys-status-dot');
    this.sysStatusText = document.getElementById('sys-status-text');

    this.selectedFile = null;
  }

  async init() {
    this.bindAuthEvents();
    this.startHealthPolling();
    await this.checkAuthStatus();
    await this.loadGallery();
  }

  // ============================================================================
  // HEALTH MONITORING POLLING (Every 30s)
  // ============================================================================
  startHealthPolling() {
    this.pollHealth();
    setInterval(() => this.pollHealth(), 30000);
  }

  async pollHealth() {
    try {
      const res = await fetch('/health', { cache: 'no-store' });
      if (res.ok) {
        if (this.sysStatusDot) {
          this.sysStatusDot.style.color = '#5cc8ff';
          this.sysStatusDot.classList.remove('offline');
        }
        if (this.sysStatusText) {
          this.sysStatusText.textContent = 'SYS // ONLINE';
          this.sysStatusText.style.color = 'var(--text-pure)';
        }
      } else {
        throw new Error('Non-200 response');
      }
    } catch (_) {
      if (this.sysStatusDot) {
        this.sysStatusDot.style.color = '#ef4444';
        this.sysStatusDot.classList.add('offline');
      }
      if (this.sysStatusText) {
        this.sysStatusText.textContent = 'SYS // OFFLINE';
        this.sysStatusText.style.color = '#ef4444';
      }
    }
  }

  // ============================================================================
  // AUTHENTICATION LOGIC & MODAL HANDLING
  // ============================================================================
  bindAuthEvents() {
    // Open Auth Modal or User Profile
    if (this.authBtn) {
      this.authBtn.addEventListener('click', async () => {
        if (this.currentUser) {
          // Open profile modal for current user or prompt sign-out
          const nick = this.currentUser.nickname || this.currentUser.username;
          const choice = await UI.confirm({
            title: 'OBSERVER PROFILE',
            message: `Signed in as @${nick} [${this.currentUser.role.toUpperCase()}]. Open your Observer Dossier / Profile?`,
            confirmText: 'OPEN PROFILE',
            cancelText: 'SIGN OUT'
          });
          if (choice) {
            const profileModal = document.getElementById('user-profile-modal');
            if (profileModal) {
              profileModal.classList.add('active');
              // Trigger social app to populate
              const socialModule = window.novaSocialApp;
              if (socialModule && socialModule.openUserProfile) {
                socialModule.openUserProfile(nick);
              }
            }
          } else {
            await this.handleLogout();
          }
        } else {
          this.openAuthModal('login');
        }
        spaceAudio.playTelemetryClick();
      });
    }

    // Close Auth Modal
    if (this.authCloseBtn && this.authModal) {
      this.authCloseBtn.addEventListener('click', () => {
        this.closeAuthModal();
        spaceAudio.playTelemetryClick();
      });

      this.authModal.addEventListener('click', (e) => {
        if (e.target === this.authModal) {
          this.closeAuthModal();
        }
      });
    }

    // Switch Tabs
    if (this.tabLogin && this.tabRegister) {
      this.tabLogin.addEventListener('click', () => this.switchAuthTab('login'));
      this.tabRegister.addEventListener('click', () => this.switchAuthTab('register'));
    }

    // Login Form Submit
    if (this.loginForm) {
      this.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value.trim();
        await this.submitLogin(username, password);
      });
    }

    // Register Form Submit
    if (this.registerForm) {
      this.registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullnameEl = document.getElementById('register-fullname');
        const nicknameEl = document.getElementById('register-nickname') || document.getElementById('register-username');
        const emailEl = document.getElementById('register-email');
        const passEl = document.getElementById('register-password');
        const roleEl = document.getElementById('register-role');

        const fullname = fullnameEl ? fullnameEl.value.trim() : '';
        const nickname = nicknameEl ? nicknameEl.value.trim() : '';
        const email = emailEl ? emailEl.value.trim() : '';
        const password = passEl ? passEl.value.trim() : '';
        const role = roleEl ? roleEl.value : 'observer';

        await this.submitRegister(fullname, nickname, email, password, role);
      });
    }
  }

  openAuthModal(tab = 'login') {
    if (!this.authModal) return;
    this.clearFeedback();
    this.switchAuthTab(tab);
    this.authModal.classList.add('active');
  }

  closeAuthModal() {
    if (!this.authModal) return;
    this.authModal.classList.remove('active');
    this.clearFeedback();
  }

  switchAuthTab(tab) {
    if (tab === 'login') {
      this.tabLogin.classList.add('active');
      this.tabRegister.classList.remove('active');
      this.loginForm.style.display = 'block';
      this.registerForm.style.display = 'none';
    } else {
      this.tabRegister.classList.add('active');
      this.tabLogin.classList.remove('active');
      this.registerForm.style.display = 'block';
      this.loginForm.style.display = 'none';
    }
    this.clearFeedback();
  }

  showFeedback(message, isError = true) {
    if (!this.feedbackBanner) return;
    this.feedbackBanner.textContent = message;
    this.feedbackBanner.className = `auth-feedback-banner ${isError ? 'error' : 'success'}`;
    this.feedbackBanner.style.display = 'block';
  }

  clearFeedback() {
    if (this.feedbackBanner) {
      this.feedbackBanner.style.display = 'none';
      this.feedbackBanner.textContent = '';
    }
  }

  async checkAuthStatus() {
    try {
      const res = await fetch('/api/me');
      if (res.ok) {
        const data = await res.json();
        this.currentUser = data.user;
      } else {
        this.currentUser = null;
      }
    } catch (_) {
      this.currentUser = null;
    }
    this.updateUIForAuth();
    window.dispatchEvent(new CustomEvent('nova:auth:change', { detail: this.currentUser }));
  }

  async submitLogin(username, password) {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: username, password })
      });
      const data = await res.json();

      if (res.ok) {
        this.currentUser = data.user;
        this.updateUIForAuth();
        this.closeAuthModal();
        window.dispatchEvent(new CustomEvent('nova:auth:change', { detail: this.currentUser }));
        await this.loadGallery();
      } else {
        this.showFeedback(data.error || 'Authentication rejected');
      }
    } catch (err) {
      this.showFeedback('Connection failure with authentication service');
    }
  }

  async submitRegister(fullname, nickname, email, password, role) {
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fullname || nickname,
          nickname: nickname,
          username: nickname,
          email: email,
          password: password,
          role: role
        })
      });
      const data = await res.json();

      if (res.ok) {
        this.currentUser = data.user;
        this.updateUIForAuth();
        this.closeAuthModal();
        window.dispatchEvent(new CustomEvent('nova:auth:change', { detail: this.currentUser }));
        await this.loadGallery();
      } else {
        this.showFeedback(data.error || 'Registration rejected');
      }
    } catch (err) {
      this.showFeedback('Registration service unreachable');
    }
  }

  async handleLogout() {
    const nick = this.currentUser ? (this.currentUser.nickname || this.currentUser.username) : 'Observer';
    const confirmLogout = await UI.confirm({
      title: 'TERMINATE SESSION',
      message: `Signed in as @${nick}. Terminate active session?`,
      confirmText: 'TERMINATE',
      cancelText: 'CANCEL',
      danger: true
    });
    if (!confirmLogout) return;

    try {
      if (window.API) {
        await API.post('/api/logout', {});
      } else {
        await fetch('/api/logout', { method: 'POST' });
      }
      if (typeof UI !== 'undefined' && UI.toast) {
        UI.toast.info('Session terminated', 'LOGGED OUT');
      }
    } catch (_) {}

    this.currentUser = null;
    this.updateUIForAuth();
    window.dispatchEvent(new CustomEvent('nova:auth:change', { detail: null }));
    await this.loadGallery();
  }

  updateUIForAuth() {
    if (this.currentUser) {
      const displayNick = (this.currentUser.nickname || this.currentUser.username).toUpperCase();
      if (this.authLabel) {
        this.authLabel.textContent = `[OBSERVER // @${displayNick}]`;
      }
      if (this.authBtn) {
        this.authBtn.classList.add('active');
        this.authBtn.title = `Signed in as @${displayNick} (${this.currentUser.role}) — Click for options`;
      }
    } else {
      if (this.authLabel) {
        this.authLabel.textContent = '[AUTH // LOGIN]';
      }
      if (this.authBtn) {
        this.authBtn.classList.remove('active');
        this.authBtn.title = 'Observer Authentication & Access Portal';
      }
    }

    // Render upload form or login prompt
    this.renderUploadPanel();
  }

  // ============================================================================
  // UPLOAD PANEL (Form with image preview & cloud submission)
  // ============================================================================
  renderUploadPanel() {
    if (!this.uploadContainer) return;

    if (!this.currentUser) {
      this.uploadContainer.innerHTML = `
        <div class="gallery-auth-prompt-card">
          <div class="section-label">// TELEMETRY ACCESS RESTRICTED</div>
          <h3 class="section-title" style="font-size:22px; margin-bottom:8px">AUTHENTICATION REQUIRED</h3>
          <p class="section-subtitle" style="font-size:14px; margin-bottom:18px">
            Sign in as an Observer or Curator to submit high-resolution astrophotography to cloud storage.
          </p>
          <button class="btn-spacecraft-primary" id="gallery-prompt-login-btn">
            <span>SIGN IN TO UPLOAD</span>
            <span class="btn-telemetry-tag">AUTH →</span>
          </button>
        </div>
      `;

      const promptBtn = document.getElementById('gallery-prompt-login-btn');
      if (promptBtn) {
        promptBtn.addEventListener('click', () => this.openAuthModal('login'));
      }
      return;
    }

    // Authenticated user upload form
    this.uploadContainer.innerHTML = `
      <div class="gallery-form-card">
        <div class="form-header-row">
          <div>
            <div class="section-label">// CLOUD STORAGE INGESTION • AWS S3</div>
            <h3 class="section-title" style="font-size:22px">SUBMIT ASTROPHOTOGRAPHY</h3>
          </div>
          <span class="hud-pill-tag">CALLSIGN: ${this.currentUser.username.toUpperCase()} (${this.currentUser.role.toUpperCase()})</span>
        </div>

        <form id="astro-upload-form" class="astro-upload-form">
          <div class="upload-inputs-grid">
            <div class="form-field-group">
              <label class="form-field-label" for="upload-title">IMAGE TITLE</label>
              <input type="text" class="auth-text-input" id="upload-title" placeholder="e.g. Orion Molecular Core" required maxlength="80" />
            </div>

            <div class="form-field-group">
              <label class="form-field-label" for="upload-target">TARGET CELESTIAL OBJECT</label>
              <input type="text" class="auth-text-input" id="upload-target" placeholder="e.g. M42 / Messier 42" required maxlength="80" />
            </div>
          </div>

          <div class="upload-dropzone" id="upload-dropzone">
            <input type="file" id="upload-file-input" accept="image/jpeg,image/png,image/webp" style="display:none" />
            <div class="dropzone-content" id="dropzone-content">
              <span class="dropzone-icon">⬚</span>
              <span class="dropzone-main-text">SELECT OR DRAG ASTROPHOTOGRAPHY IMAGE</span>
              <span class="dropzone-sub-text">SUPPORTED: JPG, PNG, WEBP • MAX FILE SIZE: 5 MB</span>
            </div>
            <div class="dropzone-preview-container" id="dropzone-preview" style="display:none">
              <img id="preview-image" src="" alt="Upload Preview" class="preview-img-element" />
              <button type="button" class="preview-remove-btn" id="preview-remove-btn">REMOVE ✕</button>
            </div>
          </div>

          <div class="upload-status-banner" id="upload-status-banner" style="display:none"></div>

          <div class="upload-actions-row">
            <button type="submit" class="btn-spacecraft-primary" id="upload-submit-btn">
              <span>UPLOAD TO CLOUD</span>
              <span class="btn-telemetry-tag">S3 INGEST →</span>
            </button>
          </div>
        </form>
      </div>
    `;

    this.bindUploadFormEvents();
  }

  bindUploadFormEvents() {
    const fileInput = document.getElementById('upload-file-input');
    const dropzone = document.getElementById('upload-dropzone');
    const previewContainer = document.getElementById('dropzone-preview');
    const dropzoneContent = document.getElementById('dropzone-content');
    const previewImg = document.getElementById('preview-image');
    const removeBtn = document.getElementById('preview-remove-btn');
    const form = document.getElementById('astro-upload-form');
    const statusBanner = document.getElementById('upload-status-banner');
    const submitBtn = document.getElementById('upload-submit-btn');

    if (!fileInput || !dropzone || !form) return;

    dropzone.addEventListener('click', (e) => {
      if (e.target !== removeBtn) fileInput.click();
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        this.handleFileSelected(fileInput.files[0], previewImg, previewContainer, dropzoneContent);
      }
    });

    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedFile = null;
        fileInput.value = '';
        previewContainer.style.display = 'none';
        dropzoneContent.style.display = 'flex';
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('upload-title').value.trim();
      const targetObject = document.getElementById('upload-target').value.trim();

      if (!this.selectedFile) {
        this.showUploadStatus('Please select an image file to upload.', true);
        return;
      }

      const formData = new FormData();
      formData.append('title', title);
      formData.append('target_object', targetObject);
      formData.append('file', this.selectedFile);

      submitBtn.disabled = true;
      submitBtn.querySelector('span').textContent = 'UPLOADING TO S3...';
      this.showUploadStatus('Transmitting image payload to cloud storage...', false);

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });

        const data = await res.json();
        if (res.ok) {
          this.showUploadStatus('Upload successful! Submitted to curator queue for verification.', false);
          form.reset();
          this.selectedFile = null;
          previewContainer.style.display = 'none';
          dropzoneContent.style.display = 'flex';
          await this.loadGallery();
        } else {
          this.showUploadStatus(data.error || 'Upload was rejected by server.', true);
        }
      } catch (err) {
        this.showUploadStatus('Network error occurred during file transmission.', true);
      } finally {
        submitBtn.disabled = false;
        submitBtn.querySelector('span').textContent = 'UPLOAD TO CLOUD';
      }
    });
  }

  handleFileSelected(file, previewImg, previewContainer, dropzoneContent) {
    if (file.size > 5 * 1024 * 1024) {
      this.showUploadStatus('File exceeds maximum allowable size of 5 MB.', true);
      return;
    }
    this.selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      previewContainer.style.display = 'block';
      dropzoneContent.style.display = 'none';
      this.showUploadStatus(`Selected file: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`, false);
    };
    reader.readAsDataURL(file);
  }

  showUploadStatus(message, isError = false) {
    const statusBanner = document.getElementById('upload-status-banner');
    if (!statusBanner) return;
    statusBanner.textContent = message;
    statusBanner.className = `upload-status-banner ${isError ? 'error' : 'success'}`;
    statusBanner.style.display = 'block';
  }

  // ============================================================================
  // GALLERY & CURATOR QUEUE RENDERING
  // ============================================================================
  async loadGallery() {
    await this.loadPublicGallery();

    // If user is a curator, load pending queue
    if (this.currentUser && this.currentUser.role === 'curator') {
      await this.loadCuratorQueue();
    } else if (this.curatorContainer) {
      this.curatorContainer.style.display = 'none';
    }

    // If user is an observer, show their pending uploads as well
    if (this.currentUser && this.currentUser.role === 'observer') {
      await this.loadMyPendingUploads();
    }
  }

  async loadPublicGallery() {
    if (!this.publicGrid) return;
    try {
      const res = await fetch('/api/gallery');
      const data = await res.json();
      const gallery = data.gallery || [];

      if (gallery.length === 0) {
        this.publicGrid.innerHTML = `
          <div class="gallery-empty-placeholder">
            <span class="empty-icon">⬡</span>
            <div class="empty-title">PUBLIC ARCHIVE CURRENTLY EMPTY</div>
            <div class="empty-subtitle">Be the first observer to submit verified astrophotography.</div>
          </div>
        `;
        return;
      }

      this.publicGrid.innerHTML = '';
      gallery.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'gallery-photo-card';
        card.innerHTML = `
          <div class="photo-img-wrapper">
            <img src="${item.url}" alt="${item.title}" loading="lazy" class="gallery-photo-img" />
            <span class="photo-target-tag">${item.target_object.toUpperCase()}</span>
          </div>
          <div class="photo-meta-body">
            <h4 class="photo-title">${item.title}</h4>
            <div class="photo-author-row">
              <span class="author-label">OBSERVER:</span>
              <span class="author-name">${item.username}</span>
            </div>
            <div class="photo-date-row">
              <span class="date-label">TIMESTAMP:</span>
              <span class="date-val">${new Date(item.created_at).toLocaleDateString()}</span>
            </div>
            ${this.currentUser && this.currentUser.role === 'curator' ? `
              <div class="curator-action-row" style="margin-top:10px">
                <button class="btn-curator-delete" data-id="${item.id}">[DELETE ENTRY]</button>
              </div>
            ` : ''}
          </div>
        `;

        if (this.currentUser && this.currentUser.role === 'curator') {
          const deleteBtn = card.querySelector('.btn-curator-delete');
          if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.deleteUpload(item.id, item.title));
          }
        }

        this.publicGrid.appendChild(card);
      });
    } catch (e) {
      this.publicGrid.innerHTML = `
        <div class="gallery-empty-placeholder error">
          <div class="empty-title">FAILED TO RETRIEVE GALLERY ARCHIVE</div>
          <div class="empty-subtitle">Check backend service connection.</div>
        </div>
      `;
    }
  }

  async loadMyPendingUploads() {
    try {
      const res = await fetch('/api/my-uploads');
      const data = await res.json();
      const myUploads = data.uploads || [];
      const pendingItems = myUploads.filter(u => u.status === 'pending');

      if (pendingItems.length === 0) return;

      // Prepend pending cards with badge to public grid
      pendingItems.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'gallery-photo-card user-pending-card';
        card.innerHTML = `
          <div class="photo-img-wrapper">
            <img src="${item.url}" alt="${item.title}" class="gallery-photo-img" />
            <span class="photo-status-badge pending">[STATUS // PENDING CURATION]</span>
          </div>
          <div class="photo-meta-body">
            <h4 class="photo-title">${item.title}</h4>
            <div class="photo-author-row">
              <span class="author-label">TARGET:</span>
              <span class="author-name">${item.target_object}</span>
            </div>
            <div class="photo-date-row">
              <span class="date-label">UPLOADED:</span>
              <span class="date-val">${new Date(item.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        `;
        this.publicGrid.prepend(card);
      });
    } catch (_) {}
  }

  async loadCuratorQueue() {
    if (!this.curatorContainer || !this.curatorGrid) return;
    try {
      const res = await fetch('/api/pending');
      const data = await res.json();
      const pending = data.pending || [];

      if (pending.length === 0) {
        this.curatorContainer.style.display = 'block';
        this.curatorGrid.innerHTML = `
          <div class="gallery-empty-placeholder" style="grid-column: 1 / -1; padding:20px">
            <div class="empty-title">CURATOR QUEUE EMPTY</div>
            <div class="empty-subtitle">All observer uploads have been reviewed.</div>
          </div>
        `;
        return;
      }

      this.curatorContainer.style.display = 'block';
      this.curatorGrid.innerHTML = '';

      pending.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'gallery-photo-card curator-pending-card';
        card.innerHTML = `
          <div class="photo-img-wrapper">
            <img src="${item.url}" alt="${item.title}" class="gallery-photo-img" />
            <span class="photo-status-badge pending">[PENDING REVIEW]</span>
          </div>
          <div class="photo-meta-body">
            <h4 class="photo-title">${item.title}</h4>
            <div class="photo-author-row">
              <span class="author-label">OBSERVER:</span>
              <span class="author-name">${item.username}</span>
            </div>
            <div class="photo-author-row">
              <span class="author-label">TARGET:</span>
              <span class="author-name">${item.target_object}</span>
            </div>
            <div class="curator-action-row">
              <button class="btn-curator-approve" data-id="${item.id}">[APPROVE]</button>
              <button class="btn-curator-delete" data-id="${item.id}">[DELETE]</button>
            </div>
          </div>
        `;

        const approveBtn = card.querySelector('.btn-curator-approve');
        const deleteBtn = card.querySelector('.btn-curator-delete');

        approveBtn.addEventListener('click', () => this.approveUpload(item.id, item.title));
        deleteBtn.addEventListener('click', () => this.deleteUpload(item.id, item.title));

        this.curatorGrid.appendChild(card);
      });
    } catch (_) {}
  }

  async approveUpload(id, title) {
    try {
      if (window.API) {
        await API.post(`/api/approve/${id}`);
      } else {
        const res = await fetch(`/api/approve/${id}`, { method: 'POST' });
        if (!res.ok) throw new Error(`Approval failed with status ${res.status}`);
      }
      await this.loadGallery();
      if (typeof spaceAudio !== 'undefined') spaceAudio.playTelemetryClick();
      if (typeof UI !== 'undefined' && UI.toast) {
        UI.toast.success(`Upload #${id} approved successfully`, 'UPLOAD APPROVED');
      }
    } catch (err) {
      if (typeof UI !== 'undefined' && UI.toast) {
        UI.toast.error(err.message || `Failed to approve upload #${id}`, 'APPROVAL ERROR');
      }
    }
  }

  async deleteUpload(id, title) {
    const confirmDelete = await UI.confirm({
      title: 'PURGE RECORD',
      message: `Permanently delete "${title}" (#${id}) from database and cloud storage?`,
      confirmText: 'PURGE',
      cancelText: 'CANCEL',
      danger: true
    });
    if (!confirmDelete) return;

    try {
      if (window.API) {
        await API.delete(`/api/upload/${id}`);
      } else {
        const res = await fetch(`/api/upload/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`Deletion failed with status ${res.status}`);
      }
      await this.loadGallery();
      if (typeof spaceAudio !== 'undefined') spaceAudio.playTelemetryClick();
      if (typeof UI !== 'undefined' && UI.toast) {
        UI.toast.success(`Record #${id} purged successfully`, 'PURGE COMPLETE');
      }
    } catch (err) {
      if (typeof UI !== 'undefined' && UI.toast) {
        UI.toast.error(err.message || `Failed to delete upload #${id}`, 'PURGE FAILED');
      }
    }
  }
}

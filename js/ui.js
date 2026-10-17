/**
 * NOVA Space Observatory — Themed Notification & UI System (js/ui.js)
 * Production-grade toasts, confirm/prompt modals, field errors,
 * top progress bar, button loading states, and network telemetry HUD.
 * Strict compliance: 2px corners, monospace labels, no emoji, full a11y.
 */

// Global state
let activeToasts = [];
let toastQueue = [];
const MAX_VISIBLE_TOASTS = 4;
let globalProgressVal = 0;
let globalProgressTimer = null;

// Ensure Toast Container exists
function getOrCreateToastContainer() {
  let container = document.getElementById('nova-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'nova-toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', 'System notifications');
    document.body.appendChild(container);
  }
  return container;
}

// Global escape key listener for dismissing modals or top toast
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // 1. If an active modal exists, modal handles it
    const activeModal = document.querySelector('.nova-ui-modal-backdrop');
    if (activeModal) {
      const cancelBtn = activeModal.querySelector('.nova-ui-btn-cancel');
      if (cancelBtn) cancelBtn.click();
      return;
    }
    // 2. Otherwise dismiss top toast
    if (activeToasts.length > 0) {
      activeToasts[activeToasts.length - 1].dismiss();
    }
  }
});

class ToastInstance {
  constructor({ message, title = '', type = 'info', duration = null, action = null }) {
    this.message = message || '';
    this.title = title;
    this.type = type;
    this.duration = duration || (type === 'error' ? 6000 : 4000);
    this.action = action; // { text: '[VIEW]', onClick: (toast) => {} }
    this.element = null;
    this.timer = null;
    this.remaining = this.duration;
    this.startTime = null;
    this.isPaused = false;
  }

  render() {
    const glyphMap = {
      success: '[ OK ]',
      error: '[ ERR ]',
      warning: '[ WARN ]',
      info: '[ INFO ]'
    };

    const defaultTitleMap = {
      success: 'TRANSMISSION SUCCESS',
      error: 'TELEMETRY ANOMALY',
      warning: 'SYSTEM CAUTION',
      info: 'OBSERVATORY STATUS'
    };

    const glyph = glyphMap[this.type] || '[ INFO ]';
    const displayTitle = this.title || defaultTitleMap[this.type] || 'NOTIFICATION';

    const el = document.createElement('div');
    el.className = `nova-toast ${this.type}`;
    el.setAttribute('role', this.type === 'error' ? 'alert' : 'status');
    el.setAttribute('aria-live', this.type === 'error' ? 'assertive' : 'polite');

    el.innerHTML = `
      <div class="nova-toast-inner">
        <span class="nova-toast-glyph-badge">${glyph}</span>
        <div class="nova-toast-content">
          <div class="nova-toast-title">${escapeHtml(displayTitle)}</div>
          <div class="nova-toast-message">${escapeHtml(this.message)}</div>
        </div>
        ${this.action ? `
          <button type="button" class="btn-tech btn-tech-primary nova-toast-action-btn" style="padding: 3px 8px; font-size: 10px; margin-right: 6px; white-space: nowrap;">
            ${escapeHtml(this.action.text || '[VIEW]')}
          </button>
        ` : ''}
        <button type="button" class="nova-toast-close" aria-label="Dismiss notification">✕</button>
      </div>
      <div class="nova-toast-progress-track">
        <div class="nova-toast-progress-bar"></div>
      </div>
    `;

    // Action button
    if (this.action && this.action.onClick) {
      const actBtn = el.querySelector('.nova-toast-action-btn');
      if (actBtn) {
        actBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.action.onClick(this);
          this.dismiss();
        });
      }
    }

    // Close button
    el.querySelector('.nova-toast-close').addEventListener('click', () => {
      this.dismiss();
    });

    // Pause on hover
    el.addEventListener('mouseenter', () => this.pause());
    el.addEventListener('mouseleave', () => this.resume());

    this.element = el;
    this.progressBar = el.querySelector('.nova-toast-progress-bar');
    return el;
  }

  show(container) {
    container.appendChild(this.render());
    this.startTimer();
  }

  startTimer() {
    this.startTime = Date.now();
    this.updateProgressAnimation(this.remaining);

    this.timer = setTimeout(() => {
      this.dismiss();
    }, this.remaining);
  }

  updateProgressAnimation(timeMs) {
    if (this.progressBar) {
      this.progressBar.style.transition = `transform ${timeMs}ms linear`;
      // Allow DOM repaint before collapsing scale
      requestAnimationFrame(() => {
        this.progressBar.style.transform = 'scaleX(0)';
      });
    }
  }

  pause() {
    if (this.isPaused) return;
    this.isPaused = true;
    clearTimeout(this.timer);
    this.remaining -= (Date.now() - this.startTime);
    if (this.remaining < 0) this.remaining = 0;
    if (this.progressBar) {
      const computedStyle = window.getComputedStyle(this.progressBar);
      this.progressBar.style.transform = computedStyle.transform;
      this.progressBar.style.transition = 'none';
    }
  }

  resume() {
    if (!this.isPaused || this.remaining <= 0) return;
    this.isPaused = false;
    this.startTimer();
  }

  dismiss() {
    clearTimeout(this.timer);
    if (!this.element) return;

    this.element.style.opacity = '0';
    this.element.style.transform = 'translateY(-10px) scale(0.95)';
    this.element.style.pointerEvents = 'none';

    setTimeout(() => {
      if (this.element && this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
      activeToasts = activeToasts.filter(t => t !== this);
      drainToastQueue();
    }, 250);
  }
}

function processToast(toast) {
  const container = getOrCreateToastContainer();
  if (activeToasts.length < MAX_VISIBLE_TOASTS) {
    activeToasts.push(toast);
    toast.show(container);
  } else {
    toastQueue.push(toast);
  }
}

function drainToastQueue() {
  if (toastQueue.length > 0 && activeToasts.length < MAX_VISIBLE_TOASTS) {
    const nextToast = toastQueue.shift();
    processToast(nextToast);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ==============================================================================
   PUBLIC UI MODULE
   ============================================================================== */
const UI = {
  toast: {
    success(message, title = '', options = {}) {
      const opts = typeof title === 'object' ? title : options;
      const tStr = typeof title === 'string' ? title : '';
      const toast = new ToastInstance({ message, title: tStr, type: 'success', ...opts });
      processToast(toast);
      return toast;
    },
    error(message, title = '', options = {}) {
      const opts = typeof title === 'object' ? title : options;
      const tStr = typeof title === 'string' ? title : '';
      const toast = new ToastInstance({ message, title: tStr, type: 'error', ...opts });
      processToast(toast);
      return toast;
    },
    warn(message, title = '', options = {}) {
      const opts = typeof title === 'object' ? title : options;
      const tStr = typeof title === 'string' ? title : '';
      const toast = new ToastInstance({ message, title: tStr, type: 'warning', ...opts });
      processToast(toast);
      return toast;
    },
    info(message, title = '', options = {}) {
      const opts = typeof title === 'object' ? title : options;
      const tStr = typeof title === 'string' ? title : '';
      const toast = new ToastInstance({ message, title: tStr, type: 'info', ...opts });
      processToast(toast);
      return toast;
    },
    action(message, actionText, onClick, title = '', type = 'info', options = {}) {
      const toast = new ToastInstance({
        message,
        title,
        type,
        action: { text: actionText, onClick },
        ...options
      });
      processToast(toast);
      return toast;
    }
  },

  /**
   * Themed Confirm Modal returning Promise<boolean>
   * Replaces native window.confirm()
   */
  confirm({
    title = 'CONFIRM ACTION',
    message = 'Are you sure you want to proceed with this operation?',
    confirmText = '[CONFIRM]',
    cancelText = '[CANCEL]',
    danger = false
  } = {}) {
    return new Promise((resolve) => {
      // Remove any existing modals
      document.querySelectorAll('.nova-ui-modal-backdrop').forEach(m => m.remove());

      const backdrop = document.createElement('div');
      backdrop.className = 'nova-ui-modal-backdrop';
      backdrop.setAttribute('role', 'dialog');
      backdrop.setAttribute('aria-modal', 'true');
      backdrop.setAttribute('aria-labelledby', 'nova-modal-title');

      backdrop.innerHTML = `
        <div class="nova-ui-modal-window" tabindex="-1">
          <div class="nova-ui-modal-header">
            <span class="nova-ui-modal-tag ${danger ? 'danger' : ''}">// ${danger ? 'SECURITY PROTOCOL • DESTRUCTIVE' : 'STATION PROTOCOL'}</span>
          </div>
          <h2 class="nova-ui-modal-title" id="nova-modal-title">${escapeHtml(title)}</h2>
          <div class="nova-ui-modal-body">${escapeHtml(message)}</div>
          <div class="nova-ui-modal-actions">
            <button type="button" class="nova-ui-btn nova-ui-btn-cancel">${escapeHtml(cancelText)}</button>
            <button type="button" class="nova-ui-btn ${danger ? 'nova-ui-btn-danger' : 'nova-ui-btn-confirm'}">${escapeHtml(confirmText)}</button>
          </div>
        </div>
      `;

      document.body.appendChild(backdrop);

      const cancelBtn = backdrop.querySelector('.nova-ui-btn-cancel');
      const confirmBtn = backdrop.querySelector('.nova-ui-btn-confirm, .nova-ui-btn-danger');

      // Focus management: initial focus on Cancel for safety on destructive actions
      if (danger) {
        cancelBtn.focus();
      } else {
        confirmBtn.focus();
      }

      function cleanUp(result) {
        backdrop.style.opacity = '0';
        backdrop.style.transition = 'opacity 0.18s ease';
        setTimeout(() => backdrop.remove(), 200);
        resolve(result);
      }

      cancelBtn.addEventListener('click', () => cleanUp(false));
      confirmBtn.addEventListener('click', () => cleanUp(true));

      // Click outside modal
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) cleanUp(false);
      });

      // Trap focus inside modal
      backdrop.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          const focusables = [cancelBtn, confirmBtn];
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
      });
    });
  },

  /**
   * Themed Prompt Modal returning Promise<string | null>
   * Replaces native window.prompt()
   */
  prompt({
    title = 'INPUT REQUIRED',
    message = 'Please specify parameters for this operation:',
    placeholder = 'Enter value...',
    defaultValue = '',
    confirmText = '[SUBMIT]',
    cancelText = '[CANCEL]'
  } = {}) {
    return new Promise((resolve) => {
      document.querySelectorAll('.nova-ui-modal-backdrop').forEach(m => m.remove());

      const backdrop = document.createElement('div');
      backdrop.className = 'nova-ui-modal-backdrop';
      backdrop.setAttribute('role', 'dialog');
      backdrop.setAttribute('aria-modal', 'true');

      backdrop.innerHTML = `
        <div class="nova-ui-modal-window" tabindex="-1">
          <div class="nova-ui-modal-header">
            <span class="nova-ui-modal-tag">// TELEMETRY PROMPT</span>
          </div>
          <h2 class="nova-ui-modal-title">${escapeHtml(title)}</h2>
          <div class="nova-ui-modal-body">${escapeHtml(message)}</div>
          <input type="text" class="nova-ui-modal-input" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(defaultValue)}" />
          <div class="nova-ui-modal-actions">
            <button type="button" class="nova-ui-btn nova-ui-btn-cancel">${escapeHtml(cancelText)}</button>
            <button type="button" class="nova-ui-btn nova-ui-btn-confirm">${escapeHtml(confirmText)}</button>
          </div>
        </div>
      `;

      document.body.appendChild(backdrop);

      const input = backdrop.querySelector('.nova-ui-modal-input');
      const cancelBtn = backdrop.querySelector('.nova-ui-btn-cancel');
      const confirmBtn = backdrop.querySelector('.nova-ui-btn-confirm');

      input.focus();
      input.select();

      function cleanUp(val) {
        backdrop.style.opacity = '0';
        backdrop.style.transition = 'opacity 0.18s ease';
        setTimeout(() => backdrop.remove(), 200);
        resolve(val);
      }

      cancelBtn.addEventListener('click', () => cleanUp(null));
      confirmBtn.addEventListener('click', () => cleanUp(input.value));

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          cleanUp(input.value);
        }
      });

      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) cleanUp(null);
      });
    });
  },

  /**
   * Inline field error indicators
   */
  fieldError(inputTarget, message) {
    const input = typeof inputTarget === 'string' ? document.querySelector(inputTarget) : inputTarget;
    if (!input) return;

    input.classList.add('has-field-error');

    // Remove existing error msg element
    let existingMsg = input.parentNode.querySelector('.nova-field-error-msg');
    if (existingMsg) existingMsg.remove();

    const msgEl = document.createElement('div');
    msgEl.className = 'nova-field-error-msg';
    msgEl.textContent = `// ERROR: ${message}`;
    input.parentNode.appendChild(msgEl);

    // Auto clear error when input changes
    const onInput = () => {
      input.classList.remove('has-field-error');
      msgEl.remove();
      input.removeEventListener('input', onInput);
    };
    input.addEventListener('input', onInput);
  },

  clearFieldErrors(formTarget) {
    const form = typeof formTarget === 'string' ? document.querySelector(formTarget) : formTarget;
    if (!form) return;
    form.querySelectorAll('.has-field-error').forEach(el => el.classList.remove('has-field-error'));
    form.querySelectorAll('.nova-field-error-msg').forEach(el => el.remove());
    form.querySelectorAll('.nova-form-banner').forEach(el => el.remove());
  },

  formBanner(formTarget, message, type = 'error') {
    const form = typeof formTarget === 'string' ? document.querySelector(formTarget) : formTarget;
    if (!form) return;

    let banner = form.querySelector('.nova-form-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.className = `nova-form-banner ${type}`;
      form.insertBefore(banner, form.firstChild);
    } else {
      banner.className = `nova-form-banner ${type}`;
    }
    banner.textContent = `// ${message}`;
  },

  /**
   * Button loading spinner helper
   */
  setLoading(btnTarget, isLoading, loadingText = 'TRANSMITTING...') {
    const btn = typeof btnTarget === 'string' ? document.querySelector(btnTarget) : btnTarget;
    if (!btn) return;

    if (isLoading) {
      btn.dataset.originalHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="btn-spinner"></span> <span>${escapeHtml(loadingText)}</span>`;
    } else {
      if (btn.dataset.originalHtml) {
        btn.innerHTML = btn.dataset.originalHtml;
      }
      btn.disabled = false;
    }
  },

  /**
   * Skeleton loaders for cards or lists
   */
  showSkeleton(containerTarget, count = 3) {
    const container = typeof containerTarget === 'string' ? document.querySelector(containerTarget) : containerTarget;
    if (!container) return;

    let skeletons = '';
    for (let i = 0; i < count; i++) {
      skeletons += `
        <div class="hairline-card" style="padding: 24px; margin-bottom: 16px;">
          <div class="nova-skeleton" style="height: 18px; width: 45%; margin-bottom: 12px;"></div>
          <div class="nova-skeleton" style="height: 14px; width: 85%; margin-bottom: 8px;"></div>
          <div class="nova-skeleton" style="height: 14px; width: 65%;"></div>
        </div>
      `;
    }
    container.innerHTML = skeletons;
  },

  skeleton(containerTarget, count = 3) {
    return this.showSkeleton(containerTarget, count);
  },

  /**
   * Top global progress bar
   */
  progress: {
    start() {
      let bar = document.getElementById('nova-global-progress');
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'nova-global-progress';
        document.body.appendChild(bar);
      }
      bar.style.opacity = '1';
      globalProgressVal = 20;
      bar.style.width = '20%';

      clearInterval(globalProgressTimer);
      globalProgressTimer = setInterval(() => {
        if (globalProgressVal < 85) {
          globalProgressVal += Math.random() * 12;
          bar.style.width = `${globalProgressVal}%`;
        }
      }, 200);
    },
    done() {
      const bar = document.getElementById('nova-global-progress');
      if (!bar) return;
      clearInterval(globalProgressTimer);
      bar.style.width = '100%';
      setTimeout(() => {
        bar.style.opacity = '0';
        setTimeout(() => {
          bar.style.width = '0%';
        }, 300);
      }, 200);
    }
  },

  /**
   * Network connection telemetry listener
   */
  setupNetworkMonitoring() {
    let banner = document.getElementById('nova-network-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'nova-network-banner';
      document.body.appendChild(banner);
    }

    const showBanner = (status, text) => {
      banner.className = `show ${status}`;
      banner.textContent = `[ ${text} ]`;
      if (status === 'online') {
        setTimeout(() => {
          banner.classList.remove('show');
        }, 3500);
      }
    };

    window.addEventListener('offline', () => {
      showBanner('offline', 'CONNECTION LOST // TELEMETRY OFFLINE');
    });

    window.addEventListener('online', () => {
      showBanner('online', 'CONNECTION RESTORED // TELEMETRY SYNCED');
    });
  }
};

// Auto-initialize network banner on load
if (typeof window !== 'undefined') {
  window.UI = UI;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => UI.setupNetworkMonitoring());
  } else {
    UI.setupNetworkMonitoring();
  }
}

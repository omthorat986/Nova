/**
 * NOVA Space Observatory — Canonical Image Editor & Crop Modal (js/image-modal.js)
 * Strict 2px corners, 1px hairline borders, monospace typography, zero emoji.
 * Canvas-based client cropping (1:1 square or 3:1 banner), zoom, pan repositioning,
 * drag-and-drop file ingestion, upload progress, CSRF protection, and error handling.
 */

function getCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  if (meta && meta.content) return meta.content;
  try {
    const fromSession = sessionStorage.getItem('nova_csrf');
    if (fromSession) return fromSession;
  } catch (e) {}
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function openImageEditor(options = {}) {
  const type = options.type || 'avatar'; // 'avatar' | 'banner' | 'agency_logo' | 'agency_banner'
  const isBanner = type === 'banner' || type === 'agency_banner';
  const isAgency = type === 'agency_logo' || type === 'agency_banner';
  const slug = options.slug || '';

  const maxSizeBytes = isBanner ? (5 * 1024 * 1024) : (3 * 1024 * 1024);
  const maxSizeLabel = isBanner ? '5 MB' : '3 MB';
  const targetAspect = isBanner ? 3 : 1; // 3:1 for banner, 1:1 for avatar

  let uploadUrl = options.uploadUrl;
  let deleteUrl = options.deleteUrl;
  let fieldName = options.fieldName;
  let defaultTitle = '';
  let defaultNotice = '';

  if (type === 'avatar') {
    uploadUrl = uploadUrl || '/api/me/avatar';
    deleteUrl = deleteUrl || '/api/me/avatar';
    fieldName = fieldName || 'avatar';
    defaultTitle = '// OBSERVER STATION • PROFILE PHOTO';
    defaultNotice = 'Your photo is public. Stripped of all EXIF/GPS telemetry before deployment.';
  } else if (type === 'banner') {
    uploadUrl = uploadUrl || '/api/me/banner';
    deleteUrl = deleteUrl || '/api/me/banner';
    fieldName = fieldName || 'banner';
    defaultTitle = '// OBSERVER STATION • PROFILE BANNER (3:1)';
    defaultNotice = 'Your photo is public. Cropped to 3:1 panoramic telemetry ratio.';
  } else if (type === 'agency_logo') {
    uploadUrl = uploadUrl || `/api/agencies/${encodeURIComponent(slug)}/logo`;
    deleteUrl = deleteUrl || `/api/agencies/${encodeURIComponent(slug)}/logo`;
    fieldName = fieldName || 'logo';
    defaultTitle = `// AGENCY LOGO • ${escapeHTML(slug.toUpperCase())}`;
    defaultNotice = 'Logo is the property of the respective agency. NOVA is not affiliated.';
  } else if (type === 'agency_banner') {
    uploadUrl = uploadUrl || `/api/agencies/${encodeURIComponent(slug)}/banner`;
    deleteUrl = deleteUrl || `/api/agencies/${encodeURIComponent(slug)}/banner`;
    fieldName = fieldName || 'banner';
    defaultTitle = `// AGENCY BANNER (3:1) • ${escapeHTML(slug.toUpperCase())}`;
    defaultNotice = 'Banner is the property of the respective agency. NOVA is not affiliated.';
  }

  const modalTitle = options.title || defaultTitle;
  const modalNotice = options.notice || defaultNotice;
  const allowRemove = Boolean(options.allowRemove);

  // Close any existing modal
  const existing = document.getElementById('nova-crop-modal');
  if (existing) existing.remove();

  // Modal Container
  const backdrop = document.createElement('div');
  backdrop.className = 'nova-crop-backdrop';
  backdrop.id = 'nova-crop-modal';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-label', modalTitle);

  backdrop.innerHTML = `
    <div class="nova-crop-window" id="crop-window">
      <div class="nova-crop-header">
        <div>
          <span class="mono-label" style="color:var(--accent-cyan); font-size:10px;">[ TELEMETRY ASSET UPLOADER ]</span>
          <div class="nova-crop-title">${escapeHTML(modalTitle)}</div>
        </div>
        <button type="button" class="nova-crop-close-btn" id="crop-btn-close" aria-label="Close modal">[ ✕ ESC ]</button>
      </div>

      <!-- STEP 1: DROPZONE -->
      <div id="crop-stage-select">
        <div class="nova-crop-dropzone" id="crop-dropzone">
          <div class="nova-crop-dropzone-icon">[ ^ ]</div>
          <div class="nova-crop-dropzone-text">DRAG & DROP IMAGE HERE OR CLICK TO BROWSE</div>
          <div class="nova-crop-dropzone-hint">ACCEPTED: WEBP, PNG, JPG (MAX ${maxSizeLabel}) • STRICTLY NO GIF/SVG</div>
          <input type="file" id="crop-file-input" accept="image/jpeg,image/png,image/webp" style="display:none;" />
        </div>
      </div>

      <!-- STEP 2: CANVAS EDITOR -->
      <div id="crop-stage-edit" style="display:none;">
        <div class="nova-crop-viewport ${isBanner ? 'banner' : 'square'}" id="crop-viewport">
          <canvas class="nova-crop-canvas" id="crop-canvas"></canvas>
          <div class="nova-crop-frame-guide"></div>
        </div>

        <div class="nova-crop-slider-row">
          <span>ZOOM:</span>
          <span>1x</span>
          <input type="range" class="nova-crop-slider" id="crop-zoom-slider" min="1" max="3" step="0.01" value="1" />
          <span>3x</span>
        </div>
      </div>

      <div class="nova-crop-notice" id="crop-notice">${escapeHTML(modalNotice)}</div>

      <div class="nova-crop-progress-bar" id="crop-progress-bar">
        <div class="nova-crop-progress-fill" id="crop-progress-fill"></div>
      </div>

      <div class="nova-crop-actions">
        <div class="nova-crop-actions-left">
          ${allowRemove ? `
            <button type="button" class="btn-tech btn-tech-danger" id="crop-btn-remove" style="padding:6px 12px; font-size:11px;">
              [ REMOVE ]
            </button>
          ` : ''}
          <button type="button" class="btn-tech btn-tech-secondary" id="crop-btn-reselect" style="display:none; padding:6px 12px; font-size:11px;">
            [ CHOOSE DIFFERENT ]
          </button>
        </div>
        <div class="nova-crop-actions-right">
          <button type="button" class="btn-tech btn-tech-secondary" id="crop-btn-cancel" style="padding:6px 14px; font-size:11px;">
            [ CANCEL ]
          </button>
          <button type="button" class="btn-tech btn-tech-primary" id="crop-btn-save" style="display:none; padding:6px 18px; font-size:11px;">
            [ SAVE IMAGE ]
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  // References
  const stageSelect = backdrop.querySelector('#crop-stage-select');
  const stageEdit = backdrop.querySelector('#crop-stage-edit');
  const dropzone = backdrop.querySelector('#crop-dropzone');
  const fileInput = backdrop.querySelector('#crop-file-input');
  const viewport = backdrop.querySelector('#crop-viewport');
  const canvas = backdrop.querySelector('#crop-canvas');
  const zoomSlider = backdrop.querySelector('#crop-zoom-slider');
  const progressBar = backdrop.querySelector('#crop-progress-bar');
  const progressFill = backdrop.querySelector('#crop-progress-fill');
  const btnClose = backdrop.querySelector('#crop-btn-close');
  const btnCancel = backdrop.querySelector('#crop-btn-cancel');
  const btnSave = backdrop.querySelector('#crop-btn-save');
  const btnReselect = backdrop.querySelector('#crop-btn-reselect');
  const btnRemove = backdrop.querySelector('#crop-btn-remove');
  const cropNotice = backdrop.querySelector('#crop-notice');

  let currentImage = null;
  let imgWidth = 0;
  let imgHeight = 0;
  let baseScale = 1;
  let currentZoom = 1;
  let panX = 0;
  let panY = 0;
  let isDragging = false;
  let startDragX = 0;
  let startDragY = 0;
  let startPanX = 0;
  let startPanY = 0;
  let isSending = false;

  // Cleanup helper
  function closeModal() {
    document.removeEventListener('keydown', handleKeydown);
    backdrop.remove();
  }

  function handleKeydown(e) {
    if (e.key === 'Escape' && !isSending) {
      closeModal();
    }
  }
  document.addEventListener('keydown', handleKeydown);

  btnClose.addEventListener('click', () => { if (!isSending) closeModal(); });
  btnCancel.addEventListener('click', () => { if (!isSending) closeModal(); });
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop && !isSending) closeModal();
  });

  // Dropzone file trigger
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  });

  // Drag and drop handlers
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
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  btnReselect.addEventListener('click', () => {
    fileInput.value = '';
    stageEdit.style.display = 'none';
    stageSelect.style.display = 'block';
    btnSave.style.display = 'none';
    btnReselect.style.display = 'none';
  });

  // Handle selected file validation & load
  function handleFileSelected(file) {
    if (!file) return;

    // Reject non-allowed types
    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
    const ext = file.name.split('.').pop().toLowerCase();
    const validExts = ['jpg', 'jpeg', 'png', 'webp'];

    if (!validMimes.includes(file.type) || !validExts.includes(ext)) {
      showError('Invalid image format. Allowed formats: WebP, PNG, JPEG. SVG and GIF are strictly prohibited.');
      return;
    }

    if (file.size > maxSizeBytes) {
      showError(`File exceeds maximum size of ${maxSizeLabel} (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Enforce max pixel dimensions
        if (img.width > 6000 || img.height > 6000) {
          showError('Image dimensions exceed 6000px limit (decompression guard).');
          return;
        }

        currentImage = img;
        imgWidth = img.width;
        imgHeight = img.height;

        // Switch to editor stage
        stageSelect.style.display = 'none';
        stageEdit.style.display = 'block';
        btnSave.style.display = 'inline-flex';
        btnReselect.style.display = 'inline-flex';

        initCanvasAndCrop();
      };
      img.onerror = () => {
        showError('Corrupted or unreadable image file.');
      };
      img.src = e.target.result;
    };
    reader.onerror = () => {
      showError('Failed reading selected file from disk.');
    };
    reader.readAsDataURL(file);
  }

  function showError(msg) {
    if (typeof window.showToast === 'function') {
      window.showToast(msg, 'error');
    } else if (typeof window.UI !== 'undefined' && window.UI.toast) {
      window.UI.toast.error(msg);
    }
    cropNotice.textContent = `// ERROR: ${msg}`;
    cropNotice.style.borderLeftColor = '#ef4444';
    cropNotice.style.color = '#fca5a5';
  }

  function initCanvasAndCrop() {
    const vWidth = viewport.clientWidth || (isBanner ? 480 : 280);
    const vHeight = viewport.clientHeight || (isBanner ? 160 : 280);

    canvas.width = vWidth;
    canvas.height = vHeight;

    // Calculate baseScale so the image covers the viewport
    const scaleX = vWidth / imgWidth;
    const scaleY = vHeight / imgHeight;
    baseScale = Math.max(scaleX, scaleY);
    currentZoom = 1;
    zoomSlider.value = 1;

    // Center image
    panX = (vWidth - imgWidth * baseScale) / 2;
    panY = (vHeight - imgHeight * baseScale) / 2;

    clampAndDraw();
  }

  function clampAndDraw() {
    if (!currentImage) return;

    const vWidth = canvas.width;
    const vHeight = canvas.height;
    const totalScale = baseScale * currentZoom;
    const drawnW = imgWidth * totalScale;
    const drawnH = imgHeight * totalScale;

    // Clamp pan so crop viewport is always filled
    if (drawnW >= vWidth) {
      panX = Math.min(0, Math.max(vWidth - drawnW, panX));
    } else {
      panX = (vWidth - drawnW) / 2;
    }

    if (drawnH >= vHeight) {
      panY = Math.min(0, Math.max(vHeight - drawnH, panY));
    } else {
      panY = (vHeight - drawnH) / 2;
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, vWidth, vHeight);
    ctx.drawImage(currentImage, panX, panY, drawnW, drawnH);
  }

  // Zoom Slider
  zoomSlider.addEventListener('input', () => {
    const newZoom = parseFloat(zoomSlider.value);
    const vWidth = canvas.width;
    const vHeight = canvas.height;

    // Zoom centered on viewport center
    const prevScale = baseScale * currentZoom;
    const nextScale = baseScale * newZoom;

    const centerX = vWidth / 2;
    const centerY = vHeight / 2;

    const imgCoordX = (centerX - panX) / prevScale;
    const imgCoordY = (centerY - panY) / prevScale;

    panX = centerX - imgCoordX * nextScale;
    panY = centerY - imgCoordY * nextScale;

    currentZoom = newZoom;
    clampAndDraw();
  });

  // Mouse / Touch Drag Repositioning
  function onPointerDown(clientX, clientY) {
    isDragging = true;
    startDragX = clientX;
    startDragY = clientY;
    startPanX = panX;
    startPanY = panY;
  }

  function onPointerMove(clientX, clientY) {
    if (!isDragging) return;
    const dx = clientX - startDragX;
    const dy = clientY - startDragY;
    panX = startPanX + dx;
    panY = startPanY + dy;
    clampAndDraw();
  }

  function onPointerUp() {
    isDragging = false;
  }

  viewport.addEventListener('mousedown', (e) => onPointerDown(e.clientX, e.clientY));
  window.addEventListener('mousemove', (e) => onPointerMove(e.clientX, e.clientY));
  window.addEventListener('mouseup', onPointerUp);

  viewport.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1) {
      onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });

  window.addEventListener('touchend', onPointerUp);

  // Wheel zoom
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    const next = Math.max(1, Math.min(3, currentZoom + delta));
    zoomSlider.value = next;
    zoomSlider.dispatchEvent(new Event('input'));
  }, { passive: false });

  // SAVE: Render crop to target canvas and upload
  btnSave.addEventListener('click', async () => {
    if (isSending || !currentImage) return;
    isSending = true;

    btnSave.disabled = true;
    btnCancel.disabled = true;
    btnClose.disabled = true;
    if (btnRemove) btnRemove.disabled = true;
    btnSave.textContent = '[ TRANSMITTING... ]';

    progressBar.style.display = 'block';
    progressFill.style.width = '10%';

    try {
      // Calculate cropped sub-rectangle in image natural coordinates
      const totalScale = baseScale * currentZoom;
      const cropX = -panX / totalScale;
      const cropY = -panY / totalScale;
      const cropW = canvas.width / totalScale;
      const cropH = canvas.height / totalScale;

      // Render onto high-res output canvas
      const outCanvas = document.createElement('canvas');
      const outW = isBanner ? 1500 : 512;
      const outH = isBanner ? 500 : 512;
      outCanvas.width = outW;
      outCanvas.height = outH;

      const ctx = outCanvas.getContext('2d');
      ctx.drawImage(currentImage, cropX, cropY, cropW, cropH, 0, 0, outW, outH);

      // Convert to blob
      const blob = await new Promise((resolve) => {
        outCanvas.toBlob(resolve, 'image/webp', 0.92);
      }) || await new Promise((resolve) => {
        outCanvas.toBlob(resolve, 'image/jpeg', 0.92);
      });

      if (!blob) throw new Error('Canvas rendering telemetry fault.');

      progressFill.style.width = '35%';

      const formData = new FormData();
      const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
      formData.append(fieldName, blob, `crop_${Date.now()}.${ext}`);

      // XHR upload with progress
      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl, true);
      xhr.setRequestHeader('X-CSRF-Token', getCsrfToken());

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          const pct = Math.round((evt.loaded / evt.total) * 60) + 35;
          progressFill.style.width = `${Math.min(95, pct)}%`;
        }
      };

      xhr.onload = () => {
        progressFill.style.width = '100%';
        let resJson = {};
        try { resJson = JSON.parse(xhr.responseText); } catch (e) {}

        if (xhr.status >= 200 && xhr.status < 300) {
          showSuccessToast('Image telemetry processed and deployed.');
          if (typeof options.onSuccess === 'function') {
            options.onSuccess(resJson);
          }
          setTimeout(() => closeModal(), 300);
        } else {
          isSending = false;
          btnSave.disabled = false;
          btnCancel.disabled = false;
          btnClose.disabled = false;
          if (btnRemove) btnRemove.disabled = false;
          btnSave.textContent = '[ SAVE IMAGE ]';
          progressBar.style.display = 'none';

          if (xhr.status === 429) {
            const retry = xhr.getResponseHeader('Retry-After') || '60';
            showError(`Rate limit reached (5 uploads/hr). Retry in ${retry} seconds.`);
          } else {
            showError(resJson.error || resJson.message || `Upload rejected (${xhr.status})`);
          }
        }
      };

      xhr.onerror = () => {
        isSending = false;
        btnSave.disabled = false;
        btnCancel.disabled = false;
        btnClose.disabled = false;
        if (btnRemove) btnRemove.disabled = false;
        btnSave.textContent = '[ SAVE IMAGE ]';
        progressBar.style.display = 'none';
        showError('Network disconnection during transmission.');
      };

      xhr.send(formData);
    } catch (err) {
      isSending = false;
      btnSave.disabled = false;
      btnCancel.disabled = false;
      btnClose.disabled = false;
      if (btnRemove) btnRemove.disabled = false;
      btnSave.textContent = '[ SAVE IMAGE ]';
      progressBar.style.display = 'none';
      showError(err.message || 'Image processing failed');
    }
  });

  // REMOVE button handler
  if (btnRemove) {
    btnRemove.addEventListener('click', async () => {
      if (isSending || !deleteUrl) return;
      const ok = typeof window.UI !== 'undefined' && window.UI.confirm
        ? await window.UI.confirm({
            title: 'REMOVE IMAGE ASSET',
            message: 'Are you sure you want to remove this image and reset to the default?',
            confirmText: '[REMOVE]',
            cancelText: '[CANCEL]',
            danger: true
          })
        : true;
      if (!ok) return;

      isSending = true;
      btnRemove.disabled = true;
      btnSave.disabled = true;
      btnCancel.disabled = true;
      btnRemove.textContent = '[ REMOVING... ]';

      try {
        const res = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
            'X-CSRF-Token': getCsrfToken()
          }
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          showSuccessToast('Image asset removed successfully.');
          if (typeof options.onRemove === 'function') {
            options.onRemove(data);
          }
          closeModal();
        } else {
          isSending = false;
          btnRemove.disabled = false;
          btnSave.disabled = false;
          btnCancel.disabled = false;
          btnRemove.textContent = '[ REMOVE ]';
          showError(data.error || data.message || 'Failed removing image');
        }
      } catch (err) {
        isSending = false;
        btnRemove.disabled = false;
        btnSave.disabled = false;
        btnCancel.disabled = false;
        btnRemove.textContent = '[ REMOVE ]';
        showError(err.message);
      }
    });
  }

  function showSuccessToast(msg) {
    if (typeof window.showToast === 'function') {
      window.showToast(msg, 'success');
    } else if (typeof window.UI !== 'undefined' && window.UI.toast) {
      window.UI.toast.success(msg);
    }
  }
}

if (typeof window !== 'undefined') {
  window.openImageEditor = openImageEditor;
}

export default { openImageEditor };

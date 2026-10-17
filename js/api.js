/**
 * NOVA Space Observatory — Unified API Client (js/api.js)
 * Wraps all HTTP network requests with:
 * - Credentials & CSRF header injection
 * - 15s timeout with AbortController
 * - 1 automatic retry on GET requests for transient network errors
 * - Global progress bar telemetry
 * - Standardized status mapping to themed UI toasts
 * - Sanitized user-facing error formatting (zero raw stack traces or JSON)
 */

(function () {
  'use strict';

  let activeRequestsCount = 0;

  function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    if (meta && meta.content) {
      return meta.content;
    }
    // Fallback: look for meta[name="csrf"] or input[name="csrf_token"]
    const input = document.querySelector('input[name="csrf_token"]');
    if (input && input.value) {
      return input.value;
    }
    return '';
  }

  function startGlobalProgress() {
    if (typeof UI !== 'undefined' && UI.progress) {
      activeRequestsCount++;
      if (activeRequestsCount === 1) {
        UI.progress.start();
      }
    }
  }

  function endGlobalProgress() {
    if (typeof UI !== 'undefined' && UI.progress) {
      activeRequestsCount = Math.max(0, activeRequestsCount - 1);
      if (activeRequestsCount === 0) {
        UI.progress.done();
      }
    }
  }

  class APIError extends Error {
    constructor({ message, status, code, requestId, details, raw }) {
      super(message);
      this.name = 'APIError';
      this.status = status;
      this.code = code || 'API_ERROR';
      this.requestId = requestId || null;
      this.details = details || null;
      this.raw = raw;
    }
  }

  async function requestWithTimeout(url, options, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timer);
      return response;
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        const timeoutErr = new Error('Request timed out after 15s');
        timeoutErr.isTimeout = true;
        throw timeoutErr;
      }
      throw err;
    }
  }

  async function apiFetch(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const headers = new Headers(options.headers || {});

    // Ensure CSRF token header for mutations
    const csrfToken = getCsrfToken();
    if (csrfToken && !headers.has('X-CSRF-Token')) {
      headers.set('X-CSRF-Token', csrfToken);
    }

    // Default JSON headers if not FormData
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    if (!isFormData && !headers.has('Content-Type') && options.body && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json, text/plain, */*');
    }

    const fetchOptions = {
      ...options,
      method,
      headers,
      credentials: options.credentials || 'same-origin'
    };

    const silent = Boolean(options.silent);
    const retryCount = (method === 'GET' && options.retry !== false) ? 1 : 0;

    startGlobalProgress();

    let response = null;
    let attempt = 0;
    let lastNetworkError = null;

    while (attempt <= retryCount) {
      try {
        attempt++;
        response = await requestWithTimeout(url, fetchOptions, options.timeout || 15000);
        // If GET returned 502/503/504 and we have retries left, wait briefly and retry
        if (method === 'GET' && attempt <= retryCount && [502, 503, 504].includes(response.status)) {
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }
        break;
      } catch (err) {
        lastNetworkError = err;
        if (method === 'GET' && attempt <= retryCount) {
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }
        break;
      }
    }

    endGlobalProgress();

    // Handle Network / Timeout Failures
    if (!response) {
      const isTimeout = lastNetworkError && lastNetworkError.isTimeout;
      const displayMsg = isTimeout
        ? 'Request timed out. Telemetry link did not respond within 15 seconds.'
        : 'Cannot reach server. Telemetry link degraded or network offline.';

      if (!silent && typeof UI !== 'undefined' && UI.toast) {
        UI.toast.error(displayMsg, isTimeout ? 'TIMEOUT ERROR' : 'NETWORK FAILURE');
      }

      throw new APIError({
        message: displayMsg,
        status: 0,
        code: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
        raw: lastNetworkError
      });
    }

    // Capture X-Request-ID header
    const requestId = response.headers.get('X-Request-ID') || null;
    const retryAfter = response.headers.get('Retry-After');

    // Parse JSON or text body
    let data = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (e) {
        data = null;
      }
    } else {
      try {
        data = await response.text();
      } catch (e) {
        data = null;
      }
    }

    // Success response
    if (response.ok) {
      return data;
    }

    // Standard error normalization: extract code and message
    let errorCode = 'SERVER_ERROR';
    let errorMessage = 'An unexpected observatory error occurred.';
    let errorDetails = null;

    if (data && typeof data === 'object') {
      if (data.error && typeof data.error === 'object') {
        errorCode = data.error.code || errorCode;
        errorMessage = data.error.message || errorMessage;
        errorDetails = data.error.details || null;
      } else if (data.error && typeof data.error === 'string') {
        errorMessage = data.error;
      } else if (data.message && typeof data.message === 'string') {
        errorMessage = data.message;
      }
    } else if (typeof data === 'string' && data.length < 200 && !data.includes('<!DOCTYPE')) {
      errorMessage = data;
    }

    // Map status codes to specific user toasts if not silenced
    if (!silent && typeof UI !== 'undefined' && UI.toast) {
      switch (response.status) {
        case 401:
          UI.toast.error(errorMessage || 'Session expired or authentication required.', 'SESSION EXPIRED');
          // If not already on auth page, redirect after brief moment
          if (!window.location.pathname.includes('/auth') && !window.location.pathname.includes('/login')) {
            setTimeout(() => {
              const currentPath = encodeURIComponent(window.location.pathname + window.location.search);
              window.location.href = `/auth?mode=login&next=${currentPath}`;
            }, 1200);
          }
          break;

        case 403:
          UI.toast.error(errorMessage || 'Not allowed. Access to this subsystem is restricted.', 'NOT ALLOWED');
          break;

        case 404:
          UI.toast.error(errorMessage || 'Requested entity or telemetry record not found.', 'NOT FOUND');
          break;

        case 413:
          UI.toast.error(errorMessage || 'Payload or file too large. Exceeds upload buffer.', 'FILE TOO LARGE');
          break;

        case 422:
          UI.toast.warning(errorMessage || 'Validation error in submitted parameters.', 'VALIDATION ERROR');
          // If field-level errors exist and a form is bound, callers or auto-matcher can highlight
          if (errorDetails && typeof errorDetails === 'object' && options.form) {
            UI.clearFieldErrors(options.form);
            for (const [fName, fMsg] of Object.entries(errorDetails)) {
              const fieldEl = options.form.querySelector(`[name="${fName}"]`);
              if (fieldEl) UI.fieldError(fieldEl, fMsg);
            }
          }
          break;

        case 429: {
          const waitSecs = retryAfter ? `${retryAfter}s` : 'a few moments';
          const rateMsg = errorMessage && errorMessage.includes('Too many')
            ? errorMessage
            : `Too many requests, try again in ${waitSecs}.`;
          UI.toast.warning(rateMsg, 'RATE LIMITED');
          break;
        }

        default:
          if (response.status >= 500) {
            const refMsg = requestId ? `Server error (ref: ${requestId})` : 'Server error encountered during processing';
            UI.toast.error(refMsg, 'SERVER ERROR');
          } else {
            UI.toast.error(errorMessage, `ERROR ${response.status}`);
          }
          break;
      }
    }

    throw new APIError({
      message: errorMessage,
      status: response.status,
      code: errorCode,
      requestId: requestId || (data && data.error && data.error.request_id),
      details: errorDetails,
      raw: data
    });
  }

  // Convenience helper wrappers
  window.API = {
    fetch: apiFetch,

    get(url, options = {}) {
      return apiFetch(url, { ...options, method: 'GET' });
    },

    post(url, body = {}, options = {}) {
      const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
      return apiFetch(url, {
        ...options,
        method: 'POST',
        body: isFormData ? body : JSON.stringify(body)
      });
    },

    put(url, body = {}, options = {}) {
      const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
      return apiFetch(url, {
        ...options,
        method: 'PUT',
        body: isFormData ? body : JSON.stringify(body)
      });
    },

    patch(url, body = {}, options = {}) {
      const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
      return apiFetch(url, {
        ...options,
        method: 'PATCH',
        body: isFormData ? body : JSON.stringify(body)
      });
    },

    delete(url, body = null, options = {}) {
      const opts = { ...options, method: 'DELETE' };
      if (body) {
        opts.body = typeof body === 'string' ? body : JSON.stringify(body);
      }
      return apiFetch(url, opts);
    },

    upload(url, formData, options = {}) {
      return apiFetch(url, {
        ...options,
        method: 'POST',
        body: formData
      });
    }
  };
})();

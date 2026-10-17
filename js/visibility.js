/**
 * NOVA Space Exploration - Viewport Visibility & Performance Manager (js/visibility.js)
 * Robust, fault-tolerant performance optimizations:
 * 1. Tracks canvas visibility via IntersectionObserver with generous 250px pre-warm margin.
 * 2. Skips WebGL draw calls when off-screen to keep 60-120fps scrolling smooth.
 * 3. Pauses WebGL draw calls when browser tab is hidden.
 * 4. Optimizes DPR (clamped to 1.5 on mobile/touch, 2.0 on desktop).
 * 5. Smart touch orchestration: allows vertical page scroll without capturing.
 */

/**
 * Computes optimal DPR for high-DPI displays without GPU thermal throttling on mobile.
 */
export function getOptimalPixelRatio() {
  const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window && window.innerWidth <= 1024);
  const maxDpr = isMobile ? 1.5 : 2.0;
  return Math.min(window.devicePixelRatio || 1, maxDpr);
}

/**
 * Creates an IntersectionObserver-based lifecycle watcher for a 3D canvas container.
 * Returns an object with isVisible() method that is always safe to call.
 */
export function createVisibilityObserver(element, { rootMargin = '250px 0px' } = {}) {
  let isIntersecting = true;

  if (element && typeof window !== 'undefined' && 'IntersectionObserver' in window) {
    try {
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          isIntersecting = entry.isIntersecting;
        }
      }, { rootMargin });

      observer.observe(element);
    } catch (_) {
      isIntersecting = true;
    }
  }

  return {
    isVisible: () => isIntersecting && !document.hidden
  };
}

/**
 * Attaches smart touch drag listener that allows native vertical page scrolling
 * while capturing intentional horizontal/diagonal gestures for 3D camera/mesh rotation.
 * Accepts either an options object or a direct onDrag function.
 */
export function attachSmartTouchControls(domElement, handlers) {
  if (!domElement || !handlers) return;

  const onDrag = typeof handlers === 'function' ? handlers : handlers.onDrag;
  const onDragStart = typeof handlers === 'object' ? handlers.onDragStart : null;
  const onDragEnd = typeof handlers === 'object' ? handlers.onDragEnd : null;

  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  let intent = null; // null | 'scroll' | 'rotate'
  let isTouching = false;

  domElement.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isTouching = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      lastX = startX;
      lastY = startY;
      intent = null;
    } else {
      isTouching = false;
      intent = null;
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (!isTouching || e.touches.length !== 1) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const totalDx = currentX - startX;
    const totalDy = currentY - startY;

    // Detect user intent once initial 8px deadzone is crossed
    if (intent === null) {
      if (Math.hypot(totalDx, totalDy) > 8) {
        // If vertical movement is dominant, user is trying to scroll the page
        if (Math.abs(totalDy) > Math.abs(totalDx) * 1.15) {
          intent = 'scroll';
        } else {
          intent = 'rotate';
          if (onDragStart) onDragStart();
        }
      }
    }

    // Only apply rotation if intent was determined to be 3D exploration
    if (intent === 'rotate') {
      const deltaX = currentX - lastX;
      const deltaY = currentY - lastY;
      if (onDrag) onDrag(deltaX, deltaY);
      lastX = currentX;
      lastY = currentY;
    }
  }, { passive: true });

  window.addEventListener('touchend', () => {
    if (isTouching) {
      if (intent === 'rotate' && onDragEnd) {
        onDragEnd();
      }
      isTouching = false;
      intent = null;
    }
  }, { passive: true });
}

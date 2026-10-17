/**
 * NOVA Space Exploration - Custom Precision Reticle Cursor
 * Sci-fi spacecraft HUD cursor with targeting ring expansion and ripple dynamics.
 */
export function initCustomCursor() {
  // Disable on mobile/touch devices
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    return;
  }

  const dot = document.createElement('div');
  dot.className = 'nova-cursor-dot';
  const ring = document.createElement('div');
  ring.className = 'nova-cursor-ring';

  document.body.appendChild(dot);
  document.body.appendChild(ring);

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let ringX = mouseX;
  let ringY = mouseY;

  let isLoopRunning = false;

  function startCursorLoop() {
    if (!isLoopRunning) {
      isLoopRunning = true;
      requestAnimationFrame(renderCursor);
    }
  }

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    dot.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
    startCursorLoop();
  }, { passive: true });

  // Smooth lerp animation loop for trailing outer targeting ring (sleeps when mouse stops)
  function renderCursor() {
    const dx = mouseX - ringX;
    const dy = mouseY - ringY;

    if (Math.abs(dx) < 0.12 && Math.abs(dy) < 0.12) {
      ringX = mouseX;
      ringY = mouseY;
      ring.style.transform = `translate(${ringX}px, ${ringY}px)`;
      isLoopRunning = false;
      return; // Sleep until next mouse movement
    }

    ringX += dx * 0.22;
    ringY += dy * 0.22;
    ring.style.transform = `translate(${ringX}px, ${ringY}px)`;
    requestAnimationFrame(renderCursor);
  }
  startCursorLoop();

  // Click ripple
  window.addEventListener('mousedown', (e) => {
    ring.classList.add('cursor-clicked');
    createRipple(e.clientX, e.clientY);
  });
  window.addEventListener('mouseup', () => {
    ring.classList.remove('cursor-clicked');
  });

  function createRipple(x, y) {
    const ripple = document.createElement('div');
    ripple.className = 'nova-cursor-ripple';
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    document.body.appendChild(ripple);
    setTimeout(() => {
      ripple.remove();
    }, 600);
  }

  // Interactive element hover detection
  const interactiveSelectors = 'a, button, input, [role="button"], .planet-nav-item, .scale-step-item, .wavelength-btn, .clickable';
  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest(interactiveSelectors);
    if (target) {
      ring.classList.add('cursor-hover');
    }
  });

  document.addEventListener('mouseout', (e) => {
    const target = e.target.closest(interactiveSelectors);
    if (target) {
      ring.classList.remove('cursor-hover');
    }
  });
}

/**
 * NOVA Space Exploration - Deep Space Quiet Void & Cosmological Data Hub
 * Animates oversized numerical statistics upon viewport intersection.
 */
export class DataHub {
  constructor() {
    this.countersAnimated = false;
    this.section = document.getElementById('deep-space-section');
    this.init();
  }

  init() {
    if (!this.section) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !this.countersAnimated) {
          this.animateCounters();
          this.countersAnimated = true;
        }
      });
    }, { threshold: 0.3 });

    observer.observe(this.section);
  }

  animateCounters() {
    const counterElements = document.querySelectorAll('.counter-animated-val');
    counterElements.forEach((el) => {
      const targetVal = parseFloat(el.dataset.target);
      const isFloat = el.dataset.decimals ? parseInt(el.dataset.decimals) : 0;
      const duration = 2000;
      const startTime = performance.now();

      const update = (now) => {
        const progress = Math.min((now - startTime) / duration, 1.0);
        // Ease out cubic
        const ease = 1 - Math.pow(1 - progress, 3);
        const currentVal = (targetVal * ease).toFixed(isFloat);

        el.textContent = currentVal;

        if (progress < 1.0) {
          requestAnimationFrame(update);
        } else {
          el.textContent = targetVal.toFixed(isFloat);
        }
      };

      requestAnimationFrame(update);
    });
  }
}

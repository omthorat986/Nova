/**
 * NOVA Space Exploration - Powers of Ten Scale Explorer
 * Interactive cosmological scale zoom stepping from 1 meter to 93 billion light-years.
 */
import { SCALE_STEPS } from '../data/scale.js';
import { spaceAudio } from './audio.js';

export class ScaleExplorer {
  constructor() {
    this.currentStepIndex = 0;
    this.slider = document.getElementById('scale-slider');
    this.cardsContainer = document.getElementById('scale-cards-container');
    this.visualCircle = document.getElementById('scale-visual-circle');
    this.exponentDisplay = document.getElementById('scale-exponent-badge');
    this.titleDisplay = document.getElementById('scale-title-text');
    this.unitDisplay = document.getElementById('scale-unit-text');
    this.descDisplay = document.getElementById('scale-desc-text');
    this.prevBtn = document.getElementById('scale-prev-btn');
    this.nextBtn = document.getElementById('scale-next-btn');

    this.init();
  }

  init() {
    if (!this.slider) return;

    // Render interactive step navigation ticks
    this.renderStepTicks();

    // Event listeners
    this.slider.addEventListener('input', (e) => {
      this.goToStep(parseInt(e.target.value, 10));
    });

    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', () => {
        if (this.currentStepIndex > 0) {
          this.goToStep(this.currentStepIndex - 1);
        }
      });
    }

    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', () => {
        if (this.currentStepIndex < SCALE_STEPS.length - 1) {
          this.goToStep(this.currentStepIndex + 1);
        }
      });
    }

    // Initialize with first step
    this.goToStep(0, false);
  }

  renderStepTicks() {
    const ticksContainer = document.getElementById('scale-ticks-bar');
    if (!ticksContainer) return;

    ticksContainer.innerHTML = '';
    SCALE_STEPS.forEach((step, idx) => {
      const tick = document.createElement('button');
      tick.className = `scale-tick-btn ${idx === 0 ? 'active' : ''}`;
      tick.setAttribute('aria-label', step.label);
      tick.title = `${step.label} (${step.exponent})`;
      tick.innerHTML = `
        <span class="tick-dot"></span>
        <span class="tick-label">${step.exponent}</span>
      `;
      tick.addEventListener('click', () => {
        this.goToStep(idx);
      });
      ticksContainer.appendChild(tick);
    });
  }

  goToStep(index, playAudio = true) {
    if (index < 0 || index >= SCALE_STEPS.length) return;
    this.currentStepIndex = index;
    const step = SCALE_STEPS[index];

    if (playAudio) {
      spaceAudio.playTelemetryClick();
    }

    // Update slider value
    if (this.slider) {
      this.slider.value = index;
    }

    // Update ticks UI
    const allTicks = document.querySelectorAll('.scale-tick-btn');
    allTicks.forEach((t, i) => {
      t.classList.toggle('active', i === index);
    });

    // Update displays with smooth animations
    if (this.exponentDisplay) {
      this.exponentDisplay.textContent = step.exponent;
      this.exponentDisplay.style.color = step.accent;
    }
    if (this.titleDisplay) {
      this.titleDisplay.textContent = step.title;
    }
    if (this.unitDisplay) {
      this.unitDisplay.textContent = step.unitStr;
    }
    if (this.descDisplay) {
      this.descDisplay.textContent = step.description;
    }

    // Update visual circle pulse and scale
    if (this.visualCircle) {
      const scaleFactor = 0.5 + (index / (SCALE_STEPS.length - 1)) * 0.9;
      this.visualCircle.style.transform = `scale(${scaleFactor})`;
      this.visualCircle.style.borderColor = step.accent;
      this.visualCircle.style.boxShadow = `0 0 30px ${step.accent}33, inset 0 0 20px ${step.accent}22`;
      
      const iconSpan = this.visualCircle.querySelector('.scale-center-icon');
      if (iconSpan) {
        iconSpan.textContent = step.icon;
      }
    }

    // Button states
    if (this.prevBtn) this.prevBtn.disabled = (index === 0);
    if (this.nextBtn) this.nextBtn.disabled = (index === SCALE_STEPS.length - 1);
  }
}

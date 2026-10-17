/**
 * NOVA Space Exploration - Cinematic Loading & Genesis Intro Sequence
 * Begins in deep pitch black, ignites a solitary distant star genesis point,
 * expands into a multi-depth star field, and progresses into the Earth orbital approach.
 */
import { spaceAudio } from './audio.js';

export class CinematicIntro {
  constructor(onComplete) {
    this.onComplete = onComplete;
    this.overlay = document.getElementById('cinematic-intro-overlay');
    this.genesisStar = document.getElementById('intro-genesis-star');
    this.progressFill = document.getElementById('intro-progress-fill');
    this.progressStatus = document.getElementById('intro-status-text');
    this.percentText = document.getElementById('intro-percent-text');
    this.skipBtn = document.getElementById('intro-skip-btn');
    this.isCompleted = false;
  }

  start() {
    // Check if user already completed intro this session
    const hasVisited = sessionStorage.getItem('nova_intro_seen');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (hasVisited || prefersReducedMotion) {
      if (this.overlay) {
        this.overlay.remove();
      }
      if (this.onComplete) this.onComplete();
      return;
    }

    // Skip button listener
    if (this.skipBtn) {
      this.skipBtn.addEventListener('click', () => {
        this.finish(true);
      });
    }

    // Genesis star animation
    setTimeout(() => {
      if (this.genesisStar) {
        this.genesisStar.classList.add('genesis-active');
      }
    }, 200);

    // Progress line animation (0% -> 100% over ~1.8 seconds)
    const startTime = performance.now();
    const duration = 1800;

    const statusPhases = [
      { at: 0.1, text: 'SCANNING CELESTIAL COORDINATES' },
      { at: 0.4, text: 'ESTABLISHING ORBITAL TELEMETRY' },
      { at: 0.7, text: 'INITIALIZING DEEP SPACE' },
      { at: 0.95, text: 'ORBIT INSERTION CONFIRMED' }
    ];

    const updateProgress = (currentTime) => {
      if (this.isCompleted) return;

      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1.0);
      const percent = Math.floor(progress * 100);

      if (this.progressFill) {
        this.progressFill.style.width = `${percent}%`;
      }
      if (this.percentText) {
        this.percentText.textContent = `${percent}%`;
      }

      // Update status phase text
      const currentPhase = statusPhases.slice().reverse().find(p => progress >= p.at);
      if (currentPhase && this.progressStatus) {
        this.progressStatus.textContent = currentPhase.text;
      }

      if (progress < 1.0) {
        requestAnimationFrame(updateProgress);
      } else {
        setTimeout(() => this.finish(false), 300);
      }
    };

    requestAnimationFrame(updateProgress);
  }

  finish(wasSkipped = false) {
    if (this.isCompleted) return;
    this.isCompleted = true;
    sessionStorage.setItem('nova_intro_seen', 'true');

    if (this.overlay) {
      this.overlay.classList.add('intro-fade-out');
      this.overlay.style.pointerEvents = 'none';
      setTimeout(() => {
        this.overlay.remove();
      }, 1000);
    }

    if (this.onComplete) {
      this.onComplete(wasSkipped);
    }
  }
}

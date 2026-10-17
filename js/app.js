/**
 * NOVA Space Exploration - Master Orchestrator (app.js)
 * Coordinates the full cinematic narrative, 3D engines, telemetry interfaces,
 * and user interactions across all cosmic horizons.
 */
import { initCustomCursor } from './cursor.js';
import { spaceAudio } from './audio.js';
import { CinematicIntro } from './intro.js';
import { HeroScene } from './hero.js';
import { ScaleExplorer } from './scale-explorer.js';
import { PlanetExplorer } from './planet-explorer.js';
import { SolarSystemScene } from './solarsystem.js';
import { GalaxyExplorer } from './galaxy-explorer.js';
import { NebulaSection } from './nebula-section.js';
import { BlackHoleScene } from './blackhole.js';
import { DataHub } from './datahub.js';
import { MissionsSection } from './missions.js';
import { ObservatorySection } from './observatory.js';
import { TimelineSection } from './timeline-section.js';
import { ResourcesSection } from './resources.js';
import { NarrativeReturnScene } from './narrative-return.js';
import { GlobalSearch } from './search.js';
import { GalleryApp } from './gallery.js';
import { AuthState } from './social.js';

class NovaSpaceApp {
  constructor() {
    this.heroScene = null;
    this.scaleExplorer = null;
    this.planetExplorer = null;
    this.solarSystem = null;
    this.galaxyExplorer = null;
    this.nebulaSection = null;
    this.blackHole = null;
    this.dataHub = null;
    this.missionsSection = null;
    this.observatorySection = null;
    this.timelineSection = null;
    this.resourcesSection = null;
    this.narrativeReturn = null;
    this.search = null;
    this.galleryApp = null;
    this.isDataMode = false;
  }

  bootstrap() {
    // 1. Initialize cursor system
    initCustomCursor();

    // 2. Setup HUD sound toggle
    this.setupAudioToggle();

    // 3. Setup Navigation & Mode switchers
    this.setupNavigation();
    this.setupModeToggle();
    this.setupMobileMenu();
    this.setupScrollProgressTracker();

    // 4. Initialize global search
    this.search = new GlobalSearch();

    // 4.5. Initialize NOVA Sky Gallery & Cloud Storage system
    try {
      this.galleryApp = new GalleryApp();
      this.galleryApp.init();
    } catch (e) {
      console.error('Sky Gallery initialization failed:', e);
    }

    // 4.6. Synchronize Auth State for HUD button
    try {
      AuthState.fetchUser().then(user => {
        const authLabel = document.getElementById('hud-auth-label');
        const authBtn = document.getElementById('hud-auth-btn');
        if (user && authLabel && authBtn) {
          authLabel.textContent = `[USER // @${user.nickname}]`;
          authBtn.setAttribute('href', `/u/${encodeURIComponent(user.nickname)}`);
          authBtn.setAttribute('title', `Logged in as @${user.nickname} (${user.role})`);
        }
      });
    } catch (e) {
      console.error('Auth state synchronization failed:', e);
    }

    // 5. Initialize interactive scenes immediately so all components are ready
    this.initInteractiveScenes();

    // 6. Cinematic Loading Sequence
    const intro = new CinematicIntro();
    intro.start();
  }

  initInteractiveScenes() {
    // 01: Hero Earth approach
    try {
      const heroContainer = document.getElementById('hero-3d-canvas-container');
      if (heroContainer) {
        this.heroScene = new HeroScene(heroContainer);
      }
    } catch (e) {
      console.error('Hero scene initialization failed:', e);
    }

    // 02: Scale Explorer
    try {
      this.scaleExplorer = new ScaleExplorer();
    } catch (e) {
      console.error('Scale explorer initialization failed:', e);
    }

    // 03: Planetarium 3D Explorer
    try {
      const planetContainer = document.getElementById('planet-3d-viewport');
      if (planetContainer) {
        this.planetExplorer = new PlanetExplorer(planetContainer);
      }
    } catch (e) {
      console.error('Planet explorer initialization failed:', e);
    }

    // 04: Solar System Simulation
    try {
      const solarContainer = document.getElementById('solarsystem-3d-viewport');
      if (solarContainer) {
        this.solarSystem = new SolarSystemScene(solarContainer);
      }
    } catch (e) {
      console.error('Solar system initialization failed:', e);
    }

    // 05: Galaxy Explorer
    try {
      const galaxyContainer = document.getElementById('galaxy-3d-viewport');
      if (galaxyContainer) {
        this.galaxyExplorer = new GalaxyExplorer(galaxyContainer);
      }
    } catch (e) {
      console.error('Galaxy explorer initialization failed:', e);
    }

    // 06: Nebula & Star Formation
    try {
      this.nebulaSection = new NebulaSection();
    } catch (e) {
      console.error('Nebula section initialization failed:', e);
    }

    // 07: Relativistic Black Hole
    try {
      const bhContainer = document.getElementById('blackhole-3d-viewport');
      if (bhContainer) {
        this.blackHole = new BlackHoleScene(bhContainer);
      }
    } catch (e) {
      console.error('Black hole scene initialization failed:', e);
    }

    // 08: Deep Space Data Hub
    try {
      this.dataHub = new DataHub();
    } catch (e) {
      console.error('Data hub initialization failed:', e);
    }

    // 09: Missions Section
    try {
      this.missionsSection = new MissionsSection();
    } catch (e) {
      console.error('Missions section initialization failed:', e);
    }

    // 10: Sky Observatory
    try {
      this.observatorySection = new ObservatorySection();
    } catch (e) {
      console.error('Observatory section initialization failed:', e);
    }

    // 11: Timeline & Future
    try {
      this.timelineSection = new TimelineSection();
    } catch (e) {
      console.error('Timeline section initialization failed:', e);
    }

    // 12: Cosmic Compendium & Resources (Sites & Books)
    try {
      this.resourcesSection = new ResourcesSection();
    } catch (e) {
      console.error('Resources section initialization failed:', e);
    }

    // 13: Narrative Return Earth
    try {
      const returnContainer = document.getElementById('return-earth-canvas');
      if (returnContainer) {
        this.narrativeReturn = new NarrativeReturnScene(returnContainer);
      }
    } catch (e) {
      console.error('Narrative return scene initialization failed:', e);
    }
  }

  setupAudioToggle() {
    const soundBtn = document.getElementById('hud-sound-toggle-btn');
    if (!soundBtn) return;

    soundBtn.addEventListener('click', () => {
      const isAudible = spaceAudio.toggleSound();
      soundBtn.classList.toggle('audio-active', isAudible);
      const label = soundBtn.querySelector('.sound-btn-label');
      if (label) {
        label.textContent = isAudible ? 'AUDIO: ON' : 'AUDIO: MUTED';
      }
    });
  }

  setupNavigation() {
    const navbar = document.getElementById('nova-sticky-navbar');
    let scrollTicking = false;

    window.addEventListener('scroll', () => {
      if (!scrollTicking) {
        requestAnimationFrame(() => {
          if (navbar) {
            navbar.classList.toggle('scrolled', window.scrollY > 80);
          }
          scrollTicking = false;
        });
        scrollTicking = true;
      }
    }, { passive: true });

    // Smooth scroll for nav links & dismiss active menus
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = anchor.getAttribute('href').slice(1);
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth' });
          spaceAudio.playTelemetryClick();
          // Close mobile menu if open
          const mobileOverlay = document.getElementById('mobile-nav-overlay');
          if (mobileOverlay) mobileOverlay.classList.remove('active');
          // Close all open dropdowns
          document.querySelectorAll('.nav-dropdown-item.is-open').forEach(d => {
            d.classList.remove('is-open');
            d.querySelector('.nav-dropdown-trigger')?.setAttribute('aria-expanded', 'false');
          });
        }
      });
    });

    // Nav Dropdown Toggles (Click/Touch accessibility)
    const dropdownItems = document.querySelectorAll('.nav-dropdown-item');
    dropdownItems.forEach(item => {
      const trigger = item.querySelector('.nav-dropdown-trigger');
      if (trigger) {
        trigger.addEventListener('click', (e) => {
          e.stopPropagation();
          const isOpen = item.classList.contains('is-open');
          dropdownItems.forEach(other => {
            if (other !== item) {
              other.classList.remove('is-open');
              other.querySelector('.nav-dropdown-trigger')?.setAttribute('aria-expanded', 'false');
            }
          });
          item.classList.toggle('is-open', !isOpen);
          trigger.setAttribute('aria-expanded', String(!isOpen));
          spaceAudio.playTelemetryClick();
        });
      }
    });

    // Close dropdowns on outside click or Escape
    document.addEventListener('click', () => {
      dropdownItems.forEach(item => {
        item.classList.remove('is-open');
        item.querySelector('.nav-dropdown-trigger')?.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        dropdownItems.forEach(item => {
          item.classList.remove('is-open');
          item.querySelector('.nav-dropdown-trigger')?.setAttribute('aria-expanded', 'false');
        });
      }
    });
  }

  setupModeToggle() {
    const modeBtn = document.getElementById('hud-mode-toggle-btn');
    if (!modeBtn) return;

    modeBtn.addEventListener('click', () => {
      this.isDataMode = !this.isDataMode;
      document.body.classList.toggle('data-mode-active', this.isDataMode);
      modeBtn.classList.toggle('active', this.isDataMode);
      const textSpan = modeBtn.querySelector('.mode-toggle-text');
      if (textSpan) {
        textSpan.textContent = this.isDataMode ? 'DATA MODE' : 'EXPERIENCE MODE';
      }
      spaceAudio.playTelemetryClick();
    });
  }

  setupMobileMenu() {
    const openBtn = document.getElementById('mobile-menu-trigger-btn');
    const closeBtn = document.getElementById('mobile-menu-close-btn');
    const overlay = document.getElementById('mobile-nav-overlay');

    if (openBtn && overlay) {
      openBtn.addEventListener('click', () => {
        overlay.classList.add('active');
        spaceAudio.playTelemetryClick();
      });
    }

    if (closeBtn && overlay) {
      closeBtn.addEventListener('click', () => {
        overlay.classList.remove('active');
        spaceAudio.playTelemetryClick();
      });
    }

    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('active')) {
          overlay.classList.remove('active');
        }
      });
    }
  }

  setupScrollProgressTracker() {
    const sectionIndexIndicator = document.getElementById('scroll-section-indicator');
    const sections = document.querySelectorAll('section[data-section-num]');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const num = entry.target.dataset.sectionNum;
          const sectionTitle = entry.target.dataset.sectionTitle;
          if (sectionIndexIndicator) {
            sectionIndexIndicator.innerHTML = `
              <span class="curr-num">${num}</span>
              <span class="divider">/</span>
              <span class="total-num">12</span>
            `;
          }
          // Dynamic browser tab title
          if (sectionTitle) {
            document.title = `NOVA — ${sectionTitle}`;
          }
        }
      });
    }, { threshold: 0.4 });

    sections.forEach(s => observer.observe(s));
  }
}

// Bootstrap once DOM content is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new NovaSpaceApp();
  app.bootstrap();
});

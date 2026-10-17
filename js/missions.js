/**
 * NOVA Space Exploration - Human Exploration Missions Dossier
 * Filtering, dossier cards, and interactive mission telemetry drawer.
 */
import { MISSIONS_DATA } from '../data/missions.js';
import { spaceAudio } from './audio.js';

export class MissionsSection {
  constructor() {
    this.container = document.getElementById('missions-grid');
    this.filterContainer = document.getElementById('missions-filter-tabs');
    this.modal = document.getElementById('mission-modal');
    this.currentFilter = 'all';

    this.init();
  }

  init() {
    if (!this.container) return;
    this.renderFilters();
    this.renderCards('all');
    this.setupModal();
  }

  renderFilters() {
    if (!this.filterContainer) return;
    const categories = [
      { id: 'all', label: 'ALL MISSIONS' },
      { id: 'lunar', label: 'LUNAR' },
      { id: 'mars', label: 'MARS' },
      { id: 'deep-space', label: 'DEEP SPACE' },
      { id: 'observatory', label: 'TELESCOPES' }
    ];

    this.filterContainer.innerHTML = '';
    categories.forEach((cat) => {
      const btn = document.createElement('button');
      btn.className = `mission-filter-btn ${cat.id === 'all' ? 'active' : ''}`;
      btn.dataset.category = cat.id;
      btn.textContent = cat.label;
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mission-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = cat.id;
        this.renderCards(cat.id);
        spaceAudio.playTelemetryClick();
      });
      this.filterContainer.appendChild(btn);
    });
  }

  renderCards(category = 'all') {
    const filtered = category === 'all'
      ? MISSIONS_DATA
      : MISSIONS_DATA.filter(m => m.category === category);

    this.container.innerHTML = '';
    filtered.forEach((mission, idx) => {
      const card = document.createElement('div');
      card.className = 'mission-card';
      card.style.setProperty('--card-accent', mission.accent);

      card.innerHTML = `
        <div class="mission-card-header">
          <span class="mission-num">DOSSIER 0${idx + 1}</span>
          <span class="mission-status-pill">${mission.status}</span>
        </div>
        <h3 class="mission-card-title">${mission.name}</h3>
        <div class="mission-meta-grid">
          <div class="meta-item">
            <span class="meta-label">DESTINATION</span>
            <span class="meta-val">${mission.destination}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">LAUNCH YEAR</span>
            <span class="meta-val">${mission.year}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">AGENCY</span>
            <span class="meta-val">${mission.agency}</span>
          </div>
        </div>
        <p class="mission-summary-snippet">${mission.primaryGoal}</p>
        <button class="mission-view-btn" data-id="${mission.id}">
          INSPECT DOSSIER <span class="btn-arrow">→</span>
        </button>
      `;

      card.querySelector('.mission-view-btn').addEventListener('click', () => {
        this.openModal(mission);
      });

      this.container.appendChild(card);
    });
  }

  setupModal() {
    if (!this.modal) return;
    const closeBtn = document.getElementById('mission-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeModal());
    }

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.closeModal();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.classList.contains('active')) {
        this.closeModal();
      }
    });
  }

  openModal(mission) {
    if (!this.modal) return;
    spaceAudio.playTelemetryClick();

    document.getElementById('modal-mission-title').textContent = mission.name;
    document.getElementById('modal-mission-status').textContent = mission.status;
    document.getElementById('modal-mission-dest').textContent = mission.destination;
    document.getElementById('modal-mission-date').textContent = mission.launchDate;
    document.getElementById('modal-mission-vehicle').textContent = mission.launchVehicle;
    document.getElementById('modal-mission-duration').textContent = mission.duration;
    document.getElementById('modal-mission-dist').textContent = mission.distanceTraveled;
    document.getElementById('modal-mission-crew').textContent = mission.crew || 'Uncrewed Robotic Explorer';
    document.getElementById('modal-mission-goal').textContent = mission.primaryGoal;
    document.getElementById('modal-mission-results').textContent = mission.scientificResults;

    this.modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  closeModal() {
    if (!this.modal) return;
    this.modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

/**
 * NOVA Space Exploration - Cosmic Compendium & Resources Controller
 * Handles filtering, card rendering, and safe external link routing.
 */
import { RESOURCES_DATA } from '../data/resources.js';
import { spaceAudio } from './audio.js';

export class ResourcesSection {
  constructor() {
    this.container = document.getElementById('resources-grid');
    this.filterContainer = document.getElementById('resources-filter-tabs');
    this.currentFilter = 'all';

    this.init();
  }

  init() {
    if (!this.container) return;
    this.renderFilters();
    this.renderCards('all');
  }

  renderFilters() {
    if (!this.filterContainer) return;
    const filterTabs = [
      { id: 'all', label: 'ALL ARCHIVES' },
      { id: 'site', label: 'OBSERVATORIES & WEBSITES' },
      { id: 'book', label: 'SEMINAL LITERATURE' }
    ];

    this.filterContainer.innerHTML = '';
    filterTabs.forEach((tab) => {
      const btn = document.createElement('button');
      btn.className = `mission-filter-btn ${tab.id === 'all' ? 'active' : ''}`;
      btn.dataset.type = tab.id;
      btn.textContent = tab.label;
      btn.addEventListener('click', () => {
        document.querySelectorAll('#resources-filter-tabs .mission-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = tab.id;
        this.renderCards(tab.id);
        spaceAudio.playTelemetryClick();
      });
      this.filterContainer.appendChild(btn);
    });
  }

  renderCards(filterType = 'all') {
    if (!this.container) return;

    const filtered = filterType === 'all'
      ? RESOURCES_DATA
      : RESOURCES_DATA.filter(item => item.type === filterType);

    this.container.innerHTML = '';
    filtered.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'resource-card';
      card.style.setProperty('--card-accent', item.accent);

      const typeLabel = item.type === 'book' ? 'BOOK // LITERATURE' : 'PORTAL // OBSERVATORY';

      card.innerHTML = `
        <div class="resource-card-header">
          <span class="resource-type-tag">${typeLabel}</span>
          <span class="resource-num">REF 0${idx + 1}</span>
        </div>
        <h3 class="resource-card-title">${item.title}</h3>
        <div class="resource-org-label">${item.organization.toUpperCase()}</div>
        <div class="resource-category-badge">${item.category}</div>
        <p class="resource-desc">${item.description}</p>
        <div class="resource-tags-row">
          ${item.tags.map(t => `<span class="resource-micro-tag">${t}</span>`).join('')}
        </div>
        <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="resource-link-btn">
          <span>ACCESS ARCHIVE</span>
          <span class="btn-arrow">↗</span>
        </a>
      `;

      this.container.appendChild(card);
    });
  }
}

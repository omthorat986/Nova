/**
 * NOVA Space Exploration - Global Search Modal ("SEARCH THE COSMOS")
 * Omnibox search indexed across planets, stars, galaxies, missions, and scale horizons.
 */
import { PLANETS_DATA } from '../data/planets.js';
import { GALAXIES_DATA } from '../data/galaxies.js';
import { MISSIONS_DATA } from '../data/missions.js';
import { STARS_DATA } from '../data/stars.js';
import { SCALE_STEPS } from '../data/scale.js';
import { RESOURCES_DATA } from '../data/resources.js';
import { spaceAudio } from './audio.js';

export class GlobalSearch {
  constructor() {
    this.modal = document.getElementById('search-modal');
    this.input = document.getElementById('search-input');
    this.resultsList = document.getElementById('search-results-list');
    this.triggerBtn = document.getElementById('search-trigger-btn');
    this.closeBtn = document.getElementById('search-modal-close');

    this.searchIndex = [];
    this.buildIndex();
    this.bindEvents();
  }

  buildIndex() {
    PLANETS_DATA.forEach((p, idx) => {
      this.searchIndex.push({
        title: p.name,
        type: 'Planet / World',
        category: 'planet',
        targetId: 'planet-explorer-section',
        description: p.description.slice(0, 110) + '...',
        index: idx
      });
    });

    GALAXIES_DATA.forEach((g) => {
      this.searchIndex.push({
        title: g.name,
        type: 'Galaxy Morphology',
        category: 'galaxy',
        targetId: 'galaxy-explorer-section',
        description: g.description.slice(0, 110) + '...',
        id: g.id
      });
    });

    MISSIONS_DATA.forEach((m) => {
      this.searchIndex.push({
        title: m.name,
        type: 'Space Exploration Mission',
        category: 'mission',
        targetId: 'missions-section',
        description: `${m.destination} (${m.year}) - ${m.primaryGoal.slice(0, 80)}...`,
        id: m.id
      });
    });

    STARS_DATA.forEach((s) => {
      this.searchIndex.push({
        title: s.name,
        type: 'Stellar Object',
        category: 'star',
        targetId: 'observatory-section',
        description: `${s.constellation} • ${s.distanceLY} • ${s.spectralClass}`,
        id: s.id
      });
    });

    SCALE_STEPS.forEach((sc, idx) => {
      this.searchIndex.push({
        title: sc.title,
        type: 'Cosmological Scale',
        category: 'scale',
        targetId: 'universe-scale-section',
        description: `${sc.unitStr} - ${sc.comparison}`,
        index: idx
      });
    });

    RESOURCES_DATA.forEach((r) => {
      this.searchIndex.push({
        title: r.title,
        type: r.type === 'book' ? 'Seminal Book / Literature' : 'Observatory / Research Portal',
        category: 'resource',
        targetId: 'resources-section',
        description: `${r.organization} — ${r.description.slice(0, 100)}...`,
        id: r.id
      });
    });

    this.searchIndex.push({
      title: 'NOVA Sky Gallery (Observer Uploads)',
      type: 'Cloud Storage & Astrophotography',
      category: 'gallery',
      targetId: 'gallery-section',
      description: 'Observer astrophotography uploaded to cloud storage and verified through curator review.'
    });
  }

  bindEvents() {
    if (this.triggerBtn) {
      this.triggerBtn.addEventListener('click', () => this.openSearch());
    }

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.closeSearch());
    }

    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.closeSearch();
      });
    }

    // Hotkey / or Ctrl+K / Cmd+K
    window.addEventListener('keydown', (e) => {
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && document.activeElement.tagName !== 'INPUT')) {
        e.preventDefault();
        this.openSearch();
      } else if (e.key === 'Escape' && this.modal && this.modal.classList.contains('active')) {
        this.closeSearch();
      }
    });

    if (this.input) {
      this.input.addEventListener('input', () => {
        this.handleSearch(this.input.value.trim());
      });
    }
  }

  openSearch() {
    if (!this.modal) return;
    this.modal.classList.add('active');
    spaceAudio.playTelemetryClick();
    if (this.input) {
      this.input.value = '';
      setTimeout(() => this.input.focus(), 100);
      this.handleSearch('');
    }
  }

  closeSearch() {
    if (!this.modal) return;
    this.modal.classList.remove('active');
  }

  handleSearch(query) {
    if (!this.resultsList) return;
    const lower = query.toLowerCase();

    const matches = query === ''
      ? this.searchIndex.slice(0, 8)
      : this.searchIndex.filter(item =>
          item.title.toLowerCase().includes(lower) ||
          item.type.toLowerCase().includes(lower) ||
          item.description.toLowerCase().includes(lower)
        );

    this.resultsList.innerHTML = '';

    if (matches.length === 0) {
      this.resultsList.innerHTML = `
        <div class="search-no-results">
          NO CELESTIAL OBJECTS FOUND MATCHING "${query.toUpperCase()}"
        </div>
      `;
      return;
    }

    matches.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'search-result-item';
      row.innerHTML = `
        <div class="result-header">
          <span class="result-title">${item.title}</span>
          <span class="result-type-tag">${item.type}</span>
        </div>
        <div class="result-desc">${item.description}</div>
      `;

      row.addEventListener('click', () => {
        this.closeSearch();
        const targetSection = document.getElementById(item.targetId);
        if (targetSection) {
          targetSection.scrollIntoView({ behavior: 'smooth' });
        }
      });

      this.resultsList.appendChild(row);
    });
  }
}

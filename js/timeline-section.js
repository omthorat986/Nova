/**
 * NOVA Space Exploration - Timeline of Cosmic Exploration & The Future Chapter
 * Interactive milestones navigation from Galileo's telescope in 1609 to the deep interstellar future.
 */
import { TIMELINE_DATA, FUTURE_CHAPTER } from '../data/timeline.js';
import { spaceAudio } from './audio.js';

export class TimelineSection {
  constructor() {
    this.milestonesContainer = document.getElementById('timeline-milestones-track');
    this.futureGrid = document.getElementById('future-chapter-grid');
    this.init();
  }

  init() {
    this.renderMilestones();
    this.renderFutureChapter();
  }

  renderMilestones() {
    if (!this.milestonesContainer) return;

    this.milestonesContainer.innerHTML = '';
    TIMELINE_DATA.forEach((item, idx) => {
      const node = document.createElement('div');
      node.className = `timeline-node ${idx === 0 ? 'active' : ''}`;
      node.dataset.index = idx;

      node.innerHTML = `
        <div class="timeline-node-pin">
          <div class="pin-dot"></div>
          <div class="pin-glow"></div>
        </div>
        <div class="timeline-node-card">
          <div class="node-year">${item.year}</div>
          <h4 class="node-title">${item.title}</h4>
          <div class="node-pioneer">PIONEER: ${item.pioneer}</div>
          <p class="node-desc">${item.description}</p>
          <div class="node-quote">"${item.quote}"</div>
        </div>
      `;

      node.addEventListener('mouseenter', () => {
        document.querySelectorAll('.timeline-node').forEach(n => n.classList.remove('active'));
        node.classList.add('active');
        spaceAudio.playTelemetryClick();
      });

      this.milestonesContainer.appendChild(node);
    });
  }

  renderFutureChapter() {
    if (!this.futureGrid) return;

    this.futureGrid.innerHTML = '';
    FUTURE_CHAPTER.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'future-card';

      card.innerHTML = `
        <div class="future-card-header">
          <span class="future-timeframe">${item.timeframe}</span>
          <span class="future-status-pill">${item.status}</span>
        </div>
        <h4 class="future-card-title">${item.title}</h4>
        <p class="future-card-desc">${item.description}</p>
      `;

      this.futureGrid.appendChild(card);
    });
  }
}

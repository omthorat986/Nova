/**
 * NOVA Space Exploration - Interactive Sky Observatory & Multi-Wavelength Star Map
 * Features multi-wavelength spectrum switcher (Visible, Infrared, X-Ray, Radio),
 * constellation geometry overlays, and interactive stellar telemetry inspector.
 */
import { STARS_DATA, CONSTELLATIONS_DATA } from '../data/stars.js';
import { spaceAudio } from './audio.js';

export class ObservatorySection {
  constructor() {
    this.canvas = document.getElementById('observatory-canvas');
    this.activeWavelength = 'visible'; // 'visible' | 'infrared' | 'xray' | 'radio'
    this.showConstellations = true;
    this.selectedStar = STARS_DATA[0];
    this.hoveredStar = null;

    this.init();
  }

  init() {
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    this.bindControls();
    this.setupInteractions();
    this.resizeCanvas();
    this.updateInspector(this.selectedStar);

    window.addEventListener('resize', () => this.resizeCanvas());
    this.render();
  }

  resizeCanvas() {
    this.width = this.canvas.clientWidth || 800;
    this.height = this.canvas.clientHeight || 500;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.render();
  }

  bindControls() {
    // Wavelength switcher
    const wavelengthButtons = document.querySelectorAll('.wavelength-btn');
    wavelengthButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        wavelengthButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeWavelength = btn.dataset.wavelength;
        this.updateInspector(this.selectedStar);
        this.render();
        spaceAudio.playTelemetryClick();
      });
    });

    // Constellations toggle
    const constToggle = document.getElementById('toggle-constellations-btn');
    if (constToggle) {
      constToggle.addEventListener('click', () => {
        this.showConstellations = !this.showConstellations;
        constToggle.classList.toggle('active', this.showConstellations);
        this.render();
        spaceAudio.playTelemetryClick();
      });
    }
  }

  setupInteractions() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      let found = null;
      STARS_DATA.forEach((star) => {
        const sx = this.width * 0.5 + star.x * (this.width * 0.45);
        const sy = this.height * 0.5 - star.y * (this.height * 0.45);
        const dist = Math.hypot(mouseX - sx, mouseY - sy);
        if (dist < 18) {
          found = star;
        }
      });

      if (found !== this.hoveredStar) {
        this.hoveredStar = found;
        this.canvas.style.cursor = found ? 'pointer' : 'crosshair';
        this.render();
      }
    });

    this.canvas.addEventListener('click', (e) => {
      if (this.hoveredStar) {
        this.selectedStar = this.hoveredStar;
        this.updateInspector(this.selectedStar);
        this.render();
        spaceAudio.playTelemetryClick();
      }
    });
  }

  updateInspector(star) {
    if (!star) return;
    const nameEl = document.getElementById('obs-star-name');
    const constEl = document.getElementById('obs-star-const');
    const distEl = document.getElementById('obs-star-dist');
    const specEl = document.getElementById('obs-star-spec');
    const magEl = document.getElementById('obs-star-mag');
    const raEl = document.getElementById('obs-star-ra');
    const decEl = document.getElementById('obs-star-dec');
    const waveDescEl = document.getElementById('obs-wavelength-desc');
    const descEl = document.getElementById('obs-star-desc');

    if (nameEl) nameEl.textContent = star.name.toUpperCase();
    if (constEl) constEl.textContent = star.constellation;
    if (distEl) distEl.textContent = star.distanceLY;
    if (specEl) specEl.textContent = star.spectralClass;
    if (magEl) magEl.textContent = star.apparentMagnitude;
    if (raEl) raEl.textContent = star.rightAscension;
    if (decEl) decEl.textContent = star.declination;
    if (descEl) descEl.textContent = star.description;

    if (waveDescEl && star.wavelengths) {
      waveDescEl.textContent = star.wavelengths[this.activeWavelength] || star.wavelengths.visible;
    }
  }

  render() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    // Dynamic background based on active wavelength
    let bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.5, 20, w * 0.5, h * 0.5, w * 0.6);
    if (this.activeWavelength === 'infrared') {
      bgGrad.addColorStop(0, '#150810');
      bgGrad.addColorStop(1, '#02040a');
    } else if (this.activeWavelength === 'xray') {
      bgGrad.addColorStop(0, '#0a0520');
      bgGrad.addColorStop(1, '#02040a');
    } else if (this.activeWavelength === 'radio') {
      bgGrad.addColorStop(0, '#041512');
      bgGrad.addColorStop(1, '#02040a');
    } else {
      bgGrad.addColorStop(0, '#050a18');
      bgGrad.addColorStop(1, '#02040a');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle coordinate reticle rings
    ctx.strokeStyle = 'rgba(92, 200, 255, 0.08)';
    ctx.lineWidth = 1;
    [0.2, 0.4, 0.6, 0.8].forEach(r => {
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.5, w * 0.45 * r, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Crosshair axes
    ctx.beginPath();
    ctx.moveTo(w * 0.5, 0); ctx.lineTo(w * 0.5, h);
    ctx.moveTo(0, h * 0.5); ctx.lineTo(w, h * 0.5);
    ctx.stroke();

    // Draw Constellation Lines if enabled
    if (this.showConstellations) {
      ctx.strokeStyle = 'rgba(92, 200, 255, 0.22)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);

      CONSTELLATIONS_DATA.forEach(c => {
        c.lines.forEach(l => {
          const x1 = w * 0.5 + l.from[0] * (w * 0.45);
          const y1 = h * 0.5 - l.from[1] * (h * 0.45);
          const x2 = w * 0.5 + l.to[0] * (w * 0.45);
          const y2 = h * 0.5 - l.to[1] * (h * 0.45);

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        });
      });

      ctx.setLineDash([]);
    }

    // Draw Stars
    STARS_DATA.forEach((star) => {
      const sx = w * 0.5 + star.x * (w * 0.45);
      const sy = h * 0.5 - star.y * (h * 0.45);
      const isSelected = star === this.selectedStar;
      const isHovered = star === this.hoveredStar;

      // Color shift per wavelength
      let starColor = star.color;
      if (this.activeWavelength === 'infrared') starColor = '#ff8c69';
      else if (this.activeWavelength === 'xray') starColor = '#c77dff';
      else if (this.activeWavelength === 'radio') starColor = '#52b788';

      // Outer glow
      const glowR = (isSelected || isHovered) ? 24 : 12;
      const grad = ctx.createRadialGradient(sx, sy, 2, sx, sy, glowR);
      grad.addColorStop(0, starColor);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sx, sy, glowR, 0, Math.PI * 2);
      ctx.fill();

      // Core point
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sx, sy, (isSelected || isHovered) ? 4.5 : 3.0, 0, Math.PI * 2);
      ctx.fill();

      // Selection reticle box
      if (isSelected) {
        ctx.strokeStyle = '#5cc8ff';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx - 10, sy - 10, 20, 20);
      }

      // Star label
      ctx.fillStyle = isSelected ? '#5cc8ff' : 'rgba(234, 247, 255, 0.75)';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillText(star.name.split(' ')[0], sx + 12, sy + 4);
    });
  }
}

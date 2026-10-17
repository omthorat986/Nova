/**
 * NOVA Space Exploration - Nebula & Star Formation Storytelling
 * Interactive visualization of stellar nurseries and 6-stage evolutionary genesis.
 */
import { isWebGLAvailable } from './engine.js';
import { spaceAudio } from './audio.js';

export const STAR_FORMATION_STAGES = [
  {
    step: 1,
    title: 'GIANT MOLECULAR CLOUD',
    temp: '10 – 20 K (-260°C)',
    scale: '100 Light-Years across',
    description: 'Vast, cold reservoirs of molecular hydrogen (H₂) and microscopic silicate/carbon dust drift through interstellar space. Shielded from destructive ultraviolet stellar radiation, gravity begins overcoming internal thermal pressure.',
    visualClass: 'stage-cloud',
    accent: '#5cc8ff'
  },
  {
    step: 2,
    title: 'GRAVITATIONAL COLLAPSE',
    temp: '50 – 100 K',
    scale: '1 – 2 Light-Years',
    description: 'Triggered by a nearby supernova shockwave or galactic spiral density wave, the cloud fragments into dense, collapsing clumps. Conservation of angular momentum forces the collapsing gas pocket to spin faster and flatten into a circumstellar disk.',
    visualClass: 'stage-collapse',
    accent: '#8b7cff'
  },
  {
    step: 3,
    title: 'PROTOSTAR EMERGENCE',
    temp: '2,000 – 3,000 K',
    scale: '~10 – 50 AU',
    description: 'At the geometric center of the spinning accretion disk, gravitational potential energy is converted directly into thermal radiation. An opaque core forms, shrouded in a cocoon of infalling dust and blasting bipolar magnetic plasma jets.',
    visualClass: 'stage-protostar',
    accent: '#ffd285'
  },
  {
    step: 4,
    title: 'CORE TEMPERATURE SURGE',
    temp: '1 – 5 Million K',
    scale: '~5 – 10 Solar Radii',
    description: 'The young stellar object contracts under crushing gravitational pressure. Interior density and temperature climb exponentially as hydrogen nuclei collide with escalating kinetic velocity, awaiting quantum tunneling thresholds.',
    visualClass: 'stage-heating',
    accent: '#ff9e42'
  },
  {
    step: 5,
    title: 'NUCLEAR FUSION IGNITION',
    temp: '15 Million K (Core)',
    scale: 'Stellar Nucleus',
    description: 'Core temperatures breach the 10-million Kelvin threshold. The proton-proton chain reaction ignites: four hydrogen protons fuse into one helium nucleus, liberating tremendous mass-defect energy via E = mc².',
    visualClass: 'stage-ignition',
    accent: '#ff5c38'
  },
  {
    step: 6,
    title: 'MAIN SEQUENCE EQUILIBRIUM',
    temp: '5,500 K Surface / 15M K Core',
    scale: 'Stable Star (1 R☉)',
    description: 'Outward thermal radiation pressure precisely balances inward gravitational contraction, achieving hydrostatic equilibrium. The infant star blows away its circumstellar dust cocoon, shining as a stable main-sequence star for billions of years.',
    visualClass: 'stage-mainsequence',
    accent: '#ffea75'
  }
];

export class NebulaSection {
  constructor() {
    this.currentStep = 0;
    this.canvas = document.getElementById('nebula-canvas');
    this.stepperContainer = document.getElementById('nebula-stepper-nav');
    this.titleEl = document.getElementById('nebula-stage-title');
    this.tempEl = document.getElementById('nebula-stage-temp');
    this.scaleEl = document.getElementById('nebula-stage-scale');
    this.descEl = document.getElementById('nebula-stage-desc');
    this.visualEl = document.getElementById('nebula-visual-stage');

    this.init();
  }

  init() {
    this.initCanvasCloud();
    this.renderStepper();
    this.goToStep(0, false);
  }

  initCanvasCloud() {
    if (!this.canvas) return;
    const ctx = this.canvas.getContext('2d');
    const resize = () => {
      this.canvas.width = this.canvas.clientWidth || 800;
      this.canvas.height = this.canvas.clientHeight || 450;
      this.drawNebula(ctx);
    };
    window.addEventListener('resize', resize);
    resize();
  }

  drawNebula(ctx) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Deep cosmic dust cloud gradients
    const colors = [
      { x: w * 0.35, y: h * 0.45, r: w * 0.4, color: 'rgba(92, 200, 255, 0.12)' },
      { x: w * 0.65, y: h * 0.55, r: w * 0.45, color: 'rgba(139, 124, 255, 0.14)' },
      { x: w * 0.50, y: h * 0.35, r: w * 0.3, color: 'rgba(255, 107, 74, 0.09)' },
      { x: w * 0.45, y: h * 0.65, r: w * 0.35, color: 'rgba(106, 238, 255, 0.08)' }
    ];

    colors.forEach(c => {
      const grad = ctx.createRadialGradient(c.x, c.y, 10, c.x, c.y, c.r);
      grad.addColorStop(0, c.color);
      grad.addColorStop(0.6, c.color.replace('0.', '0.04'));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // Embedded proto-stars
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const size = Math.random() * 2.5 + 0.5;
      const alpha = Math.random() * 0.8 + 0.2;
      ctx.fillStyle = `rgba(234, 247, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  renderStepper() {
    if (!this.stepperContainer) return;
    this.stepperContainer.innerHTML = '';

    STAR_FORMATION_STAGES.forEach((stage, idx) => {
      const btn = document.createElement('button');
      btn.className = `nebula-step-pill ${idx === 0 ? 'active' : ''}`;
      btn.innerHTML = `
        <span class="step-num">0${stage.step}</span>
        <span class="step-label">${stage.title}</span>
      `;
      btn.addEventListener('click', () => {
        this.goToStep(idx);
      });
      this.stepperContainer.appendChild(btn);
    });

    const prevBtn = document.getElementById('nebula-prev-btn');
    const nextBtn = document.getElementById('nebula-next-btn');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (this.currentStep > 0) this.goToStep(this.currentStep - 1);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (this.currentStep < STAR_FORMATION_STAGES.length - 1) this.goToStep(this.currentStep + 1);
      });
    }
  }

  goToStep(index, playAudio = true) {
    if (index < 0 || index >= STAR_FORMATION_STAGES.length) return;
    this.currentStep = index;
    const stage = STAR_FORMATION_STAGES[index];

    if (playAudio) {
      spaceAudio.playTelemetryClick();
    }

    const pills = document.querySelectorAll('.nebula-step-pill');
    pills.forEach((p, idx) => p.classList.toggle('active', idx === index));

    if (this.titleEl) this.titleEl.textContent = stage.title;
    if (this.tempEl) this.tempEl.textContent = stage.temp;
    if (this.scaleEl) this.scaleEl.textContent = stage.scale;
    if (this.descEl) this.descEl.textContent = stage.description;

    if (this.visualEl) {
      this.visualEl.className = `nebula-stage-graphic ${stage.visualClass}`;
      this.visualEl.style.setProperty('--stage-accent', stage.accent);
    }

    const prevBtn = document.getElementById('nebula-prev-btn');
    const nextBtn = document.getElementById('nebula-next-btn');
    if (prevBtn) prevBtn.disabled = (index === 0);
    if (nextBtn) nextBtn.disabled = (index === STAR_FORMATION_STAGES.length - 1);
  }
}

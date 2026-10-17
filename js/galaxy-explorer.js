/**
 * NOVA Space Exploration - 3D Galactic Particle Simulation
 * Procedural particle simulations for Spiral (Milky Way), Elliptical (M87), and Irregular (LMC) morphologies.
 */
import { GALAXIES_DATA } from '../data/galaxies.js';
import { isWebGLAvailable } from './engine.js';
import { spaceAudio } from './audio.js';
import { getOptimalPixelRatio, createVisibilityObserver, attachSmartTouchControls } from './visibility.js';

export class GalaxyExplorer {
  constructor(canvasContainer) {
    this.container = canvasContainer;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.galaxyPoints = null;
    this.currentGalaxy = GALAXIES_DATA[0]; // Spiral (Milky Way)
    this.isDragging = false;
    this.previousMouse = { x: 0, y: 0 };
    this.galaxyGroup = null;
    this.visibility = null;
    this.isRendering = false;

    this.init();
  }

  init() {
    if (!this.container || !isWebGLAvailable()) return;

    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 500;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(0, 18, 30);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(getOptimalPixelRatio());
    this.container.appendChild(this.renderer.domElement);

    this.galaxyGroup = new THREE.Group();
    this.galaxyGroup.rotation.x = 0.55;
    this.scene.add(this.galaxyGroup);

    // Build initial spiral galaxy
    this.generateGalaxy('spiral');

    // Controls & Navigation
    this.bindEvents();
    this.renderSelector();

    // Viewport-aware visibility observer (pauses WebGL render loop when offscreen)
    this.visibility = createVisibilityObserver(this.container, {
      onVisible: () => {
        if (!this.isRendering) this.animate();
      },
      onHidden: () => {
        this.isRendering = false;
      }
    });

    // Animation Loop
    this.animate();
  }

  generateGalaxy(type = 'spiral') {
    if (this.galaxyPoints) {
      this.galaxyGroup.remove(this.galaxyPoints);
      this.galaxyPoints.geometry.dispose();
      this.galaxyPoints.material.dispose();
      this.galaxyPoints = null;
    }

    const count = 22000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const insideColor = new THREE.Color('#ffe1a8'); // Warm core
    const outsideColor = new THREE.Color(type === 'elliptical' ? '#ff9e42' : (type === 'irregular' ? '#6aeeff' : '#5cc8ff'));

    if (type === 'spiral') {
      // 4 Spiral arms with logarithmic winding
      const arms = 4;
      const radius = 18;
      const spin = 1.35;
      const randomnessPower = 3;

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const r = Math.pow(Math.random(), 1.6) * radius;
        const spinAngle = r * spin;
        const branchAngle = ((i % arms) / arms) * Math.PI * 2;

        const randomX = Math.pow(Math.random(), randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * 0.45 * (r + 1);
        const randomY = Math.pow(Math.random(), randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * 0.35 * (r + 1);
        const randomZ = Math.pow(Math.random(), randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * 0.45 * (r + 1);

        positions[i3] = Math.cos(branchAngle + spinAngle) * r + randomX;
        positions[i3 + 1] = randomY * 0.5;
        positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * r + randomZ;

        // Color interpolation based on radius (warm core -> cool electric blue outer arms)
        const mixedColor = insideColor.clone();
        mixedColor.lerp(outsideColor, r / radius);

        colors[i3] = mixedColor.r;
        colors[i3 + 1] = mixedColor.g;
        colors[i3 + 2] = mixedColor.b;
      }
    } else if (type === 'elliptical') {
      // Dense triaxial ellipsoid swarm
      const a = 16, b = 11, c = 9;
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const u = Math.random();
        const v = Math.random();
        const theta = u * 2.0 * Math.PI;
        const phi = Math.acos(2.0 * v - 1.0);
        const r = Math.pow(Math.random(), 2.0) * a;

        positions[i3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = (r * (b / a)) * Math.sin(phi) * Math.sin(theta);
        positions[i3 + 2] = (r * (c / a)) * Math.cos(phi);

        const mixedColor = insideColor.clone();
        mixedColor.lerp(outsideColor, r / a);
        colors[i3] = mixedColor.r;
        colors[i3 + 1] = mixedColor.g;
        colors[i3 + 2] = mixedColor.b;
      }
    } else {
      // Irregular chaotic cloud with high-density starburst clusters
      const clusterCenters = [
        { x: -4, y: 1, z: 2, r: 7 },
        { x: 3, y: -2, z: -1, r: 8 },
        { x: 1, y: 3, z: -3, r: 5 }
      ];

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const cluster = clusterCenters[i % clusterCenters.length];
        const r = Math.pow(Math.random(), 1.4) * cluster.r;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        positions[i3] = cluster.x + r * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = cluster.y + r * Math.sin(phi) * Math.sin(theta);
        positions[i3 + 2] = cluster.z + r * Math.cos(phi);

        const mixedColor = insideColor.clone();
        mixedColor.lerp(outsideColor, Math.random());
        colors[i3] = mixedColor.r;
        colors[i3 + 1] = mixedColor.g;
        colors[i3 + 2] = mixedColor.b;
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 1.5,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      transparent: true,
      opacity: 0.85
    });

    this.galaxyPoints = new THREE.Points(geometry, material);
    this.galaxyGroup.add(this.galaxyPoints);
  }

  renderSelector() {
    const selectorContainer = document.getElementById('galaxy-selector-tabs');
    if (!selectorContainer) return;

    selectorContainer.innerHTML = '';
    GALAXIES_DATA.forEach((gal, idx) => {
      const btn = document.createElement('button');
      btn.className = `galaxy-tab-btn ${idx === 0 ? 'active' : ''}`;
      btn.dataset.id = gal.id;
      btn.innerHTML = `
        <span class="tab-type">${gal.type.split(' ')[0].toUpperCase()}</span>
        <span class="tab-name">${gal.name}</span>
      `;
      btn.addEventListener('click', () => {
        document.querySelectorAll('.galaxy-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectGalaxy(gal);
      });
      selectorContainer.appendChild(btn);
    });

    this.updateInfoCard(GALAXIES_DATA[0]);
  }

  selectGalaxy(gal) {
    this.currentGalaxy = gal;
    this.generateGalaxy(gal.id);
    this.updateInfoCard(gal);
    spaceAudio.playTelemetryClick();
  }

  updateInfoCard(gal) {
    const titleEl = document.getElementById('galaxy-info-title');
    const typeEl = document.getElementById('galaxy-info-type');
    const diamEl = document.getElementById('galaxy-info-diameter');
    const starsEl = document.getElementById('galaxy-info-stars');
    const massEl = document.getElementById('galaxy-info-mass');
    const coreEl = document.getElementById('galaxy-info-core');
    const descEl = document.getElementById('galaxy-info-desc');
    const attrsEl = document.getElementById('galaxy-info-attrs');

    if (titleEl) titleEl.textContent = gal.name.toUpperCase();
    if (typeEl) typeEl.textContent = gal.type;
    if (diamEl) diamEl.textContent = gal.diameter;
    if (starsEl) starsEl.textContent = gal.starCount;
    if (massEl) massEl.textContent = gal.mass;
    if (coreEl) coreEl.textContent = gal.centralObject;
    if (descEl) descEl.textContent = gal.description;

    if (attrsEl && gal.keyAttributes) {
      attrsEl.innerHTML = gal.keyAttributes.map(a => `
        <div class="galaxy-attr-row">
          <span class="attr-label">${a.label}</span>
          <span class="attr-value">${a.value}</span>
        </div>
      `).join('');
    }
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      if (!this.renderer || !this.camera) return;
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });

    const dom = this.renderer.domElement;
    dom.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.previousMouse = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.previousMouse.x;
      const dy = e.clientY - this.previousMouse.y;

      if (this.galaxyGroup) {
        this.galaxyGroup.rotation.z += dx * 0.005;
        this.galaxyGroup.rotation.x += dy * 0.004;
      }
      this.previousMouse = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Smart touch controls (fluid vertical page scrolling + 1-finger galaxy rotation)
    attachSmartTouchControls(dom, {
      onDragStart: () => {
        this.isDragging = true;
      },
      onDrag: (dx, dy) => {
        if (this.galaxyGroup) {
          this.galaxyGroup.rotation.z += dx * 0.005;
          this.galaxyGroup.rotation.x += dy * 0.004;
        }
      },
      onDragEnd: () => {
        this.isDragging = false;
      }
    });

    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.camera.position.z += e.deltaY * 0.02;
      this.camera.position.z = Math.max(16, Math.min(55, this.camera.position.z));
    }, { passive: false });
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    if (this.visibility && !this.visibility.isVisible()) {
      return;
    }

    if (!this.isDragging && this.galaxyPoints) {
      this.galaxyPoints.rotation.y += 0.0012;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

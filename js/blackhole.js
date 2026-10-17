/**
 * NOVA Space Exploration - Relativistic Black Hole Simulation
 * Gargantua-style singularity with curved gravitational lensing arcs, photon ring,
 * and high-temperature Doppler-boosted accretion disk.
 */
import { isWebGLAvailable } from './engine.js';
import { spaceAudio } from './audio.js';
import { getOptimalPixelRatio, createVisibilityObserver, attachSmartTouchControls } from './visibility.js';

export class BlackHoleScene {
  constructor(canvasContainer) {
    this.container = canvasContainer;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.singularityMesh = null;
    this.photonRingMesh = null;
    this.diskMesh = null;
    this.lensingMesh = null;
    this.group = null;
    this.isDragging = false;
    this.previousMouse = { x: 0, y: 0 };

    this.showHorizon = true;
    this.showDisk = true;
    this.showLensing = true;
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
    this.camera.position.set(0, 4, 18);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(getOptimalPixelRatio());
    this.container.appendChild(this.renderer.domElement);

    this.group = new THREE.Group();
    this.scene.add(this.group);

    // Build Black Hole components
    this.buildBlackHole();

    // Setup toggles and drag controls
    this.bindEvents();

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

  buildBlackHole() {
    const rs = 2.4; // Event horizon radius

    // 1. The Event Horizon (Absoluteness of total darkness)
    const horizonGeo = new THREE.SphereGeometry(rs, 48, 48);
    const horizonMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      depthTest: true
    });
    this.singularityMesh = new THREE.Mesh(horizonGeo, horizonMat);
    this.group.add(this.singularityMesh);

    // 2. The Photon Ring (1.5 × Schwarzschild Radius)
    const photonRingGeo = new THREE.RingGeometry(rs * 1.02, rs * 1.08, 64);
    const photonRingMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    });
    this.photonRingMesh = new THREE.Mesh(photonRingGeo, photonRingMat);
    this.group.add(this.photonRingMesh);

    // 3. Equatorial Accretion Disk
    const diskGeo = new THREE.RingGeometry(rs * 1.35, rs * 4.2, 80);
    diskGeo.rotateX(-Math.PI / 2);

    // Procedural accretion disk texture
    const diskCanvas = document.createElement('canvas');
    diskCanvas.width = 512;
    diskCanvas.height = 64;
    const ctx = diskCanvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)'); // Extreme inner heat
    grad.addColorStop(0.2, 'rgba(106, 238, 255, 0.95)'); // Cyan relativistic ionization
    grad.addColorStop(0.5, 'rgba(255, 140, 40, 0.85)'); // Hot plasma
    grad.addColorStop(0.8, 'rgba(220, 50, 20, 0.5)'); // Cooler outer gas
    grad.addColorStop(1.0, 'rgba(10, 0, 0, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 64);

    const diskTex = new THREE.CanvasTexture(diskCanvas);
    const diskMat = new THREE.MeshBasicMaterial({
      map: diskTex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    this.diskMesh = new THREE.Mesh(diskGeo, diskMat);
    this.group.add(this.diskMesh);

    // 4. Relativistic Gravitational Lensing Arcs (Vertical bent light)
    const lensGeoTop = new THREE.RingGeometry(rs * 1.25, rs * 3.4, 60, 1, 0, Math.PI);
    const lensMat = new THREE.MeshBasicMaterial({
      map: diskTex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending
    });
    this.lensingMesh = new THREE.Group();

    const topArc = new THREE.Mesh(lensGeoTop, lensMat);
    topArc.rotation.x = 0;
    this.lensingMesh.add(topArc);

    const bottomArc = new THREE.Mesh(lensGeoTop, lensMat);
    bottomArc.rotation.z = Math.PI;
    this.lensingMesh.add(bottomArc);

    this.group.add(this.lensingMesh);

    // Tilt system slightly for iconic perspective
    this.group.rotation.x = 0.28;
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

      if (this.group) {
        this.group.rotation.y += dx * 0.007;
        this.group.rotation.x += dy * 0.005;
      }
      this.previousMouse = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Smart touch controls (fluid vertical page scrolling + 1-finger black hole rotation)
    attachSmartTouchControls(dom, {
      onDragStart: () => {
        this.isDragging = true;
      },
      onDrag: (dx, dy) => {
        if (this.group) {
          this.group.rotation.y += dx * 0.007;
          this.group.rotation.x += dy * 0.005;
        }
      },
      onDragEnd: () => {
        this.isDragging = false;
      }
    });

    // Toggle controls
    const toggleHorizonBtn = document.getElementById('bh-toggle-horizon');
    const toggleDiskBtn = document.getElementById('bh-toggle-disk');
    const toggleLensingBtn = document.getElementById('bh-toggle-lensing');

    if (toggleHorizonBtn) {
      toggleHorizonBtn.addEventListener('click', () => {
        this.showHorizon = !this.showHorizon;
        this.singularityMesh.visible = this.showHorizon;
        toggleHorizonBtn.classList.toggle('active', this.showHorizon);
        spaceAudio.playTelemetryClick();
      });
    }

    if (toggleDiskBtn) {
      toggleDiskBtn.addEventListener('click', () => {
        this.showDisk = !this.showDisk;
        this.diskMesh.visible = this.showDisk;
        toggleDiskBtn.classList.toggle('active', this.showDisk);
        spaceAudio.playTelemetryClick();
      });
    }

    if (toggleLensingBtn) {
      toggleLensingBtn.addEventListener('click', () => {
        this.showLensing = !this.showLensing;
        this.lensingMesh.visible = this.showLensing;
        toggleLensingBtn.classList.toggle('active', this.showLensing);
        spaceAudio.playTelemetryClick();
      });
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    if (this.visibility && !this.visibility.isVisible()) {
      return;
    }

    if (!this.isDragging && this.group) {
      this.group.rotation.y += 0.003;
      if (this.photonRingMesh) {
        this.photonRingMesh.lookAt(this.camera.position);
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}

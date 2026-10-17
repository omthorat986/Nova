/**
 * NOVA Space Exploration - Interactive 3D Solar System & Orbital Mechanics
 * Features luminous Sun with corona, 8 orbiting planetary bodies,
 * functional Visual Scale vs True Physical AU Scale with smooth lerping,
 * orbit lines dynamic scaling, mouse drag-to-orbit, and wheel zoom controls.
 */
import { PLANETS_DATA } from '../data/planets.js';
import { isWebGLAvailable, ProceduralTextures } from './engine.js';
import { spaceAudio } from './audio.js';
import { getOptimalPixelRatio, createVisibilityObserver, attachSmartTouchControls } from './visibility.js';

export class SolarSystemScene {
  constructor(canvasContainer) {
    this.container = canvasContainer;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.sunMesh = null;
    this.planets = [];
    this.scaleMode = 'visual'; // 'visual' | 'physical'
    this.simulationSpeed = 1.0;
    this.isPaused = false;
    this.focusedPlanet = null;

    // Spherical camera navigation
    this.cameraSpherical = { radius: 80, theta: 0.75, phi: 1.0 };
    this.targetSpherical = { radius: 80, theta: 0.75, phi: 1.0 };
    this.cameraLookTarget = new THREE.Vector3(0, 0, 0);
    this.targetLookTarget = new THREE.Vector3(0, 0, 0);

    this.isDragging = false;
    this.previousMouse = { x: 0, y: 0 };
    this.visibility = null;
    this.isRendering = false;

    this.init();
  }

  init() {
    if (!this.container) return;
    if (!isWebGLAvailable()) return;

    const width = this.container.clientWidth || 900;
    const height = this.container.clientHeight || 550;

    // Scene & Camera (far frustum 5,000 for physical scale zoom)
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);
    this.updateCameraFromSpherical(true);

    // WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(getOptimalPixelRatio());
    this.container.appendChild(this.renderer.domElement);

    // Lighting
    const sunLight = new THREE.PointLight(0xfff5e6, 3.5, 800, 0.4);
    sunLight.position.set(0, 0, 0);
    this.scene.add(sunLight);

    const ambientLight = new THREE.AmbientLight(0x0a1428, 0.35);
    this.scene.add(ambientLight);

    // Build central Sun
    this.buildSun();

    // Build the 8 planets
    this.buildPlanets();

    // Setup UI Controls & Interactive Drag/Zoom
    this.bindControls();
    this.setupInteractions();

    // Window resize
    window.addEventListener('resize', () => {
      if (!this.renderer || !this.camera) return;
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });

    // Viewport-aware visibility observer (pauses WebGL render loop when offscreen)
    this.visibility = createVisibilityObserver(this.container, {
      onVisible: () => {
        if (!this.isRendering) this.animate();
      },
      onHidden: () => {
        this.isRendering = false;
      }
    });

    // Start animation loop
    this.animate();
  }

  buildSun() {
    const sunRadius = 4.2;
    const sunGeo = new THREE.SphereGeometry(sunRadius, 48, 48);
    const sunTex = ProceduralTextures.createSunTexture(1024, 512);
    const sunMat = new THREE.MeshBasicMaterial({ map: sunTex });
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.scene.add(this.sunMesh);

    // Coronal outer glow
    const coronaGeo = new THREE.SphereGeometry(sunRadius * 1.25, 32, 32);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: 0xffaa22,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide
    });
    const coronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
    this.scene.add(coronaMesh);
  }

  buildPlanets() {
    // Proportional astronomical scale based on real AU distances:
    // Earth = 14 units (1 AU)
    // Mercury (0.39 AU) = 5.5
    // Venus (0.72 AU) = 10.1
    // Mars (1.52 AU) = 21.3
    // Jupiter (5.20 AU) = 72.8
    // Saturn (9.58 AU) = 134.1
    // Uranus (19.2 AU) = 268.8
    // Neptune (30.1 AU) = 421.4
    const planetSpecs = [
      { id: 'mercury', name: 'Mercury', size: 0.65, visualDist: 9.0, physDist: 5.5, speed: 0.040, color: 0x9e948c, distAU: '0.39 AU' },
      { id: 'venus', name: 'Venus', size: 0.95, visualDist: 13.5, physDist: 10.1, speed: 0.026, color: 0xe3bb76, distAU: '0.72 AU' },
      { id: 'earth', name: 'Earth', size: 1.05, visualDist: 18.0, physDist: 14.0, speed: 0.018, color: 0x2b82c9, distAU: '1.00 AU' },
      { id: 'mars', name: 'Mars', size: 0.75, visualDist: 23.5, physDist: 21.3, speed: 0.014, color: 0xc1440e, distAU: '1.52 AU' },
      { id: 'jupiter', name: 'Jupiter', size: 2.5, visualDist: 32.5, physDist: 72.8, speed: 0.008, color: 0xc99039, distAU: '5.20 AU' },
      { id: 'saturn', name: 'Saturn', size: 2.1, visualDist: 42.0, physDist: 134.1, speed: 0.006, color: 0xe2bf7d, hasRings: true, distAU: '9.58 AU' },
      { id: 'uranus', name: 'Uranus', size: 1.45, visualDist: 51.5, physDist: 268.8, speed: 0.004, color: 0x4fb9af, distAU: '19.2 AU' },
      { id: 'neptune', name: 'Neptune', size: 1.40, visualDist: 61.0, physDist: 421.4, speed: 0.003, color: 0x274687, distAU: '30.1 AU' }
    ];

    planetSpecs.forEach((spec) => {
      const group = new THREE.Group();

      // Planet Sphere
      const geo = new THREE.SphereGeometry(spec.size, 32, 32);
      const mat = new THREE.MeshStandardMaterial({
        color: spec.color,
        roughness: 0.7,
        metalness: 0.1
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData = { id: spec.id, name: spec.name, distAU: spec.distAU };
      group.add(mesh);

      // Saturn Rings if applicable
      if (spec.hasRings) {
        const ringGeo = new THREE.RingGeometry(spec.size * 1.3, spec.size * 2.3, 40);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xd4b57e,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        group.add(ring);
      }

      const initialDist = this.scaleMode === 'visual' ? spec.visualDist : spec.physDist;
      const orbitLine = this.createOrbitLine(initialDist);
      this.scene.add(orbitLine);

      const angle = Math.random() * Math.PI * 2;
      group.position.set(Math.cos(angle) * initialDist, 0, Math.sin(angle) * initialDist);

      this.scene.add(group);
      this.planets.push({
        spec,
        group,
        mesh,
        orbitLine,
        angle,
        currentDist: initialDist,
        targetDist: initialDist
      });
    });
  }

  createOrbitLine(radius) {
    const segments = 120;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array((segments + 1) * 3);

    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      positions[i * 3] = Math.cos(theta) * radius;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = Math.sin(theta) * radius;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color: 0x5cc8ff,
      transparent: true,
      opacity: 0.16
    });
    return new THREE.Line(geometry, material);
  }

  updateOrbitLineGeometry(line, radius) {
    const positions = line.geometry.attributes.position.array;
    const segments = 120;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      positions[i * 3] = Math.cos(theta) * radius;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = Math.sin(theta) * radius;
    }
    line.geometry.attributes.position.needsUpdate = true;
  }

  setScaleMode(mode) {
    this.scaleMode = mode;
    this.focusedPlanet = null;
    this.targetLookTarget.set(0, 0, 0);

    const visualBtn = document.getElementById('solar-scale-visual-btn');
    const physicalBtn = document.getElementById('solar-scale-physical-btn');

    if (mode === 'physical') {
      if (physicalBtn) physicalBtn.classList.add('active');
      if (visualBtn) visualBtn.classList.remove('active');

      // Set astronomical target distances
      this.planets.forEach(p => {
        p.targetDist = p.spec.physDist;
      });

      // Smoothly pull camera back so the massive scale can be viewed
      this.targetSpherical.radius = 340;
      this.targetSpherical.phi = 1.15;
      this.updateFocusHUD('PHYSICAL SCALE // TRUE RELATIVE AU DISTANCES (EARTH 1 AU → NEPTUNE 30 AU)', true);
    } else {
      if (visualBtn) visualBtn.classList.add('active');
      if (physicalBtn) physicalBtn.classList.remove('active');

      // Set compressed visual distances
      this.planets.forEach(p => {
        p.targetDist = p.spec.visualDist;
      });

      // Move camera closer to observe compressed orbits
      this.targetSpherical.radius = 80;
      this.targetSpherical.phi = 1.0;
      this.updateFocusHUD('VISUAL SCALE // COMPRESSED FOR OBSERVATION', false);
    }

    spaceAudio.playTelemetryClick();
  }

  bindControls() {
    // Scale mode buttons
    const visualBtn = document.getElementById('solar-scale-visual-btn');
    const physicalBtn = document.getElementById('solar-scale-physical-btn');

    if (visualBtn) {
      visualBtn.addEventListener('click', () => this.setScaleMode('visual'));
    }
    if (physicalBtn) {
      physicalBtn.addEventListener('click', () => this.setScaleMode('physical'));
    }

    // Zoom buttons
    const zoomInBtn = document.getElementById('solar-zoom-in-btn');
    const zoomOutBtn = document.getElementById('solar-zoom-out-btn');

    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => {
        this.targetSpherical.radius = Math.max(18, this.targetSpherical.radius * 0.75);
        spaceAudio.playTelemetryClick();
      });
    }

    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => {
        this.targetSpherical.radius = Math.min(550, this.targetSpherical.radius * 1.35);
        spaceAudio.playTelemetryClick();
      });
    }

    // Simulation speed controls
    const speedButtons = document.querySelectorAll('.solar-speed-btn');
    speedButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        speedButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const speedVal = parseFloat(btn.dataset.speed);
        if (speedVal === 0) {
          this.isPaused = true;
        } else {
          this.isPaused = false;
          this.simulationSpeed = speedVal;
        }
        spaceAudio.playTelemetryClick();
      });
    });

    // Reset Orbit View
    const resetCameraBtn = document.getElementById('solar-reset-camera-btn');
    if (resetCameraBtn) {
      resetCameraBtn.addEventListener('click', () => {
        this.focusedPlanet = null;
        this.targetLookTarget.set(0, 0, 0);
        this.targetSpherical.radius = this.scaleMode === 'physical' ? 340 : 80;
        this.targetSpherical.theta = 0.75;
        this.targetSpherical.phi = 1.0;
        this.updateFocusHUD(null);
        spaceAudio.playTelemetryClick();
      });
    }
  }

  setupInteractions() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const dom = this.renderer.domElement;

    // Mouse Drag to Orbit Camera
    dom.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.previousMouse = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.previousMouse.x;
      const dy = e.clientY - this.previousMouse.y;

      this.targetSpherical.theta -= dx * 0.006;
      // Clamp phi to avoid flipping camera over poles
      this.targetSpherical.phi = Math.max(0.15, Math.min(Math.PI / 2 + 0.35, this.targetSpherical.phi - dy * 0.005));

      this.previousMouse = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Mouse Wheel Zoom
    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 1.12 : 0.89;
      this.targetSpherical.radius = Math.max(18, Math.min(550, this.targetSpherical.radius * zoomFactor));
    }, { passive: false });

    // Smart Touch Support for mobile (fluid vertical page scrolling + 1-finger horizontal orbit + 2-finger zoom)
    let initialTouchDist = null;

    dom.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        initialTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });

    attachSmartTouchControls(dom, {
      onDragStart: () => {
        this.isDragging = true;
      },
      onDrag: (dx, dy) => {
        this.targetSpherical.theta -= dx * 0.007;
        this.targetSpherical.phi = Math.max(0.15, Math.min(Math.PI / 2 + 0.35, this.targetSpherical.phi - dy * 0.006));
      },
      onDragEnd: () => {
        this.isDragging = false;
      }
    });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && initialTouchDist) {
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const diff = initialTouchDist - currentDist;
        this.targetSpherical.radius = Math.max(18, Math.min(550, this.targetSpherical.radius + diff * 0.35));
        initialTouchDist = currentDist;
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      initialTouchDist = null;
    });

    // Click to focus planet
    dom.addEventListener('click', (e) => {
      const rect = dom.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, this.camera);
      const meshes = this.planets.map(p => p.mesh);
      const intersects = raycaster.intersectObjects(meshes);

      if (intersects.length > 0) {
        const clickedMesh = intersects[0].object;
        const planetItem = this.planets.find(p => p.mesh === clickedMesh);
        if (planetItem) {
          this.focusOnPlanet(planetItem);
        }
      }
    });
  }

  focusOnPlanet(planetItem) {
    this.focusedPlanet = planetItem;
    this.targetSpherical.radius = planetItem.spec.size * 5 + 6;
    this.updateFocusHUD(`FOCUSING ON ${planetItem.spec.name.toUpperCase()} // ${planetItem.spec.distAU}`, true);
    spaceAudio.playTelemetryClick();
  }

  updateFocusHUD(text, isHighlighted = false) {
    const badge = document.getElementById('solar-focus-badge');
    if (!badge) return;

    if (text) {
      badge.innerHTML = text;
      badge.classList.toggle('active', isHighlighted);
    } else {
      badge.textContent = this.scaleMode === 'physical'
        ? 'PHYSICAL SCALE // TRUE RELATIVE AU DISTANCES'
        : 'VISUAL SCALE // COMPRESSED FOR OBSERVATION';
      badge.classList.remove('active');
    }
  }

  updateCameraFromSpherical(immediate = false) {
    if (!this.camera) return;

    // Smooth damping for spherical coordinates
    if (!immediate) {
      this.cameraSpherical.radius += (this.targetSpherical.radius - this.cameraSpherical.radius) * 0.05;
      this.cameraSpherical.theta += (this.targetSpherical.theta - this.cameraSpherical.theta) * 0.06;
      this.cameraSpherical.phi += (this.targetSpherical.phi - this.cameraSpherical.phi) * 0.06;
      this.cameraLookTarget.lerp(this.targetLookTarget, 0.05);
    } else {
      this.cameraSpherical.radius = this.targetSpherical.radius;
      this.cameraSpherical.theta = this.targetSpherical.theta;
      this.cameraSpherical.phi = this.targetSpherical.phi;
      this.cameraLookTarget.copy(this.targetLookTarget);
    }

    const r = this.cameraSpherical.radius;
    const sinPhi = Math.sin(this.cameraSpherical.phi);
    const cosPhi = Math.cos(this.cameraSpherical.phi);
    const sinTheta = Math.sin(this.cameraSpherical.theta);
    const cosTheta = Math.cos(this.cameraSpherical.theta);

    this.camera.position.x = this.cameraLookTarget.x + r * sinPhi * sinTheta;
    this.camera.position.y = this.cameraLookTarget.y + r * cosPhi;
    this.camera.position.z = this.cameraLookTarget.z + r * sinPhi * cosTheta;
    this.camera.lookAt(this.cameraLookTarget);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    if (this.visibility && !this.visibility.isVisible()) {
      return;
    }

    // Rotate central Sun
    if (this.sunMesh) {
      this.sunMesh.rotation.y += 0.002;
    }

    // Smooth orbital distances scaling transition & orbital revolution
    this.planets.forEach((p) => {
      // Smooth lerp distance towards target scale mode
      p.currentDist += (p.targetDist - p.currentDist) * 0.05;

      // Update orbit line in real time
      this.updateOrbitLineGeometry(p.orbitLine, p.currentDist);

      // Advance orbital revolution
      if (!this.isPaused) {
        p.angle += p.spec.speed * 0.015 * this.simulationSpeed;
        p.group.position.x = Math.cos(p.angle) * p.currentDist;
        p.group.position.z = Math.sin(p.angle) * p.currentDist;
        p.mesh.rotation.y += 0.015;
      }
    });

    // Tracking focused planet
    if (this.focusedPlanet) {
      this.targetLookTarget.copy(this.focusedPlanet.group.position);
    }

    // Update Camera
    this.updateCameraFromSpherical();

    this.renderer.render(this.scene, this.camera);
  }
}

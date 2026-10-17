/**
 * NOVA Space Exploration - "CHOOSE YOUR WORLD" 3D Planetarium Explorer
 * Delivers interactive 3D inspection of all 8 major planets + Sun,
 * with real-time procedural textures, Saturn rings, atmospheric shaders, and animated telemetry.
 */
import { PLANETS_DATA } from '../data/planets.js';
import { ProceduralTextures, createAtmosphereShader, isWebGLAvailable } from './engine.js';
import { spaceAudio } from './audio.js';
import { getOptimalPixelRatio, createVisibilityObserver, attachSmartTouchControls } from './visibility.js';

export class PlanetExplorer {
  constructor(canvasContainer) {
    this.container = canvasContainer;
    this.currentPlanetIndex = 2; // Default to Earth
    this.currentPlanet = PLANETS_DATA[this.currentPlanetIndex];
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.planetGroup = null;
    this.planetMesh = null;
    this.cloudsMesh = null;
    this.ringsMesh = null;
    this.atmosphereMesh = null;
    this.sunGlow = null;
    this.isDragging = false;
    this.hasUserInteracted = false;
    this.previousMouse = { x: 0, y: 0 };
    this.showAtmosphere = true;
    this.visibility = null;
    this.isRendering = false;

    this.init();
  }

  init() {
    if (!this.container) return;

    if (!isWebGLAvailable()) {
      this.initFallback();
      return;
    }

    const width = this.container.clientWidth || 600;
    const height = this.container.clientHeight || 500;

    // Scene & Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 5.0);

    // WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(getOptimalPixelRatio());
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.container.appendChild(this.renderer.domElement);

    // Directional Sun lighting from left-front
    this.dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    this.dirLight.position.set(-6, 2, 5);
    this.scene.add(this.dirLight);

    this.ambientLight = new THREE.AmbientLight(0x0a1428, 0.35);
    this.scene.add(this.ambientLight);

    // Build planet holder
    this.planetGroup = new THREE.Group();
    this.scene.add(this.planetGroup);

    // Render navigation list and UI controls
    this.renderNav();
    this.bindEvents();

    // Load initial planet (Earth)
    this.loadPlanet(this.currentPlanetIndex, false);

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

  renderNav() {
    const navContainer = document.getElementById('planet-selector-nav');
    if (!navContainer) return;

    navContainer.innerHTML = '';
    PLANETS_DATA.forEach((planet, idx) => {
      const btn = document.createElement('button');
      btn.className = `planet-nav-item ${idx === this.currentPlanetIndex ? 'active' : ''}`;
      btn.dataset.index = idx;
      btn.innerHTML = `
        <span class="planet-nav-dot" style="background: ${planet.accentColor}"></span>
        <span class="planet-nav-name">${planet.name.toUpperCase()}</span>
      `;
      btn.addEventListener('click', () => {
        this.selectPlanet(idx);
      });
      navContainer.appendChild(btn);
    });

    // Control toggles
    const atmosphereToggle = document.getElementById('toggle-atmosphere-btn');
    if (atmosphereToggle) {
      atmosphereToggle.addEventListener('click', () => {
        this.showAtmosphere = !this.showAtmosphere;
        if (this.atmosphereMesh) {
          this.atmosphereMesh.visible = this.showAtmosphere;
        }
        if (this.cloudsMesh) {
          this.cloudsMesh.visible = this.showAtmosphere;
        }
        atmosphereToggle.classList.toggle('active', this.showAtmosphere);
      });
    }

    const resetBtn = document.getElementById('reset-planet-camera-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (this.planetGroup) {
          this.planetGroup.rotation.set(0, 0, 0);
        }
        this.camera.position.set(0, 0, 5.0);
      });
    }
  }

  selectPlanet(index) {
    if (index === this.currentPlanetIndex) return;
    spaceAudio.playTelemetryClick();
    this.loadPlanet(index, true);
  }

  loadPlanet(index, animateTransition = true) {
    this.currentPlanetIndex = index;
    this.currentPlanet = PLANETS_DATA[index];

    // Update active nav button
    const navItems = document.querySelectorAll('.planet-nav-item');
    navItems.forEach((btn, idx) => {
      btn.classList.toggle('active', idx === index);
    });

    // Clear previous planet mesh children
    while (this.planetGroup.children.length > 0) {
      const obj = this.planetGroup.children[0];
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
      this.planetGroup.remove(obj);
    }
    this.cloudsMesh = null;
    this.ringsMesh = null;
    this.atmosphereMesh = null;

    const planet = this.currentPlanet;
    const isSun = planet.id === 'sun';
    const radius = 1.35;
    const segments = 64;

    // Adjust light for Sun vs Planets
    if (isSun) {
      this.dirLight.intensity = 0.5;
      this.ambientLight.intensity = 1.8;
    } else {
      this.dirLight.intensity = 2.0;
      this.ambientLight.intensity = 0.35;
    }

    // 1. Base Planet Mesh
    const planetGeo = new THREE.SphereGeometry(radius, segments, segments);
    let planetMat;

    if (planet.id === 'earth') {
      const tex = ProceduralTextures.createEarthTexture(2048, 1024);
      planetMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.65, metalness: 0.1 });
    } else if (planet.id === 'mars') {
      const tex = ProceduralTextures.createMarsTexture(1024, 512);
      planetMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, metalness: 0.05 });
    } else if (planet.id === 'jupiter') {
      const tex = ProceduralTextures.createJupiterTexture(1024, 512);
      planetMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 });
    } else if (planet.id === 'saturn') {
      const tex = ProceduralTextures.createSaturnTexture(1024, 512);
      planetMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 });
    } else if (planet.id === 'sun') {
      const tex = ProceduralTextures.createSunTexture(1024, 512);
      planetMat = new THREE.MeshBasicMaterial({ map: tex });
    } else {
      const tex = ProceduralTextures.createGenericTexture(planet.color, planet.type.includes('Giant'));
      planetMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 });
    }

    this.planetMesh = new THREE.Mesh(planetGeo, planetMat);
    this.planetGroup.add(this.planetMesh);

    // 2. Earth Clouds
    if (planet.id === 'earth') {
      const cloudsGeo = new THREE.SphereGeometry(radius * 1.018, segments, segments);
      const cloudsTex = ProceduralTextures.createEarthCloudsTexture(2048, 1024);
      const cloudsMat = new THREE.MeshStandardMaterial({
        map: cloudsTex,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      this.cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
      this.planetGroup.add(this.cloudsMesh);
    }

    // 3. Saturn Ring System
    if (planet.id === 'saturn') {
      const ringGeo = new THREE.RingGeometry(radius * 1.3, radius * 2.4, 80);
      // Orient ring to equator
      ringGeo.rotateX(-Math.PI / 2);
      const ringTex = ProceduralTextures.createSaturnRingsTexture(1024, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        map: ringTex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95
      });
      this.ringsMesh = new THREE.Mesh(ringGeo, ringMat);
      this.planetGroup.add(this.ringsMesh);
      // Give Saturn its iconic 27-degree axial tilt
      this.planetGroup.rotation.z = 26.7 * (Math.PI / 180);
    } else {
      this.planetGroup.rotation.z = 0.1;
    }

    // 4. Atmosphere Fresnel Glow
    if (planet.hasAtmosphere && !isSun) {
      const atmosColor = planet.atmosphereColor ? parseInt(planet.atmosphereColor.replace('#', '0x')) : 0x5cc8ff;
      const atmosGeo = new THREE.SphereGeometry(radius * 1.12, segments, segments);
      const atmosMat = createAtmosphereShader(atmosColor, 3.8, 1.2);
      this.atmosphereMesh = new THREE.Mesh(atmosGeo, atmosMat);
      this.atmosphereMesh.visible = this.showAtmosphere;
      this.planetGroup.add(this.atmosphereMesh);
    }

    // Update Telemetry Panel with animated counters
    this.updateTelemetryPanel(planet);

    // Section atmospheric accent transition
    this.updateAtmosphericGlow(planet.accentColor);
  }

  updateTelemetryPanel(planet) {
    const nameEl = document.getElementById('planet-telemetry-name');
    const subtitleEl = document.getElementById('planet-telemetry-subtitle');
    const descEl = document.getElementById('planet-telemetry-desc');
    const distEl = document.getElementById('telemetry-distance');
    const diamEl = document.getElementById('telemetry-diameter');
    const dayEl = document.getElementById('telemetry-day');
    const yearEl = document.getElementById('telemetry-year');
    const moonsEl = document.getElementById('telemetry-moons');
    const gravEl = document.getElementById('telemetry-gravity');
    const atmoBar = document.getElementById('telemetry-atmo-bar');
    const atmoText = document.getElementById('telemetry-atmo-text');
    const featuresList = document.getElementById('planet-features-list');

    if (nameEl) nameEl.textContent = planet.name.toUpperCase();
    if (subtitleEl) subtitleEl.textContent = planet.subtitle;
    if (descEl) descEl.textContent = planet.description;
    if (distEl) distEl.textContent = planet.distanceFromSun;
    if (diamEl) diamEl.textContent = planet.diameter;
    if (dayEl) dayEl.textContent = planet.dayLength;
    if (yearEl) yearEl.textContent = planet.yearLength;
    if (moonsEl) moonsEl.textContent = planet.moons;
    if (gravEl) gravEl.textContent = planet.gravity;

    if (atmoBar) {
      atmoBar.style.width = `${Math.floor(planet.atmosphereDensityValue * 100)}%`;
      atmoBar.style.backgroundColor = planet.accentColor;
    }
    if (atmoText) {
      atmoText.textContent = planet.atmosphericDensity;
    }

    if (featuresList && planet.features) {
      featuresList.innerHTML = planet.features.map(f => `<li>● ${f}</li>`).join('');
    }
  }

  updateAtmosphericGlow(colorHex) {
    const bgContainer = document.getElementById('planet-explorer-section');
    if (bgContainer) {
      bgContainer.style.setProperty('--planet-glow-color', colorHex);
    }
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      if (!this.renderer || !this.camera) return;
      const width = this.container.clientWidth;
      const height = this.container.clientHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    });

    const dom = this.renderer.domElement;

    // Drag to rotate
    dom.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.hideInteractionHint();
      this.previousMouse = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.previousMouse.x;
      const dy = e.clientY - this.previousMouse.y;

      if (this.planetGroup) {
        this.planetGroup.rotation.y += dx * 0.007;
        this.planetGroup.rotation.x += dy * 0.005;
      }
      this.previousMouse = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Smart touch controls (distinguishes vertical page scrolling from horizontal 3D planet orbit)
    attachSmartTouchControls(dom, {
      onDragStart: () => {
        this.isDragging = true;
        this.hideInteractionHint();
      },
      onDrag: (dx, dy) => {
        if (this.planetGroup) {
          this.planetGroup.rotation.y += dx * 0.008;
          this.planetGroup.rotation.x += dy * 0.006;
        }
      },
      onDragEnd: () => {
        this.isDragging = false;
      }
    });

    // Wheel zoom
    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.camera.position.z += e.deltaY * 0.003;
      this.camera.position.z = Math.max(3.2, Math.min(8.5, this.camera.position.z));
    }, { passive: false });
  }

  hideInteractionHint() {
    if (this.hasUserInteracted) return;
    this.hasUserInteracted = true;
    const hint = document.getElementById('planet-drag-hint');
    if (hint) {
      hint.style.opacity = '0';
      setTimeout(() => hint.remove(), 400);
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    if (this.visibility && !this.visibility.isVisible()) {
      return;
    }

    if (!this.isDragging && this.planetGroup) {
      this.planetGroup.rotation.y += 0.0025;
      if (this.cloudsMesh) {
        this.cloudsMesh.rotation.y += 0.0008;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  initFallback() {
    this.container.innerHTML = `
      <div class="webgl-fallback-planet">
        <div class="fallback-sphere"></div>
        <div class="fallback-message">Interactive 3D preview mode active.</div>
      </div>
    `;
  }
}

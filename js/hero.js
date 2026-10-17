/**
 * NOVA Space Exploration - Hero 3D Earth Experience (Maximized Scale & Presence)
 * Full-bleed celestial scene featuring an imposing Earth with dual-layer volumetric rim lighting,
 * high-contrast solar grazing, rotating multi-tier clouds, and 4-tier starfield depth.
 */
import { ProceduralTextures, createAtmosphereShader, createCosmicStarfield, isWebGLAvailable } from './engine.js';
import { getOptimalPixelRatio, createVisibilityObserver, attachSmartTouchControls } from './visibility.js';

export class HeroScene {
  constructor(canvasContainer) {
    this.container = canvasContainer;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.earthGroup = null;
    this.earthMesh = null;
    this.cloudsMesh = null;
    this.atmoMesh = null;
    this.starfield = null;
    this.targetCameraZ = 4.8;
    this.currentCameraZ = 14.0; // Starts in deep space for cinematic orbital approach
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.autoRotateSpeed = 0.0014;
    this.mouseParallax = { x: 0, y: 0, targetX: 0, targetY: 0 };
    this.isApproaching = true;
    this.visibility = null;
    this.isRendering = false;
    this.init();
  }

  init() {
    if (!isWebGLAvailable()) {
      this.initFallback();
      return;
    }

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // Scene setup with deep void fog
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x02040a, 0.0006);

    // Camera setup
    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 2500);
    this.camera.position.set(0, 0, this.currentCameraZ);

    // Renderer setup with ACES Filmic tone mapping for cinematic dynamic range
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(getOptimalPixelRatio());
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.container.appendChild(this.renderer.domElement);

    // High-contrast directional solar grazing light (terminator across globe, unlit quadrant behind top-right HUD)
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
    sunLight.position.set(-9.2, 1.5, 2.8);
    this.scene.add(sunLight);

    // Deep space subtle ambient fill (distant starlight)
    const ambientLight = new THREE.AmbientLight(0x040814, 0.22);
    this.scene.add(ambientLight);

    // 4-Tier Cosmological Starfield (adaptive density for mobile vs desktop)
    const isMobile = window.innerWidth < 768;
    const starCount = isMobile ? 6500 : 14000;
    this.starfield = createCosmicStarfield(starCount, 900);
    this.scene.add(this.starfield);

    // Build the imposing Earth system
    this.createEarth();

    // Event listeners
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

    // Start animation loop
    this.animate();
  }

  createEarth() {
    this.earthGroup = new THREE.Group();

    // Position Earth so its massive horizon curves across the right/upper-right
    const isMobile = window.innerWidth < 768;
    const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;

    const posX = isMobile ? 0 : (isTablet ? 1.2 : 2.05);
    const posY = isMobile ? 0.35 : -0.10;
    this.earthGroup.position.set(posX, posY, 0);

    // Maximized Earth Scale: 1.85 radius creates an imposing planetary presence
    const earthRadius = 1.85;
    const segments = isMobile ? 48 : 80;

    // 1. Photorealistic Cinematic Planetary Surface
    const earthGeo = new THREE.SphereGeometry(earthRadius, segments, segments);
    const earthTex = ProceduralTextures.createEarthTexture(2048, 1024);
    const earthBumpTex = ProceduralTextures.createEarthBumpMap(2048, 1024);
    const earthNightTex = ProceduralTextures.createEarthNightTexture(2048, 1024);

    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTex,
      bumpMap: earthBumpTex,
      bumpScale: 0.045,
      roughness: 0.65,
      metalness: 0.06,
      emissiveMap: earthNightTex,
      emissive: new THREE.Color(0xffe0a0),
      emissiveIntensity: 1.2
    });
    this.earthMesh = new THREE.Mesh(earthGeo, earthMat);
    this.earthGroup.add(this.earthMesh);

    // 2. Swirling Cloud Layer
    const cloudsGeo = new THREE.SphereGeometry(earthRadius * 1.012, segments, segments);
    const cloudsTex = ProceduralTextures.createEarthCloudsTexture(2048, 1024);
    const cloudsMat = new THREE.MeshStandardMaterial({
      map: cloudsTex,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
    this.earthGroup.add(this.cloudsMesh);

    // 3. Thin Rayleigh Horizon Atmospheric Glow (Blends seamlessly into deep space vacuum)
    const atmoGeo = new THREE.SphereGeometry(earthRadius * 1.018, segments, segments);
    const atmoMat = createAtmosphereShader(0x48a8ff, 6.2, 1.7);
    this.atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    this.earthGroup.add(this.atmoMesh);

    // Authentic 23.4° axial tilt
    this.earthGroup.rotation.z = 23.44 * (Math.PI / 180);
    this.earthGroup.rotation.x = 0.12;

    this.scene.add(this.earthGroup);
  }

  bindEvents() {
    window.addEventListener('resize', () => this.onResize());

    // Mouse parallax with soft damping
    window.addEventListener('mousemove', (e) => {
      const normX = (e.clientX / window.innerWidth) * 2 - 1;
      const normY = -(e.clientY / window.innerHeight) * 2 + 1;
      this.mouseParallax.targetX = normX * 0.22;
      this.mouseParallax.targetY = normY * 0.14;
    });

    // Drag-to-rotate Earth
    const dom = this.renderer.domElement;
    dom.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging || !this.earthGroup) return;
      const deltaX = e.clientX - this.previousMousePosition.x;
      const deltaY = e.clientY - this.previousMousePosition.y;

      this.earthGroup.rotation.y += deltaX * 0.005;
      this.earthGroup.rotation.x += deltaY * 0.003;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Smart touch controls (allows fluid vertical page scroll, captures horizontal gestures for 3D exploration)
    attachSmartTouchControls(dom, {
      onDragStart: () => {
        this.isDragging = true;
      },
      onDrag: (dx, dy) => {
        if (!this.earthGroup) return;
        this.earthGroup.rotation.y += dx * 0.006;
        this.earthGroup.rotation.x += dy * 0.004;
      },
      onDragEnd: () => {
        this.isDragging = false;
      }
    });
  }

  onResize() {
    if (!this.renderer || !this.camera) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);

    if (this.earthGroup) {
      const isMobile = window.innerWidth < 768;
      const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
      const posX = isMobile ? 0 : (isTablet ? 1.2 : 2.05);
      const posY = isMobile ? 0.35 : -0.10;
      this.earthGroup.position.set(posX, posY, 0);
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    if (this.visibility && !this.visibility.isVisible()) {
      return;
    }

    // Orbital approach camera lerp
    if (this.isApproaching) {
      this.currentCameraZ += (this.targetCameraZ - this.currentCameraZ) * 0.032;
      this.camera.position.z = this.currentCameraZ;
      if (Math.abs(this.currentCameraZ - this.targetCameraZ) < 0.015) {
        this.currentCameraZ = this.targetCameraZ;
        this.isApproaching = false;
      }
    }

    // Mouse parallax smoothing
    this.mouseParallax.x += (this.mouseParallax.targetX - this.mouseParallax.x) * 0.04;
    this.mouseParallax.y += (this.mouseParallax.targetY - this.mouseParallax.y) * 0.04;
    this.camera.position.x = this.mouseParallax.x;
    this.camera.position.y = this.mouseParallax.y;
    this.camera.lookAt(0, 0, 0);

    // Natural Earth planetary rotation & cloud drift
    if (!this.isDragging && this.earthGroup) {
      this.earthGroup.rotation.y += this.autoRotateSpeed;
      if (this.cloudsMesh) {
        this.cloudsMesh.rotation.y += this.autoRotateSpeed * 0.38;
      }
    }

    // Cosmic starfield slow drift & dust particles
    if (this.starfield) {
      this.starfield.rotation.y += 0.00012;
      if (this.starfield.userData && this.starfield.userData.dustPoints) {
        this.starfield.userData.dustPoints.rotation.y += 0.0002;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  initFallback() {
    this.container.innerHTML = `
      <div class="webgl-fallback-earth">
        <div class="fallback-earth-sphere"></div>
        <div class="fallback-atmosphere-glow"></div>
      </div>
    `;
  }
}

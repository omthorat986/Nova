/**
 * NOVA Space Exploration - The Narrative Return to Earth
 * Concludes the cosmic journey with the Pale Blue Dot perspective:
 * "One planet. One civilization. An infinite universe."
 */
import { isWebGLAvailable, ProceduralTextures, createAtmosphereShader } from './engine.js';
import { spaceAudio } from './audio.js';
import { getOptimalPixelRatio, createVisibilityObserver } from './visibility.js';

export class NarrativeReturnScene {
  constructor(canvasContainer) {
    this.container = canvasContainer;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.paleEarth = null;
    this.visibility = null;
    this.isRendering = false;

    this.init();
  }

  init() {
    if (!this.container || !isWebGLAvailable()) return;

    const width = this.container.clientWidth || 600;
    const height = this.container.clientHeight || 400;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 7.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(getOptimalPixelRatio());
    this.container.appendChild(this.renderer.domElement);

    // Directional sunlight
    const light = new THREE.DirectionalLight(0xffffff, 1.8);
    light.position.set(-6, 2, 4);
    this.scene.add(light);

    const ambient = new THREE.AmbientLight(0x050a14, 0.2);
    this.scene.add(ambient);

    // Earth floating far away, solitary
    const earthGeo = new THREE.SphereGeometry(1.0, 48, 48);
    const earthTex = ProceduralTextures.createEarthTexture(1024, 512);
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTex,
      roughness: 0.7,
      metalness: 0.1
    });

    this.paleEarth = new THREE.Mesh(earthGeo, earthMat);
    this.scene.add(this.paleEarth);

    // Subtle thin atmospheric horizon halo
    const atmosGeo = new THREE.SphereGeometry(1.018, 48, 48);
    const atmosMat = createAtmosphereShader(0x48a8ff, 6.0, 1.5);
    const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
    this.scene.add(atmosMesh);

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

    // Animation
    this.animate();
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    if (this.visibility && !this.visibility.isVisible()) {
      return;
    }
    if (this.paleEarth) {
      this.paleEarth.rotation.y += 0.0015;
    }
    this.renderer.render(this.scene, this.camera);
  }
}

import * as THREE from 'three';

export class SceneManager {
  constructor(canvasContainer) {
    this.container = canvasContainer;
    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();
    this.updatables = [];

    // Camera control parameters
    this.defaultCameraPos = new THREE.Vector3(0.0, 1.35, 1.8);
    this.bustTargetY = 1.25;      // Target height for bust / face close-up
    this.fullBodyTargetY = 0.75;  // Target height for full body center
    this.cameraTarget = new THREE.Vector3(0.0, this.bustTargetY, 0.0);
    this.currentCameraDist = 1.8;
    this.targetCameraDist = 1.8;
    this.minDist = 0.75;  // Close-up face zoom
    this.maxDist = 4.2;   // Full body view from head to feet

    // Orbit angles (azimuth & elevation)
    this.orbitTheta = 0.0;       // Horizontal angle
    this.orbitPhi = 0.0;         // Vertical angle
    this.targetOrbitTheta = 0.0;
    this.targetOrbitPhi = 0.0;
    this.isRightDragging = false;
    this.lastMousePos = { x: 0, y: 0 };

    this._initRenderer();
    this._initCamera();
    this._initLights();
    this._initParticles();
    this._bindCameraControls();

    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);

    this._animate = this._animate.bind(this);
    requestAnimationFrame(this._animate);
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.container.appendChild(this.renderer.domElement);
  }

  _initCamera() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 20.0);
    this._updateCameraTransform();
  }

  _bindCameraControls() {
    const dom = this.container;

    // 1. Mouse Wheel Zoom (In / Out)
    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomStep = 0.18;
      if (e.deltaY < 0) {
        // Zoom in towards face
        this.targetCameraDist = Math.max(this.minDist, this.targetCameraDist - zoomStep);
      } else {
        // Zoom out
        this.targetCameraDist = Math.min(this.maxDist, this.targetCameraDist + zoomStep);
      }
    }, { passive: false });

    // 2. Right-click drag to adjust view angle / Orbit
    dom.addEventListener('contextmenu', (e) => e.preventDefault()); // Prevent browser context menu

    dom.addEventListener('mousedown', (e) => {
      if (e.button === 2) { // Right click
        this.isRightDragging = true;
        this.lastMousePos = { x: e.clientX, y: e.clientY };
      } else if (e.button === 1) { // Middle click: Toggle bust / full body view
        e.preventDefault();
        this.setCameraPreset('toggle');
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isRightDragging) return;
      const deltaX = e.clientX - this.lastMousePos.x;
      const deltaY = e.clientY - this.lastMousePos.y;
      this.lastMousePos = { x: e.clientX, y: e.clientY };

      // Orbit around avatar
      this.targetOrbitTheta -= deltaX * 0.008;
      this.targetOrbitPhi += deltaY * 0.006;
      // Clamp vertical elevation to avoid flipped camera
      this.targetOrbitPhi = THREE.MathUtils.clamp(this.targetOrbitPhi, -0.45, 0.55);
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) {
        this.isRightDragging = false;
      }
    });

    // 3. Mobile touch controls: single touch orbit & pinch-to-zoom
    this.touchStartDist = null;
    this.lastTouchPos = null;

    dom.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.lastTouchPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        this.touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });

    dom.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && this.lastTouchPos) {
        const deltaX = e.touches[0].clientX - this.lastTouchPos.x;
        const deltaY = e.touches[0].clientY - this.lastTouchPos.y;
        this.lastTouchPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };

        this.targetOrbitTheta -= deltaX * 0.008;
        this.targetOrbitPhi += deltaY * 0.006;
        this.targetOrbitPhi = THREE.MathUtils.clamp(this.targetOrbitPhi, -0.45, 0.55);
      } else if (e.touches.length === 2 && this.touchStartDist) {
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const diff = (this.touchStartDist - currentDist) * 0.006;
        this.targetCameraDist = THREE.MathUtils.clamp(this.targetCameraDist + diff, this.minDist, this.maxDist);
        this.touchStartDist = currentDist;
      }
    }, { passive: true });

    dom.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) {
        this.touchStartDist = null;
      }
      if (e.touches.length === 1) {
        this.lastTouchPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 0) {
        this.lastTouchPos = null;
      }
    }, { passive: true });
  }

  setCameraPreset(mode = 'toggle') {
    if (mode === 'bust') {
      this.targetCameraDist = 1.8;
      this.targetOrbitTheta = 0.0;
      this.targetOrbitPhi = 0.0;
    } else if (mode === 'full') {
      this.targetCameraDist = 3.6;
      this.targetOrbitTheta = 0.0;
      this.targetOrbitPhi = 0.0;
    } else if (mode === 'toggle') {
      if (this.targetCameraDist > 2.6) {
        this.setCameraPreset('bust');
      } else {
        this.setCameraPreset('full');
      }
    }
  }

  resetCamera() {
    this.setCameraPreset('bust');
  }

  _updateCameraTransform() {
    // Dynamically calculate cameraTarget.y based on currentCameraDist
    const t = THREE.MathUtils.clamp((this.currentCameraDist - 1.5) / (3.6 - 1.5), 0.0, 1.0);
    this.cameraTarget.y = THREE.MathUtils.lerp(this.bustTargetY, this.fullBodyTargetY, t);

    // Calculate spherical position relative to cameraTarget
    const cosPhi = Math.cos(this.orbitPhi);
    const sinPhi = Math.sin(this.orbitPhi);
    const sinTheta = Math.sin(this.orbitTheta);
    const cosTheta = Math.cos(this.orbitTheta);

    const x = this.cameraTarget.x + this.currentCameraDist * cosPhi * sinTheta;
    const y = this.cameraTarget.y + 0.1 + this.currentCameraDist * sinPhi;
    const z = this.cameraTarget.z + this.currentCameraDist * cosPhi * cosTheta;

    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.cameraTarget);
  }

  _initLights() {
    const ambientLight = new THREE.AmbientLight(0xfff5f8, 1.4);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(1.0, 2.5, 1.5);
    this.scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xfce7f3, 0.9);
    fillLight.position.set(-1.0, 1.8, 1.0);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xf472b6, 0.8);
    rimLight.position.set(0.0, 2.0, -1.5);
    this.scene.add(rimLight);
  }

  _createHeartTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = '#f43f5e';
    ctx.shadowColor = '#fb7185';
    ctx.shadowBlur = 16;

    ctx.beginPath();
    ctx.moveTo(64, 40);
    ctx.bezierCurveTo(64, 20, 32, 10, 16, 36);
    ctx.bezierCurveTo(0, 62, 28, 92, 64, 116);
    ctx.bezierCurveTo(100, 92, 128, 62, 112, 36);
    ctx.bezierCurveTo(96, 10, 64, 20, 64, 40);
    ctx.closePath();
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  _initParticles() {
    this.particleGroup = new THREE.Group();
    this.scene.add(this.particleGroup);
    this.activeParticles = [];
    this.heartTexture = this._createHeartTexture();
  }

  spawnHeartParticles(count = 8, origin = new THREE.Vector3(0, 1.4, 0)) {
    for (let i = 0; i < count; i++) {
      const geometry = new THREE.BufferGeometry();
      const vertices = new Float32Array([0, 0, 0]);
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

      const material = new THREE.PointsMaterial({
        color: 0xffffff,
        map: this.heartTexture,
        size: 0.12 + Math.random() * 0.05,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        blending: THREE.NormalBlending
      });

      const particle = new THREE.Points(geometry, material);
      particle.position.copy(origin);
      particle.position.x += (Math.random() - 0.5) * 0.35;
      particle.position.y += (Math.random() - 0.5) * 0.2;
      particle.position.z += (Math.random() - 0.5) * 0.2;

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.45,
        0.35 + Math.random() * 0.45,
        (Math.random() - 0.5) * 0.25
      );

      this.particleGroup.add(particle);
      this.activeParticles.push({ mesh: particle, velocity, life: 1.0 });
    }
  }

  addUpdatable(obj) {
    this.updatables.push(obj);
  }

  removeUpdatable(obj) {
    const idx = this.updatables.indexOf(obj);
    if (idx !== -1) this.updatables.splice(idx, 1);
  }

  _onResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  _animate() {
    requestAnimationFrame(this._animate);
    const delta = this.clock.getDelta();

    // Smooth camera distance & orbit angle lerp
    this.currentCameraDist = THREE.MathUtils.lerp(this.currentCameraDist, this.targetCameraDist, delta * 8.0);
    this.orbitTheta = THREE.MathUtils.lerp(this.orbitTheta, this.targetOrbitTheta, delta * 10.0);
    this.orbitPhi = THREE.MathUtils.lerp(this.orbitPhi, this.targetOrbitPhi, delta * 10.0);
    this._updateCameraTransform();

    // Particle updates
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i];
      p.life -= delta * 1.0;
      p.mesh.position.addScaledVector(p.velocity, delta);
      p.mesh.material.opacity = Math.max(0, p.life);
      if (p.life <= 0) {
        this.particleGroup.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.activeParticles.splice(i, 1);
      }
    }

    for (const item of this.updatables) {
      if (item && typeof item.update === 'function') {
        item.update(delta);
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}

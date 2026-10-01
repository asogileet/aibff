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
    this.targetPanY = 1.25;
    this.currentPanY = 1.25;
    this.targetPanX = 0.0;
    this.currentPanX = 0.0;
    this.isCustomTargetY = false;
    this.cameraTarget = new THREE.Vector3(0.0, this.bustTargetY, 0.0);
    this.currentCameraDist = 1.8;
    this.targetCameraDist = 1.8;
    this.minDist = 0.15;  // Extreme close-up micro zoom on face/eyes
    this.maxDist = 12.0;  // Full panoramic wide distance

    // Orbit angles (azimuth & elevation)
    this.orbitTheta = 0.0;       // Horizontal angle
    this.orbitPhi = 0.0;         // Vertical angle
    this.targetOrbitTheta = 0.0;
    this.targetOrbitPhi = 0.0;
    this.isRightDragging = false;
    this.isMiddleDragging = false;
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
      const zoomStep = 0.2;
      if (e.deltaY < 0) {
        // Zoom in towards face / detail
        this.targetCameraDist = Math.max(this.minDist, this.targetCameraDist - zoomStep);
      } else {
        // Zoom out
        this.targetCameraDist = Math.min(this.maxDist, this.targetCameraDist + zoomStep);
      }
    }, { passive: false });

    // 2. Right-click / Middle-click drag to adjust view angle / Orbit / Pan
    dom.addEventListener('contextmenu', (e) => e.preventDefault()); // Prevent browser context menu

    dom.addEventListener('mousedown', (e) => {
      if (e.button === 2) { // Right click
        this.isRightDragging = true;
        this.lastMousePos = { x: e.clientX, y: e.clientY };
      } else if (e.button === 1) { // Middle click: Pan camera target Y
        this.isMiddleDragging = true;
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        e.preventDefault();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isRightDragging) {
        const deltaX = e.clientX - this.lastMousePos.x;
        const deltaY = e.clientY - this.lastMousePos.y;
        this.lastMousePos = { x: e.clientX, y: e.clientY };

        const isFullscreen = window.innerWidth > 600;
        if (isFullscreen && !e.altKey) {
          // In full-screen mode, right-click drag pans the avatar across the screen
          const panFactor = this.currentCameraDist * 0.0016;
          this.setCameraPan(this.targetPanX - deltaX * panFactor, this.targetPanY + deltaY * panFactor);
        } else if (e.shiftKey) {
          // Shift + Right drag: Pan target height (head to feet)
          this.setCameraTargetY(this.targetPanY + deltaY * 0.005);
        } else {
          // Orbit around avatar
          this.targetOrbitTheta -= deltaX * 0.008;
          this.targetOrbitPhi += deltaY * 0.006;
          this.targetOrbitPhi = THREE.MathUtils.clamp(this.targetOrbitPhi, -1.48, 1.48);
        }
      } else if (this.isMiddleDragging) {
        const deltaX = e.clientX - this.lastMousePos.x;
        const deltaY = e.clientY - this.lastMousePos.y;
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        const panFactor = this.currentCameraDist * 0.0016;
        this.setCameraPan(this.targetPanX - deltaX * panFactor, this.targetPanY + deltaY * panFactor);
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) this.isRightDragging = false;
      if (e.button === 1) this.isMiddleDragging = false;
    });

    // 3. Mobile touch controls: single touch orbit, pinch-to-zoom & two-finger pan height
    this.touchStartDist = null;
    this.lastTouchMidY = null;
    this.lastTouchPos = null;
    let lastTapTime = 0;

    dom.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.lastTouchPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        this.touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        this.lastTouchMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      }
    }, { passive: true });

    dom.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && this.lastTouchPos) {
        const deltaX = e.touches[0].clientX - this.lastTouchPos.x;
        const deltaY = e.touches[0].clientY - this.lastTouchPos.y;
        this.lastTouchPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };

        this.targetOrbitTheta -= deltaX * 0.008;
        this.targetOrbitPhi += deltaY * 0.006;
        this.targetOrbitPhi = THREE.MathUtils.clamp(this.targetOrbitPhi, -1.48, 1.48);
      } else if (e.touches.length === 2 && this.touchStartDist) {
        // Pinch-to-zoom distance
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const distDiff = (this.touchStartDist - currentDist) * 0.008;
        this.targetCameraDist = THREE.MathUtils.clamp(this.targetCameraDist + distDiff, this.minDist, this.maxDist);
        this.touchStartDist = currentDist;

        // Two-finger vertical pan to adjust height from feet to head
        const currentMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        if (this.lastTouchMidY !== null && this.lastTouchMidY !== undefined) {
          const deltaMidY = currentMidY - this.lastTouchMidY;
          this.setCameraTargetY(this.targetPanY + deltaMidY * 0.005);
        }
        this.lastTouchMidY = currentMidY;
      }
    }, { passive: true });

    dom.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) {
        this.touchStartDist = null;
        this.lastTouchMidY = null;
      }
      if (e.touches.length === 1) {
        this.lastTouchPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 0) {
        this.lastTouchPos = null;
        // Double tap detection to quickly reset camera
        const now = Date.now();
        if (now - lastTapTime < 300) {
          this.resetCamera();
        }
        lastTapTime = now;
      }
    }, { passive: true });
  }

  setCameraTargetY(y) {
    this.isCustomTargetY = true;
    this.targetPanY = THREE.MathUtils.clamp(y, -0.2, 2.2);
  }

  setCameraPan(x, y) {
    if (x !== undefined) this.targetPanX = THREE.MathUtils.clamp(x, -6.0, 6.0);
    if (y !== undefined) {
      this.isCustomTargetY = true;
      this.targetPanY = THREE.MathUtils.clamp(y, -0.5, 3.0);
    }
  }

  setCameraPanPreset(preset = 'center') {
    const aspect = this.container.clientWidth / (this.container.clientHeight || 1);
    const distFactor = Math.max(1.0, this.currentCameraDist * 0.4);
    if (preset === 'right') {
      // Moves camera target left so avatar sits on the right side of the screen
      this.setCameraPan(-aspect * 0.55 * distFactor, this.targetPanY);
    } else if (preset === 'left') {
      // Moves camera target right so avatar sits on the left side of the screen
      this.setCameraPan(aspect * 0.55 * distFactor, this.targetPanY);
    } else {
      // Center
      this.setCameraPan(0.0, this.targetPanY);
    }
  }

  setCameraDistance(dist) {
    this.targetCameraDist = THREE.MathUtils.clamp(dist, this.minDist, this.maxDist);
  }

  setCameraOrbit(theta, phi) {
    if (theta !== undefined) this.targetOrbitTheta = theta;
    if (phi !== undefined) this.targetOrbitPhi = THREE.MathUtils.clamp(phi, -1.48, 1.48);
  }

  setCameraPreset(mode = 'toggle') {
    if (mode === 'bust') {
      this.targetCameraDist = 1.8;
      this.targetOrbitTheta = 0.0;
      this.targetOrbitPhi = 0.0;
      this.targetPanY = 1.25;
      this.isCustomTargetY = false;
    } else if (mode === 'full') {
      this.targetCameraDist = 3.6;
      this.targetOrbitTheta = 0.0;
      this.targetOrbitPhi = 0.0;
      this.targetPanY = 0.75;
      this.isCustomTargetY = false;
    } else if (mode === 'top') {
      this.targetCameraDist = 1.1;
      this.targetOrbitTheta = 0.0;
      this.targetOrbitPhi = 1.35; // Looking directly down onto head top
      this.targetPanY = 1.45;
      this.isCustomTargetY = true;
    } else if (mode === 'feet') {
      this.targetCameraDist = 1.2;
      this.targetOrbitTheta = 0.0;
      this.targetOrbitPhi = -1.25; // Looking upward at feet from ground
      this.targetPanY = 0.1;
      this.isCustomTargetY = true;
    } else if (mode === 'toggle') {
      if (this.targetCameraDist > 2.6) {
        this.setCameraPreset('bust');
      } else {
        this.setCameraPreset('full');
      }
    }
  }

  resetCamera() {
    this.targetPanX = 0.0;
    this.setCameraPreset('bust');
  }

  _updateCameraTransform() {
    if (!this.isCustomTargetY) {
      // Dynamically calculate cameraTarget.y based on currentCameraDist
      const t = THREE.MathUtils.clamp((this.currentCameraDist - 1.5) / (3.6 - 1.5), 0.0, 1.0);
      this.targetPanY = THREE.MathUtils.lerp(this.bustTargetY, this.fullBodyTargetY, t);
    }
    this.cameraTarget.x = this.currentPanX;
    this.cameraTarget.y = this.currentPanY;

    // Calculate spherical position relative to cameraTarget
    const cosPhi = Math.cos(this.orbitPhi);
    const sinPhi = Math.sin(this.orbitPhi);
    const sinTheta = Math.sin(this.orbitTheta);
    const cosTheta = Math.cos(this.orbitTheta);

    const x = this.cameraTarget.x + this.currentCameraDist * cosPhi * sinTheta;
    const y = this.cameraTarget.y + this.currentCameraDist * sinPhi;
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

    // Smooth camera distance, pan height & orbit angle lerp
    this.currentCameraDist = THREE.MathUtils.lerp(this.currentCameraDist, this.targetCameraDist, delta * 8.0);
    this.currentPanX = THREE.MathUtils.lerp(this.currentPanX, this.targetPanX, delta * 8.0);
    this.currentPanY = THREE.MathUtils.lerp(this.currentPanY, this.targetPanY, delta * 8.0);
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

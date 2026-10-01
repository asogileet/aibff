import * as THREE from 'three';

export class RaycastManager {
  constructor(sceneManager, avatarController, onHeadPat) {
    this.sceneManager = sceneManager;
    this.avatarController = avatarController;
    this.onHeadPat = onHeadPat;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.isMouseDown = false;
    this.isDragging = false;
    this.startPos = { x: 0, y: 0 };
    this.startTime = 0;
    this.DRAG_THRESHOLD = 5; // Pixels
    this.puppetController = null;

    this._bindEvents();
  }

  setPuppetController(puppetController) {
    this.puppetController = puppetController;
  }

  _bindEvents() {
    const dom = this.sceneManager.renderer.domElement;

    dom.addEventListener('mousedown', (e) => {
      // In puppet mode, lock window dragging completely on left-click so pulling puppet limbs is never interrupted
      if (this.puppetController && this.puppetController.isEnabled) {
        if (e.button === 2) {
          // In small desktop window mode (<=600px), right-click moves the window.
          // In full-screen mode, let SceneManager handle right-click to pan avatar across the screen!
          if (window.innerWidth <= 600) {
            this.isMouseDown = true;
            this.isDragging = false;
            this.startPos = { x: e.screenX, y: e.screenY };
          }
        }
        return;
      }
      if (e.button !== 0) return; // Left click only
      this.isMouseDown = true;
      this.isDragging = false;
      this.startPos = { x: e.screenX, y: e.screenY };
      this.startTime = Date.now();
    });

    window.addEventListener('mousemove', (e) => {
      if (this.puppetController && this.puppetController.isEnabled && !this.isMouseDown) {
        return;
      }
      if (!this.isMouseDown) return;

      const deltaX = e.screenX - this.startPos.x;
      const deltaY = e.screenY - this.startPos.y;
      const distance = Math.hypot(deltaX, deltaY);

      if (distance > this.DRAG_THRESHOLD) {
        this.isDragging = true;
        // Request Electron main process to move transparent window only in small window mode
        if (window.innerWidth <= 600 && window.electronAPI && typeof window.electronAPI.moveWindow === 'function') {
          window.electronAPI.moveWindow({ mouseX: deltaX, mouseY: deltaY });
          this.startPos = { x: e.screenX, y: e.screenY };
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (!this.isMouseDown) return;
      const clickDuration = Date.now() - this.startTime;
      const wasDragging = this.isDragging;

      this.isMouseDown = false;
      this.isDragging = false;

      // If it wasn't a drag and was a quick click, perform raycasting for head pat
      if (!wasDragging && clickDuration < 400) {
        this._checkHeadClick(e);
      }
    });

    // Mobile touch tap detection for head pat
    let touchStartTime = 0;
    let touchStartPos = { x: 0, y: 0 };
    dom.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        touchStartTime = Date.now();
        touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    }, { passive: true });

    dom.addEventListener('touchend', (e) => {
      if (e.changedTouches.length === 1 && Date.now() - touchStartTime < 350) {
        const touch = e.changedTouches[0];
        const dist = Math.hypot(touch.clientX - touchStartPos.x, touch.clientY - touchStartPos.y);
        if (dist < 10) {
          this._checkHeadClick({ clientX: touch.clientX, clientY: touch.clientY });
        }
      }
    }, { passive: true });
  }

  _checkHeadClick(e) {
    const rect = this.sceneManager.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.sceneManager.camera);
    const vrm = this.avatarController ? this.avatarController.getCurrentVRM() : null;

    if (!vrm) return;

    // Check intersection with avatar meshes
    const intersects = this.raycaster.intersectObjects(vrm.scene.children, true);
    if (intersects.length > 0) {
      const hit = intersects[0];
      // Check if clicked point is in upper head region (y >= 1.25)
      if (hit.point.y >= 1.25) {
        if (typeof this.onHeadPat === 'function') {
          this.onHeadPat(hit.point);
        }
      }
    }
  }
}

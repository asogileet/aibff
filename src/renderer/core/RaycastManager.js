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

    this._bindEvents();
  }

  _bindEvents() {
    const dom = this.sceneManager.renderer.domElement;

    dom.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Left click only
      this.isMouseDown = true;
      this.isDragging = false;
      this.startPos = { x: e.screenX, y: e.screenY };
      this.startTime = Date.now();
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isMouseDown) return;

      const deltaX = e.screenX - this.startPos.x;
      const deltaY = e.screenY - this.startPos.y;
      const distance = Math.hypot(deltaX, deltaY);

      if (distance > this.DRAG_THRESHOLD) {
        this.isDragging = true;
        // Request Electron main process to move transparent window
        if (window.electronAPI && typeof window.electronAPI.moveWindow === 'function') {
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

import * as THREE from 'three';

export class RaycastManager {
  constructor(sceneManager, avatarController, onHeadPat, avatarManager = null) {
    this.sceneManager = sceneManager;
    this.avatarController = avatarController;
    this.avatarManager = avatarManager || (avatarController?.slots ? avatarController : null);
    this.onHeadPat = onHeadPat;
    this.mascotPhysicsController = null;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.isMouseDown = false;
    this.isDragging = false;
    this.startPos = { x: 0, y: 0 };
    this.startTime = 0;
    this.DRAG_THRESHOLD = 5; // Pixels
    this.puppetController = null;

    // Avatar physics drag & throw state
    this.draggedSlot = null;
    this.draggedSlotIndex = -1;
    this.initialHitPoint = null;
    this.dragPlane = null;
    this.dragIntersection = new THREE.Vector3();
    this.dragOffset = new THREE.Vector3();
    this.lastDragPos = new THREE.Vector3();
    this.lastDragTime = 0;
    this.dragVelocity = new THREE.Vector3();

    this._bindEvents();
  }

  setMascotPhysicsController(controller) {
    this.mascotPhysicsController = controller;
  }

  setPuppetController(puppetController) {
    this.puppetController = puppetController;
  }

  /**
   * Raycasts into the scene against all active VRM avatars.
   */
  _getHitAvatar(e) {
    const dom = this.sceneManager.renderer.domElement;
    const rect = dom.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.sceneManager.camera);

    const slots = this.avatarController?.getAllSlots ? this.avatarController.getAllSlots() : [];
    let closestHit = null;
    let hitSlot = null;
    let hitSlotIndex = -1;

    slots.forEach((slot, idx) => {
      if (!slot.vrm?.scene) return;
      const intersects = this.raycaster.intersectObjects(slot.vrm.scene.children, true);
      if (intersects.length > 0) {
        if (!closestHit || intersects[0].distance < closestHit.distance) {
          closestHit = intersects[0];
          hitSlot = slot;
          hitSlotIndex = idx;
        }
      }
    });

    return { hit: closestHit, slot: hitSlot, index: hitSlotIndex };
  }

  _bindEvents() {
    const dom = this.sceneManager.renderer.domElement;

    // 1. Mouse Wheel on Avatar: Independent scaling without zooming camera
    dom.addEventListener('wheel', (e) => {
      const hitRes = this._getHitAvatar(e);
      if (hitRes && hitRes.slot) {
        e.preventDefault();
        e.stopPropagation();
        const curScale = hitRes.slot.scale || 1.0;
        const delta = e.deltaY < 0 ? 0.08 : -0.08;
        const newScale = THREE.MathUtils.clamp(curScale + delta, 0.35, 2.5);
        const mgr = this.avatarManager || this.avatarController;
        if (mgr && typeof mgr.setScale === 'function') {
          mgr.setScale(hitRes.index, newScale);
        }
      }
    }, { capture: true, passive: false });

    // 2. Mouse Down: Hit check for avatar drag vs window drag vs joint puppet
    dom.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Left click only

      // When puppet mode is active, ordinary left-click pulls joints; Alt + Left-click allows window moving
      if (this.puppetController && this.puppetController.isEnabled) {
        if (e.altKey && window.innerWidth <= 600 && window.electronAPI) {
          this.isMouseDown = true;
          this.isDragging = false;
          this.startPos = { x: e.screenX, y: e.screenY };
          this.startTime = Date.now();
        }
        return;
      }

      // Holding Alt in small window mode forces dragging the OS window across screens
      if (e.altKey && window.innerWidth <= 600 && window.electronAPI) {
        this.isMouseDown = true;
        this.isDragging = false;
        this.startPos = { x: e.screenX, y: e.screenY };
        this.startTime = Date.now();
        this.draggedSlot = null;
        this.draggedSlotIndex = -1;
        this.initialHitPoint = null;
        return;
      }

      this.isMouseDown = true;
      this.isDragging = false;
      this.startPos = { x: e.screenX, y: e.screenY };
      this.startTime = Date.now();

      // Check if clicking directly on an avatar
      const hitRes = this._getHitAvatar(e);
      if (hitRes && hitRes.slot) {
        this.draggedSlot = hitRes.slot;
        this.draggedSlotIndex = hitRes.index;
        this.initialHitPoint = hitRes.hit.point.clone();

        // Switch active selection if different
        if (this.avatarController.activeIndex !== hitRes.index) {
          this.avatarController.selectAvatar(hitRes.index);
        }

        // Create camera-facing drag plane through avatar position
        const cam = this.sceneManager.camera;
        const camDir = new THREE.Vector3();
        cam.getWorldDirection(camDir);
        this.dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
          camDir.clone().negate(),
          hitRes.slot.vrm.scene.position
        );

        this.raycaster.ray.intersectPlane(this.dragPlane, this.dragIntersection);
        this.dragOffset.subVectors(hitRes.slot.vrm.scene.position, this.dragIntersection);
        this.lastDragPos.copy(hitRes.slot.vrm.scene.position);
        this.lastDragTime = performance.now();
        this.dragVelocity.set(0, 0, 0);
      } else {
        this.draggedSlot = null;
        this.draggedSlotIndex = -1;
        this.initialHitPoint = null;
      }
    });

    // 3. Mouse Move: Avatar translation or Electron window repositioning
    window.addEventListener('mousemove', (e) => {
      if (!this.isMouseDown) return;

      const deltaX = e.screenX - this.startPos.x;
      const deltaY = e.screenY - this.startPos.y;
      const distance = Math.hypot(deltaX, deltaY);

      if (this.draggedSlot && this.dragPlane) {
        if (distance > this.DRAG_THRESHOLD) {
          this.isDragging = true;
          this.draggedSlot.physicsState = 'grabbed';
          this.draggedSlot.velocity.set(0, 0, 0);

          const domElem = this.sceneManager.renderer.domElement;
          const rect = domElem.getBoundingClientRect();
          this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

          this.raycaster.setFromCamera(this.mouse, this.sceneManager.camera);
          if (this.raycaster.ray.intersectPlane(this.dragPlane, this.dragIntersection)) {
            const targetPos = this.dragIntersection.clone().add(this.dragOffset);
            targetPos.z = 0; // Strictly lock Z depth to 2.5D plane
            const minFloorY = this.mascotPhysicsController ? this.mascotPhysicsController.getFloorYAt(targetPos.x) : 0;
            targetPos.y = Math.max(minFloorY, targetPos.y); // Dynamic floor boundary per monitor

            // Clamp horizontal drag position to visible screen boundaries
            const cam = this.sceneManager.camera;
            if (cam) {
              const dist = Math.abs(cam.position.z - targetPos.z);
              const vFov = (cam.fov * Math.PI) / 180;
              const visibleH = 2 * Math.tan(vFov / 2) * dist;
              const visibleW = visibleH * cam.aspect;
              const halfW = visibleW / 2;
              const safeMargin = Math.min(halfW * 0.35, 0.45 * (this.draggedSlot.scale || 1.0));
              targetPos.x = THREE.MathUtils.clamp(targetPos.x, cam.position.x - halfW + safeMargin, cam.position.x + halfW - safeMargin);
            }

            this.draggedSlot.vrm.scene.position.copy(targetPos);
            this.draggedSlot.position.copy(targetPos);
            this.avatarController.updateSelectionRing();

            const now = performance.now();
            const dt = (now - this.lastDragTime) / 1000;
            if (dt > 0.012) {
              this.dragVelocity.subVectors(targetPos, this.lastDragPos).divideScalar(dt);
              this.dragVelocity.z = 0;
              this.lastDragPos.copy(targetPos);
              this.lastDragTime = now;
            }
          }
        }
      } else {
        // Dragging on empty background in small window mode moves the Electron window
        if (distance > this.DRAG_THRESHOLD) {
          this.isDragging = true;
          if (window.innerWidth <= 600 && window.electronAPI && typeof window.electronAPI.moveWindow === 'function') {
            window.electronAPI.moveWindow({ mouseX: deltaX, mouseY: deltaY });
            this.startPos = { x: e.screenX, y: e.screenY };
          }
        }
      }
    });

    // 4. Mouse Up: Head pat vs drop/throw into free fall
    window.addEventListener('mouseup', (e) => {
      if (!this.isMouseDown) return;

      const clickDuration = Date.now() - this.startTime;
      const wasDragging = this.isDragging;

      this.isMouseDown = false;
      this.isDragging = false;

      if (this.draggedSlot) {
        if (!wasDragging && clickDuration < 380) {
          // Quick click: check head pat
          const headThreshold = 1.15 * (this.draggedSlot.scale || 1.0);
          if (this.initialHitPoint && this.initialHitPoint.y >= headThreshold) {
            if (typeof this.onHeadPat === 'function') {
              this.onHeadPat(this.initialHitPoint);
            }
          }
          this.draggedSlot.physicsState = 'idle';
        } else {
          // Released from drag / throw!
          const curFloor = this.mascotPhysicsController ? this.mascotPhysicsController.getFloorYAt(this.draggedSlot.vrm.scene.position.x) : 0;
          const curY = this.draggedSlot.vrm.scene.position.y;
          if (curY > curFloor + 0.05 || Math.abs(this.dragVelocity.y) > 0.25) {
            this.draggedSlot.physicsState = 'falling';
            // Clamp release velocity to safe values
            this.dragVelocity.x = THREE.MathUtils.clamp(this.dragVelocity.x, -5.5, 5.5);
            this.dragVelocity.y = THREE.MathUtils.clamp(this.dragVelocity.y, -7.5, 7.5);
            this.dragVelocity.z = 0;
            this.draggedSlot.velocity.copy(this.dragVelocity);
          } else {
            this.draggedSlot.physicsState = 'idle';
          }
        }

        this.draggedSlot = null;
        this.draggedSlotIndex = -1;
        this.initialHitPoint = null;
      }
    });

    // Mobile touch detection for head pat
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
          const hitRes = this._getHitAvatar(touch);
          if (hitRes && hitRes.hit && hitRes.hit.point.y >= 1.15) {
            if (typeof this.onHeadPat === 'function') {
              this.onHeadPat(hitRes.hit.point);
            }
          }
        }
      }
    }, { passive: true });
  }
}

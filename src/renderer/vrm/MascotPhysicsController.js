import * as THREE from 'three';

/**
 * MascotPhysicsController
 * Lightweight physics and screen roaming engine for desktop VRM avatars.
 * Handles gravity, velocity integration, floor bounce, high-impact landing,
 * and horizontal screen roaming / patrol across the monitor workspace.
 */
export class MascotPhysicsController {
  constructor(sceneManager, avatarManager, options = {}) {
    this.sceneManager = sceneManager;
    this.avatarManager = avatarManager;

    this.gravity = options.gravity !== undefined ? options.gravity : 9.8; // m/s^2

    let storedBounciness = null;
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('aibff_physics_bounciness');
        if (saved !== null) storedBounciness = parseFloat(saved);
      }
    } catch (_) {}
    this.bounciness = (storedBounciness !== null && !isNaN(storedBounciness))
      ? storedBounciness
      : (options.bounciness !== undefined ? options.bounciness : 0.75);

    this.floorY = 0.0; // Floor level in 3D scene space

    this.onAvatarImpact = options.onAvatarImpact || null;
    this.onAvatarLanded = options.onAvatarLanded || null;
    this.onWallBounce = options.onWallBounce || null;
    this.onHandGrab = options.onHandGrab || null;
    this.onHandFling = options.onHandFling || null;

    // Hand tracking & interaction state (手部偵測、人偶黏手、甩飛)
    this.isHandGrabbed = false;
    this.grabbedHandId = null;
    this.lastHand3DPos = new THREE.Vector3();
    this.handGrabOffset = new THREE.Vector3();
    this.handVelHistory = [];
    this.lastHandTime = 0;
    this.lastFlingTime = 0;
    this._lastPinchingState = false;
    this._lastWallBounceTime = 0;

    // Base bone node cache for restoring postures
    this.baseHipsPositions = new Map();
    this.displayLayout = null;
  }

  setDisplayLayout(layout) {
    this.displayLayout = layout;
  }

  /**
   * Calculates the adaptive floor Y in 3D world space corresponding to the physical display at 3D X coordinate.
   */
  getFloorYAt(x) {
    if (!this.displayLayout || !this.displayLayout.bounds || !this.displayLayout.displays?.length) {
      return this.floorY;
    }
    const cam = this.sceneManager?.camera;
    if (!cam) return this.floorY;

    const bounds = this.displayLayout.bounds;
    const vFov = (cam.fov * Math.PI) / 180;
    const dist = this.sceneManager.currentCameraDist || 3.3;
    const visibleH = 2 * Math.tan(vFov / 2) * dist;
    const visibleW = visibleH * cam.aspect;

    // Convert 3D world X to canvas screen pixel X using camera NDC projection
    const testVec = new THREE.Vector3(x, this.floorY, 0).project(cam);
    const screenNormX = THREE.MathUtils.clamp((testVec.x + 1.0) / 2.0, 0.0, 1.0);
    const pixelX = bounds.x + screenNormX * bounds.width;

    // Find the physical display that contains pixelX
    const disp = this.displayLayout.displays.find(d => pixelX >= d.x && pixelX < d.x + d.width)
      || this.displayLayout.displays[0];

    if (!disp) return this.floorY;

    // The floor is positioned ~48px above the bottom of this specific display (avoiding taskbar)
    const dispBottomY = disp.y + disp.height - 48;
    const normY = (dispBottomY - bounds.y) / bounds.height;
    const floor3D = (cam.position.y + visibleH / 2) - normY * visibleH;

    return Math.max(this.floorY, floor3D);
  }

  setGravity(val) {
    this.gravity = Math.max(0, val);
  }

  setBounciness(val) {
    this.bounciness = THREE.MathUtils.clamp(val, 0, 1.25);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('aibff_physics_bounciness', this.bounciness.toString());
      }
    } catch (_) {}
    return this.bounciness;
  }

  getBounciness() {
    return this.bounciness;
  }

  /**
   * Projects 2D screen pixel coordinates (e.g. from HandTracker or mouse) onto the 3D scene plane (Z = 0).
   */
  unprojectTo3D(screenX, screenY, out = new THREE.Vector3()) {
    const cam = this.sceneManager?.camera;
    if (!cam) return out.set(0, 0, 0);

    const ndcX = (screenX / window.innerWidth) * 2 - 1;
    const ndcY = -(screenY / window.innerHeight) * 2 + 1;

    if (!this._raycaster) this._raycaster = new THREE.Raycaster();
    if (!this._planeZ0) this._planeZ0 = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

    this._raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam);
    this._raycaster.ray.intersectPlane(this._planeZ0, out);
    return out;
  }

  /**
   * Processes hand tracking input (from HandTracker, MotionTracker, or cursor)
   * to stick avatar to user's hand and allow flinging the avatar with physics collision.
   */
  handleHandUpdate(handData) {
    if (!handData) return;
    const activeSlot = this.avatarManager?.getActiveSlot?.();
    if (!activeSlot || !activeSlot.vrm?.scene) return;

    const hands = handData.hands || (handData.isHandDetected ? [{ x: handData.x, y: handData.y, isPinching: handData.isPinching }] : []);
    const now = performance.now();

    if (hands.length === 0 || !handData.isHandDetected) {
      if (this.isHandGrabbed) {
        this._flingAvatar(activeSlot, now);
      }
      return;
    }

    const primaryHand = hands[0];
    const hand3D = this.unprojectTo3D(primaryHand.x, primaryHand.y);
    const scale = activeSlot.scale || 1.0;

    if (this.isHandGrabbed) {
      const dt = Math.max(0.005, (now - this.lastHandTime) / 1000);
      const instV = new THREE.Vector3().subVectors(hand3D, this.lastHand3DPos).divideScalar(dt);
      instV.z = 0;

      this.handVelHistory.push({ v: instV, time: now });
      this.handVelHistory = this.handVelHistory.filter(h => now - h.time <= 140);

      this.lastHand3DPos.copy(hand3D);
      this.lastHandTime = now;

      // Position avatar with hand
      const targetPos = hand3D.clone().add(this.handGrabOffset);
      targetPos.z = 0;
      const minFloor = this.getFloorYAt(targetPos.x);
      targetPos.y = Math.max(minFloor, targetPos.y);

      activeSlot.vrm.scene.position.copy(targetPos);
      activeSlot.position.copy(targetPos);
      activeSlot.physicsState = 'grabbed';
      this.avatarManager.updateSelectionRing();

      // Compute weighted velocity for flinging
      let avgVx = 0, avgVy = 0;
      if (this.handVelHistory.length > 0) {
        for (const item of this.handVelHistory) {
          avgVx += item.v.x;
          avgVy += item.v.y;
        }
        avgVx /= this.handVelHistory.length;
        avgVy /= this.handVelHistory.length;
      }
      const handSpeed = Math.hypot(avgVx, avgVy);

      // Check fling conditions:
      const wasPinching = this._lastPinchingState;
      this._lastPinchingState = !!primaryHand.isPinching;

      // Fling when pinch released or rapid hand flick/fling
      if ((wasPinching && !primaryHand.isPinching && handSpeed > 0.5) || (handSpeed > 2.0)) {
        this._flingAvatar(activeSlot, now, avgVx, avgVy);
      }
    } else {
      // Cooldown after flinging so avatar doesn't instantly re-grab
      if (now - this.lastFlingTime < 450) return;

      const avatarPos = activeSlot.vrm.scene.position;
      const avatarCenterY = avatarPos.y + 0.65 * scale;
      const dist = Math.hypot(hand3D.x - avatarPos.x, hand3D.y - avatarCenterY);
      const stickRadius = 0.58 * scale; // Generous stick distance (~0.6m in VRM space)

      if (dist <= stickRadius) {
        // STICK TO HAND!
        this.isHandGrabbed = true;
        this.grabbedHandId = primaryHand.id || 'primary';
        activeSlot.physicsState = 'grabbed';
        activeSlot.velocity.set(0, 0, 0);

        this.handGrabOffset.subVectors(avatarPos, hand3D);
        this.lastHand3DPos.copy(hand3D);
        this.lastHandTime = now;
        this.handVelHistory = [];
        this._lastPinchingState = !!primaryHand.isPinching;

        if (typeof this.onHandGrab === 'function') {
          this.onHandGrab(activeSlot);
        }
      }
    }
  }

  _flingAvatar(slot, now, flingVx = null, flingVy = null) {
    if (!this.isHandGrabbed) return;
    this.isHandGrabbed = false;
    this.lastFlingTime = now;

    let vx = flingVx;
    let vy = flingVy;

    if (vx === null || vy === null) {
      let sumX = 0, sumY = 0;
      if (this.handVelHistory.length > 0) {
        for (const item of this.handVelHistory) {
          sumX += item.v.x;
          sumY += item.v.y;
        }
        vx = sumX / this.handVelHistory.length;
        vy = sumY / this.handVelHistory.length;
      } else {
        vx = 0;
        vy = 0;
      }
    }

    // Apply lively fling boost
    const boost = 1.35;
    const finalVx = THREE.MathUtils.clamp(vx * boost, -12, 12);
    const finalVy = THREE.MathUtils.clamp(vy * boost, -12, 12);

    slot.physicsState = 'falling';
    slot.velocity.set(finalVx, finalVy, 0);

    const speed = Math.hypot(finalVx, finalVy);
    if (typeof this.onHandFling === 'function') {
      this.onHandFling(slot, speed);
    }
  }

  /**
   * Drops an avatar from high above for playful physics demonstration.
   */
  dropAvatar(index = this.avatarManager.activeIndex, height = 2.2) {
    const slot = this.avatarManager.slots[index];
    if (!slot || !slot.vrm?.scene) return;

    slot.vrm.scene.position.y = height;
    slot.position.y = height;
    slot.velocity.set((Math.random() - 0.5) * 0.5, 0, 0);
    slot.physicsState = 'falling';
    this.avatarManager.updateSelectionRing();
  }

  /**
   * Toggles horizontal screen patrol for the specified avatar slot.
   */
  togglePatrol(index = this.avatarManager.activeIndex) {
    const slot = this.avatarManager.slots[index];
    if (!slot) return false;

    if (slot.physicsState === 'patrol') {
      slot.physicsState = 'idle';
      if (slot.vrm?.scene) {
        slot.vrm.scene.rotation.y = this.avatarManager.getFrontRotation(slot.costumeKey);
      }
      this._resetAvatarLimbs(slot);
      return false;
    } else {
      slot.physicsState = 'patrol';
      slot.velocity.set(0, 0, 0);
      if (slot.vrm?.scene) {
        const base = this.avatarManager.getFrontRotation(slot.costumeKey);
        slot.vrm.scene.rotation.y = (slot.patrolDir === -1) ? (base - Math.PI * 0.45) : (base + Math.PI * 0.45);
      }
      return true;
    }
  }

  /**
   * Main physics step called on each animation frame by SceneManager.
   */
  update(delta) {
    const slots = this.avatarManager.getAllSlots();
    if (!slots || slots.length === 0) return;

    const cam = this.sceneManager.camera;
    const dt = Math.min(delta, 0.05); // Clamp dt to prevent tunneling on frame drops

    slots.forEach((slot, idx) => {
      if (!slot.vrm?.scene) return;

      const vrm = slot.vrm;
      const humanoid = vrm.humanoid;
      const scenePos = vrm.scene.position;

      // 1. Grabbed State: Avatar being held in the air by user's cursor
      if (slot.physicsState === 'grabbed') {
        this._updateDanglingLimbAnimation(humanoid);
        return;
      }

      // 2. High-Impact Landed State: Butt-fall or squat recovery timer
      if (slot.physicsState === 'impact') {
        slot.impactTimer -= dt;
        this._updateImpactPosture(humanoid, slot);
        if (slot.impactTimer <= 0) {
          slot.physicsState = 'idle';
          this._resetAvatarLimbs(slot);
        }
        return;
      }

      // 3. Screen Roaming / Patrol Mode: Running back and forth across desktop
      if (slot.physicsState === 'patrol') {
        this._updatePatrolMovement(slot, dt, cam);
        this._updateRunningLimbAnimation(humanoid, dt);
        return;
      }

      // 4. Free Falling & Gravity Physics
      if (slot.physicsState === 'falling') {
        // Integrate gravity
        slot.velocity.y -= this.gravity * dt;
        slot.velocity.z = 0;

        // Apply velocity to 3D scene position
        scenePos.addScaledVector(slot.velocity, dt);
        scenePos.z = 0; // Strictly lock Z to 2.5D plane

        // 4-Border screen collision: Left wall, Right wall, Top ceiling bounce using NDC projection
        if (cam) {
          const testPos = scenePos.clone();
          testPos.y += 0.6 * (slot.scale || 1.0);
          const ndc = testPos.project(cam);
          const ndcLimit = 0.88;
          const now = performance.now();
          const canNotify = now - this._lastWallBounceTime > 250;

          // Left border bounce
          if (ndc.x <= -ndcLimit && slot.velocity.x < 0) {
            scenePos.x += 0.06;
            slot.velocity.x = Math.abs(slot.velocity.x) * this.bounciness; // Bounce right inward
            if (canNotify) {
              this._lastWallBounceTime = now;
              if (typeof this.onWallBounce === 'function') this.onWallBounce(slot, 'left', Math.abs(slot.velocity.x));
            }
          } else if (ndc.x >= ndcLimit && slot.velocity.x > 0) {
            // Right border bounce
            scenePos.x -= 0.06;
            slot.velocity.x = -Math.abs(slot.velocity.x) * this.bounciness; // Bounce left inward
            if (canNotify) {
              this._lastWallBounceTime = now;
              if (typeof this.onWallBounce === 'function') this.onWallBounce(slot, 'right', Math.abs(slot.velocity.x));
            }
          }

          // Top ceiling bounce (when flung high into the air)
          if (ndc.y >= 0.88 && slot.velocity.y > 0) {
            scenePos.y -= 0.06;
            slot.velocity.y = -Math.abs(slot.velocity.y) * this.bounciness; // Bounce downward
            if (canNotify) {
              this._lastWallBounceTime = now;
              if (typeof this.onWallBounce === 'function') this.onWallBounce(slot, 'top', Math.abs(slot.velocity.y));
            }
          }
        }

        slot.position.copy(scenePos);

        // Gentle air drag damping on horizontal speed
        slot.velocity.x *= Math.pow(0.92, dt * 60);

        // Animate limbs slightly while falling (arms outward for balance)
        this._updateFallingLimbAnimation(humanoid);

        // Adaptive floor collision detection across multi-monitor setup
        const curFloor = this.getFloorYAt(scenePos.x);
        if (scenePos.y <= curFloor) {
          scenePos.y = curFloor;
          slot.position.y = curFloor;

          const impactSpeed = -slot.velocity.y;

          if (impactSpeed > 0.6 && this.bounciness > 0.1) {
            // Rebound bounce
            slot.velocity.y = impactSpeed * this.bounciness;
            slot.velocity.x *= 0.88; // gentle floor friction

            const now = performance.now();
            if (now - this._lastWallBounceTime > 250) {
              this._lastWallBounceTime = now;
              if (typeof this.onWallBounce === 'function') this.onWallBounce(slot, 'floor', impactSpeed);
            }

            // Severe fall impact (> 4.2 m/s drop speed AND low bounciness): trigger dizzy butt-fall
            if (impactSpeed > 4.2 && this.bounciness < 0.45) {
              slot.physicsState = 'impact';
              slot.impactTimer = 1.35;
              slot.velocity.set(0, 0, 0);
              if (typeof this.onAvatarImpact === 'function') {
                this.onAvatarImpact(slot, impactSpeed);
              }
            }
          } else {
            // Gentle landing: settle down
            slot.velocity.set(0, 0, 0);
            slot.physicsState = 'idle';
            this._resetAvatarLimbs(slot);
            if (typeof this.onAvatarLanded === 'function') {
              this.onAvatarLanded(slot);
            }
          }

          this.avatarManager.updateSelectionRing();
        }
      }

      // Safety Clamp & Out-of-bounds rescue: Guarantee avatar stays within visible and floor limits
      if (slot.physicsState !== 'grabbed') {
        const curFloor = this.getFloorYAt(scenePos.x);
        if (scenePos.y < curFloor - 0.25 || isNaN(scenePos.y)) {
          scenePos.y = curFloor;
          slot.position.y = curFloor;
          slot.velocity.y = Math.max(0, slot.velocity.y);
        }
        if (cam) {
          const testPos = scenePos.clone();
          testPos.y += 0.6 * (slot.scale || 1.0);
          const ndc = testPos.project(cam);
          if (ndc.x > 0.94) {
            scenePos.x -= 0.08;
            slot.position.x = scenePos.x;
            slot.velocity.x = Math.min(0, slot.velocity.x);
            slot.patrolDir = -1;
          } else if (ndc.x < -0.94) {
            scenePos.x += 0.08;
            slot.position.x = scenePos.x;
            slot.velocity.x = Math.max(0, slot.velocity.x);
            slot.patrolDir = 1;
          }
          if (isNaN(scenePos.x)) {
            scenePos.x = 0;
            slot.position.x = scenePos.x;
            slot.velocity.x = 0;
          }
        }
      }
      scenePos.z = 0;
      slot.position.z = 0;
    });
  }

  /**
   * Rescues all avatars back to screen center and grounded on floor.
   */
  rescueAllAvatars() {
    const slots = this.avatarManager?.getAllSlots?.();
    if (!slots || slots.length === 0) return;
    slots.forEach((slot, idx) => {
      if (!slot.vrm?.scene) return;
      const targetX = slots.length > 1 ? (idx - (slots.length - 1) / 2) * 0.8 : 0.0;
      const targetY = this.getFloorYAt(targetX);
      slot.vrm.scene.position.set(targetX, targetY, 0);
      slot.position.set(targetX, targetY, 0);
      slot.velocity.set(0, 0, 0);
      slot.physicsState = 'idle';
      if (slot.vrm.scene) {
        slot.vrm.scene.rotation.y = this.avatarManager.getFrontRotation(slot.costumeKey);
      }
      this._resetAvatarLimbs(slot);
    });
    this.avatarManager.updateSelectionRing();
  }

  /**
   * Horizontal screen roaming calculation based on camera frustum boundaries.
   */
  _updatePatrolMovement(slot, dt, cam) {
    const scenePos = slot.vrm.scene.position;
    const speed = (slot.patrolSpeed || 0.85) * (slot.scale || 1.0);

    // Dynamic screen NDC boundary check
    const checkPos = scenePos.clone();
    checkPos.y += 0.6 * (slot.scale || 1.0);
    const ndc = checkPos.project(cam);
    const ndcBoundary = 0.88;

    // Flip patrol direction when reaching screen edge
    if (ndc.x >= ndcBoundary && (slot.patrolDir || 1) > 0) {
      slot.patrolDir = -1;
    } else if (ndc.x <= -ndcBoundary && (slot.patrolDir || 1) < 0) {
      slot.patrolDir = 1;
    }

    // Safety step clamping: if avatar pushed or dragged past boundary, steer inward
    if (ndc.x > 0.92) {
      scenePos.x -= speed * dt * 1.5;
      slot.patrolDir = -1;
    } else if (ndc.x < -0.92) {
      scenePos.x += speed * dt * 1.5;
      slot.patrolDir = 1;
    } else {
      scenePos.x += (slot.patrolDir || 1) * speed * dt;
    }

    scenePos.z = 0; // Strictly lock Z depth
    slot.velocity.z = 0;

    // Adaptive floor level stepping across monitors
    const targetFloor = this.getFloorYAt(scenePos.x);
    scenePos.y = THREE.MathUtils.lerp(scenePos.y, targetFloor, Math.min(1.0, 8.0 * dt));
    slot.position.copy(scenePos);

    const baseFacing = this.avatarManager.getFrontRotation(slot.costumeKey);
    const targetFacing = (slot.patrolDir === -1) ? (baseFacing - Math.PI * 0.45) : (baseFacing + Math.PI * 0.45);
    slot.vrm.scene.rotation.y = THREE.MathUtils.lerp(slot.vrm.scene.rotation.y, targetFacing, Math.min(1.0, 12.0 * dt));

    // Dynamic scale: If custom vanishing point is NOT configured, compensate camera perspective depth
    // to maintain uniform apparent height across monitors; if custom vanishing point IS configured,
    // preserve off-axis perspective scaling (closer to VP is smaller, further is bigger).
    const hasVP = Boolean(this.sceneManager?.hasCustomVanishingPoint?.());
    const baseScale = slot.scale || 1.0;
    if (!hasVP && cam) {
      const camDist = cam.position.distanceTo(scenePos);
      const refDist = this.sceneManager.currentCameraDist || 3.3;
      const comp = THREE.MathUtils.clamp(camDist / refDist, 0.65, 1.5);
      slot.vrm.scene.scale.setScalar(baseScale * comp);
    } else {
      slot.vrm.scene.scale.setScalar(baseScale);
    }

    this.avatarManager.updateSelectionRing();
  }

  /**
   * Cute dangling animation when avatar is picked up and held in the air.
   */
  _updateDanglingLimbAnimation(humanoid) {
    if (!humanoid) return;
    const t = performance.now() * 0.008;

    const leftUpperArm = humanoid.getNormalizedBoneNode('leftUpperArm');
    const rightUpperArm = humanoid.getNormalizedBoneNode('rightUpperArm');
    const leftUpperLeg = humanoid.getNormalizedBoneNode('leftUpperLeg');
    const rightUpperLeg = humanoid.getNormalizedBoneNode('rightUpperLeg');
    const leftLowerLeg = humanoid.getNormalizedBoneNode('leftLowerLeg');
    const rightLowerLeg = humanoid.getNormalizedBoneNode('rightLowerLeg');

    // Arms raised in surprise / dangling
    if (leftUpperArm) {
      leftUpperArm.rotation.z = Math.PI * 0.28 + Math.sin(t * 1.5) * 0.08;
      leftUpperArm.rotation.x = 0.15;
    }
    if (rightUpperArm) {
      rightUpperArm.rotation.z = -Math.PI * 0.28 - Math.sin(t * 1.5) * 0.08;
      rightUpperArm.rotation.x = 0.15;
    }

    // Little kicking / dangling legs
    if (leftUpperLeg) leftUpperLeg.rotation.x = Math.sin(t) * 0.28;
    if (rightUpperLeg) rightUpperLeg.rotation.x = -Math.sin(t) * 0.28;
    if (leftLowerLeg) leftLowerLeg.rotation.x = -Math.max(0, -Math.sin(t) * 0.35);
    if (rightLowerLeg) rightLowerLeg.rotation.x = -Math.max(0, Math.sin(t) * 0.35);
  }

  /**
   * Falling limb posture for aerial balance.
   */
  _updateFallingLimbAnimation(humanoid) {
    if (!humanoid) return;
    const leftUpperArm = humanoid.getNormalizedBoneNode('leftUpperArm');
    const rightUpperArm = humanoid.getNormalizedBoneNode('rightUpperArm');
    const leftUpperLeg = humanoid.getNormalizedBoneNode('leftUpperLeg');
    const rightUpperLeg = humanoid.getNormalizedBoneNode('rightUpperLeg');

    if (leftUpperArm) leftUpperArm.rotation.z = Math.PI * 0.22;
    if (rightUpperArm) rightUpperArm.rotation.z = -Math.PI * 0.22;
    if (leftUpperLeg) leftUpperLeg.rotation.x = 0.1;
    if (rightUpperLeg) rightUpperLeg.rotation.x = 0.1;
  }

  /**
   * Heavy impact posture: Butt-fall / squat cushion upon hard landing.
   */
  _updateImpactPosture(humanoid, slot) {
    if (!humanoid) return;
    const hips = humanoid.getNormalizedBoneNode('hips');
    const leftUpperLeg = humanoid.getNormalizedBoneNode('leftUpperLeg');
    const rightUpperLeg = humanoid.getNormalizedBoneNode('rightUpperLeg');
    const leftLowerLeg = humanoid.getNormalizedBoneNode('leftLowerLeg');
    const rightLowerLeg = humanoid.getNormalizedBoneNode('rightLowerLeg');
    const leftUpperArm = humanoid.getNormalizedBoneNode('leftUpperArm');
    const rightUpperArm = humanoid.getNormalizedBoneNode('rightUpperArm');

    if (hips) {
      if (!this.baseHipsPositions.has(slot.id)) {
        this.baseHipsPositions.set(slot.id, hips.position.y);
      }
      const baseY = this.baseHipsPositions.get(slot.id) || 0.8;
      // Lower hips towards floor
      hips.position.y = baseY - 0.28;
    }

    if (leftUpperLeg) leftUpperLeg.rotation.set(-0.95, 0, -0.2);
    if (rightUpperLeg) rightUpperLeg.rotation.set(-0.95, 0, 0.2);
    if (leftLowerLeg) leftLowerLeg.rotation.set(-1.3, 0, 0);
    if (rightLowerLeg) rightLowerLeg.rotation.set(-1.3, 0, 0);

    // Hands touching floor or head in dizzy reaction
    if (leftUpperArm) leftUpperArm.rotation.set(0.3, 0, 0.6);
    if (rightUpperArm) rightUpperArm.rotation.set(0.3, 0, -0.6);
  }

  /**
   * Running locomotion limb swing for patrol mode.
   */
  _updateRunningLimbAnimation(humanoid, dt) {
    if (!humanoid) return;
    const runFreq = 11.0;
    const t = performance.now() * 0.001;
    const swing = Math.sin(t * runFreq);

    const leftUpperLeg = humanoid.getNormalizedBoneNode('leftUpperLeg');
    const rightUpperLeg = humanoid.getNormalizedBoneNode('rightUpperLeg');
    const leftLowerLeg = humanoid.getNormalizedBoneNode('leftLowerLeg');
    const rightLowerLeg = humanoid.getNormalizedBoneNode('rightLowerLeg');
    const leftUpperArm = humanoid.getNormalizedBoneNode('leftUpperArm');
    const rightUpperArm = humanoid.getNormalizedBoneNode('rightUpperArm');
    const leftLowerArm = humanoid.getNormalizedBoneNode('leftLowerArm');
    const rightLowerArm = humanoid.getNormalizedBoneNode('rightLowerArm');

    if (leftUpperLeg) leftUpperLeg.rotation.x = swing * 0.72;
    if (rightUpperLeg) rightUpperLeg.rotation.x = -swing * 0.72;
    if (leftLowerLeg) leftLowerLeg.rotation.x = -Math.max(0, -swing * 1.25);
    if (rightLowerLeg) rightLowerLeg.rotation.x = -Math.max(0, swing * 1.25);

    if (leftUpperArm) {
      leftUpperArm.rotation.x = swing * 0.6;
      leftUpperArm.rotation.z = 0.25;
    }
    if (rightUpperArm) {
      rightUpperArm.rotation.x = -swing * 0.6;
      rightUpperArm.rotation.z = -0.25;
    }
    if (leftLowerArm) leftLowerArm.rotation.set(1.25, 0, 0);
    if (rightLowerArm) rightLowerArm.rotation.set(1.25, 0, 0);
  }

  /**
   * Resets limbs to natural relaxed standing pose.
   */
  _resetAvatarLimbs(slot) {
    const humanoid = slot.vrm?.humanoid;
    if (!humanoid) return;

    const hips = humanoid.getNormalizedBoneNode('hips');
    if (hips && this.baseHipsPositions.has(slot.id)) {
      hips.position.y = this.baseHipsPositions.get(slot.id);
    }

    const leftUpperArm = humanoid.getNormalizedBoneNode('leftUpperArm');
    const rightUpperArm = humanoid.getNormalizedBoneNode('rightUpperArm');
    const leftLowerArm = humanoid.getNormalizedBoneNode('leftLowerArm');
    const rightLowerArm = humanoid.getNormalizedBoneNode('rightLowerArm');
    const leftUpperLeg = humanoid.getNormalizedBoneNode('leftUpperLeg');
    const rightUpperLeg = humanoid.getNormalizedBoneNode('rightUpperLeg');
    const leftLowerLeg = humanoid.getNormalizedBoneNode('leftLowerLeg');
    const rightLowerLeg = humanoid.getNormalizedBoneNode('rightLowerLeg');

    if (leftUpperArm) leftUpperArm.rotation.set(0.08, 0, Math.PI * 0.38);
    if (rightUpperArm) rightUpperArm.rotation.set(0.08, 0, -Math.PI * 0.38);
    if (leftLowerArm) leftLowerArm.rotation.set(0, 0, 0);
    if (rightLowerArm) rightLowerArm.rotation.set(0, 0, 0);
    if (leftUpperLeg) leftUpperLeg.rotation.set(0, 0, 0);
    if (rightUpperLeg) rightUpperLeg.rotation.set(0, 0, 0);
    if (leftLowerLeg) leftLowerLeg.rotation.set(0, 0, 0);
    if (rightLowerLeg) rightLowerLeg.rotation.set(0, 0, 0);
    if (slot.vrm?.scene) {
      slot.vrm.scene.scale.setScalar(slot.scale || 1.0);
    }
  }
}

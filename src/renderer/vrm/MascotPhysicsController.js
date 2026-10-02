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
    this.bounciness = options.bounciness !== undefined ? options.bounciness : 0.35;
    this.floorY = 0.0; // Floor level in 3D scene space

    this.onAvatarImpact = options.onAvatarImpact || null;
    this.onAvatarLanded = options.onAvatarLanded || null;

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
    this.bounciness = THREE.MathUtils.clamp(val, 0, 0.8);
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

        // Horizontal screen boundary wall bounce using NDC projection
        if (cam) {
          const testPos = scenePos.clone();
          testPos.y += 0.6 * (slot.scale || 1.0);
          const ndc = testPos.project(cam);
          const ndcLimit = 0.88;

          if (ndc.x <= -ndcLimit) {
            scenePos.x += 0.05;
            slot.velocity.x = Math.abs(slot.velocity.x) * 0.55; // Bounce right inward
          } else if (ndc.x >= ndcLimit) {
            scenePos.x -= 0.05;
            slot.velocity.x = -Math.abs(slot.velocity.x) * 0.55; // Bounce left inward
          }
        }

        slot.position.copy(scenePos);

        // Air drag damping on horizontal speed
        slot.velocity.x *= Math.pow(0.88, dt * 60);

        // Animate limbs slightly while falling (arms outward for balance)
        this._updateFallingLimbAnimation(humanoid);

        // Adaptive floor collision detection across multi-monitor setup
        const curFloor = this.getFloorYAt(scenePos.x);
        if (scenePos.y <= curFloor) {
          scenePos.y = curFloor;
          slot.position.y = curFloor;

          const impactSpeed = -slot.velocity.y;

          if (impactSpeed > 1.2) {
            // Rebound bounce
            slot.velocity.y = impactSpeed * this.bounciness;

            // Severe fall impact (> 3.5 m/s drop speed): trigger dizzy butt-fall
            if (impactSpeed > 3.5) {
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

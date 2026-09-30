import * as THREE from 'three';

export class AnimationController {
  constructor(avatarController) {
    this.avatarController = avatarController;

    // Breathing parameters
    this.breathTime = 0;
    this.breathSpeed = 1.6;

    // Blinking parameters
    this.blinkTimer = 0;
    this.nextBlinkInterval = 3.5;
    this.isBlinking = false;
    this.blinkProgress = 0;

    // Action state
    this.currentAction = 'idle';
    this.actionTime = 0;
    this.spinProgress = 0;
    this.onActionComplete = null;
    this.baseHipsY = null;
  }

  playAction(actionName, onComplete = null) {
    this.currentAction = actionName;
    this.actionTime = 0;
    this.onActionComplete = onComplete;

    if (actionName === 'spinning') {
      const vrm = this.avatarController.getCurrentVRM();
      this.baseRotationY = vrm && vrm.scene ? vrm.scene.rotation.y : Math.PI;
      this.spinProgress = 0;
    }
  }

  playWave(onComplete) {
    this.playAction('waving', onComplete);
  }

  playHeartPose(onComplete) {
    this.playAction('heart_pose', onComplete);
  }

  playBow(onComplete) {
    this.playAction('bow', onComplete);
  }

  playClap(onComplete) {
    this.playAction('clap', onComplete);
  }

  playTiltHead(onComplete) {
    this.playAction('tilt_head', onComplete);
  }

  playStretch(onComplete) {
    this.playAction('stretch', onComplete);
  }

  playCheer(onComplete) {
    this.playAction('cheer', onComplete);
  }

  playNod(onComplete) {
    this.playAction('nod', onComplete);
  }

  playShakeHead(onComplete) {
    this.playAction('shake_head', onComplete);
  }

  playPout(onComplete) {
    this.playAction('pout', onComplete);
  }

  playSpin(onComplete) {
    this.playAction('spinning', onComplete);
  }

  playSit(onComplete) {
    this.playAction('sit', onComplete);
  }

  playRun(onComplete) {
    this.playAction('run', onComplete);
  }

  playJump(onComplete) {
    this.playAction('jump', onComplete);
  }

  playSquat(onComplete) {
    this.playAction('squat', onComplete);
  }

  playKneel(onComplete) {
    this.playAction('kneel', onComplete);
  }

  resetToIdle() {
    this.currentAction = 'idle';
    this.actionTime = 0;
    if (typeof this.onActionComplete === 'function') {
      const cb = this.onActionComplete;
      this.onActionComplete = null;
      cb();
    }

    const vrm = this.avatarController.getCurrentVRM();
    if (!vrm) return;

    const leftUpperArm = vrm.humanoid?.getNormalizedBoneNode('leftUpperArm');
    const rightUpperArm = vrm.humanoid?.getNormalizedBoneNode('rightUpperArm');
    const leftLowerArm = vrm.humanoid?.getNormalizedBoneNode('leftLowerArm');
    const rightLowerArm = vrm.humanoid?.getNormalizedBoneNode('rightLowerArm');
    const leftHand = vrm.humanoid?.getNormalizedBoneNode('leftHand');
    const rightHand = vrm.humanoid?.getNormalizedBoneNode('rightHand');
    const head = vrm.humanoid?.getNormalizedBoneNode('head');
    const spine = vrm.humanoid?.getNormalizedBoneNode('spine');
    const hips = vrm.humanoid?.getNormalizedBoneNode('hips');
    const leftUpperLeg = vrm.humanoid?.getNormalizedBoneNode('leftUpperLeg');
    const rightUpperLeg = vrm.humanoid?.getNormalizedBoneNode('rightUpperLeg');
    const leftLowerLeg = vrm.humanoid?.getNormalizedBoneNode('leftLowerLeg');
    const rightLowerLeg = vrm.humanoid?.getNormalizedBoneNode('rightLowerLeg');
    const leftFoot = vrm.humanoid?.getNormalizedBoneNode('leftFoot');
    const rightFoot = vrm.humanoid?.getNormalizedBoneNode('rightFoot');

    if (leftUpperArm) leftUpperArm.rotation.set(0.08, 0, Math.PI * 0.38);
    if (rightUpperArm) rightUpperArm.rotation.set(0.08, 0, -Math.PI * 0.38);
    if (leftLowerArm) leftLowerArm.rotation.set(0, 0, 0);
    if (rightLowerArm) rightLowerArm.rotation.set(0, 0, 0);
    if (leftHand) leftHand.rotation.set(0, 0, 0);
    if (rightHand) rightHand.rotation.set(0, 0, 0);
    if (head) head.rotation.set(0, 0, 0);
    if (spine) {
      spine.rotation.set(0, 0, 0);
      spine.position.y = 0.25;
    }

    if (hips) {
      if (this.baseHipsY !== null) {
        hips.position.y = this.baseHipsY;
      }
      hips.rotation.set(0, 0, 0);
    }
    if (leftUpperLeg) leftUpperLeg.rotation.set(0, 0, 0);
    if (rightUpperLeg) rightUpperLeg.rotation.set(0, 0, 0);
    if (leftLowerLeg) leftLowerLeg.rotation.set(0, 0, 0);
    if (rightLowerLeg) rightLowerLeg.rotation.set(0, 0, 0);
    if (leftFoot) leftFoot.rotation.set(0, 0, 0);
    if (rightFoot) rightFoot.rotation.set(0, 0, 0);
  }

  update(delta) {
    const vrm = this.avatarController.getCurrentVRM();
    if (!vrm) return;

    this._updateBreathing(delta, vrm);
    this._updateBlinking(delta, vrm);
    this._updateActions(delta, vrm);
  }

  _updateBreathing(delta, vrm) {
    this.breathTime += delta * this.breathSpeed;
    const sinVal = Math.sin(this.breathTime);

    // Subtle spine and chest movement
    const ignoreBreathing = ['bow', 'stretch', 'jump'];
    if (!ignoreBreathing.includes(this.currentAction)) {
      const spine = vrm.humanoid?.getNormalizedBoneNode('spine');
      if (spine) {
        let baseRotX = 0;
        if (this.currentAction === 'squat') baseRotX = 0.32;
        spine.position.y = 0.25 + sinVal * 0.005;
        spine.rotation.x = baseRotX + sinVal * 0.012;
      }
    }
  }

  _updateBlinking(delta, vrm) {
    this.blinkTimer += delta;

    if (!this.isBlinking && this.blinkTimer >= this.nextBlinkInterval) {
      this.isBlinking = true;
      this.blinkProgress = 0;
      this.nextBlinkInterval = 2.5 + Math.random() * 3.0;
    }

    if (this.isBlinking) {
      this.blinkProgress += delta * 12.0;
      let blinkVal = 0;
      if (this.blinkProgress < 1.0) {
        blinkVal = this.blinkProgress;
      } else if (this.blinkProgress < 2.0) {
        blinkVal = 2.0 - this.blinkProgress;
      } else {
        blinkVal = 0;
        this.isBlinking = false;
        this.blinkTimer = 0;
      }

      if (vrm.expressionManager) {
        vrm.expressionManager.setValue('blink', blinkVal);
      }
    }
  }

  _updateActions(delta, vrm) {
    if (this.currentAction === 'idle') return;
    this.actionTime += delta;

    const leftUpperArm = vrm.humanoid?.getNormalizedBoneNode('leftUpperArm');
    const rightUpperArm = vrm.humanoid?.getNormalizedBoneNode('rightUpperArm');
    const leftLowerArm = vrm.humanoid?.getNormalizedBoneNode('leftLowerArm');
    const rightLowerArm = vrm.humanoid?.getNormalizedBoneNode('rightLowerArm');
    const leftHand = vrm.humanoid?.getNormalizedBoneNode('leftHand');
    const rightHand = vrm.humanoid?.getNormalizedBoneNode('rightHand');
    const head = vrm.humanoid?.getNormalizedBoneNode('head');
    const spine = vrm.humanoid?.getNormalizedBoneNode('spine');
    const hips = vrm.humanoid?.getNormalizedBoneNode('hips');
    const leftUpperLeg = vrm.humanoid?.getNormalizedBoneNode('leftUpperLeg');
    const rightUpperLeg = vrm.humanoid?.getNormalizedBoneNode('rightUpperLeg');
    const leftLowerLeg = vrm.humanoid?.getNormalizedBoneNode('leftLowerLeg');
    const rightLowerLeg = vrm.humanoid?.getNormalizedBoneNode('rightLowerLeg');

    // Initialize base hips position
    if (hips && this.baseHipsY === null) {
      this.baseHipsY = hips.position.y;
    }
    const baseHipsY = this.baseHipsY !== null ? this.baseHipsY : 0.8;

    switch (this.currentAction) {
      case 'waving': {
        if (rightUpperArm) {
          rightUpperArm.rotation.z = Math.PI * 0.45;
          rightUpperArm.rotation.y = Math.sin(this.actionTime * 8) * 0.25;
        }
        if (rightHand) {
          rightHand.rotation.z = Math.sin(this.actionTime * 10) * 0.3;
        }
        if (this.actionTime > 2.5) {
          this.resetToIdle();
        }
        break;
      }

      case 'heart_pose': {
        // Bring hands to chest to form heart shape
        const blend = Math.min(1.0, this.actionTime * 3.0);
        if (leftUpperArm) {
          leftUpperArm.rotation.z = THREE.MathUtils.lerp(Math.PI * 0.38, 0.65, blend);
          leftUpperArm.rotation.x = THREE.MathUtils.lerp(0.08, 0.55, blend);
          leftUpperArm.rotation.y = THREE.MathUtils.lerp(0, 0.35, blend);
        }
        if (rightUpperArm) {
          rightUpperArm.rotation.z = THREE.MathUtils.lerp(-Math.PI * 0.38, -0.65, blend);
          rightUpperArm.rotation.x = THREE.MathUtils.lerp(0.08, 0.55, blend);
          rightUpperArm.rotation.y = THREE.MathUtils.lerp(0, -0.35, blend);
        }
        if (leftLowerArm) {
          leftLowerArm.rotation.y = THREE.MathUtils.lerp(0, 1.1, blend);
          leftLowerArm.rotation.x = THREE.MathUtils.lerp(0, 0.25, blend);
        }
        if (rightLowerArm) {
          rightLowerArm.rotation.y = THREE.MathUtils.lerp(0, -1.1, blend);
          rightLowerArm.rotation.x = THREE.MathUtils.lerp(0, 0.25, blend);
        }
        if (leftHand) leftHand.rotation.z = THREE.MathUtils.lerp(0, 0.2, blend);
        if (rightHand) rightHand.rotation.z = THREE.MathUtils.lerp(0, -0.2, blend);

        if (this.actionTime > 3.2) {
          this.resetToIdle();
        }
        break;
      }

      case 'bow': {
        // 2.8s Bowing: lean forward, hold, return
        let bowProg = 0;
        if (this.actionTime < 0.8) {
          bowProg = this.actionTime / 0.8;
        } else if (this.actionTime < 2.0) {
          bowProg = 1.0;
        } else if (this.actionTime < 2.8) {
          bowProg = 1.0 - (this.actionTime - 2.0) / 0.8;
        } else {
          this.resetToIdle();
          return;
        }

        if (spine) {
          spine.rotation.x = bowProg * 0.42; // Lean forward ~24 degrees
        }
        if (head) {
          head.rotation.x = bowProg * 0.25;
        }
        if (leftUpperArm) leftUpperArm.rotation.z = THREE.MathUtils.lerp(Math.PI * 0.38, 0.25, bowProg);
        if (rightUpperArm) rightUpperArm.rotation.z = THREE.MathUtils.lerp(-Math.PI * 0.38, -0.25, bowProg);
        break;
      }

      case 'clap': {
        // Hands clapping in front of chest
        const blend = Math.min(1.0, this.actionTime * 4.0);
        const clapCycle = Math.sin(this.actionTime * 14.0);

        if (leftUpperArm) {
          leftUpperArm.rotation.z = THREE.MathUtils.lerp(Math.PI * 0.38, 0.45 + clapCycle * 0.08, blend);
          leftUpperArm.rotation.x = THREE.MathUtils.lerp(0.08, 0.5, blend);
        }
        if (rightUpperArm) {
          rightUpperArm.rotation.z = THREE.MathUtils.lerp(-Math.PI * 0.38, -0.45 - clapCycle * 0.08, blend);
          rightUpperArm.rotation.x = THREE.MathUtils.lerp(0.08, 0.5, blend);
        }
        if (leftLowerArm) leftLowerArm.rotation.y = THREE.MathUtils.lerp(0, 0.95, blend);
        if (rightLowerArm) rightLowerArm.rotation.y = THREE.MathUtils.lerp(0, -0.95, blend);

        if (this.actionTime > 2.8) {
          this.resetToIdle();
        }
        break;
      }

      case 'tilt_head': {
        let tiltProg = 0;
        if (this.actionTime < 0.5) {
          tiltProg = this.actionTime / 0.5;
        } else if (this.actionTime < 1.7) {
          tiltProg = 1.0;
        } else if (this.actionTime < 2.2) {
          tiltProg = 1.0 - (this.actionTime - 1.7) / 0.5;
        } else {
          this.resetToIdle();
          return;
        }

        if (head) {
          head.rotation.z = tiltProg * 0.32; // ~18 degrees tilt
          head.rotation.x = tiltProg * 0.08;
        }
        break;
      }

      case 'stretch': {
        let stretchProg = 0;
        if (this.actionTime < 0.8) {
          stretchProg = this.actionTime / 0.8;
        } else if (this.actionTime < 2.4) {
          stretchProg = 1.0;
        } else if (this.actionTime < 3.2) {
          stretchProg = 1.0 - (this.actionTime - 2.4) / 0.8;
        } else {
          this.resetToIdle();
          return;
        }

        if (leftUpperArm) {
          leftUpperArm.rotation.z = THREE.MathUtils.lerp(Math.PI * 0.38, 1.5, stretchProg);
          leftUpperArm.rotation.x = THREE.MathUtils.lerp(0.08, -0.15, stretchProg);
        }
        if (rightUpperArm) {
          rightUpperArm.rotation.z = THREE.MathUtils.lerp(-Math.PI * 0.38, -1.5, stretchProg);
          rightUpperArm.rotation.x = THREE.MathUtils.lerp(0.08, -0.15, stretchProg);
        }
        if (spine) {
          spine.rotation.x = -stretchProg * 0.12;
        }
        break;
      }

      case 'cheer': {
        const bounce = Math.sin(this.actionTime * 12.0) * 0.025;
        if (leftUpperArm) {
          leftUpperArm.rotation.z = 1.25 + Math.sin(this.actionTime * 10.0) * 0.15;
          leftUpperArm.rotation.x = 0.2;
        }
        if (rightUpperArm) {
          rightUpperArm.rotation.z = -1.25 - Math.sin(this.actionTime * 10.0) * 0.15;
          rightUpperArm.rotation.x = 0.2;
        }
        if (spine) {
          spine.position.y = 0.25 + Math.max(0, bounce);
        }

        if (this.actionTime > 2.6) {
          this.resetToIdle();
        }
        break;
      }

      case 'nod': {
        if (head) {
          head.rotation.x = Math.sin(this.actionTime * 7.5) * 0.22;
        }
        if (this.actionTime > 1.8) {
          this.resetToIdle();
        }
        break;
      }

      case 'shake_head': {
        if (head) {
          head.rotation.y = Math.sin(this.actionTime * 7.5) * 0.28;
        }
        if (this.actionTime > 1.8) {
          this.resetToIdle();
        }
        break;
      }

      case 'pout': {
        const blend = Math.min(1.0, this.actionTime * 3.5);
        if (leftUpperArm) {
          leftUpperArm.rotation.z = THREE.MathUtils.lerp(Math.PI * 0.38, 0.85, blend);
          leftUpperArm.rotation.x = THREE.MathUtils.lerp(0.08, -0.2, blend);
          leftUpperArm.rotation.y = THREE.MathUtils.lerp(0, -0.25, blend);
        }
        if (rightUpperArm) {
          rightUpperArm.rotation.z = THREE.MathUtils.lerp(-Math.PI * 0.38, -0.85, blend);
          rightUpperArm.rotation.x = THREE.MathUtils.lerp(0.08, -0.2, blend);
          rightUpperArm.rotation.y = THREE.MathUtils.lerp(0, 0.25, blend);
        }
        if (leftLowerArm) {
          leftLowerArm.rotation.y = THREE.MathUtils.lerp(0, 1.25, blend);
          leftLowerArm.rotation.z = THREE.MathUtils.lerp(0, -0.35, blend);
        }
        if (rightLowerArm) {
          rightLowerArm.rotation.y = THREE.MathUtils.lerp(0, -1.25, blend);
          rightLowerArm.rotation.z = THREE.MathUtils.lerp(0, 0.35, blend);
        }
        if (head) {
          head.rotation.y = THREE.MathUtils.lerp(0, 0.26, blend);
        }

        if (this.actionTime > 2.8) {
          this.resetToIdle();
        }
        break;
      }

      // --- Persistent Full-Body & Locomotion Actions (Corrected Bone Axes & Holding Mode) ---

      case 'sit': {
        // Sit down comfortably and hold posture indefinitely until user switches action
        const sitProg = Math.min(1.0, this.actionTime / 0.8);

        if (hips) {
          hips.position.y = baseHipsY - 0.42 * sitProg;
        }
        // Thighs raise forward (+X)
        if (leftUpperLeg) {
          leftUpperLeg.rotation.x = 1.52 * sitProg;
          leftUpperLeg.rotation.z = 0.08 * sitProg;
        }
        if (rightUpperLeg) {
          rightUpperLeg.rotation.x = 1.52 * sitProg;
          rightUpperLeg.rotation.z = -0.08 * sitProg;
        }
        // Knees bend backward (-X)
        if (leftLowerLeg) leftLowerLeg.rotation.x = -1.55 * sitProg;
        if (rightLowerLeg) rightLowerLeg.rotation.x = -1.55 * sitProg;

        // Hands resting gently on thighs/lap
        if (leftUpperArm) {
          leftUpperArm.rotation.z = THREE.MathUtils.lerp(Math.PI * 0.38, 0.25, sitProg);
          leftUpperArm.rotation.x = THREE.MathUtils.lerp(0.08, 0.35, sitProg);
        }
        if (rightUpperArm) {
          rightUpperArm.rotation.z = THREE.MathUtils.lerp(-Math.PI * 0.38, -0.25, sitProg);
          rightUpperArm.rotation.x = THREE.MathUtils.lerp(0.08, 0.35, sitProg);
        }
        if (leftLowerArm) leftLowerArm.rotation.x = 0.25 * sitProg;
        if (rightLowerArm) rightLowerArm.rotation.x = 0.25 * sitProg;
        break;
      }

      case 'run': {
        // Continuous running in place cycle (~6Hz cadence) until user switches action
        const runFreq = 12.0;
        const swing = Math.sin(this.actionTime * runFreq);

        if (leftUpperLeg) leftUpperLeg.rotation.x = swing * 0.75;
        if (rightUpperLeg) rightUpperLeg.rotation.x = -swing * 0.75;
        // Knees bend backward (-X) when leg swings back
        if (leftLowerLeg) leftLowerLeg.rotation.x = -Math.max(0, -swing * 1.3);
        if (rightLowerLeg) rightLowerLeg.rotation.x = -Math.max(0, swing * 1.3);

        // Counter-balancing arm swing with bent elbows
        if (leftUpperArm) {
          leftUpperArm.rotation.x = -swing * 0.65;
          leftUpperArm.rotation.z = 0.22;
        }
        if (rightUpperArm) {
          rightUpperArm.rotation.x = swing * 0.65;
          rightUpperArm.rotation.z = -0.22;
        }
        if (leftLowerArm) leftLowerArm.rotation.y = 1.15;
        if (rightLowerArm) rightLowerArm.rotation.y = -1.15;

        // Subtle natural running hip bounce
        if (hips) {
          hips.position.y = baseHipsY + Math.abs(swing) * 0.035;
        }
        break;
      }

      case 'jump': {
        // 2.0s Joyous Jump with airborne kinematics (one-shot transient action)
        if (this.actionTime < 0.35) {
          // Phase 1: Deep crouch anticipation
          const t = this.actionTime / 0.35;
          if (hips) hips.position.y = baseHipsY - 0.16 * t;
          if (leftUpperLeg) leftUpperLeg.rotation.x = 0.45 * t;
          if (rightUpperLeg) rightUpperLeg.rotation.x = 0.45 * t;
          if (leftLowerLeg) leftLowerLeg.rotation.x = -0.8 * t;
          if (rightLowerLeg) rightLowerLeg.rotation.x = -0.8 * t;
          if (leftUpperArm) leftUpperArm.rotation.x = -0.4 * t;
          if (rightUpperArm) rightUpperArm.rotation.x = -0.4 * t;
        } else if (this.actionTime < 1.25) {
          // Phase 2: Airborne leap
          const jumpT = (this.actionTime - 0.35) / 0.9;
          const jumpHeight = Math.sin(jumpT * Math.PI) * 0.42; // Up ~42cm!
          if (hips) hips.position.y = baseHipsY + jumpHeight;
          if (leftUpperArm) {
            leftUpperArm.rotation.z = THREE.MathUtils.lerp(0.2, 1.35, Math.sin(jumpT * Math.PI));
            leftUpperArm.rotation.x = 0.1;
          }
          if (rightUpperArm) {
            rightUpperArm.rotation.z = THREE.MathUtils.lerp(-0.2, -1.35, Math.sin(jumpT * Math.PI));
            rightUpperArm.rotation.x = 0.1;
          }
          if (leftUpperLeg) leftUpperLeg.rotation.x = 0.05;
          if (rightUpperLeg) rightUpperLeg.rotation.x = 0.05;
          if (leftLowerLeg) leftLowerLeg.rotation.x = -0.15;
          if (rightLowerLeg) rightLowerLeg.rotation.x = -0.15;
        } else if (this.actionTime < 1.65) {
          // Phase 3: Landing cushion
          const landT = (this.actionTime - 1.25) / 0.4;
          if (hips) hips.position.y = THREE.MathUtils.lerp(baseHipsY - 0.14, baseHipsY, landT);
          if (leftLowerLeg) leftLowerLeg.rotation.x = THREE.MathUtils.lerp(-0.6, 0, landT);
          if (rightLowerLeg) rightLowerLeg.rotation.x = THREE.MathUtils.lerp(-0.6, 0, landT);
        } else {
          this.resetToIdle();
        }
        break;
      }

      case 'squat': {
        // Cute Squat: hold posture indefinitely until user switches action
        const squatProg = Math.min(1.0, this.actionTime / 0.7);

        if (hips) hips.position.y = baseHipsY - 0.46 * squatProg;
        // Thighs pulled up forward (+X)
        if (leftUpperLeg) leftUpperLeg.rotation.x = 1.75 * squatProg;
        if (rightUpperLeg) rightUpperLeg.rotation.x = 1.75 * squatProg;
        // Knees bent deeply backward (-X)
        if (leftLowerLeg) leftLowerLeg.rotation.x = -2.15 * squatProg;
        if (rightLowerLeg) rightLowerLeg.rotation.x = -2.15 * squatProg;

        if (spine) spine.rotation.x = 0.32 * squatProg;
        if (head) head.rotation.x = -0.28 * squatProg; // Look up at user

        if (leftUpperArm) {
          leftUpperArm.rotation.z = THREE.MathUtils.lerp(Math.PI * 0.38, 0.25, squatProg);
          leftUpperArm.rotation.x = 0.45 * squatProg;
        }
        if (rightUpperArm) {
          rightUpperArm.rotation.z = THREE.MathUtils.lerp(-Math.PI * 0.38, -0.25, squatProg);
          rightUpperArm.rotation.x = 0.45 * squatProg;
        }
        break;
      }

      case 'kneel': {
        // Japanese Seiza / Kneeling pose: hold posture indefinitely until user switches action
        const kneelProg = Math.min(1.0, this.actionTime / 0.7);

        if (hips) hips.position.y = baseHipsY - 0.48 * kneelProg;
        if (leftUpperLeg) leftUpperLeg.rotation.x = 0.12 * kneelProg;
        if (rightUpperLeg) rightUpperLeg.rotation.x = 0.12 * kneelProg;
        // Knees folded backward (-X) flat onto ground
        if (leftLowerLeg) leftLowerLeg.rotation.x = -2.45 * kneelProg;
        if (rightLowerLeg) rightLowerLeg.rotation.x = -2.45 * kneelProg;

        // Elegant posture, hands flat on lap
        if (leftUpperArm) leftUpperArm.rotation.z = THREE.MathUtils.lerp(Math.PI * 0.38, 0.22, kneelProg);
        if (rightUpperArm) rightUpperArm.rotation.z = THREE.MathUtils.lerp(-Math.PI * 0.38, -0.22, kneelProg);
        if (leftLowerArm) leftLowerArm.rotation.x = 0.4 * kneelProg;
        if (rightLowerArm) rightLowerArm.rotation.x = 0.4 * kneelProg;
        break;
      }

      case 'spinning': {
        this.spinProgress += delta * 4.5;
        const baseY = (this.baseRotationY !== undefined) ? this.baseRotationY : Math.PI;

        if (vrm.scene) {
          vrm.scene.rotation.y = baseY + this.spinProgress;
        }

        if (this.spinProgress >= Math.PI * 2) {
          if (vrm.scene) vrm.scene.rotation.y = baseY;
          this.resetToIdle();
        }
        break;
      }

      default:
        this.resetToIdle();
        break;
    }
  }
}

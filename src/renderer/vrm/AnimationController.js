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

    // Custom pose override mode
    this.isCustomPoseOverride = false;
    this.customPoseData = null;
  }

  setCustomPoseOverride(override = true, poseData = null) {
    this.isCustomPoseOverride = override;
    this.customPoseData = poseData;
  }

  resetCustomPose() {
    this.isCustomPoseOverride = false;
    this.customPoseData = null;
    this.resetToIdle();
  }

  playAction(actionName, onComplete = null) {
    this.isCustomPoseOverride = false;
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

  playFrogSit(onComplete) {
    this.playAction('frog_sit', onComplete);
  }

  playAnimalCrawl(onComplete) {
    this.playAction('animal_crawl', onComplete);
  }

  playProne(onComplete) {
    this.playAction('prone', onComplete);
  }

  playSupine(onComplete) {
    this.playAction('supine', onComplete);
  }

  playJumpingJacks(onComplete) {
    this.playAction('jumping_jacks', onComplete);
  }

  playDance(onComplete) {
    this.playAction('dance', onComplete);
  }

  resetToIdle() {
    this.currentAction = 'idle';
    this.actionTime = 0;
    if (typeof this.onActionComplete === 'function') {
      const cb = this.onActionComplete;
      this.onActionComplete = null;
      cb();
    }

    if (this.isCustomPoseOverride) {
      return;
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
      hips.position.x = 0;
      hips.position.z = 0;
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
    if (this.isCustomPoseOverride) return;

    this.breathTime += delta * this.breathSpeed;
    const sinVal = Math.sin(this.breathTime);

    // Subtle spine and chest movement
    const ignoreBreathing = ['bow', 'stretch', 'jump', 'animal_crawl', 'prone', 'supine', 'jumping_jacks', 'dance'];
    if (!ignoreBreathing.includes(this.currentAction)) {
      const spine = vrm.humanoid?.getNormalizedBoneNode('spine');
      if (spine) {
        let baseRotX = 0;
        if (this.currentAction === 'squat') baseRotX = 0.32;
        if (this.currentAction === 'frog_sit') baseRotX = 0.18;
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
    const leftFoot = vrm.humanoid?.getNormalizedBoneNode('leftFoot');
    const rightFoot = vrm.humanoid?.getNormalizedBoneNode('rightFoot');

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

        // Counter-balancing arm swing with naturally forward-bent elbows
        if (leftUpperArm) {
          leftUpperArm.rotation.x = swing * 0.65;
          leftUpperArm.rotation.z = 0.22;
        }
        if (rightUpperArm) {
          rightUpperArm.rotation.x = -swing * 0.65;
          rightUpperArm.rotation.z = -0.22;
        }
        if (leftLowerArm) {
          leftLowerArm.rotation.set(1.35, 0, 0);
        }
        if (rightLowerArm) {
          rightLowerArm.rotation.set(1.35, 0, 0);
        }

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
        // Authentic Japanese Seiza: hips rest on heels, thighs forward horizontal, parallel shins (no crossing)
        const kneelProg = Math.min(1.0, this.actionTime / 0.7);

        if (hips) {
          hips.position.y = baseHipsY - 0.68 * kneelProg;
          hips.position.z = -0.05 * kneelProg;
          hips.rotation.set(0, 0, 0);
        }

        // Thighs folded forward horizontally, outward angle to eliminate Q-angle inward leg crossing
        if (leftUpperLeg) leftUpperLeg.rotation.set(1.48 * kneelProg, 0, -0.16 * kneelProg);
        if (rightUpperLeg) rightUpperLeg.rotation.set(1.48 * kneelProg, 0, 0.16 * kneelProg);

        // Knees deeply folded, lower legs flat on floor parallel to each other (parallel shins, zero crossing)
        if (leftLowerLeg) leftLowerLeg.rotation.set(-2.70 * kneelProg, -0.15 * kneelProg, 0);
        if (rightLowerLeg) rightLowerLeg.rotation.set(-2.70 * kneelProg, 0.15 * kneelProg, 0);

        // Elegant posture, hands placed flat and square on thighs (lap)
        if (leftUpperArm) leftUpperArm.rotation.set(0.15 * kneelProg, 0, 1.18 * kneelProg);
        if (rightUpperArm) rightUpperArm.rotation.set(0.15 * kneelProg, 0, -1.18 * kneelProg);
        if (leftLowerArm) leftLowerArm.rotation.set(0.55 * kneelProg, 0, 0);
        if (rightLowerArm) rightLowerArm.rotation.set(0.55 * kneelProg, 0, 0);
        if (leftHand) leftHand.rotation.set(-0.15 * kneelProg, 0, 0);
        if (rightHand) rightHand.rotation.set(-0.15 * kneelProg, 0, 0);
        break;
      }

      case 'frog_sit': {
        // Authentic M-sitting (M字腿 / Frog Sit): hips seated on floor, thighs arched up and wide spread outward,
        // knees form M peaks, feet flat on floor beside hips, hands planted on the ground between legs
        const sitProg = Math.min(1.0, this.actionTime / 0.7);

        if (hips) {
          hips.position.y = baseHipsY - 0.72 * sitProg;
          hips.position.z = 0.02 * sitProg;
          hips.rotation.set(0, 0, 0);
        }

        // Thighs pulled up forward and spread wide outward (-Z for left, +Z for right forming M-shape sides)
        if (leftUpperLeg) leftUpperLeg.rotation.set(0.95 * sitProg, -0.20 * sitProg, -0.85 * sitProg);
        if (rightUpperLeg) rightUpperLeg.rotation.set(0.95 * sitProg, 0.20 * sitProg, 0.85 * sitProg);

        // Knees bent deeply back, calves bring feet flat to ground outside hips forming M peaks
        if (leftLowerLeg) leftLowerLeg.rotation.set(-2.65 * sitProg, -0.40 * sitProg, 0);
        if (rightLowerLeg) rightLowerLeg.rotation.set(-2.65 * sitProg, 0.40 * sitProg, 0);
        if (leftFoot) leftFoot.rotation.set(0.55 * sitProg, 0, 0);
        if (rightFoot) rightFoot.rotation.set(0.55 * sitProg, 0, 0);

        // Torso leaning slightly forward, hands planted on ground between legs supporting body
        if (spine) spine.rotation.x = -0.15 * sitProg;
        if (head) head.rotation.x = 0.10 * sitProg;

        // Arms reach forward down between knees to ground, palms supporting body
        if (leftUpperArm) leftUpperArm.rotation.set(0.35 * sitProg, 0, 1.45 * sitProg);
        if (rightUpperArm) rightUpperArm.rotation.set(0.35 * sitProg, 0, -1.45 * sitProg);
        if (leftLowerArm) leftLowerArm.rotation.set(0.35 * sitProg, 0, 0);
        if (rightLowerArm) rightLowerArm.rotation.set(0.35 * sitProg, 0, 0);
        if (leftHand) leftHand.rotation.set(-0.55 * sitProg, 0, 0); // Palms flat on ground
        if (rightHand) rightHand.rotation.set(-0.55 * sitProg, 0, 0);
        break;
      }

      case 'animal_crawl': {
        // Animal Quadruped: all fours on ground, horizontal torso, head raised facing forward
        const crawlProg = Math.min(1.0, this.actionTime / 0.7);

        if (hips) {
          hips.position.y = baseHipsY - 0.58 * crawlProg;
          hips.position.z = -0.10 * crawlProg;
          hips.rotation.x = -1.05 * crawlProg; // Torso tilted forward horizontally
        }
        if (spine) spine.rotation.x = -0.25 * crawlProg; // Spine completes horizontal alignment
        if (head) head.rotation.x = 0.85 * crawlProg;    // Head raised looking up/forward at camera

        // Front limbs (arms) vertically supporting chest on ground
        if (leftUpperArm) leftUpperArm.rotation.set(1.15 * crawlProg, 0, 1.45 * crawlProg);
        if (rightUpperArm) rightUpperArm.rotation.set(1.15 * crawlProg, 0, -1.45 * crawlProg);
        if (leftLowerArm) leftLowerArm.rotation.set(0.35 * crawlProg, 0, 0);
        if (rightLowerArm) rightLowerArm.rotation.set(0.35 * crawlProg, 0, 0);
        if (leftHand) leftHand.rotation.set(-0.55 * crawlProg, 0, 0); // Palms flat on ground
        if (rightHand) rightHand.rotation.set(-0.55 * crawlProg, 0, 0);

        // Hind limbs (legs): knees on ground, shins flat behind on floor
        if (leftUpperLeg) leftUpperLeg.rotation.set(0.95 * crawlProg, 0, -0.15 * crawlProg);
        if (rightUpperLeg) rightUpperLeg.rotation.set(0.95 * crawlProg, 0, 0.15 * crawlProg);
        if (leftLowerLeg) leftLowerLeg.rotation.set(-1.55 * crawlProg, 0, 0);
        if (rightLowerLeg) rightLowerLeg.rotation.set(-1.55 * crawlProg, 0, 0);
        break;
      }

      case 'prone': {
        // Lie Prone: entire body rotates forward flat onto floor face down
        const proneProg = Math.min(1.0, this.actionTime / 0.8);

        if (hips) {
          hips.position.y = baseHipsY - 0.72 * proneProg;
          hips.position.z = 0.20 * proneProg;
          hips.rotation.x = -Math.PI * 0.48 * proneProg; // Forward rotation ~-86 deg flat onto floor
          hips.rotation.y = 0;
          hips.rotation.z = 0;
        }

        // Spine slightly arched up, head raised looking forward at user
        if (spine) spine.rotation.x = 0.18 * proneProg;
        if (head) head.rotation.x = 0.85 * proneProg;

        // In VRM hips-forward-rotated frame:
        // Arms reach forward onto floor, elbows propped supporting chin
        if (leftUpperArm) leftUpperArm.rotation.set(-0.40 * proneProg, 0, 1.18 * proneProg);
        if (rightUpperArm) rightUpperArm.rotation.set(-0.40 * proneProg, 0, -1.18 * proneProg);
        if (leftLowerArm) leftLowerArm.rotation.set(1.20 * proneProg, 0.45 * proneProg, 0);
        if (rightLowerArm) rightLowerArm.rotation.set(1.20 * proneProg, -0.45 * proneProg, 0);
        if (leftHand) leftHand.rotation.set(0, 0, 0);
        if (rightHand) rightHand.rotation.set(0, 0, 0);

        // Legs resting flat backward along the ground, relaxed
        if (leftUpperLeg) leftUpperLeg.rotation.set(-0.05 * proneProg, 0, -0.12 * proneProg);
        if (rightUpperLeg) rightUpperLeg.rotation.set(-0.05 * proneProg, 0, 0.12 * proneProg);
        if (leftLowerLeg) leftLowerLeg.rotation.set(-0.25 * proneProg, 0, 0);
        if (rightLowerLeg) rightLowerLeg.rotation.set(-0.25 * proneProg, 0, 0);
        break;
      }

      case 'supine': {
        // Lie Supine: entire body rotates backward flat onto floor face up
        const supineProg = Math.min(1.0, this.actionTime / 0.8);

        if (hips) {
          hips.position.y = baseHipsY - 0.72 * supineProg;
          hips.position.z = -0.20 * supineProg;
          hips.rotation.x = Math.PI * 0.48 * supineProg; // Backward rotation ~+86 deg flat onto floor
          hips.rotation.y = 0;
          hips.rotation.z = 0;
        }

        if (spine) spine.rotation.x = -0.05 * supineProg;
        if (head) head.rotation.x = -0.30 * supineProg; // Head rests naturally facing upward

        // Arms relaxed at sides
        if (leftUpperArm) leftUpperArm.rotation.set(0, 0, 1.18 * supineProg);
        if (rightUpperArm) rightUpperArm.rotation.set(0, 0, -1.18 * supineProg);
        if (leftLowerArm) leftLowerArm.rotation.set(0, 0, 0);
        if (rightLowerArm) rightLowerArm.rotation.set(0, 0, 0);

        // Legs flat on floor
        if (leftUpperLeg) leftUpperLeg.rotation.set(0, 0, -0.10 * supineProg);
        if (rightUpperLeg) rightUpperLeg.rotation.set(0, 0, 0.10 * supineProg);
        if (leftLowerLeg) leftLowerLeg.rotation.set(0, 0, 0);
        if (rightLowerLeg) rightLowerLeg.rotation.set(0, 0, 0);
        break;
      }

      case 'jumping_jacks': {
        // Continuous Jumping Jacks aerobic exercise cycle (~6.0 rad/s)
        // t smoothly oscillates between 0 (landing, feet together, arms at side) and 1 (peak jump, feet apart, arms overhead)
        const t = (Math.sin(this.actionTime * 6.0) + 1.0) * 0.5;

        // Airborne leap height
        if (hips) {
          hips.position.y = baseHipsY + t * 0.22;
          hips.rotation.set(0, 0, 0);
        }

        // Arms: t=0 arms down at sides (Math.PI*0.38, -Math.PI*0.38), t=1 hands clap high above head (-1.95, 1.95)
        if (leftUpperArm) {
          leftUpperArm.rotation.z = THREE.MathUtils.lerp(Math.PI * 0.38, -1.95, t);
          leftUpperArm.rotation.x = 0.05;
          leftUpperArm.rotation.y = 0;
        }
        if (rightUpperArm) {
          rightUpperArm.rotation.z = THREE.MathUtils.lerp(-Math.PI * 0.38, 1.95, t);
          rightUpperArm.rotation.x = 0.05;
          rightUpperArm.rotation.y = 0;
        }
        if (leftLowerArm) leftLowerArm.rotation.set(0, 0, 0);
        if (rightLowerArm) rightLowerArm.rotation.set(0, 0, 0);

        // Legs: t=0 legs together (z=0), t=1 legs spread wide in air (left: -0.65, right: +0.65)
        if (leftUpperLeg) {
          leftUpperLeg.rotation.z = -t * 0.65; // Negative Z spreads left leg outward
          leftUpperLeg.rotation.x = 0.05;
        }
        if (rightUpperLeg) {
          rightUpperLeg.rotation.z = t * 0.65;  // Positive Z spreads right leg outward
          rightUpperLeg.rotation.x = 0.05;
        }

        // Knee cushion upon landing
        const cushion = Math.max(0, 0.2 - t) * 5.0;
        if (leftLowerLeg) leftLowerLeg.rotation.x = -cushion * 0.35;
        if (rightLowerLeg) rightLowerLeg.rotation.x = -cushion * 0.35;
        break;
      }

      case 'dance': {
        // Idol rhythmic dance cycle (~4.0 rad/s)
        const sway = Math.sin(this.actionTime * 4.0);
        const bounce = Math.abs(Math.sin(this.actionTime * 8.0));

        if (hips) {
          hips.position.x = sway * 0.06;
          hips.position.y = baseHipsY + bounce * 0.03;
          hips.rotation.z = sway * 0.12;
        }

        if (spine) {
          spine.rotation.z = -sway * 0.10;
          spine.rotation.x = 0.05;
        }
        if (head) {
          head.rotation.z = sway * 0.15;
          head.rotation.y = -sway * 0.12;
        }

        // Dynamic rhythmic waving arms (symmetric swaying around resting pose)
        if (leftUpperArm) {
          leftUpperArm.rotation.z = Math.PI * 0.32 + Math.sin(this.actionTime * 4.0) * 0.35;
          leftUpperArm.rotation.x = 0.30 + Math.cos(this.actionTime * 4.0) * 0.25;
        }
        if (rightUpperArm) {
          rightUpperArm.rotation.z = -Math.PI * 0.32 - Math.sin(this.actionTime * 4.0) * 0.35;
          rightUpperArm.rotation.x = 0.30 - Math.cos(this.actionTime * 4.0) * 0.25;
        }

        // Forearms / elbows bend forward naturally via Y-axis rotation (left: +Y, right: -Y)
        if (leftLowerArm) {
          leftLowerArm.rotation.set(0, 0.75 + Math.sin(this.actionTime * 8.0) * 0.25, 0);
        }
        if (rightLowerArm) {
          rightLowerArm.rotation.set(0, -0.75 - Math.sin(this.actionTime * 8.0) * 0.25, 0);
        }

        // Legs alternate weight shift
        if (leftUpperLeg) leftUpperLeg.rotation.x = sway * 0.15;
        if (rightUpperLeg) rightUpperLeg.rotation.x = -sway * 0.15;
        if (leftLowerLeg) leftLowerLeg.rotation.x = -Math.max(0, -sway * 0.25);
        if (rightLowerLeg) rightLowerLeg.rotation.x = -Math.max(0, sway * 0.25);
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

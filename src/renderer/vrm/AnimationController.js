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
    this.currentAction = 'idle'; // 'idle', 'waving', 'spinning', 'leaving', 'entering'
    this.actionTime = 0;
    this.spinProgress = 0;
  }

  playWave() {
    this.currentAction = 'waving';
    this.actionTime = 0;
  }

  playSpin(onComplete) {
    this.currentAction = 'spinning';
    this.actionTime = 0;
    this.spinProgress = 0;
    const vrm = this.avatarController.getCurrentVRM();
    // Record current front-facing base rotation (e.g. Math.PI)
    this.baseRotationY = vrm && vrm.scene ? vrm.scene.rotation.y : Math.PI;
    this.onSpinComplete = onComplete;
  }

  resetToIdle() {
    this.currentAction = 'idle';
    this.actionTime = 0;
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
    const spine = vrm.humanoid?.getNormalizedBoneNode('spine');
    if (spine) {
      spine.position.y = 0.25 + sinVal * 0.005;
      spine.rotation.x = sinVal * 0.015;
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
    this.actionTime += delta;

    if (this.currentAction === 'waving') {
      const rightArm = vrm.humanoid?.getNormalizedBoneNode('rightUpperArm');
      const rightHand = vrm.humanoid?.getNormalizedBoneNode('rightHand');
      if (rightArm) {
        rightArm.rotation.z = Math.PI * 0.45;
        rightArm.rotation.y = Math.sin(this.actionTime * 8) * 0.25;
      }
      if (rightHand) {
        rightHand.rotation.z = Math.sin(this.actionTime * 10) * 0.3;
      }

      if (this.actionTime > 2.5) {
        if (rightArm) {
          rightArm.rotation.set(0.08, 0, -Math.PI * 0.38);
        }
        if (rightHand) rightHand.rotation.set(0, 0, 0);
        this.resetToIdle();
      }
    } else if (this.currentAction === 'spinning') {
      this.spinProgress += delta * 4.5;
      const baseY = (this.baseRotationY !== undefined) ? this.baseRotationY : Math.PI;

      if (vrm.scene) {
        vrm.scene.rotation.y = baseY + this.spinProgress;
      }

      if (this.spinProgress >= Math.PI * 2) {
        if (vrm.scene) vrm.scene.rotation.y = baseY;
        this.resetToIdle();
        if (typeof this.onSpinComplete === 'function') {
          this.onSpinComplete();
          this.onSpinComplete = null;
        }
      }
    }
  }
}

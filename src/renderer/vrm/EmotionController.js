import * as THREE from 'three';

export class EmotionController {
  constructor(avatarController) {
    this.avatarController = avatarController;
    this.currentEmotion = 'neutral';
    this.targetWeights = {
      happy: 0,
      relaxed: 0,
      angry: 0,
      surprised: 0,
      sad: 0
    };
    this.currentWeights = { ...this.targetWeights };
    this.transitionSpeed = 5.0; // Lerp speed
  }

  setEmotion(emotionName) {
    this.currentEmotion = emotionName;

    // Reset targets
    for (const key of Object.keys(this.targetWeights)) {
      this.targetWeights[key] = 0;
    }

    switch (emotionName.toLowerCase()) {
      case 'happy':
        this.targetWeights.happy = 1.0;
        break;
      case 'shy':
      case 'caring':
      case 'gentle':
        this.targetWeights.relaxed = 0.8;
        this.targetWeights.happy = 0.4;
        break;
      case 'angry':
        this.targetWeights.angry = 0.9;
        break;
      case 'surprised':
        this.targetWeights.surprised = 1.0;
        break;
      case 'sad':
        this.targetWeights.sad = 0.8;
        break;
      case 'neutral':
      default:
        // All zeros
        break;
    }
  }

  update(delta) {
    const vrm = this.avatarController.getCurrentVRM();
    if (!vrm || !vrm.expressionManager) return;

    for (const [key, target] of Object.entries(this.targetWeights)) {
      this.currentWeights[key] = THREE.MathUtils.lerp(
        this.currentWeights[key],
        target,
        delta * this.transitionSpeed
      );

      // Apply to VRM ExpressionManager
      try {
        vrm.expressionManager.setValue(key, this.currentWeights[key]);
      } catch (e) {
        // Safe check for missing blendshape
      }
    }
  }
}

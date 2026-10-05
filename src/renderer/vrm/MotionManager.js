import * as THREE from 'three';

// Seconds to ease from whatever the avatar is doing into the first keyframe
const BLEND_IN_SECONDS = 0.35;
const DEFAULT_KEYFRAME_SECONDS = 0.6;
const MIN_KEYFRAME_SECONDS = 0.1;
const MAX_KEYFRAME_SECONDS = 10;

/**
 * MotionManager
 * Builds motions out of a sequence of poses (keyframes), plays them back by
 * blending from one pose to the next, and saves / loads named motions.
 */
export class MotionManager {
  constructor(avatarController, animationController, poseManager, options = {}) {
    this.avatarController = avatarController;
    this.animationController = animationController;
    this.poseManager = poseManager;
    // Returns true when something else took over the bones (e.g. the user grabbed a limb)
    this.isInterrupted = options.isInterrupted || null;
    this.onBeforePlay = options.onBeforePlay || null;
    this.onStateChanged = options.onStateChanged || null;

    // Keyframes being edited: { joints (degrees), hipsYOffset, duration (seconds to reach this pose) }
    this.keyframes = [];
    this.savedMotions = this._loadSavedMotions();

    this.isPlaying = false;
    this.isLooping = false;
    this.currentIndex = -1; // Keyframe being blended toward while playing
    this._track = null;
    this._from = null;
    this._elapsed = 0;
    this._segmentSeconds = BLEND_IN_SECONDS;
    this._vrm = null;
  }

  _loadSavedMotions() {
    try {
      const parsed = JSON.parse(localStorage.getItem('aibff_custom_motions') || '[]');
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      console.warn('[MotionManager] Failed to read localStorage custom motions:', e);
    }
    return [];
  }

  _persistSavedMotions() {
    try {
      localStorage.setItem('aibff_custom_motions', JSON.stringify(this.savedMotions));
    } catch (e) {
      console.warn('[MotionManager] Failed to persist custom motions:', e);
    }
  }

  _notify() {
    if (typeof this.onStateChanged === 'function') this.onStateChanged();
  }

  _clampSeconds(seconds) {
    const value = Number(seconds);
    if (!Number.isFinite(value)) return DEFAULT_KEYFRAME_SECONDS;
    return THREE.MathUtils.clamp(value, MIN_KEYFRAME_SECONDS, MAX_KEYFRAME_SECONDS);
  }

  /**
   * Saved poses may list only the joints they change: fill the rest with the
   * resting stand so every keyframe describes the whole body.
   */
  _makeKeyframe(poseData, duration = DEFAULT_KEYFRAME_SECONDS) {
    const joints = {};
    this.poseManager.boneDefinitions.forEach((def) => {
      const rot = poseData.joints?.[def.key];
      joints[def.key] = rot
        ? { x: rot.x || 0, y: rot.y || 0, z: rot.z || 0 }
        : {
          x: Math.round(THREE.MathUtils.radToDeg(def.defaultRot.x)),
          y: Math.round(THREE.MathUtils.radToDeg(def.defaultRot.y)),
          z: Math.round(THREE.MathUtils.radToDeg(def.defaultRot.z))
        };
    });
    return { joints, hipsYOffset: poseData.hipsYOffset || 0, duration: this._clampSeconds(duration) };
  }

  _captureCurrentPose() {
    if (!this.poseManager.captureCurrentPoseFromAvatar()) {
      throw new Error('No active avatar to capture');
    }
    return {
      joints: this.poseManager.currentRotations,
      hipsYOffset: this.poseManager.currentHipsYOffset || 0
    };
  }

  // ---- Keyframe editing ----

  addKeyframeFromCurrent() {
    this.stop();
    this.keyframes.push(this._makeKeyframe(this._captureCurrentPose()));
    this._notify();
    return this.keyframes.length - 1;
  }

  addKeyframeFromPose(pose) {
    if (!pose || !pose.joints) return -1;
    this.stop();
    this.keyframes.push(this._makeKeyframe(pose));
    this._notify();
    return this.keyframes.length - 1;
  }

  /** Overwrites a keyframe with the avatar's current pose, keeping its timing. */
  updateKeyframeFromCurrent(index) {
    const existing = this.keyframes[index];
    if (!existing) return;
    this.stop();
    this.keyframes[index] = this._makeKeyframe(this._captureCurrentPose(), existing.duration);
    this._notify();
  }

  removeKeyframe(index) {
    if (!this.keyframes[index]) return;
    this.stop();
    this.keyframes.splice(index, 1);
    this._notify();
  }

  moveKeyframe(index, offset) {
    const target = index + offset;
    if (!this.keyframes[index] || !this.keyframes[target]) return;
    this.stop();
    [this.keyframes[index], this.keyframes[target]] = [this.keyframes[target], this.keyframes[index]];
    this._notify();
  }

  setKeyframeDuration(index, seconds) {
    const keyframe = this.keyframes[index];
    if (!keyframe) return DEFAULT_KEYFRAME_SECONDS;
    keyframe.duration = this._clampSeconds(seconds);
    return keyframe.duration;
  }

  clearKeyframes() {
    this.stop();
    this.keyframes = [];
    this._notify();
  }

  /** Puts the avatar into a keyframe's pose so it can be checked or re-sculpted. */
  showKeyframe(index) {
    const keyframe = this.keyframes[index];
    if (!keyframe) return;
    this.stop();
    this.poseManager.applyPose({ name: `keyframe ${index + 1}`, joints: keyframe.joints, hipsYOffset: keyframe.hipsYOffset });
  }

  // ---- Saved motions ----

  getSavedMotions() {
    return this.savedMotions;
  }

  saveMotion(name, loop = false) {
    const trimmed = name?.trim();
    if (!trimmed) throw new Error('Motion name cannot be empty');
    if (this.keyframes.length < 2) throw new Error('A motion needs at least 2 poses');

    const motion = {
      id: `motion_${Date.now()}`,
      name: trimmed,
      loop: Boolean(loop),
      keyframes: JSON.parse(JSON.stringify(this.keyframes))
    };

    // If existing motion with same name, replace it
    const existingIndex = this.savedMotions.findIndex((m) => m.name === trimmed);
    if (existingIndex !== -1) {
      this.savedMotions[existingIndex] = motion;
    } else {
      this.savedMotions.push(motion);
    }

    this._persistSavedMotions();
    return motion;
  }

  /** Loads a saved motion into the editor. */
  loadMotion(id) {
    const motion = this.savedMotions.find((m) => m.id === id);
    if (!motion) return null;
    this.stop();
    this.keyframes = JSON.parse(JSON.stringify(motion.keyframes));
    this._notify();
    return motion;
  }

  deleteMotion(id) {
    this.savedMotions = this.savedMotions.filter((m) => m.id !== id);
    this._persistSavedMotions();
  }

  findMotionByName(query) {
    if (!query) return null;
    const lower = query.trim().toLowerCase();
    return this.savedMotions.find((m) => m.name.toLowerCase() === lower)
      || this.savedMotions.find((m) => m.name.toLowerCase().includes(lower))
      || null;
  }

  // ---- Playback ----

  /**
   * Plays the keyframes in the editor on the active avatar.
   * @returns {boolean} false if there is nothing to play
   */
  play({ loop = false } = {}) {
    const vrm = this.avatarController.getCurrentVRM();
    if (!vrm || !vrm.humanoid || this.keyframes.length === 0) return false;

    if (typeof this.onBeforePlay === 'function') this.onBeforePlay();

    // Take the bones over from idle breathing and any built-in action
    this.animationController.setCustomPoseOverride(true);
    if (this.animationController.currentAction !== 'idle') {
      this.animationController.resetToIdle();
    }

    this._track = this.keyframes.map((keyframe) => {
      const quats = {};
      Object.keys(keyframe.joints).forEach((key) => {
        const rot = keyframe.joints[key];
        quats[key] = new THREE.Quaternion().setFromEuler(new THREE.Euler(
          THREE.MathUtils.degToRad(rot.x || 0),
          THREE.MathUtils.degToRad(rot.y || 0),
          THREE.MathUtils.degToRad(rot.z || 0)
        ));
      });
      return { quats, hipsYOffset: keyframe.hipsYOffset || 0, duration: this._clampSeconds(keyframe.duration) };
    });

    // Start from wherever the avatar is right now
    const baseHipsY = this.animationController.baseHipsY;
    const hips = vrm.humanoid.getNormalizedBoneNode('hips');
    const liveQuats = {};
    Object.keys(this._track[0].quats).forEach((key) => {
      const bone = vrm.humanoid.getNormalizedBoneNode(key);
      if (bone) liveQuats[key] = bone.quaternion.clone();
    });
    this._from = {
      quats: liveQuats,
      hipsYOffset: hips && baseHipsY !== null ? hips.position.y - baseHipsY : 0
    };

    this._vrm = vrm;
    this._elapsed = 0;
    this._segmentSeconds = BLEND_IN_SECONDS;
    this.currentIndex = 0;
    this.isLooping = Boolean(loop);
    this.isPlaying = true;
    this._notify();
    return true;
  }

  /** Stops playback, holding the avatar in the pose it has reached. */
  stop() {
    if (!this.isPlaying) return;
    this._end(true);
  }

  _end(holdPose) {
    this.isPlaying = false;
    this.currentIndex = -1;
    this._track = null;
    this._from = null;
    this._vrm = null;
    if (holdPose) {
      // Keep the pose locked and in sync with the pose editor
      this.poseManager.captureCurrentPoseFromAvatar();
    }
    this._notify();
  }

  _applyBlend(vrm, from, to, t) {
    Object.keys(to.quats).forEach((key) => {
      const bone = vrm.humanoid.getNormalizedBoneNode(key);
      if (!bone) return;
      const start = from.quats[key];
      if (start) {
        bone.quaternion.slerpQuaternions(start, to.quats[key], t);
      } else {
        bone.quaternion.copy(to.quats[key]);
      }
    });

    const baseHipsY = this.animationController.baseHipsY;
    const hips = vrm.humanoid.getNormalizedBoneNode('hips');
    if (hips && baseHipsY !== null) {
      hips.position.y = baseHipsY + THREE.MathUtils.lerp(from.hipsYOffset, to.hipsYOffset, t);
    }
  }

  update(delta) {
    if (!this.isPlaying) return;

    // Something else now drives the bones (built-in action, pose reset, limb drag, avatar switch)
    const vrm = this.avatarController.getCurrentVRM();
    if (vrm !== this._vrm || !this.animationController.isCustomPoseOverride || this.isInterrupted?.()) {
      this._end(false);
      return;
    }

    this._elapsed += delta;
    let indexChanged = false;
    while (this._elapsed >= this._segmentSeconds) {
      this._elapsed -= this._segmentSeconds;
      this._from = this._track[this.currentIndex];

      const isLast = this.currentIndex === this._track.length - 1;
      if (isLast && !(this.isLooping && this._track.length > 1)) {
        this._applyBlend(vrm, this._from, this._from, 1);
        this._end(true);
        return;
      }
      this.currentIndex = isLast ? 0 : this.currentIndex + 1;
      this._segmentSeconds = this._track[this.currentIndex].duration;
      indexChanged = true;
    }

    const t = THREE.MathUtils.smoothstep(this._elapsed / this._segmentSeconds, 0, 1);
    this._applyBlend(vrm, this._from, this._track[this.currentIndex], t);
    if (indexChanged) this._notify();
  }
}

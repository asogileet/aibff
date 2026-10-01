import * as THREE from 'three';

/**
 * PoseManager
 * Controls VRM humanoid bone rotations, custom pose saving/loading,
 * and integration with AnimationController for pose overrides.
 */
export class PoseManager {
  constructor(avatarController, animationController) {
    this.avatarController = avatarController;
    this.animationController = animationController;

    // Supported humanoid bone definitions
    this.boneDefinitions = [
      { key: 'head', nameZh: '頭部', group: 'head', defaultRot: { x: 0, y: 0, z: 0 } },
      { key: 'neck', nameZh: '頸部', group: 'head', defaultRot: { x: 0, y: 0, z: 0 } },
      { key: 'leftUpperArm', nameZh: '左上臂', group: 'arm', defaultRot: { x: 0.08, y: 0, z: Math.PI * 0.38 } },
      { key: 'rightUpperArm', nameZh: '右上臂', group: 'arm', defaultRot: { x: 0.08, y: 0, z: -Math.PI * 0.38 } },
      { key: 'leftLowerArm', nameZh: '左前臂', group: 'arm', defaultRot: { x: 0, y: 0, z: 0 } },
      { key: 'rightLowerArm', nameZh: '右前臂', group: 'arm', defaultRot: { x: 0, y: 0, z: 0 } },
      { key: 'leftHand', nameZh: '左手掌', group: 'arm', defaultRot: { x: 0, y: 0, z: 0 } },
      { key: 'rightHand', nameZh: '右手掌', group: 'arm', defaultRot: { x: 0, y: 0, z: 0 } },
      { key: 'spine', nameZh: '脊椎', group: 'body', defaultRot: { x: 0, y: 0, z: 0 } },
      { key: 'chest', nameZh: '胸部', group: 'body', defaultRot: { x: 0, y: 0, z: 0 } },
      { key: 'hips', nameZh: '骨盆', group: 'body', defaultRot: { x: 0, y: 0, z: 0 } },
      { key: 'leftUpperLeg', nameZh: '左大腿', group: 'leg', defaultRot: { x: 0, y: 0, z: 0 } },
      { key: 'rightUpperLeg', nameZh: '右大腿', group: 'leg', defaultRot: { x: 0, y: 0, z: 0 } },
      { key: 'leftLowerLeg', nameZh: '左小腿', group: 'leg', defaultRot: { x: 0, y: 0, z: 0 } },
      { key: 'rightLowerLeg', nameZh: '右小腿', group: 'leg', defaultRot: { x: 0, y: 0, z: 0 } },
      { key: 'leftFoot', nameZh: '左腳掌', group: 'leg', defaultRot: { x: 0, y: 0, z: 0 } },
      { key: 'rightFoot', nameZh: '右腳掌', group: 'leg', defaultRot: { x: 0, y: 0, z: 0 } }
    ];

    // Current working rotation map (in degrees for easy UI mapping)
    this.currentRotations = {};
    this._resetWorkingRotations();

    // Default presets
    this.defaultPresets = [
      {
        id: 'preset_peace',
        name: '可愛剪刀手',
        joints: {
          rightUpperArm: { x: -20, y: 25, z: -75 },
          rightLowerArm: { x: -85, y: 20, z: 0 },
          rightHand: { x: 0, y: 0, z: 25 },
          head: { x: 5, y: -10, z: 12 }
        }
      },
      {
        id: 'preset_hands_hips',
        name: '手插腰自信站姿',
        joints: {
          leftUpperArm: { x: 10, y: -20, z: 45 },
          leftLowerArm: { x: 65, y: 0, z: 20 },
          rightUpperArm: { x: 10, y: 20, z: -45 },
          rightLowerArm: { x: 65, y: 0, z: -20 },
          head: { x: -5, y: 0, z: 0 }
        }
      },
      {
        id: 'preset_cat',
        name: '貓耳喵喵手',
        joints: {
          leftUpperArm: { x: -35, y: -15, z: 70 },
          leftLowerArm: { x: -80, y: -10, z: 0 },
          leftHand: { x: 20, y: 0, z: 10 },
          rightUpperArm: { x: -35, y: 15, z: -70 },
          rightLowerArm: { x: -80, y: 10, z: 0 },
          rightHand: { x: 20, y: 0, z: -10 },
          head: { x: 0, y: 5, z: -8 }
        }
      }
    ];

    this.savedPoses = this._loadSavedPoses();
  }

  _resetWorkingRotations() {
    this.boneDefinitions.forEach((def) => {
      this.currentRotations[def.key] = {
        x: Math.round(THREE.MathUtils.radToDeg(def.defaultRot.x)),
        y: Math.round(THREE.MathUtils.radToDeg(def.defaultRot.y)),
        z: Math.round(THREE.MathUtils.radToDeg(def.defaultRot.z))
      };
    });
  }

  _loadSavedPoses() {
    try {
      const stored = localStorage.getItem('aibff_custom_poses');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[PoseManager] Failed to read localStorage custom poses:', e);
    }
    return [...this.defaultPresets];
  }

  _persistSavedPoses() {
    try {
      localStorage.setItem('aibff_custom_poses', JSON.stringify(this.savedPoses));
    } catch (e) {
      console.warn('[PoseManager] Failed to persist custom poses:', e);
    }
  }

  getBoneNode(boneKey) {
    const vrm = this.avatarController.getCurrentVRM();
    if (!vrm || !vrm.humanoid) return null;
    return vrm.humanoid.getNormalizedBoneNode(boneKey);
  }

  /**
   * Set rotation in degrees for a single bone node
   */
  setJointRotation(boneKey, { x, y, z }) {
    if (this.currentRotations[boneKey]) {
      if (x !== undefined) this.currentRotations[boneKey].x = x;
      if (y !== undefined) this.currentRotations[boneKey].y = y;
      if (z !== undefined) this.currentRotations[boneKey].z = z;
    }

    const bone = this.getBoneNode(boneKey);
    if (bone) {
      const radX = THREE.MathUtils.degToRad(this.currentRotations[boneKey].x);
      const radY = THREE.MathUtils.degToRad(this.currentRotations[boneKey].y);
      const radZ = THREE.MathUtils.degToRad(this.currentRotations[boneKey].z);
      bone.rotation.set(radX, radY, radZ);
    }

    // Enable custom pose override in AnimationController
    if (this.animationController) {
      this.animationController.setCustomPoseOverride(true, this.currentRotations);
    }
  }

  getJointRotation(boneKey) {
    return this.currentRotations[boneKey] || { x: 0, y: 0, z: 0 };
  }

  resetJoint(boneKey) {
    const def = this.boneDefinitions.find((b) => b.key === boneKey);
    if (!def) return;
    const defaultDeg = {
      x: Math.round(THREE.MathUtils.radToDeg(def.defaultRot.x)),
      y: Math.round(THREE.MathUtils.radToDeg(def.defaultRot.y)),
      z: Math.round(THREE.MathUtils.radToDeg(def.defaultRot.z))
    };
    this.setJointRotation(boneKey, defaultDeg);
    return defaultDeg;
  }

  applyPose(poseData) {
    if (!poseData || !poseData.joints) return;

    // Apply joint rotations
    Object.keys(poseData.joints).forEach((boneKey) => {
      const rot = poseData.joints[boneKey];
      if (this.currentRotations[boneKey]) {
        this.currentRotations[boneKey] = { ...rot };
        const bone = this.getBoneNode(boneKey);
        if (bone) {
          bone.rotation.set(
            THREE.MathUtils.degToRad(rot.x || 0),
            THREE.MathUtils.degToRad(rot.y || 0),
            THREE.MathUtils.degToRad(rot.z || 0)
          );
        }
      }
    });

    // Apply hips offset if defined (e.g. for sitting or kneeling postures)
    if (poseData.hipsYOffset !== undefined && this.animationController) {
      const hips = this.getBoneNode('hips');
      if (hips) {
        const baseY = this.animationController.baseHipsY !== null ? this.animationController.baseHipsY : hips.position.y;
        hips.position.y = baseY + poseData.hipsYOffset;
      }
      this.currentHipsYOffset = poseData.hipsYOffset;
    }

    if (this.animationController) {
      this.animationController.setCustomPoseOverride(true, this.currentRotations);
    }

    // Save into active avatar slot if avatarManager is present
    const activeSlot = this.avatarController?.getActiveSlot?.();
    if (activeSlot) {
      activeSlot.customBoneRotations = { ...this.currentRotations };
      activeSlot.isSculpted = true;
    }

    console.log(`[PoseManager] Applied pose: ${poseData.name || 'custom'}`);
  }

  /**
   * Captures live rotation angles and hip height from the active 3D avatar
   */
  captureCurrentPoseFromAvatar() {
    const vrm = this.avatarController.getCurrentVRM();
    if (!vrm || !vrm.humanoid) {
      console.warn('[PoseManager] No active VRM model found to capture pose');
      return false;
    }

    this.boneDefinitions.forEach((def) => {
      const bone = vrm.humanoid.getNormalizedBoneNode(def.key);
      if (bone) {
        this.currentRotations[def.key] = {
          x: Math.round(THREE.MathUtils.radToDeg(bone.rotation.x)),
          y: Math.round(THREE.MathUtils.radToDeg(bone.rotation.y)),
          z: Math.round(THREE.MathUtils.radToDeg(bone.rotation.z))
        };
      }
    });

    // Capture hips position offset if hips lowered (e.g. sitting or kneeling)
    const hipsNode = vrm.humanoid.getNormalizedBoneNode('hips');
    if (hipsNode && this.animationController && this.animationController.baseHipsY !== null) {
      this.currentHipsYOffset = hipsNode.position.y - this.animationController.baseHipsY;
    } else {
      this.currentHipsYOffset = 0;
    }

    // Lock in custom pose override so idle animation doesn't undo the captured pose
    if (this.animationController) {
      this.animationController.setCustomPoseOverride(true, this.currentRotations);
    }

    console.log('[PoseManager] Successfully captured current avatar pose');
    return true;
  }

  resetToDefault() {
    this._resetWorkingRotations();
    this.currentHipsYOffset = 0;
    this.boneDefinitions.forEach((def) => {
      const bone = this.getBoneNode(def.key);
      if (bone) {
        bone.rotation.set(def.defaultRot.x, def.defaultRot.y, def.defaultRot.z);
      }
    });

    if (this.animationController) {
      this.animationController.resetCustomPose();
    }
    console.log('[PoseManager] Reset to default idle stand');
  }

  saveCurrentPose(name) {
    const trimmed = name?.trim();
    if (!trimmed) throw new Error('Pose name cannot be empty');

    const newPose = {
      id: `pose_${Date.now()}`,
      name: trimmed,
      joints: JSON.parse(JSON.stringify(this.currentRotations)),
      hipsYOffset: this.currentHipsYOffset || 0
    };

    // If existing pose with same name, replace it
    const existingIndex = this.savedPoses.findIndex((p) => p.name === trimmed);
    if (existingIndex !== -1) {
      this.savedPoses[existingIndex] = newPose;
    } else {
      this.savedPoses.push(newPose);
    }

    this._persistSavedPoses();
    return newPose;
  }

  deletePose(id) {
    this.savedPoses = this.savedPoses.filter((p) => p.id !== id);
    this._persistSavedPoses();
  }

  findPoseByName(query) {
    if (!query) return null;
    const lower = query.trim().toLowerCase();
    return this.savedPoses.find((p) => p.name.toLowerCase().includes(lower)) || null;
  }

  /**
   * Check if a custom saved pose exists that overrides a standard action
   */
  getCustomOverrideForAction(actionName) {
    if (!actionName) return null;
    const actionAliases = {
      sit: ['坐姿', '坐下', 'sit', 'sitting'],
      squat: ['蹲姿', '蹲下', 'squat'],
      kneel: ['跪姿', '跪坐', 'kneel', 'seiza'],
      waving: ['打招呼', '揮手', 'wave', 'waving'],
      bow: ['鞠躬', 'bow'],
      clap: ['鼓掌', '拍手', 'clap'],
      heart_pose: ['比心', '愛心', 'heart', 'heart_pose']
    };

    const aliases = actionAliases[actionName] || [actionName];
    for (const pose of this.savedPoses) {
      const poseLower = pose.name.toLowerCase().trim();
      for (const alias of aliases) {
        if (poseLower === alias.toLowerCase() || poseLower.includes(alias.toLowerCase())) {
          return pose;
        }
      }
    }
    return null;
  }

  getSavedPoses() {
    return this.savedPoses;
  }

  /**
   * Reload working rotations and captured pose from the currently active avatar
   */
  reloadFromActiveAvatar() {
    return this.captureCurrentPoseFromAvatar();
  }

  /**
   * Broadcast current pose across all avatars in the scene
   */
  syncPoseToAll() {
    if (this.avatarController?.syncPoseToAll) {
      this.avatarController.syncPoseToAll();
    }
  }
}


import * as THREE from 'three';

/**
 * PuppetController
 * Implements interactive ragdoll/puppet-like physical pulling of VRM humanoid bones.
 * Supports direct screen-delta mapping for hands, legs, head, and lifting the entire body (hips).
 */
export class PuppetController {
  constructor(avatarController, animationController, sceneManager, options = {}) {
    this.avatarController = avatarController;
    this.animationController = animationController;
    this.sceneManager = sceneManager;
    this.poseManager = options.poseManager || null;
    this.onReaction = options.onReaction || null;
    this.onPoseUpdated = options.onPoseUpdated || null;

    this.isEnabled = true; // Enabled by default for direct mouse puppet play
    this.keepPoseOnRelease = true; // Hold sculpted pose instead of auto-recovering
    this.grabbedJointKey = null; // 'head', 'hips', 'rightHand', 'leftHand', 'rightFoot', 'leftFoot'
    this.hoveredJointKey = null;

    this.fingerScreenPos = { x: 0, y: 0 };
    this.dragStartFinger = { x: 0, y: 0 };
    this.dragDelta = { x: 0, y: 0 };
    this.isPinching = false;
    this.snappingRadius = 90; // Screen pixels

    // Spring damping recovery state
    this.isRecovering = false;
    this.recoveryProgress = 1.0;

    // Cache of initial transforms on grab start
    this.startModelPos = new THREE.Vector3();
    this.startBoneRots = {};

    // Default resting rotations
    this.defaultBoneRot = {
      rightUpperArm: new THREE.Euler(0.08, 0, -Math.PI * 0.38),
      leftUpperArm: new THREE.Euler(0.08, 0, Math.PI * 0.38),
      rightLowerArm: new THREE.Euler(0, 0, 0),
      leftLowerArm: new THREE.Euler(0, 0, 0),
      rightUpperLeg: new THREE.Euler(0, 0, 0),
      leftUpperLeg: new THREE.Euler(0, 0, 0),
      rightLowerLeg: new THREE.Euler(0, 0, 0),
      leftLowerLeg: new THREE.Euler(0, 0, 0),
      head: new THREE.Euler(0, 0, 0)
    };

    // Dialogue lines per joint
    // Dialogue lines per joint
    this.dialogues = {
      hips: [
        { emotion: 'surprised', text: '呀！主人把我抱起來了～好高喔！🥰' },
        { emotion: 'shy', text: '主人抓著我的腰部，心跳好快喔...💕' },
        { emotion: 'happy', text: '哇～像飛起來一樣！主人要帶我去哪裡呢～？✨' }
      ],
      head: [
        { emotion: 'happy', text: '最喜歡主人摸摸頭了～好溫暖呀！🥰' },
        { emotion: 'shy', text: '主人撫摸我的頭髮，心跳好快喔...❤️' }
      ],
      neck: [
        { emotion: 'happy', text: '稍微歪一下頭看著主人，有可愛嗎～？🥰' },
        { emotion: 'shy', text: '主人輕輕扶著我的脖子，癢癢的啦～///' }
      ],
      chest: [
        { emotion: 'shy', text: '呀！主人碰哪裡呀...好害羞！///' },
        { emotion: 'surprised', text: '主人大笨蛋！心跳都變得好快了啦～💕' }
      ],
      spine: [
        { emotion: 'happy', text: '呼～彎腰伸展一下好舒服喔！✨' },
        { emotion: 'happy', text: '跟主人一起做健康體操～🎵' }
      ],
      rightHand: [
        { emotion: 'happy', text: '主人牽著我的右手，是要一起跳舞嗎～？💃' },
        { emotion: 'happy', text: '牽手成功！今天一整天都不准放開喔！✨' }
      ],
      leftHand: [
        { emotion: 'surprised', text: '哇！主人拉住我的左手了～要去哪裡呀？' },
        { emotion: 'happy', text: '主人的手感覺好溫暖呢～💕' }
      ],
      rightLowerArm: [
        { emotion: 'happy', text: '看我手肘彎曲，擺出元氣插腰姿勢！⚡' },
        { emotion: 'happy', text: '主人在幫我微調手部動作呢～🎵' }
      ],
      leftLowerArm: [
        { emotion: 'happy', text: '喵～要擺出可愛的招財貓肉球嗎？🐾' },
        { emotion: 'happy', text: '這個手部弧度好看嗎～？' }
      ],
      rightFoot: [
        { emotion: 'surprised', text: '呀！主人怎麼抓人家的腳啦～好害羞！😣' },
        { emotion: 'happy', text: '看我一腳金雞獨立！主人快放我下來啦～😆' }
      ],
      leftFoot: [
        { emotion: 'shy', text: '嗚嗚～不要隨便抓女孩子的腳踝啦！會癢～😂' },
        { emotion: 'surprised', text: '主人大壞蛋！快把我放回平地上～' }
      ],
      rightLowerLeg: [
        { emotion: 'surprised', text: '膝蓋被主人碰到了～有點癢癢的呢！😆' },
        { emotion: 'happy', text: '是要教我屈膝半蹲還是翹腳呀～？' }
      ],
      leftLowerLeg: [
        { emotion: 'happy', text: '要教我盤腿坐還是跪坐姿勢呢～？' },
        { emotion: 'happy', text: '看我靈活的膝蓋彎曲～嘻嘻！' }
      ],
      rightUpperLeg: [
        { emotion: 'shy', text: '呀～大腿被拉動了，是要做高踢腿嗎！😣' }
      ],
      leftUpperLeg: [
        { emotion: 'shy', text: '主人大壞蛋！裙子要飄起來了啦～///' }
      ]
    };

    this._tempVec3 = new THREE.Vector3();
  }

  get currentVRM() {
    return this.avatarController ? (this.avatarController.getCurrentVRM() || this.avatarController.currentVRM) : null;
  }

  isGrabbingOrHovered() {
    return this.isEnabled && (this.grabbedJointKey !== null || this.hoveredJointKey !== null);
  }

  setEnabled(enabled) {
    this.isEnabled = enabled;
    if (!enabled && this.grabbedJointKey) {
      this.releaseGrab();
    }
  }

  setKeepPoseOnRelease(keep) {
    this.keepPoseOnRelease = Boolean(keep);
  }

  setPoseManager(poseManager) {
    this.poseManager = poseManager;
  }

  saveCurrentPose(name) {
    if (!this.poseManager) {
      throw new Error('PoseManager is not available');
    }
    this.poseManager.captureCurrentPoseFromAvatar();
    const poseName = name || `玩偶姿勢 #${(this.poseManager.savedPoses?.length || 0) + 1}`;
    const saved = this.poseManager.saveCurrentPose(poseName);
    return saved;
  }

  resetPose(smooth = true) {
    const vrm = this.currentVRM;
    if (!vrm) return;

    if (smooth) {
      this.isRecovering = true;
      this.recoveryProgress = 0.0;
    } else {
      this.isRecovering = false;
      if (vrm.scene) {
        vrm.scene.position.set(0, 0, 0);
      }
      this._springBonesToDefault(vrm, 1.0);
      if (this.animationController?.setCustomPoseOverride) {
        this.animationController.setCustomPoseOverride(false);
      }
      if (this.poseManager?.resetToDefault) {
        this.poseManager.resetToDefault();
      }
    }
  }

  _cacheStartRotations(jointKey, vrm) {
    if (!vrm || !vrm.humanoid) return;
    this.startBoneRots = {};
    const humanoid = vrm.humanoid;
    const saveBone = (name) => {
      const node = humanoid.getNormalizedBoneNode(name);
      if (node) {
        this.startBoneRots[name] = {
          x: node.rotation.x,
          y: node.rotation.y,
          z: node.rotation.z
        };
      }
    };

    saveBone(jointKey);
    if (jointKey === 'rightHand' || jointKey === 'rightLowerArm') {
      saveBone('rightUpperArm');
      saveBone('rightLowerArm');
    } else if (jointKey === 'leftHand' || jointKey === 'leftLowerArm') {
      saveBone('leftUpperArm');
      saveBone('leftLowerArm');
    } else if (jointKey === 'rightFoot' || jointKey === 'rightLowerLeg' || jointKey === 'rightUpperLeg') {
      saveBone('rightUpperLeg');
      saveBone('rightLowerLeg');
    } else if (jointKey === 'leftFoot' || jointKey === 'leftLowerLeg' || jointKey === 'leftUpperLeg') {
      saveBone('leftUpperLeg');
      saveBone('leftLowerLeg');
    } else if (jointKey === 'head' || jointKey === 'neck') {
      saveBone('head');
      saveBone('neck');
    } else if (jointKey === 'chest' || jointKey === 'spine') {
      saveBone('chest');
      saveBone('spine');
    }
  }

  /**
   * Called by HandTracker on every finger/mouse position update.
   */
  updateFinger(x, y, isPinching) {
    if (!this.isEnabled) return;

    this.fingerScreenPos.x = x;
    this.fingerScreenPos.y = y;

    const wasPinching = this.isPinching;
    this.isPinching = isPinching;

    // Detect grab trigger
    if (this.isPinching && !wasPinching) {
      let targetJoint = this.hoveredJointKey;
      if (!targetJoint) {
        // Smart nearest joint search within avatar region (260px radius)
        const jointTargets = this.getJointScreenPositions();
        let closestKey = null;
        let minDist = 260;
        for (const [key, pos] of Object.entries(jointTargets)) {
          const d = Math.hypot(this.fingerScreenPos.x - pos.x, this.fingerScreenPos.y - pos.y);
          if (d < minDist) {
            minDist = d;
            closestKey = key;
          }
        }
        targetJoint = closestKey || 'hips'; // Fallback to body hips
      }

      if (targetJoint) {
        this.grabbedJointKey = targetJoint;
        this.hoveredJointKey = targetJoint;
        this.dragStartFinger.x = x;
        this.dragStartFinger.y = y;
        this.dragDelta.x = 0;
        this.dragDelta.y = 0;

        console.log(`[Puppet] Grabbed joint: ${targetJoint}`);

        const vrm = this.currentVRM;
        if (vrm && vrm.scene) {
          this.startModelPos.copy(vrm.scene.position);
        }

        this._cacheStartRotations(targetJoint, vrm);

        this.isRecovering = false;
        // Correct method name to override breathing idle action!
        if (this.animationController?.setCustomPoseOverride) {
          this.animationController.setCustomPoseOverride(true);
        }
        this._triggerReaction(this.grabbedJointKey);
      }
    } else if (this.isPinching && wasPinching) {
      // Actively dragging
      this.dragDelta.x = this.fingerScreenPos.x - this.dragStartFinger.x;
      this.dragDelta.y = this.fingerScreenPos.y - this.dragStartFinger.y;
    } else if (!this.isPinching && wasPinching) {
      this.releaseGrab();
    }
  }

  releaseGrab() {
    if (this.grabbedJointKey) {
      this.grabbedJointKey = null;

      if (this.keepPoseOnRelease) {
        // Keep current sculpted pose without spring recovery
        this.isRecovering = false;
        if (this.animationController?.setCustomPoseOverride) {
          this.animationController.setCustomPoseOverride(true);
        }
        if (this.poseManager?.captureCurrentPoseFromAvatar) {
          this.poseManager.captureCurrentPoseFromAvatar();
        }
        if (typeof this.onPoseUpdated === 'function') {
          this.onPoseUpdated();
        }
      } else {
        // Standard elastic spring recovery
        this.isRecovering = true;
        this.recoveryProgress = 0.0;
      }
    }
  }

  /**
   * Core frame update called inside Three.js render loop.
   */
  update(delta) {
    if (!this.isEnabled) return;
    const vrm = this.currentVRM;
    if (!vrm || !vrm.humanoid) return;

    // 1. Calculate screen projections for target joints
    const jointTargets = this.getJointScreenPositions();

    // 2. Determine hovered joint when not currently grabbing
    if (!this.grabbedJointKey) {
      this.hoveredJointKey = null;
      for (const [key, pos] of Object.entries(jointTargets)) {
        const dist = Math.hypot(this.fingerScreenPos.x - pos.x, this.fingerScreenPos.y - pos.y);
        if (dist < this.snappingRadius) {
          this.hoveredJointKey = key;
          break;
        }
      }
    }

    // 3. Process Dragging Physics
    if (this.grabbedJointKey) {
      this._applyDirectLimbDragging(this.grabbedJointKey, vrm);
    } else if (this.isRecovering) {
      // Smooth spring recovery
      this.recoveryProgress += delta * 4.0;
      const t = Math.min(1.0, this.recoveryProgress);

      if (vrm.scene) {
        vrm.scene.position.lerp(new THREE.Vector3(0, 0, 0), t);
      }

      this._springBonesToDefault(vrm, t);

      if (this.recoveryProgress >= 1.0) {
        this.isRecovering = false;
        if (vrm.scene) {
          vrm.scene.position.set(0, 0, 0);
        }
        if (this.animationController?.setCustomPoseOverride) {
          this.animationController.setCustomPoseOverride(false);
        }
      }
    }
  }

  /**
   * Applies direct, intuitive, responsive physical pulling based on screen delta.
   */
  _applyDirectLimbDragging(jointKey, vrm) {
    const dx = this.dragDelta.x;
    const dy = this.dragDelta.y;

    if (jointKey === 'hips') {
      // Pick up the whole avatar model and move with mouse
      if (vrm.scene) {
        vrm.scene.position.x = this.startModelPos.x + dx * 0.0035;
        vrm.scene.position.y = this.startModelPos.y - dy * 0.0035;
      }

      // Limbs sway and dangle
      const rArm = vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
      const lArm = vrm.humanoid.getNormalizedBoneNode('leftUpperArm');
      const rLeg = vrm.humanoid.getNormalizedBoneNode('rightUpperLeg');
      const lLeg = vrm.humanoid.getNormalizedBoneNode('leftUpperLeg');
      if (rArm) rArm.rotation.set(0.1 + dy * 0.002, 0, -Math.PI * 0.38 - dx * 0.002);
      if (lArm) lArm.rotation.set(0.1 + dy * 0.002, 0, Math.PI * 0.38 - dx * 0.002);
      if (rLeg) rLeg.rotation.set(0.15 + dy * 0.003, 0, -0.05 + dx * 0.002);
      if (lLeg) lLeg.rotation.set(0.15 + dy * 0.003, 0, 0.05 + dx * 0.002);
      return;
    }

    if (jointKey === 'rightHand') {
      const upperArm = vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
      const lowerArm = vrm.humanoid.getNormalizedBoneNode('rightLowerArm');
      const baseUpper = this.startBoneRots.rightUpperArm || { x: 0.08, y: 0, z: -Math.PI * 0.38 };
      const baseLower = this.startBoneRots.rightLowerArm || { x: 0, y: 0, z: 0 };
      if (upperArm && lowerArm) {
        upperArm.rotation.z = baseUpper.z - (dy * 0.005) - (dx * 0.005);
        upperArm.rotation.x = baseUpper.x + (dy * 0.003);
        upperArm.rotation.y = baseUpper.y - (dx * 0.003);
        lowerArm.rotation.x = Math.max(-Math.PI * 0.8, Math.min(0, baseLower.x - Math.abs(dx * 0.004) - (dy * 0.003)));
      }
      return;
    }

    if (jointKey === 'leftHand') {
      const upperArm = vrm.humanoid.getNormalizedBoneNode('leftUpperArm');
      const lowerArm = vrm.humanoid.getNormalizedBoneNode('leftLowerArm');
      const baseUpper = this.startBoneRots.leftUpperArm || { x: 0.08, y: 0, z: Math.PI * 0.38 };
      const baseLower = this.startBoneRots.leftLowerArm || { x: 0, y: 0, z: 0 };
      if (upperArm && lowerArm) {
        upperArm.rotation.z = baseUpper.z + (dy * 0.005) - (dx * 0.005);
        upperArm.rotation.x = baseUpper.x + (dy * 0.003);
        upperArm.rotation.y = baseUpper.y + (dx * 0.003);
        lowerArm.rotation.x = Math.max(-Math.PI * 0.8, Math.min(0, baseLower.x - Math.abs(dx * 0.004) - (dy * 0.003)));
      }
      return;
    }

    // Direct Elbow Control (Hands on hips, cat paws, salute)
    if (jointKey === 'rightLowerArm') {
      const lowerArm = vrm.humanoid.getNormalizedBoneNode('rightLowerArm');
      const baseLower = this.startBoneRots.rightLowerArm || { x: 0, y: 0, z: 0 };
      if (lowerArm) {
        lowerArm.rotation.x = Math.max(-Math.PI * 0.85, Math.min(0, baseLower.x - Math.abs(dy * 0.006) + (dx * 0.004)));
        lowerArm.rotation.y = baseLower.y - (dx * 0.004);
      }
      return;
    }

    if (jointKey === 'leftLowerArm') {
      const lowerArm = vrm.humanoid.getNormalizedBoneNode('leftLowerArm');
      const baseLower = this.startBoneRots.leftLowerArm || { x: 0, y: 0, z: 0 };
      if (lowerArm) {
        lowerArm.rotation.x = Math.max(-Math.PI * 0.85, Math.min(0, baseLower.x - Math.abs(dy * 0.006) - (dx * 0.004)));
        lowerArm.rotation.y = baseLower.y + (dx * 0.004);
      }
      return;
    }

    // Direct Knee Control (Kneeling, cross-legged, kicking)
    if (jointKey === 'rightLowerLeg') {
      const lowerLeg = vrm.humanoid.getNormalizedBoneNode('rightLowerLeg');
      const upperLeg = vrm.humanoid.getNormalizedBoneNode('rightUpperLeg');
      const baseLower = this.startBoneRots.rightLowerLeg || { x: 0, y: 0, z: 0 };
      const baseUpper = this.startBoneRots.rightUpperLeg || { x: 0, y: 0, z: 0 };
      if (lowerLeg) {
        lowerLeg.rotation.x = Math.max(0, Math.min(Math.PI * 0.85, baseLower.x - (dy * 0.007)));
      }
      if (upperLeg) {
        upperLeg.rotation.x = baseUpper.x + (dy * 0.003);
      }
      return;
    }

    if (jointKey === 'leftLowerLeg') {
      const lowerLeg = vrm.humanoid.getNormalizedBoneNode('leftLowerLeg');
      const upperLeg = vrm.humanoid.getNormalizedBoneNode('leftUpperLeg');
      const baseLower = this.startBoneRots.leftLowerLeg || { x: 0, y: 0, z: 0 };
      const baseUpper = this.startBoneRots.leftUpperLeg || { x: 0, y: 0, z: 0 };
      if (lowerLeg) {
        lowerLeg.rotation.x = Math.max(0, Math.min(Math.PI * 0.85, baseLower.x - (dy * 0.007)));
      }
      if (upperLeg) {
        upperLeg.rotation.x = baseUpper.x + (dy * 0.003);
      }
      return;
    }

    if (jointKey === 'rightFoot') {
      const upperLeg = vrm.humanoid.getNormalizedBoneNode('rightUpperLeg');
      const lowerLeg = vrm.humanoid.getNormalizedBoneNode('rightLowerLeg');
      const baseUpper = this.startBoneRots.rightUpperLeg || { x: 0, y: 0, z: 0 };
      const baseLower = this.startBoneRots.rightLowerLeg || { x: 0, y: 0, z: 0 };
      if (upperLeg && lowerLeg) {
        upperLeg.rotation.x = baseUpper.x - (dy * 0.006);
        upperLeg.rotation.z = baseUpper.z - (dx * 0.004);
        lowerLeg.rotation.x = Math.max(0, Math.min(Math.PI * 0.8, baseLower.x + Math.abs(dy * 0.008)));
      }
      return;
    }

    if (jointKey === 'leftFoot') {
      const upperLeg = vrm.humanoid.getNormalizedBoneNode('leftUpperLeg');
      const lowerLeg = vrm.humanoid.getNormalizedBoneNode('leftLowerLeg');
      const baseUpper = this.startBoneRots.leftUpperLeg || { x: 0, y: 0, z: 0 };
      const baseLower = this.startBoneRots.leftLowerLeg || { x: 0, y: 0, z: 0 };
      if (upperLeg && lowerLeg) {
        upperLeg.rotation.x = baseUpper.x - (dy * 0.006);
        upperLeg.rotation.z = baseUpper.z - (dx * 0.004);
        lowerLeg.rotation.x = Math.max(0, Math.min(Math.PI * 0.8, baseLower.x + Math.abs(dy * 0.008)));
      }
      return;
    }

    if (jointKey === 'rightUpperLeg') {
      const upperLeg = vrm.humanoid.getNormalizedBoneNode('rightUpperLeg');
      const baseUpper = this.startBoneRots.rightUpperLeg || { x: 0, y: 0, z: 0 };
      if (upperLeg) {
        upperLeg.rotation.x = baseUpper.x - (dy * 0.006);
        upperLeg.rotation.z = baseUpper.z - (dx * 0.005);
      }
      return;
    }

    if (jointKey === 'leftUpperLeg') {
      const upperLeg = vrm.humanoid.getNormalizedBoneNode('leftUpperLeg');
      const baseUpper = this.startBoneRots.leftUpperLeg || { x: 0, y: 0, z: 0 };
      if (upperLeg) {
        upperLeg.rotation.x = baseUpper.x - (dy * 0.006);
        upperLeg.rotation.z = baseUpper.z - (dx * 0.005);
      }
      return;
    }

    if (jointKey === 'head') {
      const head = vrm.humanoid.getNormalizedBoneNode('head');
      const baseHead = this.startBoneRots.head || { x: 0, y: 0, z: 0 };
      if (head) {
        head.rotation.z = Math.max(-0.6, Math.min(0.6, baseHead.z + dx * 0.004));
        head.rotation.x = Math.max(-0.5, Math.min(0.5, baseHead.x - dy * 0.003));
      }
      return;
    }

    if (jointKey === 'neck') {
      const neck = vrm.humanoid.getNormalizedBoneNode('neck');
      const baseNeck = this.startBoneRots.neck || { x: 0, y: 0, z: 0 };
      if (neck) {
        neck.rotation.y = Math.max(-0.8, Math.min(0.8, baseNeck.y + dx * 0.004));
        neck.rotation.x = Math.max(-0.4, Math.min(0.4, baseNeck.x - dy * 0.003));
      }
      return;
    }

    if (jointKey === 'chest') {
      const chest = vrm.humanoid.getNormalizedBoneNode('chest');
      const baseChest = this.startBoneRots.chest || { x: 0, y: 0, z: 0 };
      if (chest) {
        chest.rotation.x = Math.max(-0.4, Math.min(0.5, baseChest.x - dy * 0.003));
        chest.rotation.y = Math.max(-0.5, Math.min(0.5, baseChest.y + dx * 0.003));
      }
      return;
    }

    if (jointKey === 'spine') {
      const spine = vrm.humanoid.getNormalizedBoneNode('spine');
      const baseSpine = this.startBoneRots.spine || { x: 0, y: 0, z: 0 };
      if (spine) {
        spine.rotation.x = Math.max(-0.5, Math.min(0.6, baseSpine.x - dy * 0.004));
        spine.rotation.z = Math.max(-0.4, Math.min(0.4, baseSpine.z - dx * 0.003));
      }
      return;
    }
  }

  _springBonesToDefault(vrm, t) {
    const bones = [
      { key: 'rightUpperArm', def: this.defaultBoneRot.rightUpperArm },
      { key: 'leftUpperArm', def: this.defaultBoneRot.leftUpperArm },
      { key: 'rightLowerArm', def: this.defaultBoneRot.rightLowerArm },
      { key: 'leftLowerArm', def: this.defaultBoneRot.leftLowerArm },
      { key: 'rightUpperLeg', def: this.defaultBoneRot.rightUpperLeg },
      { key: 'leftUpperLeg', def: this.defaultBoneRot.leftUpperLeg },
      { key: 'rightLowerLeg', def: this.defaultBoneRot.rightLowerLeg },
      { key: 'leftLowerLeg', def: this.defaultBoneRot.leftLowerLeg },
      { key: 'head', def: this.defaultBoneRot.head },
      { key: 'neck', def: new THREE.Euler(0, 0, 0) },
      { key: 'chest', def: new THREE.Euler(0, 0, 0) },
      { key: 'spine', def: new THREE.Euler(0, 0, 0) }
    ];

    for (const b of bones) {
      const node = vrm.humanoid.getNormalizedBoneNode(b.key);
      if (node) {
        node.rotation.x = THREE.MathUtils.lerp(node.rotation.x, b.def.x, t);
        node.rotation.y = THREE.MathUtils.lerp(node.rotation.y, b.def.y, t);
        node.rotation.z = THREE.MathUtils.lerp(node.rotation.z, b.def.z, t);
      }
    }
  }

  /**
   * Gets screen projected 2D coordinates for interactive joints dynamically based on avatar bones.
   * @returns {Object<string, { x: number, y: number, z: number }>}
   */
  getJointScreenPositions() {
    const vrm = this.currentVRM;
    const camera = this.sceneManager?.camera;
    const result = {};

    if (!vrm || !vrm.humanoid || !camera) return result;

    if (vrm.scene) {
      vrm.scene.updateMatrixWorld(true);
    }

    const candidateKeys = [
      'head',
      'neck',
      'chest',
      'spine',
      'hips',
      'rightLowerArm',
      'leftLowerArm',
      'rightHand',
      'leftHand',
      'rightUpperLeg',
      'leftUpperLeg',
      'rightLowerLeg',
      'leftLowerLeg',
      'rightFoot',
      'leftFoot'
    ];
    const width = window.innerWidth;
    const height = window.innerHeight;

    for (const key of candidateKeys) {
      const node = vrm.humanoid.getNormalizedBoneNode(key);
      if (node) {
        node.getWorldPosition(this._tempVec3);
        const proj = this._tempVec3.clone().project(camera);
        result[key] = {
          x: ((proj.x + 1) / 2) * width,
          y: ((-proj.y + 1) / 2) * height,
          z: proj.z
        };
      }
    }
    return result;
  }

  _triggerReaction(jointKey) {
    const list = this.dialogues[jointKey];
    if (list && list.length > 0 && typeof this.onReaction === 'function') {
      const item = list[Math.floor(Math.random() * list.length)];
      this.onReaction(jointKey, item.text, item.emotion);
    }
  }
}

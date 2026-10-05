import * as THREE from 'three';

/**
 * PuppetController
 * Implements interactive ragdoll/puppet-like physical pulling of VRM humanoid bones.
 * Supports dual-hand simultaneous index finger tracking and direct screen-delta mapping
 * for hands, legs, head, and lifting the entire body (hips).
 */
// Joints that are dragged by solving the limb toward the pointer: [side, grabbed joint]
const LIMB_JOINT = /^(left|right)(Hand|LowerArm|Foot|LowerLeg)$/;

export class PuppetController {
  constructor(avatarController, animationController, sceneManager, options = {}) {
    this.avatarController = avatarController;
    this.animationController = animationController;
    this.sceneManager = sceneManager;
    this.poseManager = options.poseManager || null;
    this.onReaction = options.onReaction || null;
    this.onPoseUpdated = options.onPoseUpdated || null;

    this.isEnabled = false; // Disabled by default, toggled via toolbar button
    this.keepPoseOnRelease = true; // Hold sculpted pose instead of auto-recovering
    this.grabbedJointKey = null; // Primary pointer joint key
    this.hoveredJointKey = null;

    this.fingerScreenPos = { x: 0, y: 0 };
    this.dragStartFinger = { x: 0, y: 0 };
    this.dragDelta = { x: 0, y: 0 };
    this.isPinching = false;
    this.snappingRadius = 90; // Screen pixels

    // Multi-pointer map: Map<pointerId, PointerState>
    this.pointers = new Map();

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
      ],
      dualHands: [
        { emotion: 'happy', text: '哇～主人的兩隻手食指都在牽我，像在空中跳華爾滋一樣！💃' },
        { emotion: 'shy', text: '兩隻手一起拉著我...心跳都快停下來了啦～💕' },
        { emotion: 'happy', text: '雙手一起展開～來一個大大的溫暖擁抱吧！🥰' }
      ]
    };

    this._tempVec3 = new THREE.Vector3();
  }

  get currentVRM() {
    return this.avatarController ? (this.avatarController.getCurrentVRM() || this.avatarController.currentVRM) : null;
  }

  isGrabbingOrHovered() {
    if (!this.isEnabled) return false;
    if (this.grabbedJointKey !== null || this.hoveredJointKey !== null) return true;
    for (const p of this.pointers.values()) {
      if (p.grabbedJointKey !== null || p.hoveredJointKey !== null) return true;
    }
    return false;
  }

  setEnabled(enabled) {
    this.isEnabled = enabled;
    if (!enabled) {
      this.releaseGrab();
      this.pointers.clear();
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
    if (!vrm || !vrm.humanoid) return {};
    const startBoneRots = {};
    const humanoid = vrm.humanoid;
    const saveBone = (name) => {
      const node = humanoid.getNormalizedBoneNode(name);
      if (node) {
        startBoneRots[name] = {
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

    // Limb joints are dragged in world space: remember where the grabbed joint started
    if (LIMB_JOINT.test(jointKey)) {
      const grabbed = humanoid.getNormalizedBoneNode(jointKey);
      if (grabbed) startBoneRots._startWorld = grabbed.getWorldPosition(new THREE.Vector3());
    }
    return startBoneRots;
  }

  /**
   * Called on finger/mouse update, optionally accepting dual hands array.
   * @param {number} x
   * @param {number} y
   * @param {boolean} isPinching
   * @param {Array<Object>} [hands]
   */
  updateFinger(x, y, isPinching, hands = null) {
    if (!this.isEnabled) return;

    if (hands && Array.isArray(hands) && hands.length > 0) {
      this.updateHands(hands);
      return;
    }

    // Default single pointer fallback
    this.updateHands([
      {
        id: 'primary',
        x,
        y,
        isPinching,
        name: '食指'
      }
    ]);
  }

  /**
   * Updates multiple pointer states (dual index fingers).
   * @param {Array<Object>} handsList
   */
  updateHands(handsList) {
    if (!this.isEnabled) return;

    const currentIds = new Set(handsList.map(h => h.id));
    const jointTargets = this.getJointScreenPositions();
    const vrm = this.currentVRM;

    // 1. Release and cleanup disappeared pointers
    for (const [id, pointer] of this.pointers.entries()) {
      if (!currentIds.has(id)) {
        if (pointer.grabbedJointKey) {
          this.releasePointerGrab(pointer);
        }
        this.pointers.delete(id);
      }
    }

    // 2. Process each active hand pointer
    for (const hand of handsList) {
      let pointer = this.pointers.get(hand.id);
      if (!pointer) {
        pointer = {
          id: hand.id,
          name: hand.name || (hand.id === 'hand_1' ? '食指 2' : '食指 1'),
          x: hand.x,
          y: hand.y,
          isPinching: false,
          grabbedJointKey: null,
          hoveredJointKey: null,
          dragStartFinger: { x: hand.x, y: hand.y },
          dragDelta: { x: 0, y: 0 },
          startBoneRots: {},
          startModelPos: new THREE.Vector3()
        };
        this.pointers.set(hand.id, pointer);
      }

      pointer.x = hand.x;
      pointer.y = hand.y;
      const wasPinching = pointer.isPinching;
      pointer.isPinching = hand.isPinching;

      // Update hover state if not grabbing
      if (!pointer.grabbedJointKey) {
        pointer.hoveredJointKey = null;
        let minDist = this.snappingRadius;
        for (const [key, pos] of Object.entries(jointTargets)) {
          // Avoid targeting joint already grabbed by another pointer
          const alreadyGrabbed = Array.from(this.pointers.values()).some(
            p => p.id !== pointer.id && p.grabbedJointKey === key
          );
          if (alreadyGrabbed) continue;

          const dist = Math.hypot(pointer.x - pos.x, pointer.y - pos.y);
          if (dist < minDist) {
            minDist = dist;
            pointer.hoveredJointKey = key;
          }
        }
      }

      // Detect grab start
      if (pointer.isPinching && !wasPinching) {
        let targetJoint = pointer.hoveredJointKey;
        if (!targetJoint) {
          // Smart nearest search within avatar range
          let closestKey = null;
          let minDist = 260;
          for (const [key, pos] of Object.entries(jointTargets)) {
            const alreadyGrabbed = Array.from(this.pointers.values()).some(
              p => p.id !== pointer.id && p.grabbedJointKey === key
            );
            if (alreadyGrabbed) continue;

            const d = Math.hypot(pointer.x - pos.x, pointer.y - pos.y);
            if (d < minDist) {
              minDist = d;
              closestKey = key;
            }
          }
          targetJoint = closestKey || (this._isJointAvailable('hips') ? 'hips' : null);
        }

        if (targetJoint) {
          pointer.grabbedJointKey = targetJoint;
          pointer.hoveredJointKey = targetJoint;
          pointer.dragStartFinger.x = hand.x;
          pointer.dragStartFinger.y = hand.y;
          pointer.dragDelta.x = 0;
          pointer.dragDelta.y = 0;

          if (vrm && vrm.scene) {
            pointer.startModelPos.copy(vrm.scene.position);
          }
          pointer.startBoneRots = this._cacheStartRotations(targetJoint, vrm);

          this.isRecovering = false;
          if (this.animationController?.setCustomPoseOverride) {
            this.animationController.setCustomPoseOverride(true);
          }

          // Check if dual hands are now both grabbing!
          const activeGrabs = Array.from(this.pointers.values()).filter(p => p.grabbedJointKey);
          if (activeGrabs.length >= 2) {
            this._triggerReaction('dualHands');
          } else {
            this._triggerReaction(pointer.grabbedJointKey);
          }

          console.log(`[Puppet] ${pointer.name} (${pointer.id}) grabbed: ${targetJoint}`);
        }
      } else if (pointer.isPinching && wasPinching && pointer.grabbedJointKey) {
        // Actively dragging
        pointer.dragDelta.x = pointer.x - pointer.dragStartFinger.x;
        pointer.dragDelta.y = pointer.y - pointer.dragStartFinger.y;
      } else if (!pointer.isPinching && wasPinching) {
        // Released grab
        this.releasePointerGrab(pointer);
      }
    }

    // Mirror to primary pointer fields for backward compatibility
    const firstPointer = this.pointers.values().next().value;
    if (firstPointer) {
      this.fingerScreenPos.x = firstPointer.x;
      this.fingerScreenPos.y = firstPointer.y;
      this.isPinching = Array.from(this.pointers.values()).some(p => p.isPinching);
      this.grabbedJointKey = firstPointer.grabbedJointKey;
      this.hoveredJointKey = firstPointer.hoveredJointKey;
      this.dragDelta.x = firstPointer.dragDelta.x;
      this.dragDelta.y = firstPointer.dragDelta.y;
      this.startBoneRots = firstPointer.startBoneRots;
      this.startModelPos.copy(firstPointer.startModelPos);
    }
  }

  _isJointAvailable(jointKey) {
    for (const p of this.pointers.values()) {
      if (p.grabbedJointKey === jointKey) return false;
    }
    return true;
  }

  releasePointerGrab(pointer) {
    if (pointer && pointer.grabbedJointKey) {
      console.log(`[Puppet] Released joint: ${pointer.grabbedJointKey} for ${pointer.id}`);
      pointer.grabbedJointKey = null;

      const anyOtherGrab = Array.from(this.pointers.values()).some(p => p.grabbedJointKey !== null);
      if (!anyOtherGrab) {
        this.releaseGrab();
      }
    }
  }

  releaseGrab() {
    this.grabbedJointKey = null;
    for (const p of this.pointers.values()) {
      p.grabbedJointKey = null;
    }

    if (this.keepPoseOnRelease) {
      this.isRecovering = false;
      if (this.animationController?.setCustomPoseOverride) {
        this.animationController.setCustomPoseOverride(true);
      }
      if (this.poseManager?.captureCurrentPoseFromAvatar) {
        this.poseManager.captureCurrentPoseFromAvatar();
      }
      const activeSlot = this.avatarController?.getActiveSlot?.();
      if (activeSlot && this.poseManager?.currentRotations) {
        activeSlot.isSculpted = true;
        activeSlot.customBoneRotations = { ...this.poseManager.currentRotations };
      }
      if (typeof this.onPoseUpdated === 'function') {
        this.onPoseUpdated();
      }
    } else {
      this.isRecovering = true;
      this.recoveryProgress = 0.0;
    }
  }

  /**
   * Retrieves active pointers for visualizer rendering.
   * @returns {Array<Object>}
   */
  getActivePointers() {
    return Array.from(this.pointers.values());
  }

  /**
   * Core frame update called inside Three.js render loop.
   */
  update(delta) {
    if (!this.isEnabled) return;
    const vrm = this.currentVRM;
    if (!vrm || !vrm.humanoid) return;

    // Process dragging physics for each active pointer
    let hasAnyDragging = false;
    for (const pointer of this.pointers.values()) {
      if (pointer.grabbedJointKey) {
        hasAnyDragging = true;
        this._applyDirectLimbDragging(
          pointer.grabbedJointKey,
          vrm,
          pointer.dragDelta,
          pointer.startBoneRots,
          pointer.startModelPos
        );
      }
    }

    // Fallback for single pointer direct state
    if (!hasAnyDragging && this.grabbedJointKey) {
      hasAnyDragging = true;
      this._applyDirectLimbDragging(
        this.grabbedJointKey,
        vrm,
        this.dragDelta,
        this.startBoneRots,
        this.startModelPos
      );
    }

    if (!hasAnyDragging && this.isRecovering) {
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
   * Applies direct physical pulling with configurable delta and start transforms.
   */
  _applyDirectLimbDragging(jointKey, vrm, dragDelta = null, startBoneRots = null, startModelPos = null) {
    const delta = dragDelta || this.dragDelta;
    const baseRots = startBoneRots || this.startBoneRots;
    const modelPos = startModelPos || this.startModelPos;
    const dx = delta.x;
    const dy = delta.y;

    // Arms and legs follow the pointer exactly (full reach: overhead, high kicks);
    // the per-axis mapping below is only a fallback when that can't be solved.
    const limb = LIMB_JOINT.exec(jointKey);
    if (limb && this._dragLimbToPointer(limb[1], limb[2], vrm, dx, dy, baseRots)) {
      return;
    }

    if (jointKey === 'hips') {
      if (vrm.scene) {
        vrm.scene.position.x = modelPos.x + dx * 0.0035;
        vrm.scene.position.y = modelPos.y - dy * 0.0035;
        if (this.avatarController?.updateSelectionRing) {
          this.avatarController.updateSelectionRing();
        }
      }

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
      const baseUpper = baseRots.rightUpperArm || { x: 0.08, y: 0, z: -Math.PI * 0.38 };
      const baseLower = baseRots.rightLowerArm || { x: 0, y: 0, z: 0 };
      if (upperArm && lowerArm) {
        upperArm.rotation.z = THREE.MathUtils.clamp(baseUpper.z + (dy * 0.006) + (dx * 0.004), -2.4, -0.15);
        upperArm.rotation.x = THREE.MathUtils.clamp(baseUpper.x - (dy * 0.004), -0.5, 1.6);
        upperArm.rotation.y = THREE.MathUtils.clamp(baseUpper.y - (dx * 0.003), -1.2, 1.2);
        lowerArm.rotation.x = THREE.MathUtils.clamp(baseLower.x - (dy * 0.005) + Math.abs(dx * 0.003), 0, Math.PI * 0.85);
      }
      return;
    }

    if (jointKey === 'leftHand') {
      const upperArm = vrm.humanoid.getNormalizedBoneNode('leftUpperArm');
      const lowerArm = vrm.humanoid.getNormalizedBoneNode('leftLowerArm');
      const baseUpper = baseRots.leftUpperArm || { x: 0.08, y: 0, z: Math.PI * 0.38 };
      const baseLower = baseRots.leftLowerArm || { x: 0, y: 0, z: 0 };
      if (upperArm && lowerArm) {
        upperArm.rotation.z = THREE.MathUtils.clamp(baseUpper.z - (dy * 0.006) + (dx * 0.004), 0.15, 2.4);
        upperArm.rotation.x = THREE.MathUtils.clamp(baseUpper.x - (dy * 0.004), -0.5, 1.6);
        upperArm.rotation.y = THREE.MathUtils.clamp(baseUpper.y + (dx * 0.003), -1.2, 1.2);
        lowerArm.rotation.x = THREE.MathUtils.clamp(baseLower.x - (dy * 0.005) + Math.abs(dx * 0.003), 0, Math.PI * 0.85);
      }
      return;
    }

    if (jointKey === 'rightLowerArm') {
      const lowerArm = vrm.humanoid.getNormalizedBoneNode('rightLowerArm');
      const upperArm = vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
      const baseLower = baseRots.rightLowerArm || { x: 0, y: 0, z: 0 };
      const baseUpper = baseRots.rightUpperArm || { x: 0.08, y: 0, z: -Math.PI * 0.38 };
      if (lowerArm) {
        lowerArm.rotation.x = THREE.MathUtils.clamp(baseLower.x - (dy * 0.006) + Math.abs(dx * 0.003), 0, Math.PI * 0.85);
        lowerArm.rotation.y = THREE.MathUtils.clamp(baseLower.y - (dx * 0.004), -1.2, 1.2);
      }
      if (upperArm) {
        upperArm.rotation.z = THREE.MathUtils.clamp(baseUpper.z + (dy * 0.004) + (dx * 0.004), -2.2, -0.15);
      }
      return;
    }

    if (jointKey === 'leftLowerArm') {
      const lowerArm = vrm.humanoid.getNormalizedBoneNode('leftLowerArm');
      const upperArm = vrm.humanoid.getNormalizedBoneNode('leftUpperArm');
      const baseLower = baseRots.leftLowerArm || { x: 0, y: 0, z: 0 };
      const baseUpper = baseRots.leftUpperArm || { x: 0.08, y: 0, z: Math.PI * 0.38 };
      if (lowerArm) {
        lowerArm.rotation.x = THREE.MathUtils.clamp(baseLower.x - (dy * 0.006) + Math.abs(dx * 0.003), 0, Math.PI * 0.85);
        lowerArm.rotation.y = THREE.MathUtils.clamp(baseLower.y + (dx * 0.004), -1.2, 1.2);
      }
      if (upperArm) {
        upperArm.rotation.z = THREE.MathUtils.clamp(baseUpper.z - (dy * 0.004) + (dx * 0.004), 0.15, 2.2);
      }
      return;
    }

    if (jointKey === 'rightLowerLeg') {
      const lowerLeg = vrm.humanoid.getNormalizedBoneNode('rightLowerLeg');
      const upperLeg = vrm.humanoid.getNormalizedBoneNode('rightUpperLeg');
      const baseLower = baseRots.rightLowerLeg || { x: 0, y: 0, z: 0 };
      const baseUpper = baseRots.rightUpperLeg || { x: 0, y: 0, z: 0 };
      if (lowerLeg) {
        lowerLeg.rotation.x = THREE.MathUtils.clamp(baseLower.x + (dy * 0.007), -Math.PI * 0.85, 0);
      }
      if (upperLeg) {
        upperLeg.rotation.x = THREE.MathUtils.clamp(baseUpper.x - (dy * 0.005), -0.5, Math.PI * 0.65);
      }
      return;
    }

    if (jointKey === 'leftLowerLeg') {
      const lowerLeg = vrm.humanoid.getNormalizedBoneNode('leftLowerLeg');
      const upperLeg = vrm.humanoid.getNormalizedBoneNode('leftUpperLeg');
      const baseLower = baseRots.leftLowerLeg || { x: 0, y: 0, z: 0 };
      const baseUpper = baseRots.leftUpperLeg || { x: 0, y: 0, z: 0 };
      if (lowerLeg) {
        lowerLeg.rotation.x = THREE.MathUtils.clamp(baseLower.x + (dy * 0.007), -Math.PI * 0.85, 0);
      }
      if (upperLeg) {
        upperLeg.rotation.x = THREE.MathUtils.clamp(baseUpper.x - (dy * 0.005), -0.5, Math.PI * 0.65);
      }
      return;
    }

    if (jointKey === 'rightFoot') {
      const upperLeg = vrm.humanoid.getNormalizedBoneNode('rightUpperLeg');
      const lowerLeg = vrm.humanoid.getNormalizedBoneNode('rightLowerLeg');
      const baseUpper = baseRots.rightUpperLeg || { x: 0, y: 0, z: 0 };
      const baseLower = baseRots.rightLowerLeg || { x: 0, y: 0, z: 0 };
      if (upperLeg && lowerLeg) {
        upperLeg.rotation.x = THREE.MathUtils.clamp(baseUpper.x - (dy * 0.006), -0.5, Math.PI * 0.65);
        upperLeg.rotation.z = THREE.MathUtils.clamp(baseUpper.z + (dx * 0.004), -0.9, 0.4);
        lowerLeg.rotation.x = THREE.MathUtils.clamp(baseLower.x - Math.abs(dy * 0.008), -Math.PI * 0.85, 0);
      }
      return;
    }

    if (jointKey === 'leftFoot') {
      const upperLeg = vrm.humanoid.getNormalizedBoneNode('leftUpperLeg');
      const lowerLeg = vrm.humanoid.getNormalizedBoneNode('leftLowerLeg');
      const baseUpper = baseRots.leftUpperLeg || { x: 0, y: 0, z: 0 };
      const baseLower = baseRots.leftLowerLeg || { x: 0, y: 0, z: 0 };
      if (upperLeg && lowerLeg) {
        upperLeg.rotation.x = THREE.MathUtils.clamp(baseUpper.x - (dy * 0.006), -0.5, Math.PI * 0.65);
        upperLeg.rotation.z = THREE.MathUtils.clamp(baseUpper.z + (dx * 0.004), -0.4, 0.9);
        lowerLeg.rotation.x = THREE.MathUtils.clamp(baseLower.x - Math.abs(dy * 0.008), -Math.PI * 0.85, 0);
      }
      return;
    }

    if (jointKey === 'rightUpperLeg') {
      const upperLeg = vrm.humanoid.getNormalizedBoneNode('rightUpperLeg');
      const baseUpper = baseRots.rightUpperLeg || { x: 0, y: 0, z: 0 };
      if (upperLeg) {
        upperLeg.rotation.x = THREE.MathUtils.clamp(baseUpper.x - (dy * 0.006), -0.5, Math.PI * 0.65);
        upperLeg.rotation.z = THREE.MathUtils.clamp(baseUpper.z + (dx * 0.005), -0.9, 0.4);
      }
      return;
    }

    if (jointKey === 'leftUpperLeg') {
      const upperLeg = vrm.humanoid.getNormalizedBoneNode('leftUpperLeg');
      const baseUpper = baseRots.leftUpperLeg || { x: 0, y: 0, z: 0 };
      if (upperLeg) {
        upperLeg.rotation.x = THREE.MathUtils.clamp(baseUpper.x - (dy * 0.006), -0.5, Math.PI * 0.65);
        upperLeg.rotation.z = THREE.MathUtils.clamp(baseUpper.z + (dx * 0.005), -0.4, 0.9);
      }
      return;
    }

    if (jointKey === 'head') {
      const head = vrm.humanoid.getNormalizedBoneNode('head');
      const baseHead = baseRots.head || { x: 0, y: 0, z: 0 };
      if (head) {
        head.rotation.z = Math.max(-0.6, Math.min(0.6, baseHead.z + dx * 0.004));
        head.rotation.x = Math.max(-0.5, Math.min(0.5, baseHead.x - dy * 0.003));
      }
      return;
    }

    if (jointKey === 'neck') {
      const neck = vrm.humanoid.getNormalizedBoneNode('neck');
      const baseNeck = baseRots.neck || { x: 0, y: 0, z: 0 };
      if (neck) {
        neck.rotation.y = Math.max(-0.8, Math.min(0.8, baseNeck.y + dx * 0.004));
        neck.rotation.x = Math.max(-0.4, Math.min(0.4, baseNeck.x - dy * 0.003));
      }
      return;
    }

    if (jointKey === 'chest') {
      const chest = vrm.humanoid.getNormalizedBoneNode('chest');
      const baseChest = baseRots.chest || { x: 0, y: 0, z: 0 };
      if (chest) {
        chest.rotation.x = Math.max(-0.4, Math.min(0.5, baseChest.x - dy * 0.003));
        chest.rotation.y = Math.max(-0.5, Math.min(0.5, baseChest.y + dx * 0.003));
      }
      return;
    }

    if (jointKey === 'spine') {
      const spine = vrm.humanoid.getNormalizedBoneNode('spine');
      const baseSpine = baseRots.spine || { x: 0, y: 0, z: 0 };
      if (spine) {
        spine.rotation.x = Math.max(-0.5, Math.min(0.6, baseSpine.x - dy * 0.004));
        spine.rotation.z = Math.max(-0.4, Math.min(0.4, baseSpine.z - dx * 0.003));
      }
      return;
    }
  }

  /**
   * Moves the grabbed hand / foot (two-bone IK) or elbow / knee (aim the upper
   * bone) to the point under the pointer, at the depth the joint had when grabbed.
   * @param {string} side 'left' | 'right'
   * @param {string} joint 'Hand' | 'LowerArm' | 'Foot' | 'LowerLeg'
   * @returns {boolean} false if the limb could not be solved
   */
  _dragLimbToPointer(side, joint, vrm, dx, dy, baseRots) {
    const camera = this.sceneManager?.camera;
    const startWorld = baseRots?._startWorld;
    const humanoid = vrm.humanoid;
    const isArm = joint === 'Hand' || joint === 'LowerArm';
    const isTip = joint === 'Hand' || joint === 'Foot';
    const upper = humanoid.getNormalizedBoneNode(side + (isArm ? 'UpperArm' : 'UpperLeg'));
    const lower = humanoid.getNormalizedBoneNode(side + (isArm ? 'LowerArm' : 'LowerLeg'));
    const tip = humanoid.getNormalizedBoneNode(side + (isArm ? 'Hand' : 'Foot'));
    if (!camera || !startWorld || !upper || !lower || !tip || !upper.parent) return false;

    // Pointer movement in screen space -> world target on the grabbed joint's depth plane
    const target = startWorld.clone().project(camera);
    target.x += (dx / window.innerWidth) * 2;
    target.y -= (dy / window.innerHeight) * 2;
    target.unproject(camera);

    const root = upper.getWorldPosition(new THREE.Vector3());
    const parentQuat = upper.parent.getWorldQuaternion(new THREE.Quaternion());
    const scale = upper.getWorldScale(new THREE.Vector3()).x;
    const upperLen = lower.position.length() * scale;
    const lowerLen = tip.position.length() * scale;
    if (upperLen < 1e-5 || lowerLen < 1e-5) return false;

    // Normalized bones have identity rest rotations: a child's offset is its parent's rest direction
    const upperRest = lower.position.clone().normalize();
    const lowerRest = tip.position.clone().normalize();

    const toTarget = target.sub(root);
    const dist = toTarget.length();
    if (dist < 1e-5) return false;
    const dir = toTarget.divideScalar(dist);

    if (!isTip) {
      // Elbow / knee grabbed: point the upper bone at the pointer, keep the existing bend
      upper.quaternion.setFromUnitVectors(upperRest, dir.clone().applyQuaternion(parentQuat.clone().invert()));
      return true;
    }

    // Hand / foot grabbed: bend the middle joint so the tip reaches the target (or stretch toward it)
    const reach = THREE.MathUtils.clamp(dist, Math.abs(upperLen - lowerLen) + 1e-4, (upperLen + lowerLen) * 0.999);
    const along = (upperLen * upperLen - lowerLen * lowerLen + reach * reach) / (2 * reach);
    const bend = Math.sqrt(Math.max(0, upperLen * upperLen - along * along));

    // The avatar's own outward / forward directions, from where its two limbs attach
    const otherUpper = humanoid.getNormalizedBoneNode((side === 'left' ? 'right' : 'left') + (isArm ? 'UpperArm' : 'UpperLeg'));
    const outward = otherUpper
      ? root.clone().sub(otherUpper.getWorldPosition(new THREE.Vector3())).normalize()
      : new THREE.Vector3(1, 0, 0);
    const forward = new THREE.Vector3().crossVectors(outward, new THREE.Vector3(0, 1, 0));
    if (side === 'right') forward.negate();

    // Which way the middle joint bulges. Elbows: down / out / slightly back.
    // Knees: toward the front of the leg wherever it points (up on a front kick,
    // down on a back kick), so they never bend the wrong way.
    const avatarLeft = side === 'left' ? outward : outward.clone().negate();
    const pole = isArm
      ? new THREE.Vector3(0, -1, 0).addScaledVector(outward, 0.6).addScaledVector(forward, -0.3)
      : new THREE.Vector3().crossVectors(dir, avatarLeft).addScaledVector(forward, 0.2);
    pole.addScaledVector(dir, -pole.dot(dir));
    if (pole.lengthSq() < 1e-8) pole.copy(outward).addScaledVector(dir, -outward.dot(dir));
    pole.normalize();

    const middle = dir.clone().multiplyScalar(along).addScaledVector(pole, bend);
    const upperDir = middle.clone().normalize();
    const lowerDir = dir.clone().multiplyScalar(reach).sub(middle).normalize();

    upper.quaternion.setFromUnitVectors(upperRest, upperDir.applyQuaternion(parentQuat.clone().invert()));
    const upperWorldQuat = parentQuat.multiply(upper.quaternion);
    lower.quaternion.setFromUnitVectors(lowerRest, lowerDir.applyQuaternion(upperWorldQuat.invert()));
    return true;
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

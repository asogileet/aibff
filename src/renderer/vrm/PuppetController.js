import * as THREE from 'three';

/**
 * PuppetController
 * Implements interactive ragdoll/puppet-like physical pulling of VRM humanoid bones.
 * Supports Two-Bone IK for arms and legs, joint snapping, and spring-back recovery.
 */
export class PuppetController {
  constructor(avatarController, animationController, sceneManager, options = {}) {
    this.avatarController = avatarController;
    this.animationController = animationController;
    this.sceneManager = sceneManager;
    this.onReaction = options.onReaction || null;

    this.isEnabled = false;
    this.grabbedJointKey = null; // 'head', 'hips', 'rightHand', 'leftHand', 'rightFoot', 'leftFoot'
    this.hoveredJointKey = null;

    this.fingerScreenPos = { x: 0, y: 0 };
    this.isPinching = false;
    this.snappingRadius = 90; // Screen pixels - increased for easy snapping

    // Spring damping recovery state
    this.isRecovering = false;
    this.recoveryProgress = 1.0;
    this.recoveredJoints = {};

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
      rightHand: [
        { emotion: 'happy', text: '主人牽著我的右手，是要一起跳舞嗎～？💃' },
        { emotion: 'happy', text: '牽手成功！今天一整天都不准放開喔！✨' }
      ],
      leftHand: [
        { emotion: 'surprised', text: '哇！主人拉住我的左手了～要去哪裡呀？' },
        { emotion: 'happy', text: '主人的手感覺好溫暖呢～💕' }
      ],
      rightFoot: [
        { emotion: 'surprised', text: '呀！主人怎麼抓人家的腳啦～好害羞！😣' },
        { emotion: 'happy', text: '看我一腳金雞獨立！主人快放我下來啦～😆' }
      ],
      leftFoot: [
        { emotion: 'shy', text: '嗚嗚～不要隨便抓女孩子的腳踝啦！會癢～😂' },
        { emotion: 'surprised', text: '主人大壞蛋！快把我放回平地上～' }
      ]
    };

    // Reusable math objects
    this._tempVec3 = new THREE.Vector3();
    this._targetWorldPos = new THREE.Vector3();
    this._raycaster = new THREE.Raycaster();
    this._plane = new THREE.Plane();
  }

  setEnabled(enabled) {
    this.isEnabled = enabled;
    if (!enabled && this.grabbedJointKey) {
      this.releaseGrab();
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
      if (this.hoveredJointKey) {
        this.grabbedJointKey = this.hoveredJointKey;
        this.isRecovering = false;
        if (this.animationController?.setPoseOverrideMode) {
          this.animationController.setPoseOverrideMode(true);
        }
        this._triggerReaction(this.grabbedJointKey);
      }
    } else if (!this.isPinching && wasPinching) {
      this.releaseGrab();
    }
  }

  releaseGrab() {
    if (this.grabbedJointKey) {
      this.grabbedJointKey = null;
      this.isRecovering = true;
      this.recoveryProgress = 0.0;
    }
  }

  /**
   * Core frame update called inside Three.js render loop.
   */
  update(delta) {
    if (!this.isEnabled) return;
    const vrm = this.avatarController?.currentVrm;
    if (!vrm || !vrm.humanoid) return;

    const camera = this.sceneManager.camera;
    if (!camera) return;

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

    // 3. Process Dragging Physics IK
    if (this.grabbedJointKey) {
      this._applyJointDragging(this.grabbedJointKey, vrm, camera);
    } else if (this.isRecovering) {
      // Spring back to idle pose
      this.recoveryProgress += delta * 3.5;
      if (this.recoveryProgress >= 1.0) {
        this.isRecovering = false;
        if (this.animationController?.setPoseOverrideMode) {
          this.animationController.setPoseOverrideMode(false);
        }
      }
    }
  }

  /**
   * Gets screen projected 2D coordinates for interactive joints.
   * @returns {Object<string, { x: number, y: number, z: number }>}
   */
  getJointScreenPositions() {
    const vrm = this.avatarController?.currentVrm;
    const camera = this.sceneManager?.camera;
    const result = {};

    if (!vrm || !vrm.humanoid || !camera) return result;

    const jointKeys = ['head', 'hips', 'rightHand', 'leftHand', 'rightFoot', 'leftFoot'];
    const width = window.innerWidth;
    const height = window.innerHeight;

    for (const key of jointKeys) {
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

  /**
   * Applies Two-Bone IK and LookAt bone manipulation towards finger target.
   */
  _applyJointDragging(jointKey, vrm, camera) {
    // Project screen finger position to 3D world plane at character depth
    const ndcX = (this.fingerScreenPos.x / window.innerWidth) * 2 - 1;
    const ndcY = -(this.fingerScreenPos.y / window.innerHeight) * 2 + 1;

    this._raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);

    // Plane parallel to camera passing through root hips
    const hipsNode = vrm.humanoid.getNormalizedBoneNode('hips');
    const rootPos = hipsNode ? hipsNode.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 0.9, 0);
    const camDir = camera.getWorldDirection(new THREE.Vector3());
    this._plane.setFromNormalAndCoplanarPoint(camDir.negate(), rootPos);

    this._raycaster.ray.intersectPlane(this._plane, this._targetWorldPos);

    if (jointKey === 'hips') {
      // Pick up the whole avatar model and move with finger
      if (vrm.scene) {
        vrm.scene.position.x = this._targetWorldPos.x;
        vrm.scene.position.y = this._targetWorldPos.y - 0.85;
      }
      // Dangle limbs naturally
      const rArm = vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
      const lArm = vrm.humanoid.getNormalizedBoneNode('leftUpperArm');
      const rLeg = vrm.humanoid.getNormalizedBoneNode('rightUpperLeg');
      const lLeg = vrm.humanoid.getNormalizedBoneNode('leftUpperLeg');
      if (rArm) rArm.rotation.set(0.1, 0, -Math.PI * 0.38);
      if (lArm) lArm.rotation.set(0.1, 0, Math.PI * 0.38);
      if (rLeg) rLeg.rotation.set(0.15, 0, -0.05);
      if (lLeg) lLeg.rotation.set(0.15, 0, 0.05);
      return;
    }

    if (jointKey === 'rightHand' || jointKey === 'leftHand') {
      const isRight = jointKey === 'rightHand';
      const upperArmNode = vrm.humanoid.getNormalizedBoneNode(isRight ? 'rightUpperArm' : 'leftUpperArm');
      const lowerArmNode = vrm.humanoid.getNormalizedBoneNode(isRight ? 'rightLowerArm' : 'leftLowerArm');
      const handNode = vrm.humanoid.getNormalizedBoneNode(isRight ? 'rightHand' : 'leftHand');

      if (upperArmNode && lowerArmNode) {
        // LookAt direction towards target
        const shoulderWorld = upperArmNode.getWorldPosition(new THREE.Vector3());
        const armDir = new THREE.Vector3().subVectors(this._targetWorldPos, shoulderWorld).normalize();

        // Calculate rotation angles
        const yaw = Math.atan2(armDir.x, armDir.z);
        const pitch = -Math.asin(THREE.MathUtils.clamp(armDir.y, -0.99, 0.99));

        upperArmNode.rotation.set(pitch * 0.7, yaw * 0.5, isRight ? -Math.PI * 0.35 : Math.PI * 0.35);
        lowerArmNode.rotation.set(pitch * 0.3, 0, 0);
      }
    } else if (jointKey === 'rightFoot' || jointKey === 'leftFoot') {
      const isRight = jointKey === 'rightFoot';
      const upperLegNode = vrm.humanoid.getNormalizedBoneNode(isRight ? 'rightUpperLeg' : 'leftUpperLeg');
      const lowerLegNode = vrm.humanoid.getNormalizedBoneNode(isRight ? 'rightLowerLeg' : 'leftLowerLeg');

      if (upperLegNode && lowerLegNode) {
        const hipWorld = upperLegNode.getWorldPosition(new THREE.Vector3());
        const legDir = new THREE.Vector3().subVectors(this._targetWorldPos, hipWorld).normalize();

        const pitch = -Math.asin(THREE.MathUtils.clamp(legDir.y, -0.99, 0.99));
        upperLegNode.rotation.set(-pitch * 0.8, 0, isRight ? -0.15 : 0.15);
        lowerLegNode.rotation.set(pitch * 0.6, 0, 0);
      }
    } else if (jointKey === 'head') {
      const headNode = vrm.humanoid.getNormalizedBoneNode('head');
      if (headNode) {
        headNode.rotation.set(-0.15, 0, 0.12);
      }
    }
  }

  _triggerReaction(jointKey) {
    const list = this.dialogues[jointKey];
    if (list && list.length > 0 && typeof this.onReaction === 'function') {
      const item = list[Math.floor(Math.random() * list.length)];
      this.onReaction(jointKey, item.text, item.emotion);
    }
  }
}

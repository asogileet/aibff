import * as THREE from 'three';

/**
 * MotionCaptureController
 * Retargets MediaPipe body / face tracking results onto the active VRM:
 * torso, arms, legs, head and fingers follow the person in front of the webcam,
 * and blinking / mouth shapes follow their face.
 *
 * Must be registered as the LAST updatable so its bone writes win over the
 * idle, eye-tracking and action animations while capture is enabled.
 */

// MediaPipe Pose landmark indices
const LM = {
  nose: 0, leftEar: 7, rightEar: 8,
  leftShoulder: 11, rightShoulder: 12, leftElbow: 13, rightElbow: 14,
  leftWrist: 15, rightWrist: 16, leftPinky: 17, rightPinky: 18, leftIndex: 19, rightIndex: 20,
  leftHip: 23, rightHip: 24, leftKnee: 25, rightKnee: 26, leftAnkle: 27, rightAnkle: 28
};

// MediaPipe Hand landmark indices
const HAND = { wrist: 0, indexMcp: 5, middleMcp: 9, pinkyMcp: 17 };

// Finger bone suffix -> [from, to] hand landmarks whose segment the bone follows.
// (three-vrm names the three thumb bones Metacarpal / Proximal / Distal.)
const FINGER_SEGMENTS = {
  ThumbMetacarpal: [1, 2], ThumbProximal: [2, 3], ThumbDistal: [3, 4],
  IndexProximal: [5, 6], IndexIntermediate: [6, 7], IndexDistal: [7, 8],
  MiddleProximal: [9, 10], MiddleIntermediate: [10, 11], MiddleDistal: [11, 12],
  RingProximal: [13, 14], RingIntermediate: [14, 15], RingDistal: [15, 16],
  LittleProximal: [17, 18], LittleIntermediate: [18, 19], LittleDistal: [19, 20]
};
const FINGER_BONES = ['left', 'right'].flatMap((side) => Object.keys(FINGER_SEGMENTS).map((f) => side + f));

const DRIVEN_BONES = [
  'hips', 'spine', 'chest', 'neck', 'head',
  'leftUpperArm', 'leftLowerArm', 'leftHand', 'rightUpperArm', 'rightLowerArm', 'rightHand',
  'leftUpperLeg', 'leftLowerLeg', 'rightUpperLeg', 'rightLowerLeg',
  ...FINGER_BONES
];

const VISIBLE = 0.5;        // Landmark visibility needed to drive a limb
const LEG_VISIBLE = 0.65;   // Legs are usually out of frame at a desk, so be stricter
const LOST_TIMEOUT = 1.0;   // Seconds without a body before easing back to the rest pose
const HAND_MATCH_DIST = 0.2; // Max image-space distance (0..1) between a detected hand and a body wrist
const FOLLOW_SPEED = 16.0;  // Bone smoothing rate (higher = snappier, noisier)
const FACE_SPEED = 22.0;

const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();

export class MotionCaptureController {
  constructor(avatarController, animationController, options = {}) {
    this.avatarController = avatarController;
    this.animationController = animationController;
    this.lipSyncController = options.lipSyncController || null;
    this.onHeartDetected = options.onHeartDetected || null;
    this.onMirrorInteraction = options.onMirrorInteraction || null;

    this.isEnabled = false;
    this.isMirror = options.isMirror !== false; // Selfie-mirror: your right hand moves the hand on the same screen side
    this.isBodyTracked = false;
    this._lastHeartTime = 0;
    this._lastInteractionTime = 0;

    this.targetScenePos = new THREE.Vector3(0, 0, 0);
    this.isKissing = false;
    this.isHeadTouching = false;
    this.isTouchingScreen = false;
    this._activeComplementHeartSide = null;
    this._activeTouchScreenSides = {};
    this._lastHeadOffset = 0;

    this._targets = {};        // boneName -> target local THREE.Quaternion
    this._faceTargets = null;  // { blinkLeft, blinkRight, aa, ih, ou, ee, oh }
    this._faceValues = { blinkLeft: 0, blinkRight: 0, aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
    this._lastBodyTime = -Infinity; // performance.now() of the last body / face result
    this._lastFaceTime = -Infinity;
    this._rigVRM = null;
    this._rig = null;
  }

  setEnabled(enabled) {
    if (this.isEnabled === enabled) return;
    this.isEnabled = enabled;
    this._targets = {};
    this._faceTargets = null;
    this._lastBodyTime = -Infinity;
    this._lastFaceTime = -Infinity;
    this.isBodyTracked = false;

    if (enabled) {
      // Pause breathing / idle so they don't fight over the spine
      this.animationController?.setCustomPoseOverride?.(true);
    } else {
      this._clearFace(this.avatarController?.getCurrentVRM?.());
      this.animationController?.setCustomPoseOverride?.(false);
      this.animationController?.resetToIdle?.();
    }
  }

  setMirror(mirror = null) {
    this.isMirror = mirror !== null ? mirror : !this.isMirror;
    return this.isMirror;
  }

  /**
   * Feed one tracking result from MotionTracker.
   * @param {{ pose: { world: Array, image: Array }|null, face: { blendshapes: Object, matrix: Array|null }|null, hands: Array<{ world: Array, image: Array }> }} result
   */
  applyResults(result) {
    if (!this.isEnabled || !result) return;
    const vrm = this.avatarController.getCurrentVRM();
    if (!vrm || !vrm.humanoid) return;
    const rig = this._getRig(vrm);
    if (!rig) return;

    const targets = {};
    const world = result.pose?.world;
    if (world && world.length > LM.rightAnkle) {
      this._solveBody(vrm, rig, world, targets, result.pose);
      this._solveHands(vrm, rig, result, targets);
      this._lastBodyTime = performance.now();
    }
    if (result.face) {
      this._solveHeadFromFace(vrm, rig, result.face, targets);
      this._faceTargets = this._solveFace(result.face.blendshapes);
      this._lastFaceTime = performance.now();
    } else if (world && world.length > LM.rightAnkle) {
      this._solveHeadFromPose(vrm, rig, world, targets);
    }
    Object.assign(this._targets, targets);

    if (result.pose?.image) {
      this._checkHeartGesture(result.pose.image);
    }
  }

  update(delta) {
    if (!this.isEnabled) return;
    const vrm = this.avatarController.getCurrentVRM();
    if (!vrm || !vrm.humanoid) return;
    const rig = this._getRig(vrm);
    if (!rig) return;

    const wasTracked = this.isBodyTracked;
    this.isBodyTracked = performance.now() - this._lastBodyTime < LOST_TIMEOUT * 1000;
    if (!this.isBodyTracked && (wasTracked || Object.keys(this._targets).length === 0)) {
      // Nobody in frame: ease back to a relaxed standing pose
      this._targets = this._restTargets(vrm, rig);
      this.targetScenePos.set(0, 0, 0);
      this.isKissing = false;
      this.isHeadTouching = false;
      this.isTouchingScreen = false;
      this._activeComplementHeartSide = null;
      this._activeTouchScreenSides = {};
      this._lastHeadOffset = 0;
    }

    const activeSlot = this.avatarController?.getActiveSlot?.();
    const isPhysicsDriven = activeSlot && (activeSlot.physicsState === 'grabbed' || activeSlot.physicsState === 'falling' || activeSlot.physicsState === 'impact');

    // Smoothly lean or move avatar towards targetScenePos for interactive magic mirror (左右分站 / 親螢幕 / 比肩碰頭)
    if (!isPhysicsDriven && vrm.scene) {
      const posLerp = 1 - Math.exp(-6.0 * delta);
      vrm.scene.position.x = THREE.MathUtils.lerp(vrm.scene.position.x, this.targetScenePos.x, posLerp);
      vrm.scene.position.z = THREE.MathUtils.lerp(vrm.scene.position.z, this.targetScenePos.z, posLerp);

      // In face-to-face mirror mode: rotate avatar body to naturally face the user inward (相向面對面角度)
      const baseFront = this.avatarController?.getFrontRotation?.(this.avatarController?.currentCostume) ?? Math.PI;
      let targetRotY = baseFront;
      if (this.isMirror) {
        // When avatar is on the left (targetScenePos.x < -0.1), user is on the right (+X).
        // In Three.js with VRM baseFront (Math.PI), baseFront - angle rotates forward vector towards +X (towards the user)!
        // When avatar is on the right (targetScenePos.x > 0.1), user is on the left (-X).
        // baseFront + angle rotates forward vector towards -X (towards the user)!
        const inwardAngle = 0.85; // ~48.7° facing directly inward towards user
        if (this.targetScenePos.x < -0.1) {
          targetRotY = baseFront - inwardAngle;
        } else if (this.targetScenePos.x > 0.1) {
          targetRotY = baseFront + inwardAngle;
        }
      }
      vrm.scene.rotation.y = THREE.MathUtils.lerp(vrm.scene.rotation.y, targetRotY, posLerp);
    }

    if (!isPhysicsDriven) {
      const t = 1 - Math.exp(-FOLLOW_SPEED * delta);
      for (const name of DRIVEN_BONES) {
        const target = this._targets[name];
        const node = vrm.humanoid.getNormalizedBoneNode(name);
        if (target && node) node.quaternion.slerp(target, t);
      }
    }

    this._updateFace(vrm, delta);
  }

  /**
   * Detects heart hand/arm gesture in face-to-face or dual-hand interaction.
   * Triggers onHeartDetected callback when user performs heart pose.
   * @param {Array<Object>} poseImage
   */
  _checkHeartGesture(poseImage) {
    if (!poseImage || poseImage.length <= LM.rightWrist) return;
    const now = performance.now();
    if (now - this._lastHeartTime < 4500) return; // Cooldown 4.5s

    const rw = poseImage[LM.rightWrist];
    const lw = poseImage[LM.leftWrist];
    const rs = poseImage[LM.rightShoulder];
    const ls = poseImage[LM.leftShoulder];
    const nose = poseImage[LM.nose];

    if (!rs || !ls || this._vis(rs) < VISIBLE || this._vis(ls) < VISIBLE) return;

    // 1. Dual-hands Heart: both wrists raised above chest/chin and close to each other
    const bothWristsVisible = this._vis(rw) > 0.4 && this._vis(lw) > 0.4;
    if (bothWristsVisible) {
      const wristDist = Math.hypot(rw.x - lw.x, rw.y - lw.y);
      const isRaised = rw.y < rs.y + 0.20 && lw.y < ls.y + 0.20;
      if (wristDist < 0.26 && isRaised) {
        this._lastHeartTime = now;
        if (typeof this.onHeartDetected === 'function') {
          this.onHeartDetected({ type: 'dual', isFaceToFace: this.isMirror });
        }
        return;
      }
    }

    // 2. Face-to-Face Single-hand Heart (面對面半心合體):
    // In face-to-face mode: user raises either arm to form a heart together
    if (this.isMirror && nose && this._vis(nose) > 0.35) {
      for (const side of ['right', 'left']) {
        const w = poseImage[LM[side + 'Wrist']];
        const s = poseImage[LM[side + 'Shoulder']];
        if (this._vis(w) > 0.35 && this._vis(s) > 0.35) {
          const raised = w.y < s.y + 0.20;
          if (raised) {
            this._lastHeartTime = now;
            if (typeof this.onHeartDetected === 'function') {
              this.onHeartDetected({ type: 'single', side, isFaceToFace: true });
            }
            return;
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------- rig setup

  /**
   * Derives the avatar's own left / up / forward axes from its rest pose so the
   * solver works for both VRM 0.x (faces -Z) and VRM 1.0 (faces +Z) models.
   */
  _getRig(vrm) {
    if (this._rigVRM === vrm) return this._rig;
    this._rigVRM = vrm;
    this._rig = null;

    const humanoid = vrm.humanoid;
    const leftLowerArm = humanoid.getNormalizedBoneNode('leftLowerArm');
    if (!leftLowerArm) return null;

    // Normalized bones have identity rest rotations, so a child's local offset is its parent's rest direction
    const left = new THREE.Vector3(Math.sign(leftLowerArm.position.x) || 1, 0, 0);
    const up = new THREE.Vector3(0, 1, 0);
    const forward = new THREE.Vector3().crossVectors(left, up);
    const basis = new THREE.Matrix4().makeBasis(left, up, forward);
    const basisQuat = new THREE.Quaternion().setFromRotationMatrix(basis);

    const restDir = {};
    const chains = {
      leftUpperArm: 'leftLowerArm', leftLowerArm: 'leftHand', leftHand: 'leftMiddleProximal',
      rightUpperArm: 'rightLowerArm', rightLowerArm: 'rightHand', rightHand: 'rightMiddleProximal',
      leftUpperLeg: 'leftLowerLeg', leftLowerLeg: 'leftFoot',
      rightUpperLeg: 'rightLowerLeg', rightLowerLeg: 'rightFoot'
    };
    for (const [bone, child] of Object.entries(chains)) {
      const childNode = humanoid.getNormalizedBoneNode(child);
      if (childNode && childNode.position.lengthSq() > 1e-8) {
        restDir[bone] = childNode.position.clone().normalize();
      } else if (bone.endsWith('Hand')) {
        restDir[bone] = left.clone().multiplyScalar(bone.startsWith('left') ? 1 : -1);
      }
    }

    // Finger bones: a distal bone has no humanoid child, so it reuses the direction it was reached by
    for (const side of ['left', 'right']) {
      const suffixes = Object.keys(FINGER_SEGMENTS);
      for (let i = 0; i < suffixes.length; i++) {
        const node = humanoid.getNormalizedBoneNode(side + suffixes[i]);
        if (!node) continue;
        const isTip = i % 3 === 2;
        const next = isTip ? null : humanoid.getNormalizedBoneNode(side + suffixes[i + 1]);
        const offset = next && next.position.lengthSq() > 1e-10 ? next.position : node.position;
        if (offset.lengthSq() > 1e-10) restDir[side + suffixes[i]] = offset.clone().normalize();
      }
    }

    this._rig = { left, up, forward, basis, basisQuat, restDir };
    return this._rig;
  }

  /** MediaPipe world vector (x right, y down, z away from camera) -> avatar-local vector. */
  _toRig(rig, p, out) {
    const sx = this.isMirror ? -p.x : p.x;
    return out.set(0, 0, 0)
      .addScaledVector(rig.left, sx)
      .addScaledVector(rig.up, -p.y)
      .addScaledVector(rig.forward, -p.z);
  }

  /** Landmark for the AVATAR's given side (mirror mode swaps the person's sides). */
  _lm(world, name, side) {
    const personSide = this.isMirror ? (side === 'left' ? 'right' : 'left') : side;
    return world[LM[personSide + name]];
  }

  _vis(p) {
    return p ? (p.visibility ?? 1) : 0;
  }

  /**
   * Rotation taking the rest (left, up) frame to the given lateral / up directions.
   * The two inputs are rarely exactly perpendicular; `keepUp` picks which one is kept as-is.
   */
  _frameQuat(rig, lateral, up, out, keepUp = false) {
    const f = new THREE.Vector3().crossVectors(lateral, up);
    if (f.lengthSq() < 1e-8) return out.identity();
    f.normalize();
    let l, u;
    if (keepUp) {
      u = up.clone().normalize();
      l = new THREE.Vector3().crossVectors(u, f).normalize();
    } else {
      l = lateral.clone().normalize();
      u = new THREE.Vector3().crossVectors(f, l).normalize();
    }
    _m.makeBasis(l, u, f);
    out.setFromRotationMatrix(_m);
    return out.multiply(_q.copy(rig.basisQuat).invert());
  }

  /**
   * Avatar-local orientation of a bone's parent, using this solve's targets for
   * driven bones and the live rotation for everything in between.
   */
  _parentQuat(vrm, node, targets, out) {
    out.identity();
    const chain = [];
    let p = node.parent;
    while (p && p !== vrm.scene) {
      chain.push(p);
      p = p.parent;
    }
    const byNode = this._nodeNames(vrm);
    for (let i = chain.length - 1; i >= 0; i--) {
      const name = byNode.get(chain[i]);
      out.multiply(name && targets[name] ? targets[name] : chain[i].quaternion);
    }
    return out;
  }

  _nodeNames(vrm) {
    if (this._nodeNamesVRM !== vrm) {
      this._nodeNamesVRM = vrm;
      this._nodeNameMap = new Map();
      for (const name of DRIVEN_BONES) {
        const node = vrm.humanoid.getNormalizedBoneNode(name);
        if (node) this._nodeNameMap.set(node, name);
      }
    }
    return this._nodeNameMap;
  }

  // ---------------------------------------------------------------- body

  _solveBody(vrm, rig, world, targets, pose = null) {
    const humanoid = vrm.humanoid;
    const P = (name, side) => this._lm(world, name, side);
    const R = (p) => this._toRig(rig, p, new THREE.Vector3());

    const shL = P('Shoulder', 'left'), shR = P('Shoulder', 'right');
    const hipL = P('Hip', 'left'), hipR = P('Hip', 'right');
    if (this._vis(shL) < VISIBLE || this._vis(shR) < VISIBLE) return;

    // --- Interactive Proximity, Kissing & Head Touching Detection ---
    let leanRatio = 0;
    let headOffset = 0;
    const poseImage = pose?.image;
    let pshL = null, pshR = null, pNose = null;
    if (poseImage && poseImage.length > LM.rightShoulder) {
      pshL = poseImage[LM.leftShoulder];
      pshR = poseImage[LM.rightShoulder];
      pNose = poseImage[LM.nose];
      if (this._vis(pshL) > VISIBLE && this._vis(pshR) > VISIBLE) {
        const shoulderDist = Math.hypot(pshL.x - pshR.x, pshL.y - pshR.y);
        // Normal shoulder dist on camera ~0.20-0.28. Leaning close >0.35. Very close >0.45
        leanRatio = THREE.MathUtils.clamp((shoulderDist - 0.28) / 0.20, 0, 1);
        if (pNose && this._vis(pNose) > VISIBLE) {
          headOffset = pNose.x - (pshL.x + pshR.x) * 0.5;
        }
      }
    }
    this._lastHeadOffset = headOffset;

    // Avatar moves forward in scene as user leans into screen
    this.targetScenePos.z = leanRatio * 0.55;

    // Kissing threshold: very close to camera
    const wasKissing = this.isKissing;
    this.isKissing = leanRatio >= 0.75;
    if (this.isKissing && !wasKissing) {
      const now = performance.now();
      if (now - this._lastInteractionTime > 3000) {
        this._lastInteractionTime = now;
        this.onMirrorInteraction?.({ type: 'kiss' });
      }
    }

    // --- Side-by-Side Non-overlapping Positioning (你在左她在右，你在右她在左) ---
    // User screen position: 0 is screen-left, 1 is screen-right
    const userRawX = (pNose && this._vis(pNose) > VISIBLE) ? pNose.x : (pshL && pshR ? (pshL.x + pshR.x) * 0.5 : 0.5);
    const userScreenX = this.isMirror ? (1 - userRawX) : userRawX;

    let targetX = 0;
    if (this.isMirror) {
      // User on the left (userScreenX < 0.46) -> Avatar stands on the right (+X)
      // User on the right (userScreenX > 0.54) -> Avatar stands on the left (-X)
      // Near center (0.46 <= userScreenX <= 0.54) -> Hysteresis: retain current side so avatar doesn't jitter
      if (userScreenX < 0.46) {
        targetX = THREE.MathUtils.clamp(0.48 + (0.46 - userScreenX) * 0.3, 0.42, 0.65);
      } else if (userScreenX > 0.54) {
        targetX = -THREE.MathUtils.clamp(0.48 + (userScreenX - 0.54) * 0.3, 0.42, 0.65);
      } else {
        targetX = this.targetScenePos.x >= 0 ? 0.48 : -0.48;
      }
    }

    // Head-to-Head touching (比肩頭碰頭)
    // Only triggers when user actively leans in close (leanRatio > 0.25) AND tilts head laterally towards avatar
    const isHeadTouchEligible = leanRatio > 0.25 && Math.abs(headOffset) > 0.055;
    const wasHeadTouching = this.isHeadTouching;
    this.isHeadTouching = isHeadTouchEligible;
    if (this.isHeadTouching) {
      // Approach user's head position from current side
      const approachDistance = 0.16;
      targetX = targetX > 0 ? (targetX - approachDistance) : (targetX + approachDistance);

      if (!wasHeadTouching) {
        const now = performance.now();
        if (now - this._lastInteractionTime > 3000) {
          this._lastInteractionTime = now;
          this.onMirrorInteraction?.({ type: 'head_touch' });
        }
      }
    }

    // Check for single-hand half heart gesture to complement (面對面/鏡像另一手合體拼成愛心)
    let complementHeartSide = null;
    if (this.isMirror && poseImage && poseImage.length > LM.rightWrist) {
      const rw = poseImage[LM.rightWrist], rs = poseImage[LM.rightShoulder];
      const lw = poseImage[LM.leftWrist], ls = poseImage[LM.leftShoulder];

      const rRaised = rs && rw && this._vis(rw) > 0.35 && rw.y < rs.y + 0.22;
      const lRaised = ls && lw && this._vis(lw) > 0.35 && lw.y < ls.y + 0.22;

      // In face-to-face mirror mode:
      // The inner arm is the arm on the side facing the meeting point between user and avatar!
      // When avatar is on the left (targetX <= 0), inner arm is her 'left' arm.
      // When avatar is on the right (targetX > 0), inner arm is her 'right' arm.
      const innerArm = targetX <= 0 ? 'left' : 'right';

      if (rRaised || lRaised) {
        complementHeartSide = innerArm;
        // Step gracefully inward so both hands meet to form the full heart
        targetX = targetX > 0 ? 0.28 : -0.28;
        const now = performance.now();
        if (now - this._lastHeartTime > 3000) {
          this._lastHeartTime = now;
          this.onMirrorInteraction?.({ type: 'half_heart', side: complementHeartSide });
        }
      }
    }
    this._activeComplementHeartSide = complementHeartSide;

    this.targetScenePos.x = targetX;

    // Check if user is extending hand toward screen glass (shoulder.z - wrist.z > 0.24)
    const touchScreenSides = {};
    for (const side of ['left', 'right']) {
      const shoulder = P('Shoulder', side);
      const wrist = P('Wrist', side);
      if (this._vis(shoulder) > VISIBLE && this._vis(wrist) > VISIBLE) {
        if (shoulder.z - wrist.z > 0.24 && wrist.y < shoulder.y + 0.22) {
          touchScreenSides[side] = true;
          const now = performance.now();
          if (now - this._lastInteractionTime > 3500) {
            this._lastInteractionTime = now;
            this.onMirrorInteraction?.({ type: 'touch_screen', side });
          }
        }
      }
    }
    this._activeTouchScreenSides = touchScreenSides;
    this.isTouchingScreen = Object.keys(touchScreenSides).length > 0;

    // --- torso ---
    const shoulderLine = R(shL).sub(R(shR));
    if (this.isMirror) {
      // In face-to-face mirror mode:
      // Avatar's inward facing orientation is maintained by body scene rotation towards user.
      // Torso yaw depth disparity is neutralized so turning sideways doesn't rotate avatar away from user into "一前一後".
      shoulderLine.z = 0;
    }
    const hipsVisible = this._vis(hipL) > VISIBLE && this._vis(hipR) > VISIBLE;
    const torsoUp = hipsVisible
      ? R(shL).add(R(shR)).sub(R(hipL)).sub(R(hipR)).normalize()
      : rig.up.clone();

    // Pelvis follows the hip line; the chest follows the spine direction so that
    // leaning bends the back. Seated (hips hidden) only the shoulder line is known.
    const legTracked = (side) => hipsVisible
      && this._vis(P('Knee', side)) > LEG_VISIBLE && this._vis(P('Ankle', side)) > LEG_VISIBLE;
    const hipsQuat = new THREE.Quaternion();
    if (legTracked('left') || legTracked('right')) {
      const hipLine = R(hipL).sub(R(hipR));
      if (this.isMirror) hipLine.z = 0;
      this._frameQuat(rig, hipLine, torsoUp, hipsQuat, true);
    } else if (hipsVisible) {
      const hipLine = R(hipL).sub(R(hipR)).projectOnPlane(rig.up);
      if (this.isMirror) hipLine.z = 0;
      this._frameQuat(rig, hipLine, rig.up, hipsQuat, true);
    }
    const chestQuat = this._frameQuat(rig, shoulderLine, torsoUp, new THREE.Quaternion(), true);

    targets.hips = hipsQuat;
    const rel = hipsQuat.clone().invert().multiply(chestQuat);
    if (humanoid.getNormalizedBoneNode('chest')) {
      targets.spine = new THREE.Quaternion().slerp(rel, 0.5);
      targets.chest = targets.spine.clone().invert().multiply(rel);
    } else {
      targets.spine = rel;
    }

    // --- arms ---
    for (const side of ['left', 'right']) {
      if (complementHeartSide === side) {
        this._aimHalfHeart(vrm, rig, targets, side);
        continue;
      }
      if (touchScreenSides[side]) {
        this._aimTouchScreen(vrm, rig, targets, side);
        continue;
      }

      const shoulder = P('Shoulder', side), elbow = P('Elbow', side), wrist = P('Wrist', side);
      const sign = side === 'left' ? 1 : -1;

      if (this._vis(elbow) > VISIBLE) {
        const upperDir = R(elbow).sub(R(shoulder));
        this._aim(vrm, rig, targets, side + 'UpperArm', upperDir);
      } else {
        // Arm out of frame: let it hang naturally
        this._aim(vrm, rig, targets, side + 'UpperArm', this._hangDir(rig, sign));
      }

      if (this._vis(elbow) > VISIBLE && this._vis(wrist) > VISIBLE) {
        const lowerDir = R(wrist).sub(R(elbow));
        this._aim(vrm, rig, targets, side + 'LowerArm', lowerDir);
        const index = P('Index', side), pinky = P('Pinky', side);
        if (this._vis(index) > VISIBLE && this._vis(pinky) > VISIBLE) {
          const knuckles = R(index).add(R(pinky)).multiplyScalar(0.5);
          const handDir = knuckles.sub(R(wrist));
          this._aim(vrm, rig, targets, side + 'Hand', handDir);
        } else {
          targets[side + 'Hand'] = new THREE.Quaternion();
        }
      } else {
        targets[side + 'LowerArm'] = new THREE.Quaternion();
        targets[side + 'Hand'] = new THREE.Quaternion();
      }
    }

    // --- legs (only when actually in frame) ---
    for (const side of ['left', 'right']) {
      const hip = P('Hip', side), knee = P('Knee', side), ankle = P('Ankle', side);
      if (legTracked(side)) {
        const upperLegDir = R(knee).sub(R(hip));
        this._aim(vrm, rig, targets, side + 'UpperLeg', upperLegDir);
        const lowerLegDir = R(ankle).sub(R(knee));
        this._aim(vrm, rig, targets, side + 'LowerLeg', lowerLegDir);
      } else {
        targets[side + 'UpperLeg'] = new THREE.Quaternion();
        targets[side + 'LowerLeg'] = new THREE.Quaternion();
      }
    }
  }

  /**
   * Poses the avatar's arm to complete the complementary half of the heart
   * with the user's corresponding hand.
   */
  _aimHalfHeart(vrm, rig, targets, side) {
    const sign = side === 'left' ? 1 : -1;
    const dirUpper = new THREE.Vector3()
      .addScaledVector(rig.up, 0.7)
      .addScaledVector(rig.left, sign * 0.7)
      .normalize();
    const dirLower = new THREE.Vector3()
      .addScaledVector(rig.up, 0.55)
      .addScaledVector(rig.left, -sign * 0.85)
      .addScaledVector(rig.forward, 0.15)
      .normalize();
    const dirHand = new THREE.Vector3()
      .addScaledVector(rig.up, -0.7)
      .addScaledVector(rig.left, -sign * 0.7)
      .normalize();

    this._aim(vrm, rig, targets, side + 'UpperArm', dirUpper);
    this._aim(vrm, rig, targets, side + 'LowerArm', dirLower);
    this._aim(vrm, rig, targets, side + 'Hand', dirHand);

    // Gently curve finger segments inward
    for (const suffix of Object.keys(FINGER_SEGMENTS)) {
      targets[side + suffix] = new THREE.Quaternion().setFromAxisAngle(rig.forward, sign * 0.15);
    }
  }

  /**
   * Poses the avatar's arm and hand to press flat against the screen glass
   * facing the user's outstretched palm.
   */
  _aimTouchScreen(vrm, rig, targets, side) {
    const sign = side === 'left' ? 1 : -1;
    const dirUpper = new THREE.Vector3()
      .addScaledVector(rig.forward, 0.95)
      .addScaledVector(rig.up, 0.15)
      .addScaledVector(rig.left, sign * 0.1)
      .normalize();
    const dirLower = new THREE.Vector3()
      .addScaledVector(rig.forward, 0.98)
      .addScaledVector(rig.up, 0.05)
      .normalize();

    this._aim(vrm, rig, targets, side + 'UpperArm', dirUpper);
    this._aim(vrm, rig, targets, side + 'LowerArm', dirLower);

    const handNode = vrm.humanoid.getNormalizedBoneNode(side + 'Hand');
    if (handNode) {
      const along = rig.up.clone(); // fingers point up
      const normal = rig.forward.clone(); // palm faces camera
      const across = new THREE.Vector3().crossVectors(normal, along).normalize();
      const targetQuat = new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(across, along, normal));

      const restAlong = rig.left.clone().multiplyScalar(sign);
      const restAcross = rig.forward.clone().negate();
      const restNormal = new THREE.Vector3().crossVectors(restAlong, restAcross);
      const restQuat = new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(restAlong, restAcross, restNormal));

      const worldQuat = targetQuat.multiply(restQuat.invert());
      const parentQuat = this._parentQuat(vrm, handNode, targets, new THREE.Quaternion());
      targets[side + 'Hand'] = parentQuat.invert().multiply(worldQuat);
    }

    // Straighten open fingers against the glass
    for (const suffix of Object.keys(FINGER_SEGMENTS)) {
      targets[side + suffix] = new THREE.Quaternion();
    }
  }

  /** Avatar-local direction of a relaxed, hanging upper arm. */
  _hangDir(rig, sign) {
    if (this.isMirror) {
      // Natural companion rest pose: elbows slightly forward and inward
      return new THREE.Vector3()
        .addScaledVector(rig.left, sign * 0.22)
        .addScaledVector(rig.up, -0.95)
        .addScaledVector(rig.forward, 0.20)
        .normalize();
    }
    return new THREE.Vector3()
      .addScaledVector(rig.left, sign * 0.37)
      .addScaledVector(rig.up, -0.93)
      .normalize();
  }

  /** Sets the bone's target so its rest direction points along `dir` (avatar-local). */
  _aim(vrm, rig, targets, boneName, dir) {
    const node = vrm.humanoid.getNormalizedBoneNode(boneName);
    const restDir = rig.restDir[boneName];
    if (!node || !restDir || dir.lengthSq() < 1e-10) return;

    const parentQuat = this._parentQuat(vrm, node, targets, new THREE.Quaternion());
    const localDir = dir.clone().normalize().applyQuaternion(parentQuat.invert());
    targets[boneName] = new THREE.Quaternion().setFromUnitVectors(restDir, localDir);
  }

  _restTargets(vrm, rig) {
    const targets = {};
    for (const name of DRIVEN_BONES) targets[name] = new THREE.Quaternion();
    this._aim(vrm, rig, targets, 'leftUpperArm', this._hangDir(rig, 1));
    this._aim(vrm, rig, targets, 'rightUpperArm', this._hangDir(rig, -1));
    return targets;
  }

  // ---------------------------------------------------------------- hands

  /**
   * Matches detected hands to the body's wrists (the hand model's own left / right
   * label is unreliable on mirrored video) and drives palm orientation and fingers.
   */
  _solveHands(vrm, rig, result, targets) {
    const hands = result.hands || [];
    const poseImage = result.pose?.image;
    const assigned = {};

    if (poseImage && hands.length > 0) {
      for (const hand of hands) {
        const w = hand.image?.[HAND.wrist];
        if (!w || !hand.world) continue;
        for (const personSide of ['left', 'right']) {
          const pw = poseImage[LM[personSide + 'Wrist']];
          if (!pw || this._vis(pw) < VISIBLE) continue;
          const dist = Math.hypot(w.x - pw.x, w.y - pw.y);
          if (dist > HAND_MATCH_DIST) continue;
          const other = personSide === 'left' ? 'right' : 'left';
          const avatarSide = this.isMirror ? other : personSide;
          if (!assigned[avatarSide] || dist < assigned[avatarSide].dist) {
            assigned[avatarSide] = { hand, dist };
          }
        }
      }
      // One detected hand can't be both of the avatar's hands
      if (assigned.left && assigned.right && assigned.left.hand === assigned.right.hand) {
        delete assigned[assigned.left.dist <= assigned.right.dist ? 'right' : 'left'];
      }
    }

    for (const side of ['left', 'right']) {
      if (this._activeComplementHeartSide === side || this._activeTouchScreenSides?.[side]) {
        // Retain procedural interaction pose (fingers flat against glass or curved in heart)
        continue;
      }
      if (assigned[side]) {
        this._solveHand(vrm, rig, side, assigned[side].hand.world, targets);
      } else {
        // Not seen: relax the fingers (the wrist keeps following the body model)
        for (const suffix of Object.keys(FINGER_SEGMENTS)) targets[side + suffix] = new THREE.Quaternion();
      }
    }
  }

  _solveHand(vrm, rig, side, world, targets) {
    const R = (i) => this._toRig(rig, world[i], new THREE.Vector3());
    const sign = side === 'left' ? 1 : -1;

    // Palm orientation. Rest (T-pose, palm down): fingers point sideways, index->pinky points backward.
    const handNode = vrm.humanoid.getNormalizedBoneNode(side + 'Hand');
    if (handNode) {
      const along = R(HAND.middleMcp).sub(R(HAND.wrist));
      const across = R(HAND.pinkyMcp).sub(R(HAND.indexMcp));
      const normal = new THREE.Vector3().crossVectors(along, across);
      if (normal.lengthSq() > 1e-12) {
        along.normalize(); normal.normalize();
        across.crossVectors(normal, along);
        const target = new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(along, across, normal));

        const restAlong = rig.left.clone().multiplyScalar(sign);
        const restAcross = rig.forward.clone().negate();
        const restNormal = new THREE.Vector3().crossVectors(restAlong, restAcross);
        const rest = new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(restAlong, restAcross, restNormal));

        const worldQuat = target.multiply(rest.invert());
        const parentQuat = this._parentQuat(vrm, handNode, targets, new THREE.Quaternion());
        targets[side + 'Hand'] = parentQuat.invert().multiply(worldQuat);
      }
    }

    // Fingers, base to tip so each bone sees its parent's new orientation
    for (const [suffix, [from, to]] of Object.entries(FINGER_SEGMENTS)) {
      this._aim(vrm, rig, targets, side + suffix, R(to).sub(R(from)));
    }
  }

  // ---------------------------------------------------------------- head

  _setHead(vrm, targets, headQuat) {
    const humanoid = vrm.humanoid;
    const head = humanoid.getNormalizedBoneNode('head');
    if (!head) return;
    const neck = humanoid.getNormalizedBoneNode('neck');

    let finalQuat = headQuat;
    if (this.isHeadTouching && this._rig) {
      // Tilt head roll towards the user: lateral sign depends on isMirror
      const tiltAngle = (this._lastHeadOffset > 0 ? -0.28 : 0.28) * (this.isMirror ? 1 : -1);
      finalQuat = headQuat.clone().multiply(new THREE.Quaternion().setFromAxisAngle(this._rig.forward, tiltAngle));
    }

    if (neck) {
      const base = this._parentQuat(vrm, neck, targets, new THREE.Quaternion());
      const rel = base.invert().multiply(finalQuat);
      targets.neck = new THREE.Quaternion().slerp(rel, 0.4);
      targets.head = targets.neck.clone().invert().multiply(rel);
    } else {
      const base = this._parentQuat(vrm, head, targets, new THREE.Quaternion());
      targets.head = base.invert().multiply(finalQuat);
    }
  }

  /** Head orientation from the face landmarker's transform (camera space: x right, y up, z toward camera). */
  _solveHeadFromFace(vrm, rig, face, targets) {
    if (!face.matrix) return;
    _m.fromArray(face.matrix);
    const camQuat = new THREE.Quaternion().setFromRotationMatrix(_m.extractRotation(_m));
    const euler = new THREE.Euler().setFromQuaternion(camQuat, 'YXZ');

    if (this.isMirror) {
      // In face-to-face mirror mode: avatar is already facing inward towards user.
      // Soften horizontal yaw so avatar maintains natural eye contact with user instead of looking away.
      euler.y = -euler.y * 0.45;
      euler.z = -euler.z * 0.5;
    }

    // Clamp pitch up/down so neck doesn't stretch backward into ceiling
    euler.x = THREE.MathUtils.clamp(euler.x, -0.32, 0.32);
    euler.y = THREE.MathUtils.clamp(euler.y, -0.65, 0.65);
    euler.z = THREE.MathUtils.clamp(euler.z, -0.25, 0.25);

    const finalCamQuat = new THREE.Quaternion().setFromEuler(euler);
    const headQuat = rig.basisQuat.clone().multiply(finalCamQuat).multiply(_q.copy(rig.basisQuat).invert());
    this._setHead(vrm, targets, headQuat);
  }

  /** Coarser fallback when no face is detected: ears and nose from the body model. */
  _solveHeadFromPose(vrm, rig, world, targets) {
    const earL = this._lm(world, 'Ear', 'left'), earR = this._lm(world, 'Ear', 'right');
    const nose = world[LM.nose];
    if (this._vis(earL) < VISIBLE || this._vis(earR) < VISIBLE || this._vis(nose) < VISIBLE) return;

    const l = this._toRig(rig, earL, new THREE.Vector3());
    const r = this._toRig(rig, earR, new THREE.Vector3());
    const lateral = l.clone().sub(r);
    if (this.isMirror) lateral.z = -lateral.z;
    const forward = this._toRig(rig, nose, new THREE.Vector3()).sub(l.add(r).multiplyScalar(0.5));
    if (this.isMirror) forward.z = -forward.z;
    const up = new THREE.Vector3().crossVectors(forward, lateral);
    if (up.lengthSq() < 1e-10) return;
    this._setHead(vrm, targets, this._frameQuat(rig, lateral, up.normalize(), new THREE.Quaternion(), true));
  }

  // ---------------------------------------------------------------- face

  _solveFace(b) {
    const g = (name) => b[name] || 0;
    const side = (name, avatarSide) => {
      // Blendshape names use the person's own left / right
      const personSide = this.isMirror ? (avatarSide === 'Left' ? 'Right' : 'Left') : avatarSide;
      return g(name + personSide);
    };
    // Eyelids rarely report a full 1.0, so stretch the useful range
    const blink = (v) => THREE.MathUtils.clamp((v - 0.15) / 0.5, 0, 1);
    const jaw = THREE.MathUtils.clamp((g('jawOpen') - 0.05) / 0.5, 0, 1);
    const pucker = g('mouthPucker');
    const funnel = g('mouthFunnel');
    const smile = (g('mouthSmileLeft') + g('mouthSmileRight')) * 0.5;
    const stretch = (g('mouthStretchLeft') + g('mouthStretchRight')) * 0.5;

    return {
      blinkLeft: blink(side('eyeBlink', 'Left')),
      blinkRight: blink(side('eyeBlink', 'Right')),
      aa: jaw * (1 - Math.max(pucker, funnel) * 0.6),
      oh: THREE.MathUtils.clamp(funnel * 1.2, 0, 1) * Math.max(jaw, 0.3),
      ou: THREE.MathUtils.clamp((pucker - 0.3) * 1.4, 0, 1) * (1 - jaw),
      ee: THREE.MathUtils.clamp(smile - 0.3, 0, 1) * 0.8 * (1 - jaw),
      ih: THREE.MathUtils.clamp(stretch * 1.5, 0, 1) * 0.6
    };
  }

  _updateFace(vrm, delta) {
    const em = vrm.expressionManager;
    if (!em) return;

    // Special interactive expressions for Kissing (親螢幕) and Head Touching (頭碰頭)
    if (this.isKissing) {
      em.setValue('blink', 0.9);
      em.setValue('blinkLeft', 0.9);
      em.setValue('blinkRight', 0.9);
      em.setValue('ou', 0.85);
      em.setValue('relaxed', 0.8);
      try { em.setValue('shy', 0.95); } catch (_) {}
      return;
    } else if (this.isHeadTouching) {
      em.setValue('happy', 0.85);
      em.setValue('relaxed', 0.6);
      try { em.setValue('shy', 0.5); } catch (_) {}
    }

    const tracked = this._faceTargets && performance.now() - this._lastFaceTime < LOST_TIMEOUT * 1000;
    if (!tracked) {
      if (this._faceActive) this._clearFace(vrm);
      return;
    }
    this._faceActive = true;

    const t = 1 - Math.exp(-FACE_SPEED * delta);
    for (const key of Object.keys(this._faceValues)) {
      this._faceValues[key] = THREE.MathUtils.lerp(this._faceValues[key], this._faceTargets[key], t);
    }

    // The tracked eyelids replace the automatic blink animation
    em.setValue('blink', 0);
    em.setValue('blinkLeft', this._faceValues.blinkLeft);
    em.setValue('blinkRight', this._faceValues.blinkRight);

    // While the avatar is speaking, lip sync keeps control of the mouth
    if (!this.lipSyncController?.isPlaying) {
      for (const key of ['aa', 'ih', 'ou', 'ee', 'oh']) {
        em.setValue(key, this._faceValues[key]);
      }
    }
  }

  _clearFace(vrm) {
    this._faceActive = false;
    for (const key of Object.keys(this._faceValues)) this._faceValues[key] = 0;
    const em = vrm?.expressionManager;
    if (!em) return;
    em.setValue('blink', 0);
    em.setValue('blinkLeft', 0);
    em.setValue('blinkRight', 0);
    em.setValue('ou', 0);
    em.setValue('relaxed', 0);
    em.setValue('happy', 0);
    try { em.setValue('shy', 0); } catch (_) {}
  }
}

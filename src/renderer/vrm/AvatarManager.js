import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

/**
 * AvatarSlot data structure representing an individual avatar instance in the scene.
 */
export class AvatarSlot {
  constructor(id, title, vrm, costumeKey = 'casual', position = new THREE.Vector3(0, 0, 0), scale = 1.0) {
    this.id = id;
    this.title = title;
    this.vrm = vrm;
    this.costumeKey = costumeKey;
    this.position = position;
    this.scale = scale;
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.physicsState = 'idle'; // 'idle', 'grabbed', 'falling', 'impact', 'patrol'
    this.impactTimer = 0;
    this.patrolDir = 1;
    this.patrolSpeed = 0.85;
    this.customBoneRotations = {};
    this.isSculpted = false;
  }
}

/**
 * AvatarManager
 * Manages multiple VRM avatar instances (shadow clones), slot switching,
 * 3D ground selection indicator ring, independent costumes, and collective updates.
 */
export class AvatarManager {
  static MAX_AVATARS = 4;

  constructor(sceneManager, options = {}) {
    this.sceneManager = sceneManager;
    this.slots = [];
    this.activeIndex = 0;
    this.nextSlotId = 1;

    this.onSelectionChanged = options.onSelectionChanged || null;
    this.onSlotsChanged = options.onSlotsChanged || null;

    const isWeb = typeof window !== 'undefined' && !window.electronAPI;
    const baseDir = isWeb ? '/assets/models/' : '../../assets/models/';

    // Costume VRM file mapping with environment-aware root paths
    this.costumePaths = {
      casual: `${baseDir}costume_casual.vrm`,
      school: `${baseDir}costume_school.vrm`,
      stylish: `${baseDir}costume_stylish.vrm`,
      gothic: `${baseDir}costume_gothic.vrm`,
      seed: `${baseDir}costume_seed.vrm`,
      ayame: `${baseDir}ayame.vrm`,
      mint: `${baseDir}mint_swimsuit.vrm`
    };

    // Forward face orientation for each model standard
    this.modelOrientations = {
      casual: Math.PI,
      school: Math.PI,
      stylish: Math.PI,
      gothic: Math.PI,
      seed: Math.PI,
      ayame: Math.PI,
      mint: Math.PI
    };

    // Create 3D Ground Selection Ring
    this._createSelectionRing();
  }

  // Backwards compatibility getters for existing single-avatar controllers
  get currentVRM() {
    return this.getActiveVRM();
  }

  get currentVrm() {
    return this.getActiveVRM();
  }

  get currentCostume() {
    return this.getActiveSlot()?.costumeKey || 'casual';
  }

  getCurrentVRM() {
    return this.getActiveVRM();
  }

  getActiveVRM() {
    return this.slots[this.activeIndex]?.vrm || null;
  }

  getActiveSlot() {
    return this.slots[this.activeIndex] || null;
  }

  getAllSlots() {
    return this.slots;
  }

  getAllVRMs() {
    return this.slots.map(s => s.vrm).filter(Boolean);
  }

  getFrontRotation(costumeKey) {
    return this.modelOrientations[costumeKey] !== undefined ? this.modelOrientations[costumeKey] : Math.PI;
  }

  /**
   * Sets the scale of an avatar slot and updates 3D model scale.
   */
  setScale(index, scale) {
    if (index < 0 || index >= this.slots.length) return;
    const slot = this.slots[index];
    const clampedScale = THREE.MathUtils.clamp(scale, 0.3, 3.0);
    slot.scale = clampedScale;

    if (slot.vrm && slot.vrm.scene) {
      slot.vrm.scene.scale.setScalar(clampedScale);
    }

    this.updateSelectionRing();
    if (this.onSlotsChanged) this.onSlotsChanged(this.slots, this.activeIndex);
  }

  getScale(index = this.activeIndex) {
    return this.slots[index]?.scale || 1.0;
  }

  /**
   * Drops an avatar from high above into free fall.
   */
  dropAvatarFromHigh(index = this.activeIndex, height = 2.2) {
    const slot = this.slots[index];
    if (!slot || !slot.vrm?.scene) return;

    slot.vrm.scene.position.y = height;
    slot.position.y = height;
    slot.velocity.set((Math.random() - 0.5) * 0.4, 0, 0);
    slot.physicsState = 'falling';
    this.updateSelectionRing();
  }

  /**
   * Toggles patrol mode for the specified avatar.
   */
  togglePatrol(index = this.activeIndex) {
    const slot = this.slots[index];
    if (!slot) return false;

    if (slot.physicsState === 'patrol') {
      slot.physicsState = 'idle';
      if (slot.vrm?.scene) {
        slot.vrm.scene.rotation.y = this.getFrontRotation(slot.costumeKey);
      }
      return false;
    } else {
      slot.physicsState = 'patrol';
      slot.velocity.set(0, 0, 0);
      return true;
    }
  }

  /**
   * Creates the visual ground ring indicator for the selected avatar.
   */
  _createSelectionRing() {
    const ringGroup = new THREE.Group();

    // Outer glowing ring
    const outerGeo = new THREE.RingGeometry(0.32, 0.36, 48);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });
    const outerMesh = new THREE.Mesh(outerGeo, outerMat);
    outerMesh.rotation.x = -Math.PI / 2;
    ringGroup.add(outerMesh);

    // Inner subtle disc
    const innerGeo = new THREE.CircleGeometry(0.32, 32);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.18,
      depthWrite: false
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    innerMesh.rotation.x = -Math.PI / 2;
    ringGroup.add(innerMesh);

    ringGroup.position.set(0, 0.005, 0); // Slight offset above floor to prevent Z-fighting
    ringGroup.visible = false;

    this.selectionRing = ringGroup;
    this.sceneManager.scene.add(this.selectionRing);
  }

  /**
   * Updates position and visibility of the ground selection ring.
   */
  updateSelectionRing() {
    const activeSlot = this.getActiveSlot();
    if (!activeSlot || !activeSlot.vrm || !activeSlot.vrm.scene) {
      if (this.selectionRing) this.selectionRing.visible = false;
      return;
    }

    if (this.selectionRing) {
      this.selectionRing.visible = true;
      const pos = activeSlot.vrm.scene.position;
      const scale = activeSlot.scale || 1.0;
      this.selectionRing.position.set(pos.x, 0.005, pos.z);
      this.selectionRing.scale.set(scale, 1, scale);
    }
  }

  /**
   * Internal loader for a VRM model.
   */
  async _loadVRMModel(costumeKey, onProgress = null) {
    const vrmPath = this.costumePaths[costumeKey] || this.costumePaths.casual;
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    const gltf = await loader.loadAsync(vrmPath, (xhr) => {
      if (typeof onProgress === 'function' && xhr.total) {
        const percent = Math.round((xhr.loaded / xhr.total) * 100);
        onProgress(percent);
      }
    });

    const vrm = gltf.userData.vrm;
    if (!vrm) {
      throw new Error(`No VRM instance found in loaded asset: ${vrmPath}`);
    }

    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);

    // Apply costume material styling
    this._applyCostumeStyling(vrm, costumeKey);

    // Face camera
    const targetY = this.getFrontRotation(costumeKey);
    vrm.scene.rotation.y = targetY;

    // Apply natural relaxed standing pose (arms downward)
    const leftUpperArm = vrm.humanoid?.getNormalizedBoneNode('leftUpperArm');
    const rightUpperArm = vrm.humanoid?.getNormalizedBoneNode('rightUpperArm');
    if (leftUpperArm) {
      leftUpperArm.rotation.z = Math.PI * 0.38;
      leftUpperArm.rotation.x = 0.08;
    }
    if (rightUpperArm) {
      rightUpperArm.rotation.z = -Math.PI * 0.38;
      rightUpperArm.rotation.x = 0.08;
    }

    return vrm;
  }

  _applyCostumeStyling(vrm, costumeKey) {
    if (!vrm || !vrm.scene) return;

    vrm.scene.traverse((node) => {
      if (node.isMesh && node.material) {
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach((mat) => {
          if (mat.name === 'Alicia_wear' || mat.name === 'Alicia_other') {
            switch (costumeKey) {
              case 'school':
                if (mat.name === 'Alicia_wear') mat.color?.setHex(0x2563eb);
                else mat.color?.setHex(0xef4444);
                break;
              case 'stylish':
                if (mat.name === 'Alicia_wear') mat.color?.setHex(0x9333ea);
                else mat.color?.setHex(0xf472b6);
                break;
              case 'gothic':
                if (mat.name === 'Alicia_wear') mat.color?.setHex(0x27272a);
                else mat.color?.setHex(0x991b1b);
                break;
              case 'seed':
                if (mat.name === 'Alicia_wear') mat.color?.setHex(0x06b6d4);
                else mat.color?.setHex(0x38bdf8);
                break;
              case 'casual':
              default:
                mat.color?.setHex(0xffffff);
                break;
            }
          }
        });
      }
    });
  }

  /**
   * Initializes or loads the primary avatar into slot 0.
   */
  async loadCostume(costumeKey = 'casual', onProgress = null) {
    console.log(`[AvatarManager] Loading costume '${costumeKey}' for active avatar slot #${this.activeIndex}...`);

    try {
      const vrm = await this._loadVRMModel(costumeKey, onProgress);

      const activeSlot = this.getActiveSlot();
      if (activeSlot) {
        // Retain existing position and bone pose if present
        const currentPos = activeSlot.vrm?.scene?.position
          ? activeSlot.vrm.scene.position.clone()
          : activeSlot.position.clone();

        // Dispose previous VRM
        if (activeSlot.vrm && activeSlot.vrm !== vrm) {
          this.sceneManager.scene.remove(activeSlot.vrm.scene);
          VRMUtils.deepDispose(activeSlot.vrm.scene);
        }

        vrm.scene.position.copy(currentPos);
        if (activeSlot.scale !== undefined) {
          vrm.scene.scale.setScalar(activeSlot.scale);
        }
        activeSlot.vrm = vrm;
        activeSlot.costumeKey = costumeKey;
        activeSlot.position = currentPos;

        // Restore custom bone rotations if sculpted
        if (activeSlot.isSculpted && activeSlot.customBoneRotations) {
          this._applyStoredBoneRotations(vrm, activeSlot.customBoneRotations);
        }

        this.sceneManager.scene.add(vrm.scene);
      } else {
        // Initial primary avatar setup
        vrm.scene.position.set(0, 0, 0);
        const slot = new AvatarSlot(
          `avatar_slot_${this.nextSlotId++}`,
          '人偶 ① (主身)',
          vrm,
          costumeKey,
          new THREE.Vector3(0, 0, 0),
          1.0
        );
        this.slots.push(slot);
        this.activeIndex = 0;
        this.sceneManager.scene.add(vrm.scene);
      }

      this.updateSelectionRing();
      if (this.onSlotsChanged) this.onSlotsChanged(this.slots, this.activeIndex);
      if (this.onSelectionChanged) this.onSelectionChanged(this.getActiveSlot(), this.activeIndex);

      return vrm;
    } catch (err) {
      console.error('[AvatarManager] Failed to load costume:', err);
      throw err;
    }
  }

  /**
   * Spawns a new shadow clone avatar into the scene.
   */
  async spawnClone(costumeKey = null, onProgress = null) {
    if (this.slots.length >= AvatarManager.MAX_AVATARS) {
      throw new Error(`已達到最大人偶數量上限 (${AvatarManager.MAX_AVATARS} 人)`);
    }

    // Default to active avatar's costume if not specified
    const targetCostume = costumeKey || this.getActiveSlot()?.costumeKey || 'casual';

    // Calculate smart horizontal offset for new clone
    const defaultOffsets = [0, 0.65, -0.65, 1.25, -1.25];
    const offsetX = defaultOffsets[this.slots.length] || (this.slots.length * 0.6);
    const newPos = new THREE.Vector3(offsetX, 0, 0);

    const vrm = await this._loadVRMModel(targetCostume, onProgress);
    vrm.scene.position.copy(newPos);

    const cloneSlotNumber = this.slots.length + 1;
    const slotId = `avatar_slot_${this.nextSlotId++}`;
    const title = `人偶 ⓪${cloneSlotNumber} (分身)`.replace('⓪', '');

    const newSlot = new AvatarSlot(slotId, title, vrm, targetCostume, newPos, 1.0);
    this.slots.push(newSlot);

    this.sceneManager.scene.add(vrm.scene);

    // Switch selection to new clone
    this.selectAvatar(this.slots.length - 1);

    if (this.onSlotsChanged) this.onSlotsChanged(this.slots, this.activeIndex);
    return newSlot;
  }

  /**
   * Removes a clone avatar slot and cleans up resources.
   */
  removeClone(index = this.activeIndex) {
    if (this.slots.length <= 1) {
      console.warn('[AvatarManager] Cannot remove the primary avatar slot.');
      return false;
    }

    if (index < 0 || index >= this.slots.length) return false;

    const removedSlot = this.slots[index];
    if (removedSlot.vrm && removedSlot.vrm.scene) {
      this.sceneManager.scene.remove(removedSlot.vrm.scene);
      VRMUtils.deepDispose(removedSlot.vrm.scene);
    }

    this.slots.splice(index, 1);

    // Re-index remaining avatar titles
    this.slots.forEach((slot, i) => {
      if (i === 0) slot.title = '人偶 ① (主身)';
      else slot.title = `人偶 ${i + 1} (分身)`;
    });

    // Adjust active index
    if (this.activeIndex >= this.slots.length) {
      this.activeIndex = this.slots.length - 1;
    }

    this.updateSelectionRing();
    if (this.onSlotsChanged) this.onSlotsChanged(this.slots, this.activeIndex);
    if (this.onSelectionChanged) this.onSelectionChanged(this.getActiveSlot(), this.activeIndex);
    return true;
  }

  /**
   * Selects an avatar by slot index.
   */
  selectAvatar(index) {
    if (index < 0 || index >= this.slots.length) return;
    this.activeIndex = index;
    this.updateSelectionRing();

    if (this.onSelectionChanged) {
      this.onSelectionChanged(this.getActiveSlot(), this.activeIndex);
    }
  }

  /**
   * Evenly redistributes all avatars across the horizontal axis in front of the camera.
   */
  resetPositions() {
    const count = this.slots.length;
    if (count === 1) {
      this.slots[0].vrm.scene.position.set(0, 0, 0);
      this.slots[0].position.set(0, 0, 0);
      this.slots[0].physicsState = 'idle';
      this.slots[0].velocity.set(0, 0, 0);
      if (this.slots[0].vrm?.scene) {
        this.slots[0].vrm.scene.rotation.y = this.getFrontRotation(this.slots[0].costumeKey);
      }
    } else {
      const spacing = 0.72; // Meters between avatars
      const totalWidth = spacing * (count - 1);
      const startX = -totalWidth / 2;

      this.slots.forEach((slot, i) => {
        const targetX = startX + i * spacing;
        slot.vrm.scene.position.set(targetX, 0, 0);
        slot.position.set(targetX, 0, 0);
        slot.physicsState = 'idle';
        slot.velocity.set(0, 0, 0);
        if (slot.vrm?.scene) {
          slot.vrm.scene.rotation.y = this.getFrontRotation(slot.costumeKey);
        }
      });
    }

    this.updateSelectionRing();
  }

  /**
   * Copies the bone poses of the source avatar to all avatars in the scene.
   */
  syncPoseToAll(sourceIndex = this.activeIndex) {
    const sourceSlot = this.slots[sourceIndex];
    if (!sourceSlot || !sourceSlot.vrm || !sourceSlot.vrm.humanoid) return;

    const boneNames = [
      'head', 'neck', 'chest', 'spine', 'hips',
      'leftUpperArm', 'leftLowerArm', 'leftHand',
      'rightUpperArm', 'rightLowerArm', 'rightHand',
      'leftUpperLeg', 'leftLowerLeg', 'leftFoot',
      'rightUpperLeg', 'rightLowerLeg', 'rightFoot'
    ];

    const capturedRotations = {};
    boneNames.forEach((name) => {
      const node = sourceSlot.vrm.humanoid.getNormalizedBoneNode(name);
      if (node) {
        capturedRotations[name] = {
          x: node.rotation.x,
          y: node.rotation.y,
          z: node.rotation.z
        };
      }
    });

    this.slots.forEach((slot, idx) => {
      if (idx !== sourceIndex && slot.vrm && slot.vrm.humanoid) {
        this._applyStoredBoneRotations(slot.vrm, capturedRotations);
        slot.customBoneRotations = { ...capturedRotations };
        slot.isSculpted = true;
      }
    });
  }

  _applyStoredBoneRotations(vrm, rotations) {
    if (!vrm || !vrm.humanoid || !rotations) return;
    Object.keys(rotations).forEach((bName) => {
      const node = vrm.humanoid.getNormalizedBoneNode(bName);
      const rot = rotations[bName];
      if (node && rot) {
        node.rotation.set(rot.x, rot.y, rot.z);
      }
    });
  }

  /**
   * Render loop update for all active avatar instances and selection ring animation.
   */
  update(delta) {
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (slot.vrm) {
        slot.vrm.update(delta);
      }
    }

    // Subtle gentle pulse animation for selection ring
    if (this.selectionRing && this.selectionRing.visible) {
      const t = performance.now() * 0.0025;
      const scale = 1.0 + Math.sin(t) * 0.04;
      this.selectionRing.scale.set(scale, 1, scale);
    }
  }
}

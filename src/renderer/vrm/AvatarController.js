import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

export class AvatarController {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.currentVRM = null;
    this.currentCostume = 'casual';
    this.loader = new GLTFLoader();
    this.loader.register((parser) => new VRMLoaderPlugin(parser));

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
    // AliciaSolid requires Math.PI (180 deg) to face camera
    this.modelOrientations = {
      casual: Math.PI,
      school: Math.PI,
      stylish: Math.PI,
      gothic: Math.PI,
      seed: Math.PI,
      ayame: Math.PI,
      mint: Math.PI
    };
  }

  getCurrentVRM() {
    return this.currentVRM;
  }

  getFrontRotation(costumeKey) {
    return this.modelOrientations[costumeKey] !== undefined ? this.modelOrientations[costumeKey] : Math.PI;
  }

  async loadCostume(costumeKey = 'casual', onProgress = null) {
    const vrmPath = this.costumePaths[costumeKey] || this.costumePaths.casual;
    console.log(`[AvatarController] Loading costume '${costumeKey}' from ${vrmPath}...`);

    try {
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
        throw new Error('No VRM instance found in loaded asset');
      }

      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.combineSkeletons(gltf.scene);

      this._setupVRM(vrm, costumeKey);
      console.log(`[AvatarController] Successfully loaded and setup costume '${costumeKey}'.`);
      return vrm;
    } catch (err) {
      console.error(`[AvatarController] Failed to load ${vrmPath}: ${err.message}`, err);
      if (!this.currentVRM) {
        const fallbackVRM = this._createProceduralAvatar(costumeKey);
        this._setupVRM(fallbackVRM, costumeKey);
      }
      throw err;
    }
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
                if (mat.name === 'Alicia_wear') {
                  mat.color?.setHex(0x2563eb); // Navy sailor dress
                } else {
                  mat.color?.setHex(0xef4444); // Red ribbon
                }
                break;
              case 'stylish':
                if (mat.name === 'Alicia_wear') {
                  mat.color?.setHex(0x9333ea); // Elegant purple dress
                } else {
                  mat.color?.setHex(0xf472b6); // Soft pink ribbon
                }
                break;
              case 'gothic':
                if (mat.name === 'Alicia_wear') {
                  mat.color?.setHex(0x27272a); // Gothic dark dress
                } else {
                  mat.color?.setHex(0x991b1b); // Crimson ribbon
                }
                break;
              case 'seed':
                if (mat.name === 'Alicia_wear') {
                  mat.color?.setHex(0x06b6d4); // Sci-fi cyber cyan
                } else {
                  mat.color?.setHex(0x38bdf8); // Glowing neon blue ribbon
                }
                break;
              case 'casual':
              default:
                mat.color?.setHex(0xffffff); // Default pure white
                break;
            }
          }
        });
      }
    });
  }

  _setupVRM(vrm, costumeKey) {
    if (this.currentVRM && this.currentVRM !== vrm) {
      this.sceneManager.scene.remove(this.currentVRM.scene);
      VRMUtils.deepDispose(this.currentVRM.scene);
    }

    this.currentVRM = vrm;
    this.currentCostume = costumeKey;

    // Apply costume palette
    this._applyCostumeStyling(vrm, costumeKey);

    // Face camera precisely according to model's native coordinate system
    const targetY = this.getFrontRotation(costumeKey);
    vrm.scene.rotation.y = targetY;
    vrm.scene.position.set(0, 0, 0);

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

    this.sceneManager.scene.add(vrm.scene);
  }

  update(delta) {
    if (this.currentVRM) {
      this.currentVRM.update(delta);
    }
  }

  _createProceduralAvatar(costumeKey) {
    const root = new THREE.Group();
    return {
      scene: root,
      humanoid: { getNormalizedBoneNode: () => null },
      expressionManager: { setValue: () => {}, getValue: () => 0 },
      lookAt: { lookAt: () => {} },
      update: () => {}
    };
  }
}

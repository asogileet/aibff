import * as THREE from 'three';

export class EyeTrackingController {
  constructor(sceneManager, avatarController) {
    this.sceneManager = sceneManager;
    this.avatarController = avatarController;

    this.mouse = new THREE.Vector2(0, 0);
    this.targetLookAtPos = new THREE.Vector3(0, 1.35, 1.0);
    this.currentLookAtPos = new THREE.Vector3(0, 1.35, 1.0);

    // Angular limits in radians
    this.MAX_YAW = THREE.MathUtils.degToRad(35);   // Left-right limit: 35 degrees
    this.MAX_PITCH = THREE.MathUtils.degToRad(20); // Up-down limit: 20 degrees

    this._bindEvents();
  }

  _bindEvents() {
    window.addEventListener('mousemove', (e) => {
      // Normalize mouse (-1 to 1)
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
  }

  update(delta) {
    const vrm = this.avatarController.getCurrentVRM();
    if (!vrm) return;

    // Invert targetX because AliciaSolid faces camera with Math.PI rotation
    const targetX = THREE.MathUtils.clamp(-this.mouse.x * 0.8, -Math.sin(this.MAX_YAW), Math.sin(this.MAX_YAW));
    const targetY = 1.35 + THREE.MathUtils.clamp(this.mouse.y * 0.5, -Math.sin(this.MAX_PITCH), Math.sin(this.MAX_PITCH));
    this.targetLookAtPos.set(targetX, targetY, 1.2);

    // Smooth damp towards target position
    this.currentLookAtPos.lerp(this.targetLookAtPos, delta * 6.0);

    // Apply to VRM lookAt if available
    if (vrm.lookAt) {
      vrm.lookAt.lookAt(this.currentLookAtPos);
    }

    // Apply subtle neck and head bone orientation
    const head = vrm.humanoid?.getNormalizedBoneNode('head');
    const neck = vrm.humanoid?.getNormalizedBoneNode('neck');

    // Yaw and pitch for head orientation
    const yaw = THREE.MathUtils.clamp(-this.mouse.x * 0.35, -this.MAX_YAW, this.MAX_YAW);
    const pitch = THREE.MathUtils.clamp(this.mouse.y * 0.25, -this.MAX_PITCH, this.MAX_PITCH);

    if (head) {
      head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, yaw * 0.7, delta * 5.0);
      head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, pitch * 0.7, delta * 5.0);
    }

    if (neck) {
      neck.rotation.y = THREE.MathUtils.lerp(neck.rotation.y, yaw * 0.3, delta * 5.0);
      neck.rotation.x = THREE.MathUtils.lerp(neck.rotation.x, pitch * 0.3, delta * 5.0);
    }
  }
}

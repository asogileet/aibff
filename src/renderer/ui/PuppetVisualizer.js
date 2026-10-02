/**
 * PuppetVisualizer
 * Renders glowing dual-hand index finger pointers, elastic tension strings,
 * and joint snapping indicators on an overlay 2D canvas above the 3D scene.
 */
export class PuppetVisualizer {
  constructor(container, puppetController) {
    this.container = container;
    this.puppetController = puppetController;
    this.canvas = null;
    this.ctx = null;
    this.isVisible = false;

    this._initCanvas();
  }

  _initCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'puppetVisualizerCanvas';
    this.canvas.className = 'hidden fixed inset-0 w-screen h-screen pointer-events-none z-40';
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    const resize = () => {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();
  }

  setVisible(visible) {
    this.isVisible = visible;
    if (visible) {
      this.canvas.classList.remove('hidden');
    } else {
      this.canvas.classList.add('hidden');
      if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /**
   * Called on every frame animation loop.
   */
  render() {
    if (!this.isVisible || !this.puppetController || !this.puppetController.isEnabled) {
      return;
    }

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const pointers = typeof this.puppetController.getActivePointers === 'function'
      ? this.puppetController.getActivePointers()
      : [];

    // Fallback single pointer if pointers list is empty
    const activePointers = pointers.length > 0 ? pointers : [
      {
        id: 'primary',
        name: '食指',
        x: this.puppetController.fingerScreenPos.x,
        y: this.puppetController.fingerScreenPos.y,
        isPinching: this.puppetController.isPinching,
        grabbedJointKey: this.puppetController.grabbedJointKey,
        hoveredJointKey: this.puppetController.hoveredJointKey
      }
    ];

    const jointTargets = this.puppetController.getJointScreenPositions();

    // 1. Draw glowing grabbable joint circles
    for (const [key, pos] of Object.entries(jointTargets)) {
      if (pos.z > 1.0) continue; // Behind camera

      // Check if grabbed or hovered by ANY pointer
      const grabbingPointer = activePointers.find(p => p.grabbedJointKey === key);
      const hoveringPointer = activePointers.find(p => p.hoveredJointKey === key);
      const isGrabbed = Boolean(grabbingPointer);
      const isHovered = Boolean(hoveringPointer);

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, isGrabbed ? 10 : (isHovered ? 8 : 4), 0, Math.PI * 2);
      ctx.fillStyle = isGrabbed ? '#10b981' : (isHovered ? '#f472b6' : 'rgba(255, 255, 255, 0.4)');
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (isHovered || isGrabbed) {
        // Outer halo
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, isGrabbed ? 22 : 16, 0, Math.PI * 2);
        ctx.strokeStyle = isGrabbed ? 'rgba(16, 185, 129, 0.8)' : 'rgba(244, 114, 182, 0.7)';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Chinese Joint Label
        const labelMap = {
          head: '摸頭',
          neck: '轉頸',
          chest: '挺胸',
          spine: '彎腰',
          hips: '抓腰提拔',
          leftLowerArm: '左手肘',
          rightLowerArm: '右手肘',
          leftHand: '左手',
          rightHand: '右手',
          leftUpperLeg: '左大腿',
          rightUpperLeg: '右大腿',
          leftLowerLeg: '左膝蓋',
          rightLowerLeg: '右膝蓋',
          leftFoot: '左腳',
          rightFoot: '右腳'
        };
        const label = labelMap[key] || key;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(pos.x - 34, pos.y - 28, 68, 18);
        ctx.fillStyle = isGrabbed ? '#6ee7b7' : '#fbcfe8';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, pos.x, pos.y - 15);
      }
    }

    // 2. Draw Elastic Tension Strings & Finger Pointer Rings for Each Active Pointer
    activePointers.forEach((pointer, index) => {
      // Palette: Pointer 1 = Cyan/Emerald, Pointer 2 = Pink/Violet
      const isSecondHand = index > 0 || pointer.id === 'hand_1';
      const mainColor = isSecondHand ? '#ec4899' : '#06b6d4';
      const glowColor = isSecondHand ? 'rgba(236, 72, 153, 0.4)' : 'rgba(6, 182, 212, 0.4)';

      // 2a. Draw Elastic Tension Line if currently dragging
      if (pointer.grabbedJointKey && jointTargets[pointer.grabbedJointKey]) {
        const jointPos = jointTargets[pointer.grabbedJointKey];
        ctx.save();
        ctx.strokeStyle = mainColor;
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(pointer.x, pointer.y);
        ctx.lineTo(jointPos.x, jointPos.y);
        ctx.stroke();
        ctx.restore();

        // Elastic node glow
        ctx.beginPath();
        ctx.arc(jointPos.x, jointPos.y, 16, 0, Math.PI * 2);
        ctx.fillStyle = glowColor;
        ctx.fill();
      }

      // 2b. Draw Finger Cursor Ring
      ctx.save();
      ctx.translate(pointer.x, pointer.y);

      if (pointer.isPinching) {
        // Pinched Grab State
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fillStyle = isSecondHand ? 'rgba(236, 72, 153, 0.35)' : 'rgba(16, 185, 129, 0.35)';
        ctx.fill();
        ctx.strokeStyle = isSecondHand ? '#ec4899' : '#10b981';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else if (pointer.hoveredJointKey) {
        // Near Joint Magnet State
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fillStyle = isSecondHand ? 'rgba(244, 114, 182, 0.25)' : 'rgba(6, 182, 212, 0.25)';
        ctx.fill();
        ctx.strokeStyle = isSecondHand ? '#f472b6' : '#22d3ee';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // Idle Cursor State
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fillStyle = isSecondHand ? 'rgba(236, 72, 153, 0.2)' : 'rgba(6, 182, 212, 0.2)';
        ctx.fill();
        ctx.strokeStyle = mainColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Draw Finger Identifier Badge (if dual hands active)
      if (activePointers.length > 1) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(-22, -28, 44, 15);
        ctx.fillStyle = mainColor;
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(pointer.name || (isSecondHand ? '食指 2' : '食指 1'), 0, -17);
      }

      ctx.restore();
    });
  }
}

/**
 * PuppetVisualizer
 * Renders glowing finger pointers, elastic tension strings, and joint snapping indicators
 * on an overlay 2D canvas above the 3D scene.
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
    this.canvas.className = 'fixed inset-0 w-screen h-screen pointer-events-none z-40 hidden';
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

    const finger = this.puppetController.fingerScreenPos;
    const isPinching = this.puppetController.isPinching;
    const grabbedKey = this.puppetController.grabbedJointKey;
    const hoveredKey = this.puppetController.hoveredJointKey;
    const jointTargets = this.puppetController.getJointScreenPositions();

    // 1. Draw glowing grabbable joint circles
    for (const [key, pos] of Object.entries(jointTargets)) {
      if (pos.z > 1.0) continue; // Behind camera

      const isHovered = hoveredKey === key;
      const isGrabbed = grabbedKey === key;

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
          hips: '抓腰提拔',
          rightHand: '右手',
          leftHand: '左手',
          rightFoot: '右腳',
          leftFoot: '左腳'
        };
        const label = labelMap[key] || key;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(pos.x - 28, pos.y - 28, 56, 18);
        ctx.fillStyle = isGrabbed ? '#6ee7b7' : '#fbcfe8';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, pos.x, pos.y - 15);
      }
    }

    // 2. Draw Elastic Tension Line if currently dragging
    if (grabbedKey && jointTargets[grabbedKey]) {
      const jointPos = jointTargets[grabbedKey];
      ctx.save();
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(finger.x, finger.y);
      ctx.lineTo(jointPos.x, jointPos.y);
      ctx.stroke();
      ctx.restore();

      // Elastic node glow
      ctx.beginPath();
      ctx.arc(jointPos.x, jointPos.y, 16, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(236, 72, 153, 0.4)';
      ctx.fill();
    }

    // 3. Draw Finger Cursor Ring
    ctx.save();
    ctx.translate(finger.x, finger.y);

    if (isPinching) {
      // Pinched Grab State (Green glowing pulse)
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.35)';
      ctx.fill();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    } else if (hoveredKey) {
      // Near Joint Magnet State (Pink highlight)
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(244, 114, 182, 0.25)';
      ctx.fill();
      ctx.strokeStyle = '#f472b6';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      // Idle Cursor State (Cyan subtle ring)
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
      ctx.fill();
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();
  }
}

import * as THREE from 'three';

/**
 * SnapshotService
 * Handles high-resolution 3D canvas snapshots, transparent background exports,
 * shutter flash animations, and automatic file downloads.
 */
export class SnapshotService {
  constructor(sceneManager, arManager = null) {
    this.sceneManager = sceneManager;
    this.arManager = arManager;
    this._createShutterOverlay();
  }

  setARManager(arManager) {
    this.arManager = arManager;
  }

  _createShutterOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'snapshotShutterOverlay';
    this.overlay.className = 'pointer-events-none fixed inset-0 bg-white z-[9999] opacity-0 transition-opacity duration-300';
    document.body.appendChild(this.overlay);
  }

  _flashShutter() {
    this.overlay.style.transition = 'none';
    this.overlay.style.opacity = '0.9';
    // Trigger reflow
    void this.overlay.offsetWidth;
    this.overlay.style.transition = 'opacity 0.35s ease-out';
    this.overlay.style.opacity = '0';
  }

  /**
   * Captures a snapshot of the current 3D scene (with optional AR webcam background).
   * @param {Object} options
   * @param {boolean} options.transparent - Whether to export as transparent PNG
   * @returns {Object} { filename, dataUrl }
   */
  capture({ transparent = false } = {}) {
    const renderer = this.sceneManager.renderer;
    const scene = this.sceneManager.scene;
    const camera = this.sceneManager.camera;

    if (!renderer || !scene || !camera) {
      console.error('[SnapshotService] Renderer, scene or camera not ready');
      return null;
    }

    // Trigger visual shutter flash
    this._flashShutter();

    const isARMode = !transparent && this.arManager && this.arManager.isActive;

    const oldClearColor = new THREE.Color();
    renderer.getClearColor(oldClearColor);
    const oldClearAlpha = renderer.getClearAlpha();
    const oldBackground = scene.background;

    if (transparent || isARMode) {
      scene.background = null;
      renderer.setClearColor(0x000000, 0);
    }

    // Force high quality render for snapshot
    renderer.render(scene, camera);

    const canvas = renderer.domElement;
    let finalDataUrl = null;

    if (isARMode) {
      // Compose webcam background with 3D character
      const videoEl = this.arManager.getVideoElement();
      const compCanvas = document.createElement('canvas');
      compCanvas.width = canvas.width;
      compCanvas.height = canvas.height;
      const ctx = compCanvas.getContext('2d');

      if (videoEl && videoEl.readyState >= 2) {
        ctx.save();
        if (this.arManager.isMirror) {
          ctx.translate(compCanvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(videoEl, 0, 0, compCanvas.width, compCanvas.height);
        ctx.restore();
      }

      // Draw 3D avatar on top
      ctx.drawImage(canvas, 0, 0);
      finalDataUrl = compCanvas.toDataURL('image/png');
    } else {
      finalDataUrl = canvas.toDataURL('image/png');
    }

    // Restore background if transparent or AR mode was enabled
    if (transparent || isARMode) {
      scene.background = oldBackground;
      renderer.setClearColor(oldClearColor, oldClearAlpha);
      renderer.render(scene, camera);
    }

    // Generate formatted timestamp: YYYYMMDD_HHMMSS
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = isARMode ? `aibff_ar_snapshot_${timestamp}.png` : `aibff_snapshot_${timestamp}.png`;

    // Trigger download
    const link = document.createElement('a');
    link.download = filename;
    link.href = finalDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log(`[SnapshotService] Successfully captured and downloaded ${filename}`);
    return { filename, dataUrl: finalDataUrl };
  }
}

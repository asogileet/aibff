import * as THREE from 'three';

/**
 * SnapshotService
 * Handles high-resolution 3D canvas snapshots, transparent background exports,
 * shutter flash animations, and automatic file downloads.
 */
export class SnapshotService {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this._createShutterOverlay();
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
   * Captures a snapshot of the current 3D scene.
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

    const oldClearColor = new THREE.Color();
    renderer.getClearColor(oldClearColor);
    const oldClearAlpha = renderer.getClearAlpha();
    const oldBackground = scene.background;

    if (transparent) {
      scene.background = null;
      renderer.setClearColor(0x000000, 0);
    }

    // Force high quality render for snapshot
    renderer.render(scene, camera);

    const canvas = renderer.domElement;
    const dataUrl = canvas.toDataURL('image/png');

    // Restore background if transparent mode was enabled
    if (transparent) {
      scene.background = oldBackground;
      renderer.setClearColor(oldClearColor, oldClearAlpha);
      renderer.render(scene, camera);
    }

    // Generate formatted timestamp: YYYYMMDD_HHMMSS
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `aibff_snapshot_${timestamp}.png`;

    // Trigger download
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log(`[SnapshotService] Successfully captured and downloaded ${filename}`);
    return { filename, dataUrl };
  }
}

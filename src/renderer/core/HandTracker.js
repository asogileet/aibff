/**
 * HandTracker
 * Tracks real-time hand landmarks, pinch gesture detection (thumb tip & index tip),
 * and provides smooth mouse/touch fallback for puppet joint dragging.
 */
export class HandTracker {
  constructor(options = {}) {
    this.videoElement = options.videoElement || null;
    this.onHandUpdate = options.onHandUpdate || null; // Callback: ({ x, y, isPinching, source }) => {}

    this.isActive = false;
    this.isCameraTracking = false;
    this.isPinching = false;
    this.fingerPos = { x: 0, y: 0 }; // Screen pixels

    this.handsInstance = null;
    this.cameraInstance = null;
    this.PINCH_THRESHOLD = 0.07; // Normalized distance between thumb and index

    this._bindMouseFallback();
  }

  setVideoElement(videoEl) {
    this.videoElement = videoEl;
  }

  /**
   * Binds mouse and touch events as seamless interactive fallback.
   */
  _bindMouseFallback() {
    window.addEventListener('mousemove', (e) => {
      if (this.isCameraTracking) return;
      this.fingerPos.x = e.clientX;
      this.fingerPos.y = e.clientY;
      this._emitUpdate('mouse');
    });

    window.addEventListener('mousedown', (e) => {
      if (this.isCameraTracking) return;
      if (e.button !== 0) return; // Left click
      this.isPinching = true;
      this.fingerPos.x = e.clientX;
      this.fingerPos.y = e.clientY;
      this._emitUpdate('mouse');
    });

    window.addEventListener('mouseup', () => {
      if (this.isCameraTracking) return;
      this.isPinching = false;
      this._emitUpdate('mouse');
    });

    // Touch support for tablets / touchscreens
    window.addEventListener('touchmove', (e) => {
      if (this.isCameraTracking || !e.touches[0]) return;
      this.fingerPos.x = e.touches[0].clientX;
      this.fingerPos.y = e.touches[0].clientY;
      this._emitUpdate('touch');
    }, { passive: true });

    window.addEventListener('touchstart', (e) => {
      if (this.isCameraTracking || !e.touches[0]) return;
      this.isPinching = true;
      this.fingerPos.x = e.touches[0].clientX;
      this.fingerPos.y = e.touches[0].clientY;
      this._emitUpdate('touch');
    }, { passive: true });

    window.addEventListener('touchend', () => {
      if (this.isCameraTracking) return;
      this.isPinching = false;
      this._emitUpdate('touch');
    });
  }

  /**
   * Starts camera-based MediaPipe hands tracking if video element and scripts are available.
   */
  async startCameraTracking(videoEl = null) {
    if (videoEl) this.videoElement = videoEl;
    if (!this.videoElement) {
      console.warn('[HandTracker] No video element available for camera tracking');
      return false;
    }

    // Dynamic loading of MediaPipe scripts if not yet present
    await this._ensureMediaPipeLoaded();

    if (!window.Hands) {
      console.warn('[HandTracker] MediaPipe Hands not loaded, relying on mouse/touch fallback');
      return false;
    }

    try {
      this.handsInstance = new window.Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      this.handsInstance.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6
      });

      this.handsInstance.onResults((results) => this._onMediaPipeResults(results));

      // Processing frames from video
      let lastProcess = 0;
      const processLoop = async () => {
        if (!this.isCameraTracking) return;
        const now = performance.now();
        if (now - lastProcess > 33 && this.videoElement.readyState >= 2) { // Cap ~30fps
          lastProcess = now;
          try {
            await this.handsInstance.send({ image: this.videoElement });
          } catch (e) {
            // Frame send error handling
          }
        }
        requestAnimationFrame(processLoop);
      };

      this.isCameraTracking = true;
      requestAnimationFrame(processLoop);

      console.log('[HandTracker] MediaPipe hands camera tracking started');
      return true;
    } catch (err) {
      console.error('[HandTracker] Failed to start MediaPipe Hands:', err);
      this.isCameraTracking = false;
      return false;
    }
  }

  /**
   * Stops camera tracking and falls back to mouse/touch.
   */
  stopCameraTracking() {
    this.isCameraTracking = false;
    if (this.handsInstance) {
      try {
        this.handsInstance.close();
      } catch (e) {}
      this.handsInstance = null;
    }
  }

    this.isHandDetected = false;
    this.thumbScreenPos = { x: 0, y: 0 };
    this.indexScreenPos = { x: 0, y: 0 };
  }

  _onMediaPipeResults(results) {
    if (!this.isCameraTracking) return;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      this.isHandDetected = true;
      const landmarks = results.multiHandLandmarks[0];
      const wrist = landmarks[0];
      const thumbTip = landmarks[4];
      const indexTip = landmarks[8];
      const middleMcp = landmarks[9];

      // Mirror coordinate: x = 1 - x
      const thumbX = (1 - thumbTip.x) * window.innerWidth;
      const thumbY = thumbTip.y * window.innerHeight;
      const indexX = (1 - indexTip.x) * window.innerWidth;
      const indexY = indexTip.y * window.innerHeight;

      this.thumbScreenPos.x = thumbX;
      this.thumbScreenPos.y = thumbY;
      this.indexScreenPos.x = indexX;
      this.indexScreenPos.y = indexY;

      // Finger center point
      this.fingerPos.x = (thumbX + indexX) / 2;
      this.fingerPos.y = (thumbY + indexY) / 2;

      // Adaptive palm-scaled pinch detection
      const palmScale = Math.hypot(wrist.x - middleMcp.x, wrist.y - middleMcp.y);
      const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
      const pinchRatio = pinchDist / Math.max(0.02, palmScale);

      // Trigger pinch if fingers are close relative to hand size or absolute distance is small
      this.isPinching = pinchRatio < 0.65 || pinchDist < 0.09;

      this._emitUpdate('webcam');
    } else {
      if (this.isHandDetected) {
        this.isHandDetected = false;
        this.isPinching = false;
        this._emitUpdate('webcam');
      }
    }
  }

  _emitUpdate(source) {
    if (typeof this.onHandUpdate === 'function') {
      this.onHandUpdate({
        x: this.fingerPos.x,
        y: this.fingerPos.y,
        isPinching: this.isPinching,
        isHandDetected: this.isHandDetected,
        thumbPos: this.thumbScreenPos,
        indexPos: this.indexScreenPos,
        source
      });
    }
  }

  /**
   * Dynamically loads MediaPipe Hands script tags into document head if needed.
   */
  async _ensureMediaPipeLoaded() {
    if (window.Hands) return true;

    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
      script.crossOrigin = 'anonymous';
      script.onload = () => resolve(true);
      script.onerror = () => {
        console.warn('[HandTracker] Failed to load MediaPipe Hands from CDN');
        resolve(false);
      };
      document.head.appendChild(script);
    });
  }
}

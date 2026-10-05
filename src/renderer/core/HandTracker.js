/**
 * HandTracker
 * Dual-hand index finger tracking provider for AR puppet joint interaction.
 * Tracks index fingertips (Landmark 8) for up to two hands simultaneously,
 * with pinch detection (Thumb Landmark 4) and seamless mouse/touch fallback.
 */
import { loadVision, createWithFallback, MODEL_SOURCES } from './mediapipeVision.js';

export class HandTracker {
  constructor(options = {}) {
    this.videoElement = options.videoElement || null;
    this.onHandUpdate = options.onHandUpdate || null; // Callback: ({ x, y, isPinching, isHandDetected, hands, source }) => {}

    this.isActive = true;
    this.isCameraTracking = false;
    this.isPinching = false;
    this.fingerPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.isHandDetected = true;

    // Dual hands collection: [{ id, x, y, isPinching, name }]
    this.hands = [];

    this.handsInstance = null;
    this._animationFrameId = null;
    this._lastProcessTime = 0;

    this._bindMouseFallback();
  }

  setVideoElement(videoEl) {
    this.videoElement = videoEl;
  }

  /**
   * Binds mouse and touch events as fallback interaction.
   */
  _bindMouseFallback() {
    window.addEventListener('mousemove', (e) => {
      if (this.isCameraTracking && this.hands.length > 0) return;
      this.fingerPos.x = e.clientX;
      this.fingerPos.y = e.clientY;
      this.isHandDetected = true;
      this.hands = [
        {
          id: 'mouse_0',
          x: e.clientX,
          y: e.clientY,
          isPinching: this.isPinching,
          name: '游標食指'
        }
      ];
      this._emitUpdate('mouse');
    });

    window.addEventListener('mousedown', (e) => {
      if (this.isCameraTracking && this.hands.length > 0) return;
      if (e.button !== 0) return; // Left click
      this.isPinching = true;
      this.fingerPos.x = e.clientX;
      this.fingerPos.y = e.clientY;
      this.isHandDetected = true;
      this.hands = [
        {
          id: 'mouse_0',
          x: e.clientX,
          y: e.clientY,
          isPinching: true,
          name: '游標食指'
        }
      ];
      this._emitUpdate('mouse');
    });

    window.addEventListener('mouseup', () => {
      if (this.isCameraTracking && this.hands.length > 0) return;
      this.isPinching = false;
      this.hands = [
        {
          id: 'mouse_0',
          x: this.fingerPos.x,
          y: this.fingerPos.y,
          isPinching: false,
          name: '游標食指'
        }
      ];
      this._emitUpdate('mouse');
    });

    // Touch events for touchscreen devices
    window.addEventListener('touchmove', (e) => {
      if (this.isCameraTracking && this.hands.length > 0) return;
      if (!e.touches[0]) return;
      const touchHands = [];
      for (let i = 0; i < Math.min(e.touches.length, 2); i++) {
        touchHands.push({
          id: `touch_${i}`,
          x: e.touches[i].clientX,
          y: e.touches[i].clientY,
          isPinching: true,
          name: `觸控食指 ${i + 1}`
        });
      }
      this.hands = touchHands;
      this.fingerPos.x = e.touches[0].clientX;
      this.fingerPos.y = e.touches[0].clientY;
      this.isHandDetected = true;
      this._emitUpdate('touch');
    }, { passive: true });

    window.addEventListener('touchstart', (e) => {
      if (this.isCameraTracking && this.hands.length > 0) return;
      if (!e.touches[0]) return;
      this.isPinching = true;
      const touchHands = [];
      for (let i = 0; i < Math.min(e.touches.length, 2); i++) {
        touchHands.push({
          id: `touch_${i}`,
          x: e.touches[i].clientX,
          y: e.touches[i].clientY,
          isPinching: true,
          name: `觸控食指 ${i + 1}`
        });
      }
      this.hands = touchHands;
      this.fingerPos.x = e.touches[0].clientX;
      this.fingerPos.y = e.touches[0].clientY;
      this.isHandDetected = true;
      this._emitUpdate('touch');
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
      if (this.isCameraTracking && this.hands.length > 0) return;
      if (e.touches.length === 0) {
        this.isPinching = false;
        this.hands = [];
      } else {
        const touchHands = [];
        for (let i = 0; i < Math.min(e.touches.length, 2); i++) {
          touchHands.push({
            id: `touch_${i}`,
            x: e.touches[i].clientX,
            y: e.touches[i].clientY,
            isPinching: true,
            name: `觸控食指 ${i + 1}`
          });
        }
        this.hands = touchHands;
      }
      this._emitUpdate('touch');
    });
  }

  /**
   * Starts camera tracking for dual hands index fingers.
   * Uses the MediaPipe Tasks hand landmarker (shared runtime with motion capture).
   * @param {HTMLVideoElement} [videoEl]
   * @returns {Promise<boolean>}
   */
  async startCameraTracking(videoEl = null) {
    if (videoEl) this.videoElement = videoEl;
    if (!this.videoElement) {
      console.warn('[HandTracker] Video element not provided for camera tracking');
      return false;
    }

    this._wantCameraTracking = true;
    try {
      if (!this._handsPromise) {
        // Shared by concurrent callers (AR start and puppet toggle both request tracking)
        this._handsPromise = loadVision().then(({ vision, fileset }) =>
          // Track up to 2 hands simultaneously
          createWithFallback(MODEL_SOURCES.hand, (modelAssetPath, delegate) =>
            vision.HandLandmarker.createFromOptions(fileset, {
              baseOptions: { modelAssetPath, delegate },
              runningMode: 'VIDEO',
              numHands: 2,
              minHandDetectionConfidence: 0.5,
              minHandPresenceConfidence: 0.5,
              minTrackingConfidence: 0.5
            })));
      }
      this.handsInstance = await this._handsPromise;
    } catch (err) {
      console.warn('[HandTracker] MediaPipe hand landmarker unavailable, falling back to mouse/touch mode:', err);
      this._handsPromise = null;
      this.isCameraTracking = false;
      return false;
    }

    // Stopped while the model was loading
    if (!this._wantCameraTracking) return false;
    if (this.isCameraTracking) return true;
    this.isCameraTracking = true;
    let lastVideoTime = -1;

    // Processing loop capped at ~30 FPS to save CPU/GPU cycles
    const processLoop = () => {
      if (!this.isCameraTracking) return;
      const now = performance.now();
      const video = this.videoElement;
      if (now - this._lastProcessTime >= 33 && video && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
        this._lastProcessTime = now;
        lastVideoTime = video.currentTime;
        try {
          this._onMediaPipeResults(this.handsInstance.detectForVideo(video, now));
        } catch (e) {
          // Ignore intermittent frame errors
        }
      }
      this._animationFrameId = requestAnimationFrame(processLoop);
    };

    this._animationFrameId = requestAnimationFrame(processLoop);
    console.log('[HandTracker] Dual-hand index finger camera tracking started successfully');
    return true;
  }

  /**
   * Stops camera tracking. The landmarker is kept so tracking can resume instantly.
   */
  stopCameraTracking() {
    this._wantCameraTracking = false;
    this.isCameraTracking = false;
    if (this._animationFrameId) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }
    this.hands = [];
    console.log('[HandTracker] Camera tracking stopped');
  }

  /**
   * Processes MediaPipe landmark results and extracts index finger tip coordinates.
   * @param {Object} results
   */
  _onMediaPipeResults(results) {
    if (!this.isCameraTracking) return;

    if (results.landmarks && results.landmarks.length > 0) {
      const detectedHands = [];

      for (let i = 0; i < results.landmarks.length; i++) {
        const landmarks = results.landmarks[i];
        const indexTip = landmarks[8]; // Index finger tip
        const thumbTip = landmarks[4]; // Thumb tip for pinch detection

        // Mirror coordinates horizontally: x = (1 - landmark.x)
        const screenX = (1 - indexTip.x) * window.innerWidth;
        const screenY = indexTip.y * window.innerHeight;

        // Euclidean distance between thumb and index tip
        const pinchDistance = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
        // Pinched when thumb and index are close (< 0.08 normalized distance)
        const isPinching = pinchDistance < 0.085;

        detectedHands.push({
          id: `hand_${i}`,
          x: screenX,
          y: screenY,
          isPinching: isPinching,
          name: `食指 ${i + 1}`,
          handedness: results.handedness?.[i]?.[0]?.categoryName || `Hand ${i + 1}`
        });
      }

      this.hands = detectedHands;
      this.isHandDetected = true;

      // Update primary pointer for backward compatibility
      if (detectedHands.length > 0) {
        this.fingerPos.x = detectedHands[0].x;
        this.fingerPos.y = detectedHands[0].y;
        this.isPinching = detectedHands.some(h => h.isPinching);
      }

      this._emitUpdate('webcam');
    } else {
      if (this.isHandDetected) {
        this.isHandDetected = false;
        this.hands = [];
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
        hands: this.hands,
        source
      });
    }
  }
}

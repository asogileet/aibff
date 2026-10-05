/**
 * MotionTracker
 * Webcam body + face landmark provider for avatar motion capture.
 * Runs MediaPipe Pose Landmarker (3D world landmarks) and Face Landmarker
 * (ARKit blendshapes + head transform) on its own low-resolution camera stream,
 * so it works with or without the AR background video.
 */

import { loadVision, createWithFallback, MODEL_SOURCES } from './mediapipeVision.js';

export class MotionTracker {
  constructor(options = {}) {
    this.onResults = options.onResults || null; // Callback: ({ pose, face, timestamp }) => {}
    this.onStatus = options.onStatus || null;   // Callback: (text) => {}
    this.enableFace = options.enableFace !== false;
    this.targetFps = options.targetFps || 30;

    this.isActive = false;
    this.mediaStream = null;
    this.videoElement = null;
    this.poseLandmarker = null;
    this.faceLandmarker = null;

    this._ownsVideo = false;
    this._animationFrameId = null;
    this._lastProcessTime = 0;
    this._lastVideoTime = -1;
    this._runId = 0;
  }

  /**
   * Starts camera capture and landmark detection.
   * @param {Object} [options]
   * @param {string} [options.deviceId] Preferred camera device
   * @param {HTMLVideoElement} [options.videoElement] Already-playing video to analyse instead of opening a camera
   * @returns {Promise<boolean>}
   */
  async start(options = {}) {
    if (this.isActive) return true;
    const runId = ++this._runId;

    try {
      this._status('載入動作辨識模型中…');
      await this._ensureLandmarkers();
      if (runId !== this._runId) return false;

      if (options.videoElement) {
        this.videoElement = options.videoElement;
        this._ownsVideo = false;
      } else {
        this._status('開啟鏡頭中…');
        await this._openCamera(options.deviceId);
        if (runId !== this._runId) {
          this._closeCamera();
          return false;
        }
      }
    } catch (err) {
      console.error('[MotionTracker] Failed to start:', err);
      this._closeCamera();
      throw err;
    }

    this.isActive = true;
    this._lastVideoTime = -1;
    const interval = 1000 / this.targetFps;

    const loop = () => {
      if (!this.isActive || runId !== this._runId) return;
      const now = performance.now();
      const video = this.videoElement;
      if (now - this._lastProcessTime >= interval && video && video.readyState >= 2 && video.currentTime !== this._lastVideoTime) {
        this._lastProcessTime = now;
        this._lastVideoTime = video.currentTime;
        this._processFrame(video, now);
      }
      this._animationFrameId = requestAnimationFrame(loop);
    };
    this._animationFrameId = requestAnimationFrame(loop);
    console.log('[MotionTracker] Webcam motion tracking started');
    return true;
  }

  stop() {
    this._runId++;
    this.isActive = false;
    if (this._animationFrameId) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }
    this._closeCamera();
    console.log('[MotionTracker] Webcam motion tracking stopped');
  }

  getVideoElement() {
    return this.videoElement;
  }

  /**
   * Runs both landmarkers on one frame and emits a plain result object.
   * @param {HTMLVideoElement|HTMLImageElement|HTMLCanvasElement} source
   * @param {number} timestamp Monotonic milliseconds
   */
  _processFrame(source, timestamp) {
    let pose = null;
    let face = null;
    try {
      const poseResult = this.poseLandmarker.detectForVideo(source, timestamp);
      if (poseResult.worldLandmarks && poseResult.worldLandmarks.length > 0) {
        pose = { world: poseResult.worldLandmarks[0], image: poseResult.landmarks[0] };
      }
      if (this.faceLandmarker) {
        const faceResult = this.faceLandmarker.detectForVideo(source, timestamp);
        if (faceResult.faceBlendshapes && faceResult.faceBlendshapes.length > 0) {
          const blendshapes = {};
          for (const c of faceResult.faceBlendshapes[0].categories) {
            blendshapes[c.categoryName] = c.score;
          }
          const matrix = faceResult.facialTransformationMatrixes && faceResult.facialTransformationMatrixes[0];
          face = { blendshapes, matrix: matrix ? matrix.data : null };
        }
      }
    } catch (err) {
      // A single bad frame must not kill the loop
      console.warn('[MotionTracker] Frame processing error:', err);
      return;
    }

    if (typeof this.onResults === 'function') {
      this.onResults({ pose, face, timestamp });
    }
  }

  async _ensureLandmarkers() {
    if (this.poseLandmarker) return;

    const { vision, fileset } = await loadVision();

    this.poseLandmarker = await createWithFallback(MODEL_SOURCES.pose, (modelAssetPath, delegate) =>
      vision.PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath, delegate },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      }));

    if (this.enableFace) {
      try {
        this.faceLandmarker = await createWithFallback(MODEL_SOURCES.face, (modelAssetPath, delegate) =>
          vision.FaceLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath, delegate },
            runningMode: 'VIDEO',
            numFaces: 1,
            outputFaceBlendshapes: true,
            outputFacialTransformationMatrixes: true
          }));
      } catch (err) {
        // Body tracking still works without the face model
        console.warn('[MotionTracker] Face landmarker unavailable, continuing with body only:', err);
        this.faceLandmarker = null;
      }
    }
  }

  async _openCamera(deviceId = null) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera API unavailable');
    }
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user'
      },
      audio: false
    });

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.srcObject = this.mediaStream;
    await new Promise((resolve) => {
      if (video.readyState >= 2) resolve();
      else video.onloadeddata = () => resolve();
    });
    try {
      await video.play();
    } catch (e) {
      // Autoplay already running
    }
    this.videoElement = video;
    this._ownsVideo = true;
  }

  _closeCamera() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          // Ignore track stop errors
        }
      });
      this.mediaStream = null;
    }
    if (this._ownsVideo && this.videoElement) {
      this.videoElement.srcObject = null;
    }
    this.videoElement = null;
    this._ownsVideo = false;
  }

  _status(text) {
    if (typeof this.onStatus === 'function') this.onStatus(text);
  }
}

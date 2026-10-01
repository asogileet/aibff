/**
 * ARManager
 * Handles laptop/desktop webcam streaming for video passthrough AR mode,
 * camera lifecycle, device enumeration, mirror toggling, and background integration.
 */
export class ARManager {
  constructor(options = {}) {
    this.isActive = false;
    this.isMirror = true;
    this.mediaStream = null;
    this.videoElement = null;
    this.selectedDeviceId = null;
    this.onStateChange = options.onStateChange || null;

    this._initVideoElement();
  }

  /**
   * Initializes the background video element.
   * Placed underneath the 3D canvas so the VRM model overlays on top of the webcam feed.
   */
  _initVideoElement() {
    this.videoElement = document.createElement('video');
    this.videoElement.id = 'arWebcamVideo';
    this.videoElement.autoplay = true;
    this.videoElement.playsInline = true;
    this.videoElement.muted = true;
    this.videoElement.className = 'fixed inset-0 w-screen h-screen object-cover pointer-events-none hidden transition-opacity duration-300 z-0';
    if (this.isMirror) {
      this.videoElement.style.transform = 'scaleX(-1)';
    }
    document.body.prepend(this.videoElement);
  }

  /**
   * Enumerates available video input devices (webcams).
   * @returns {Promise<Array<{ deviceId: string, label: string }>>}
   */
  async getAvailableDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return [];
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter(device => device.kind === 'videoinput')
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${index + 1}`
        }));
    } catch (err) {
      console.warn('[ARManager] Failed to enumerate video devices:', err);
      return [];
    }
  }

  /**
   * Starts the webcam AR feed.
   * @param {string} [deviceId]
   * @returns {Promise<boolean>}
   */
  async start(deviceId = null) {
    if (this.isActive && (!deviceId || deviceId === this.selectedDeviceId)) {
      return true;
    }

    if (deviceId) {
      this.selectedDeviceId = deviceId;
    }

    // Stop existing stream if running
    this.stopStreamOnly();

    const constraints = {
      video: {
        deviceId: this.selectedDeviceId ? { exact: this.selectedDeviceId } : undefined,
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        facingMode: 'user'
      },
      audio: false
    };

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoElement.srcObject = this.mediaStream;
      this.videoElement.classList.remove('hidden');

      // Wait for video frame to load
      await new Promise((resolve) => {
        if (this.videoElement.readyState >= 2) {
          resolve();
        } else {
          this.videoElement.onloadedmetadata = () => resolve();
        }
      });

      this.videoElement.style.opacity = '1';
      this.isActive = true;

      if (typeof this.onStateChange === 'function') {
        this.onStateChange(true);
      }

      console.log('[ARManager] Webcam AR mode enabled successfully');
      return true;
    } catch (err) {
      console.error('[ARManager] Failed to access webcam:', err);
      this.stop();
      throw err;
    }
  }

  /**
   * Stops only the media stream tracks without notifying full state change.
   */
  stopStreamOnly() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          // Ignore track stop errors
        }
      });
      this.mediaStream = null;
    }
  }

  /**
   * Stops the webcam feed, turns off camera indicator light, and restores desktop transparency.
   */
  stop() {
    this.stopStreamOnly();

    if (this.videoElement) {
      this.videoElement.style.opacity = '0';
      this.videoElement.srcObject = null;
      setTimeout(() => {
        if (!this.isActive) {
          this.videoElement.classList.add('hidden');
        }
      }, 300);
    }

    this.isActive = false;

    if (typeof this.onStateChange === 'function') {
      this.onStateChange(false);
    }

    console.log('[ARManager] Webcam AR mode disabled');
  }

  /**
   * Toggles the AR mode on and off.
   * @returns {Promise<boolean>} Resulting active state
   */
  async toggle() {
    if (this.isActive) {
      this.stop();
      return false;
    } else {
      await this.start();
      return true;
    }
  }

  /**
   * Toggles video horizontal mirroring (selfie mirror effect).
   * @param {boolean} [mirrorState]
   * @returns {boolean} Current mirror state
   */
  setMirror(mirrorState = null) {
    this.isMirror = mirrorState !== null ? mirrorState : !this.isMirror;
    if (this.videoElement) {
      this.videoElement.style.transform = this.isMirror ? 'scaleX(-1)' : 'none';
    }
    return this.isMirror;
  }

  /**
   * Switches to a specific camera device ID.
   * @param {string} deviceId
   */
  async switchCamera(deviceId) {
    this.selectedDeviceId = deviceId;
    if (this.isActive) {
      await this.start(deviceId);
    }
  }

  /**
   * Gets the video DOM element for frame grabbing and snapshot composition.
   * @returns {HTMLVideoElement}
   */
  getVideoElement() {
    return this.videoElement;
  }
}

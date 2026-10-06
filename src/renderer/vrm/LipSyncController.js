import * as THREE from 'three';

export class LipSyncController {
  constructor(avatarController) {
    this.avatarController = avatarController;

    // Web Audio API context & analyser
    this.audioContext = null;
    this.analyser = null;
    this.audioSource = null;
    this.isPlaying = false;

    // FFT analysis buffers
    this.fftSize = 1024;
    this.frequencyData = null;

    // Target and current blendshape weights
    this.currentWeights = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
    this.targetWeights = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };

    this._initAudioContext();
  }

  _initAudioContext() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.fftSize;
      this.analyser.smoothingTimeConstant = 0.65;
      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    } catch (e) {
      console.warn('[LipSyncController] Web Audio API initialization failed:', e);
    }
  }

  unlock() {
    if (!this.audioContext) this._initAudioContext();
    if (!this.audioContext) return;
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    // Safari/iOS Web Audio unlock pattern: play 1-sample silent buffer
    try {
      const buffer = this.audioContext.createBuffer(1, 1, 22050);
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      source.start(0);
    } catch (_) {}
  }

  async playAudioBase64(base64Audio) {
    if (!this.audioContext) this._initAudioContext();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (_) {}
    }

    // Convert Base64 to ArrayBuffer
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Use buffer slice to prevent iOS Safari detachment errors and handle callback fallback
    let audioBuffer;
    const arrayBuffer = bytes.buffer.slice(0);
    try {
      audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    } catch (err) {
      audioBuffer = await new Promise((resolve, reject) => {
        this.audioContext.decodeAudioData(bytes.buffer.slice(0), resolve, reject);
      });
    }

    return new Promise((resolve) => {
      if (this.audioSource) {
        try { this.audioSource.stop(); } catch (e) {}
      }

      this.audioSource = this.audioContext.createBufferSource();
      this.audioSource.buffer = audioBuffer;
      this.audioSource.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);

      this.isPlaying = true;

      this.audioSource.onended = () => {
        this.isPlaying = false;
        this._resetWeights();
        resolve();
      };

      this.audioSource.start(0);
    });
  }

  stopAudio() {
    if (this.audioSource) {
      try { this.audioSource.stop(); } catch (e) {}
    }
    this.isPlaying = false;
    this._resetWeights();
  }

  _resetWeights() {
    for (const key of Object.keys(this.targetWeights)) {
      this.targetWeights[key] = 0;
    }
  }

  update(delta) {
    const vrm = this.avatarController.getCurrentVRM();
    if (!vrm || !vrm.expressionManager) return;

    if (this.isPlaying && this.analyser && this.frequencyData) {
      this.analyser.getByteFrequencyData(this.frequencyData);

      // Frequency bands (sample rate ~44100 / 48000, bin ~43Hz per index)
      // 1. aa (open vowel, low-mid fundamental 300Hz-800Hz, bin 7-18)
      const aaEnergy = this._getBandEnergy(7, 18);
      // 2. oh (rounded back vowel, mid-low 400Hz-1000Hz, bin 9-23)
      const ohEnergy = this._getBandEnergy(9, 23);
      // 3. ou (deep vowel, low 150Hz-400Hz, bin 3-9)
      const ouEnergy = this._getBandEnergy(3, 9);
      // 4. ee (front high vowel, mid-high 1500Hz-3000Hz, bin 35-70)
      const eeEnergy = this._getBandEnergy(35, 70);
      // 5. ih (short front vowel, mid 800Hz-2200Hz, bin 18-50)
      const ihEnergy = this._getBandEnergy(18, 50);

      const threshold = 0.08;
      this.targetWeights.aa = aaEnergy > threshold ? Math.min(1.0, aaEnergy * 1.6) : 0;
      this.targetWeights.oh = ohEnergy > threshold ? Math.min(0.9, ohEnergy * 1.4) : 0;
      this.targetWeights.ou = ouEnergy > threshold ? Math.min(0.8, ouEnergy * 1.3) : 0;
      this.targetWeights.ee = eeEnergy > threshold ? Math.min(0.7, eeEnergy * 1.2) : 0;
      this.targetWeights.ih = ihEnergy > threshold ? Math.min(0.6, ihEnergy * 1.2) : 0;
    } else {
      this._resetWeights();
    }

    // Smooth lerp to targets and apply to VRM expressionManager
    const lerpSpeed = this.isPlaying ? 18.0 : 12.0;
    for (const key of ['aa', 'ih', 'ou', 'ee', 'oh']) {
      this.currentWeights[key] = THREE.MathUtils.lerp(
        this.currentWeights[key],
        this.targetWeights[key],
        delta * lerpSpeed
      );

      try {
        vrm.expressionManager.setValue(key, this.currentWeights[key]);
      } catch (e) {}
    }
  }

  _getBandEnergy(startBin, endBin) {
    let sum = 0;
    const clampedEnd = Math.min(endBin, this.frequencyData.length);
    for (let i = startBin; i < clampedEnd; i++) {
      sum += this.frequencyData[i];
    }
    const count = clampedEnd - startBin;
    return count > 0 ? (sum / count) / 255.0 : 0;
  }
}

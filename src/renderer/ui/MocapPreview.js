/**
 * MocapPreview
 * Small picture-in-picture self view shown while webcam motion capture is on,
 * so the user can check their framing and whether their body is being tracked.
 */
export class MocapPreview {
  constructor(container) {
    this.container = container;
    this.element = null;
    this.videoElement = null;
    this.statusElement = null;
    this._render();
  }

  _render() {
    this.element = document.createElement('div');
    this.element.id = 'mocapPreview';
    this.element.className = 'hidden fixed bottom-24 left-4 z-40 glass-panel rounded-xl overflow-hidden shadow-2xl border border-violet-400/40 w-40';
    this.element.innerHTML = `
      <video class="w-40 h-[120px] object-cover bg-black/60" autoplay playsinline muted></video>
      <div class="px-2 py-1 text-[10px] text-violet-200 truncate" data-role="status">動作捕捉</div>
    `;
    this.videoElement = this.element.querySelector('video');
    this.statusElement = this.element.querySelector('[data-role="status"]');
    this.container.appendChild(this.element);
  }

  /**
   * @param {MediaStream|null} stream Camera stream to mirror into the preview
   * @param {boolean} mirror
   */
  show(stream, mirror = true) {
    this.videoElement.srcObject = stream || null;
    this.setMirror(mirror);
    this.element.classList.remove('hidden');
  }

  hide() {
    this.element.classList.add('hidden');
    this.videoElement.srcObject = null;
  }

  setMirror(mirror) {
    this.videoElement.style.transform = mirror ? 'scaleX(-1)' : 'none';
  }

  setStatus(text) {
    if (this.statusElement.textContent !== text) this.statusElement.textContent = text;
  }
}

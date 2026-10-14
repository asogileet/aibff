/**
 * MocapPreview
 * Small picture-in-picture self view shown while webcam motion capture is on,
 * so the user can check their framing and whether their body is being tracked.
 */
export class MocapPreview {
  constructor(container, options = {}) {
    this.container = container;
    this.onToggleMirror = options.onToggleMirror || null;
    this.element = null;
    this.videoElement = null;
    this.statusElement = null;
    this.mirrorButton = null;
    this.isMirror = true;
    this._render();
  }

  _render() {
    this.element = document.createElement('div');
    this.element.id = 'mocapPreview';
    this.element.className = 'hidden fixed bottom-24 left-4 z-40 glass-panel rounded-xl overflow-hidden shadow-2xl border border-violet-400/40 w-44';
    this.element.innerHTML = `
      <video class="w-44 h-[120px] object-cover bg-black/60" autoplay playsinline muted></video>
      <div class="px-2 py-1 text-[10px] text-violet-200 flex items-center justify-between gap-1">
        <span class="truncate flex-1" data-role="status">動作捕捉</span>
        <button type="button" data-action="toggle-mirror" class="px-1.5 py-0.5 rounded bg-violet-600/40 hover:bg-violet-600/70 border border-violet-400/40 text-[9px] text-violet-100 transition whitespace-nowrap" title="切換鏡像同步 / 面對面比愛心">
          🪞 鏡像
        </button>
      </div>
    `;
    this.videoElement = this.element.querySelector('video');
    this.statusElement = this.element.querySelector('[data-role="status"]');
    this.mirrorButton = this.element.querySelector('[data-action="toggle-mirror"]');

    this.mirrorButton?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof this.onToggleMirror === 'function') {
        this.onToggleMirror();
      }
    });

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
    this.isMirror = mirror;
    this.videoElement.style.transform = mirror ? 'scaleX(-1)' : 'none';
    if (this.mirrorButton) {
      this.mirrorButton.textContent = mirror ? '❤️ 面對面' : '🪞 同步';
      this.mirrorButton.title = mirror
        ? '目前為鏡像面對面模式 (左右分站不重疊、側身面對面互動、合體比心)。點擊切換為同向同步模式！'
        : '目前為同向同步模式 (居中 1:1 同向動作)。點擊切換為鏡像面對面模式！';
    }
  }

  setStatus(text) {
    if (this.statusElement.textContent !== text) this.statusElement.textContent = text;
  }
}

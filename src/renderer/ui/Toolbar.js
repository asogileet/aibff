export class Toolbar {
  constructor(container, handlers) {
    this.container = container;
    this.handlers = handlers || {}; // { onMic, onChat, onCostume, onLeave, onSettings }
    this.element = null;
    this.hideTimeout = null;

    this._render();
    this._bindAutoHide();
  }

  _render() {
    this.element = document.createElement('div');
    this.element.id = 'bottomToolbar';
    this.element.className = 'glass-panel rounded-full px-5 py-2 flex items-center space-x-4 shadow-2xl transition-all duration-300 border-slate-700/60 hover:border-pink-500/40 opacity-30 hover:opacity-100';

    this.element.innerHTML = `
      <button id="btnMic" class="flex items-center space-x-1 text-slate-300 hover:text-pink-400 p-2 rounded-full hover:bg-white/5 transition" title="即時語音對話 (Faster-Whisper)">
        <span class="text-lg">🎤</span>
        <span class="text-xs hidden md:inline">語音</span>
      </button>
      <button id="btnChat" class="flex items-center space-x-1 text-slate-300 hover:text-pink-400 p-2 rounded-full hover:bg-white/5 transition" title="文字聊天視窗">
        <span class="text-lg">💬</span>
        <span class="text-xs hidden md:inline">對話</span>
      </button>
      <button id="btnCostume" class="flex items-center space-x-1 text-slate-300 hover:text-pink-400 p-2 rounded-full hover:bg-white/5 transition" title="換裝系統 (5套VRM)">
        <span class="text-lg">👗</span>
        <span class="text-xs hidden md:inline">換裝</span>
      </button>
      <button id="btnLeave" class="flex items-center space-x-1 text-slate-300 hover:text-pink-400 p-2 rounded-full hover:bg-white/5 transition" title="休息 / 召出愛心掛件">
        <span class="text-lg">👋</span>
        <span class="text-xs hidden md:inline">休息</span>
      </button>
      <button id="btnSettings" class="flex items-center space-x-1 text-slate-300 hover:text-pink-400 p-2 rounded-full hover:bg-white/5 transition" title="應用程式配置與系統設定">
        <span class="text-lg">⚙️</span>
        <span class="text-xs hidden md:inline">設定</span>
      </button>
    `;

    this.container.appendChild(this.element);

    // Bind click events
    this.element.querySelector('#btnMic').addEventListener('click', () => this.handlers.onMic?.());
    this.element.querySelector('#btnChat').addEventListener('click', () => this.handlers.onChat?.());
    this.element.querySelector('#btnCostume').addEventListener('click', () => this.handlers.onCostume?.());
    this.element.querySelector('#btnLeave').addEventListener('click', () => this.handlers.onLeave?.());
    this.element.querySelector('#btnSettings').addEventListener('click', () => this.handlers.onSettings?.());
  }

  _bindAutoHide() {
    this.element.addEventListener('mouseenter', () => {
      clearTimeout(this.hideTimeout);
      this.element.classList.remove('opacity-30');
      this.element.classList.add('opacity-100');
    });

    this.element.addEventListener('mouseleave', () => {
      this.hideTimeout = setTimeout(() => {
        this.element.classList.remove('opacity-100');
        this.element.classList.add('opacity-30');
      }, 1500);
    });
  }

  setMicActive(active) {
    const btn = this.element.querySelector('#btnMic');
    if (!btn) return;
    if (active) {
      btn.classList.add('text-pink-400', 'bg-pink-500/30', 'animate-pulse', 'ring-2', 'ring-pink-500/60');
      btn.title = '正在錄音中... 再次點擊結束說話';
    } else {
      btn.classList.remove('text-pink-400', 'bg-pink-500/30', 'animate-pulse', 'ring-2', 'ring-pink-500/60');
      btn.title = '即時語音對話 (Faster-Whisper)';
    }
  }
}


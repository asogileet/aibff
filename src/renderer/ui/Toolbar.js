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
    this.element.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto glass-panel rounded-full px-3 sm:px-5 py-1.5 sm:py-2 flex items-center justify-around sm:justify-start space-x-1 sm:space-x-4 shadow-2xl transition-all duration-300 border-slate-700/60 hover:border-pink-500/40 opacity-90 sm:opacity-40 sm:hover:opacity-100 max-w-[95vw] overflow-x-auto';

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
      <button id="btnAction" class="flex items-center space-x-1 text-slate-300 hover:text-pink-400 p-2 rounded-full hover:bg-white/5 transition" title="動作庫選單 (10大標準動作)">
        <span class="text-lg">💃</span>
        <span class="text-xs hidden md:inline">動作</span>
      </button>
      <button id="btnPose" class="flex items-center space-x-1 text-slate-300 hover:text-pink-400 p-2 rounded-full hover:bg-white/5 transition" title="骨架關節微調與自訂姿勢">
        <span class="text-lg">🦴</span>
        <span class="text-xs hidden md:inline">姿勢</span>
      </button>
      <button id="btnSnapshot" class="flex items-center space-x-1 text-slate-300 hover:text-pink-400 p-2 rounded-full hover:bg-white/5 transition" title="拍下高畫質 3D 照片">
        <span class="text-lg">📸</span>
        <span class="text-xs hidden md:inline">拍照</span>
      </button>
      <button id="btnAR" class="flex items-center space-x-1 text-slate-300 hover:text-emerald-400 p-2 rounded-full hover:bg-white/5 transition" title="一鍵開關筆電視訊鏡頭 AR 模式">
        <span class="text-lg">📷</span>
        <span class="text-xs hidden md:inline">AR</span>
      </button>
      <button id="btnPuppet" class="flex items-center space-x-1 text-slate-300 hover:text-cyan-400 p-2 rounded-full hover:bg-white/5 transition" title="開關手指人偶肢體拉扯互動">
        <span class="text-lg">🤏</span>
        <span class="text-xs hidden md:inline">玩偶</span>
      </button>
      <button id="btnView" class="flex items-center space-x-1 text-slate-300 hover:text-pink-400 p-2 rounded-full hover:bg-white/5 transition" title="切換視角 (半身特寫 / 全身視角)">
        <span class="text-lg">🧍</span>
        <span class="text-xs hidden md:inline">視角</span>
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
    this.element.querySelector('#btnAction').addEventListener('click', () => this.handlers.onAction?.());
    this.element.querySelector('#btnPose').addEventListener('click', () => this.handlers.onPose?.());
    this.element.querySelector('#btnSnapshot').addEventListener('click', () => this.handlers.onSnapshot?.());
    this.element.querySelector('#btnAR').addEventListener('click', () => this.handlers.onAR?.());
    this.element.querySelector('#btnPuppet').addEventListener('click', () => this.handlers.onPuppet?.());
    this.element.querySelector('#btnView').addEventListener('click', () => this.handlers.onViewToggle?.());
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

  setViewMode(mode) {
    const btn = this.element.querySelector('#btnView');
    if (!btn) return;
    if (mode === 'full') {
      btn.classList.add('text-pink-400', 'bg-pink-500/20');
      btn.title = '目前為全身視角 (點擊切換為半身特寫)';
    } else {
      btn.classList.remove('text-pink-400', 'bg-pink-500/20');
      btn.title = '目前為半身特寫 (點擊切換為全身視角)';
    }
  }

  setARActive(active) {
    const btn = this.element.querySelector('#btnAR');
    if (!btn) return;
    if (active) {
      btn.classList.add('text-emerald-300', 'bg-emerald-500/30', 'ring-2', 'ring-emerald-400/60', 'animate-pulse');
      btn.title = 'AR 視訊鏡頭運作中 (點擊關閉相機返回透明桌面)';
    } else {
      btn.classList.remove('text-emerald-300', 'bg-emerald-500/30', 'ring-2', 'ring-emerald-400/60', 'animate-pulse');
      btn.title = '一鍵開關筆電視訊鏡頭 AR 模式';
    }
  }

  setPuppetActive(active) {
    const btn = this.element.querySelector('#btnPuppet');
    if (!btn) return;
    if (active) {
      btn.classList.add('text-cyan-300', 'bg-cyan-500/30', 'ring-2', 'ring-cyan-400/60', 'animate-pulse');
      btn.title = '人偶手指拉扯互動中 (點擊關閉)';
    } else {
      btn.classList.remove('text-cyan-300', 'bg-cyan-500/30', 'ring-2', 'ring-cyan-400/60', 'animate-pulse');
      btn.title = '開關手指人偶肢體拉扯互動';
    }
  }
}


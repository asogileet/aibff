/**
 * PuppetPoseBar
 * Floating toolbar providing controls for holding sculpted poses,
 * directly saving them as custom poses, and resetting stand.
 */
export class PuppetPoseBar {
  constructor(container, puppetController, poseManager, poseModal, onShowBubble, sceneManager = null) {
    this.container = container;
    this.puppetController = puppetController;
    this.poseManager = poseManager;
    this.poseModal = poseModal;
    this.onShowBubble = onShowBubble;
    this.sceneManager = sceneManager;

    this.element = null;
    this.isVisible = false;

    this._render();
    this._bindEvents();
    this.updateState();
  }

  _render() {
    this.element = document.createElement('div');
    this.element.id = 'puppetPoseBar';
    this.element.className = 'hidden fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-auto glass-panel rounded-full px-3 py-1.5 flex items-center space-x-2 shadow-2xl border border-pink-500/40 text-xs text-slate-200 transition-all duration-300 backdrop-blur-md bg-slate-950/80';

    this.element.innerHTML = `
      <div class="flex items-center space-x-1 pl-1 pr-2 border-r border-white/10 font-bold text-pink-300 select-none">
        <span class="text-sm">🤏</span>
        <span class="text-[11px] hidden sm:inline">玩偶捏人</span>
      </div>

      <!-- Mode Toggle: Hold Pose vs Spring Back -->
      <button id="btnToggleKeepPose" class="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 transition font-medium text-[11px]" title="切換放開後是否保持姿勢">
        <span id="iconKeepPose">🧲</span>
        <span id="textKeepPose">保持姿勢</span>
      </button>

      <!-- Fullscreen Canvas Toggle Button -->
      <button id="btnToggleFullscreen" class="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-cyan-600/25 text-cyan-300 hover:bg-cyan-600/40 border border-cyan-500/40 transition font-semibold text-[11px]" title="切換全螢幕透明畫布 / 桌面小視窗 (F11)。按住右鍵旋轉視角，按住 Shift+右鍵或中鍵可平移人偶位置！">
        <span id="iconFullscreen">🖥️</span>
        <span id="textFullscreen">全螢幕</span>
      </button>

      <!-- Docking Position Preset Buttons (Quick Pan) -->
      <div id="dockPresets" class="flex items-center space-x-1 px-1.5 py-0.5 rounded-full bg-slate-900/90 border border-slate-700/60 text-[10px]">
        <button id="btnDockLeft" class="px-1.5 py-0.5 rounded hover:bg-slate-700 text-slate-300 transition" title="平移人偶至左側">靠左</button>
        <button id="btnDockCenter" class="px-1.5 py-0.5 rounded hover:bg-slate-700 text-slate-300 transition font-semibold" title="平移人偶至畫面中央">置中</button>
        <button id="btnDockRight" class="px-1.5 py-0.5 rounded hover:bg-slate-700 text-slate-300 transition" title="平移人偶至右側">靠右</button>
      </div>

      <!-- Save Current Pose Button -->
      <button id="btnSavePuppetPose" class="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-pink-600/30 text-pink-300 hover:bg-pink-600/50 hover:text-white border border-pink-500/40 transition font-semibold text-[11px] shadow" title="將當前肢體拉扯形狀直接儲存為新姿勢">
        <span>💾</span>
        <span>存為新姿勢</span>
      </button>

      <!-- Reset Stand Button -->
      <button id="btnResetPuppetPose" class="flex items-center space-x-1 px-2 py-1 rounded-full bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition text-[11px]" title="平滑復位至標準待機站姿">
        <span>🔄</span>
        <span>復位</span>
      </button>

      <!-- Open Pose Modal -->
      <button id="btnOpenPoseModal" class="flex items-center space-x-1 px-2 py-1 rounded-full bg-slate-800 text-slate-300 hover:text-pink-300 hover:bg-slate-700 transition text-[11px]" title="開啟自訂姿勢庫微調選單">
        <span>🦴</span>
      </button>
    `;

    this.container.appendChild(this.element);
  }

  _bindEvents() {
    const btnToggleKeep = this.element.querySelector('#btnToggleKeepPose');
    const btnFullscreen = this.element.querySelector('#btnToggleFullscreen');
    const btnSave = this.element.querySelector('#btnSavePuppetPose');
    const btnReset = this.element.querySelector('#btnResetPuppetPose');
    const btnOpenModal = this.element.querySelector('#btnOpenPoseModal');

    btnFullscreen.addEventListener('click', async () => {
      if (window.electronAPI?.toggleFullscreen) {
        const isFull = await window.electronAPI.toggleFullscreen();
        this.setFullscreenState(isFull);
        if (isFull) {
          this.onShowBubble?.('🖥️ 已切換為全螢幕透明畫布！整個螢幕都是活動空間～✨（按住右鍵旋轉，Shift+右鍵或中鍵可平移）', 'happy');
        } else {
          this.onShowBubble?.('已切換回桌面懸浮小視窗～', 'happy');
        }
      }
    });

    const btnDockLeft = this.element.querySelector('#btnDockLeft');
    const btnDockCenter = this.element.querySelector('#btnDockCenter');
    const btnDockRight = this.element.querySelector('#btnDockRight');

    btnDockLeft?.addEventListener('click', () => {
      this.sceneManager?.setCameraPanPreset('left');
      this.onShowBubble?.('人偶已平移靠左站立～', 'happy');
    });

    btnDockCenter?.addEventListener('click', () => {
      this.sceneManager?.setCameraPanPreset('center');
      this.onShowBubble?.('人偶已回到畫面中央～', 'happy');
    });

    btnDockRight?.addEventListener('click', () => {
      this.sceneManager?.setCameraPanPreset('right');
      this.onShowBubble?.('人偶已平移靠右停靠～', 'happy');
    });

    btnToggleKeep.addEventListener('click', () => {
      const nextState = !this.puppetController.keepPoseOnRelease;
      this.puppetController.setKeepPoseOnRelease(nextState);
      this.updateState();

      if (nextState) {
        this.onShowBubble?.('🧲 已開啟「保持姿勢」：放開滑鼠時將固定拉扯肢體，方便捏人雕塑！', 'happy');
      } else {
        this.onShowBubble?.('➰ 已開啟「彈簧回彈」：放開滑鼠時人偶將自動復位～', 'happy');
      }
    });

    btnSave.addEventListener('click', () => {
      this.promptSavePose();
    });

    btnReset.addEventListener('click', () => {
      this.puppetController.resetPose(true);
      this.onShowBubble?.('已平滑恢復標準待機站姿～', 'happy');
    });

    btnOpenModal.addEventListener('click', () => {
      if (this.poseModal) {
        this.poseModal.toggle(true);
      }
    });
  }

  updateState() {
    const isKeeping = this.puppetController?.keepPoseOnRelease ?? true;
    const btn = this.element.querySelector('#btnToggleKeepPose');
    const icon = this.element.querySelector('#iconKeepPose');
    const text = this.element.querySelector('#textKeepPose');

    if (isKeeping) {
      btn.className = 'flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-500/25 text-emerald-300 hover:bg-emerald-500/35 border border-emerald-500/50 transition font-medium text-[11px] ring-1 ring-emerald-500/30';
      icon.textContent = '🧲';
      text.textContent = '保持姿勢';
    } else {
      btn.className = 'flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-slate-700 transition font-medium text-[11px]';
      icon.textContent = '➰';
      text.textContent = '彈簧回彈';
    }
  }

  setFullscreenState(isFull) {
    const btn = this.element.querySelector('#btnToggleFullscreen');
    const icon = this.element.querySelector('#iconFullscreen');
    const text = this.element.querySelector('#textFullscreen');
    if (!btn || !icon || !text) return;

    if (isFull) {
      btn.className = 'flex items-center space-x-1 px-2.5 py-1 rounded-full bg-cyan-500/30 text-cyan-300 hover:bg-cyan-500/40 border border-cyan-400/60 transition font-semibold text-[11px] ring-1 ring-cyan-500/30';
      icon.textContent = '🔲';
      text.textContent = '小視窗';
    } else {
      btn.className = 'flex items-center space-x-1 px-2.5 py-1 rounded-full bg-cyan-600/25 text-cyan-300 hover:bg-cyan-600/40 border border-cyan-500/40 transition font-semibold text-[11px]';
      icon.textContent = '🖥️';
      text.textContent = '全螢幕';
    }
  }

  promptSavePose() {
    const existingCount = this.poseManager?.savedPoses?.length || 0;
    const defaultName = `玩偶姿勢 #${existingCount + 1}`;
    const name = window.prompt('請輸入新姿勢名稱：', defaultName);

    if (name === null) return; // Cancelled
    const trimmed = name.trim() || defaultName;

    try {
      this.puppetController.saveCurrentPose(trimmed);
      if (this.poseModal?.refreshSavedPoses) {
        this.poseModal.refreshSavedPoses();
      }
      this.onShowBubble?.(`✨ 太棒了！已將當前姿勢儲存為「${trimmed}」！💖`, 'happy');
    } catch (err) {
      console.error('[PuppetPoseBar] Save pose failed:', err);
      this.onShowBubble?.('儲存姿勢失敗：' + err.message, 'surprised');
    }
  }

  setVisible(visible) {
    this.isVisible = visible;
    if (visible) {
      this.element.classList.remove('hidden');
      this.updateState();
    } else {
      this.element.classList.add('hidden');
    }
  }
}

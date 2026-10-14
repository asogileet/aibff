/**
 * BouncinessModal
 * Interactive control panel for adjusting avatar fling physics bounciness / elasticity.
 */
export class BouncinessModal {
  constructor(container, mascotPhysicsController, onShowBubble = null) {
    this.container = container;
    this.physicsController = mascotPhysicsController;
    this.onShowBubble = onShowBubble;
    this.element = null;
    this.isOpen = false;

    this._render();
  }

  _render() {
    this.element = document.createElement('div');
    this.element.id = 'bouncinessModal';
    this.element.className = 'hidden fixed bottom-20 left-1/2 -translate-x-1/2 glass-panel rounded-2xl p-4 shadow-2xl border border-amber-500/40 w-[92vw] max-w-sm z-50 pointer-events-auto transition-all duration-300';

    const currentVal = this.physicsController ? this.physicsController.getBounciness() : 0.75;
    const currentPercent = Math.round(currentVal * 100);

    this.element.innerHTML = `
      <div class="flex items-center justify-between pb-2 mb-3 border-b border-white/10">
        <div class="flex items-center space-x-2">
          <span class="text-lg">🏀</span>
          <span class="text-xs font-semibold text-amber-300">碰撞彈力與甩飛設定</span>
        </div>
        <button id="btnCloseBounce" class="text-slate-400 hover:text-white text-xs p-1">✕</button>
      </div>

      <!-- Current Value Badge -->
      <div class="flex items-center justify-between mb-3 px-1">
        <span class="text-xs text-slate-300">反彈彈性指數</span>
        <span id="badgeBounceLevel" class="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
          ${this._getLabel(currentVal)} (${currentPercent}%)
        </span>
      </div>

      <!-- Slider Control -->
      <div class="mb-4 px-1">
        <input id="sliderBounce" type="range" min="0" max="1.2" step="0.05" value="${currentVal}"
          class="w-full h-2 bg-slate-700/80 rounded-lg appearance-none cursor-pointer accent-amber-400" />
        <div class="flex justify-between text-[10px] text-slate-400 mt-1">
          <span>0% (黏土)</span>
          <span>50% (中等)</span>
          <span>75% (Q彈)</span>
          <span>100% (極限)</span>
          <span>120% (狂暴)</span>
        </div>
      </div>

      <!-- Quick Preset Pills -->
      <div class="grid grid-cols-5 gap-1 mb-3 text-[11px]">
        <button data-preset="0.0" class="btn-preset-bounce py-1 rounded bg-slate-800/60 hover:bg-amber-500/30 border border-slate-600/40 text-slate-300 text-center transition">
          0%<br><span class="text-[9px] text-slate-400">黏土</span>
        </button>
        <button data-preset="0.35" class="btn-preset-bounce py-1 rounded bg-slate-800/60 hover:bg-amber-500/30 border border-slate-600/40 text-slate-300 text-center transition">
          35%<br><span class="text-[9px] text-slate-400">軟綿</span>
        </button>
        <button data-preset="0.75" class="btn-preset-bounce py-1 rounded bg-amber-950/60 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-center font-bold transition">
          75%<br><span class="text-[9px] text-amber-300">Q彈</span>
        </button>
        <button data-preset="0.95" class="btn-preset-bounce py-1 rounded bg-slate-800/60 hover:bg-amber-500/30 border border-slate-600/40 text-slate-300 text-center transition">
          95%<br><span class="text-[9px] text-slate-400">超彈</span>
        </button>
        <button data-preset="1.15" class="btn-preset-bounce py-1 rounded bg-slate-800/60 hover:bg-amber-500/30 border border-slate-600/40 text-slate-300 text-center transition">
          115%<br><span class="text-[9px] text-slate-400">狂暴</span>
        </button>
      </div>

      <!-- Feature Guide -->
      <div class="bg-black/30 rounded-xl p-2.5 text-[11px] text-slate-300 space-y-1 border border-white/5">
        <div class="flex items-start space-x-1.5">
          <span>🖐️</span>
          <span><b>手部吸附</b>：將手伸向鏡頭靠近人偶，人偶會自動黏到你的手心！</span>
        </div>
        <div class="flex items-start space-x-1.5">
          <span>💨</span>
          <span><b>甩手射出</b>：快速揮動手腕或縮手，人偶會帶著加速度飛射出去！</span>
        </div>
        <div class="flex items-start space-x-1.5">
          <span>💥</span>
          <span><b>四邊反彈</b>：撞擊螢幕左、右、天花板或地板時依彈力反彈！</span>
        </div>
      </div>
    `;

    this.container.appendChild(this.element);

    // Event Bindings
    const slider = this.element.querySelector('#sliderBounce');
    const badge = this.element.querySelector('#badgeBounceLevel');
    const closeBtn = this.element.querySelector('#btnCloseBounce');

    slider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.setBounciness(val, false);
    });

    closeBtn.addEventListener('click', () => this.hide());

    this.element.querySelectorAll('.btn-preset-bounce').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = parseFloat(btn.dataset.preset);
        slider.value = val;
        this.setBounciness(val, true);
      });
    });
  }

  _getLabel(val) {
    if (val <= 0.05) return '🧱 黏土無彈';
    if (val <= 0.45) return '🧸 軟綿布偶';
    if (val <= 0.85) return '🏀 Q彈橡膠';
    if (val <= 1.05) return '⚡ 超彈力球';
    return '🚀 狂暴反彈';
  }

  setBounciness(val, notify = true) {
    if (!this.physicsController) return;
    const finalVal = this.physicsController.setBounciness(val);
    const badge = this.element.querySelector('#badgeBounceLevel');
    const slider = this.element.querySelector('#sliderBounce');

    if (badge) {
      badge.textContent = `${this._getLabel(finalVal)} (${Math.round(finalVal * 100)}%)`;
    }
    if (slider) {
      slider.value = finalVal;
    }

    if (notify && typeof this.onShowBubble === 'function') {
      const label = this._getLabel(finalVal);
      this.onShowBubble(`🏀 彈力已設為 ${label} (${Math.round(finalVal * 100)}%)！快把人偶甩出去試試～`, 'happy');
    }
  }

  toggle() {
    if (this.isOpen) this.hide();
    else this.show();
  }

  show() {
    this.element.classList.remove('hidden');
    this.isOpen = true;
    const curVal = this.physicsController ? this.physicsController.getBounciness() : 0.75;
    const slider = this.element.querySelector('#sliderBounce');
    const badge = this.element.querySelector('#badgeBounceLevel');
    if (slider) slider.value = curVal;
    if (badge) badge.textContent = `${this._getLabel(curVal)} (${Math.round(curVal * 100)}%)`;
  }

  hide() {
    this.element.classList.add('hidden');
    this.isOpen = false;
  }
}

export class CostumeSelector {
  constructor(container, onSelectCostume) {
    this.container = container;
    this.onSelectCostume = onSelectCostume;
    this.element = null;

    this.costumes = [
      { id: 'casual', name: '日常便服', icon: '👚', file: 'costume_casual.vrm' },
      { id: 'school', name: '青春水手服', icon: '🎀', file: 'costume_school.vrm' },
      { id: 'stylish', name: '優雅時尚裝', icon: '👗', file: 'costume_stylish.vrm' },
      { id: 'gothic', name: '哥德蘿莉裝', icon: '🖤', file: 'costume_gothic.vrm' },
      { id: 'seed', name: '未來科技裝 (Seed)', icon: '✨', file: 'costume_seed.vrm' },
      { id: 'ayame', name: '百鬼綾目 (Ayame)', icon: '😈', file: 'ayame.vrm' },
      { id: 'mint', name: '泳裝薄荷 (Mint)', icon: '🩱', file: 'mint_swimsuit.vrm' }
    ];

    this._render();
  }

  _render() {
    this.element = document.createElement('div');
    this.element.id = 'costumeMenu';
    this.element.className = 'hidden fixed bottom-20 left-1/2 -translate-x-1/2 glass-panel rounded-2xl p-4 shadow-2xl border border-indigo-500/40 w-[92vw] max-w-sm z-50 pointer-events-auto max-h-[80vh] overflow-y-auto';

    let buttonsHtml = '';
    for (const item of this.costumes) {
      buttonsHtml += `
        <button data-costume="${item.id}" class="costume-item-btn p-2 rounded-lg bg-indigo-900/40 hover:bg-indigo-600/40 active:bg-pink-600/50 border border-indigo-400/30 text-left transition flex items-center space-x-2 cursor-pointer">
          <span class="text-base select-none">${item.icon}</span>
          <div class="pointer-events-none select-none">
            <div class="font-medium text-slate-200 text-xs">${item.name}</div>
            <div class="text-[10px] text-slate-400">${item.file}</div>
          </div>
        </button>
      `;
    }

    this.element.innerHTML = `
      <div class="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
        <span class="text-xs font-semibold text-indigo-300" id="costumeTargetTitle">👗 角色與外觀快速切換</span>
        <button id="btnCloseCostume" class="text-slate-400 hover:text-white p-1 text-sm cursor-pointer">✕</button>
      </div>
      <div class="grid grid-cols-2 gap-2 text-xs">
        ${buttonsHtml}
      </div>
    `;

    this.container.appendChild(this.element);

    const closeBtn = this.element.querySelector('#btnCloseCostume');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle(false);
    });

    this.element.querySelectorAll('.costume-item-btn').forEach((btn) => {
      const handleSelect = (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-costume');
        if (typeof this.onSelectCostume === 'function') {
          this.onSelectCostume(id);
        }
        this.toggle(false);
      };

      btn.addEventListener('click', handleSelect);
    });
  }

  toggle(visible = null) {
    if (visible === null) {
      this.element.classList.toggle('hidden');
    } else if (visible) {
      this.element.classList.remove('hidden');
    } else {
      this.element.classList.add('hidden');
    }
  }

  setTargetAvatarTitle(title) {
    const titleEl = this.element?.querySelector('#costumeTargetTitle');
    if (titleEl) {
      titleEl.innerText = title ? `👗 為「${title}」更換外觀` : '👗 角色與外觀快速切換';
    }
  }
}


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
    this.element.className = 'hidden absolute bottom-20 left-1/2 -translate-x-1/2 glass-panel rounded-2xl p-4 shadow-2xl border border-indigo-500/40 w-80 z-40';

    let buttonsHtml = '';
    for (const item of this.costumes) {
      buttonsHtml += `
        <button data-costume="${item.id}" class="costume-item-btn p-2 rounded-lg bg-indigo-900/40 hover:bg-indigo-600/40 border border-indigo-400/30 text-left transition flex items-center space-x-2">
          <span class="text-base">${item.icon}</span>
          <div>
            <div class="font-medium text-slate-200 text-xs">${item.name}</div>
            <div class="text-[10px] text-slate-400">${item.file}</div>
          </div>
        </button>
      `;
    }

    this.element.innerHTML = `
      <div class="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
        <span class="text-xs font-semibold text-indigo-300">👗 角色與外觀快速切換</span>
        <button id="btnCloseCostume" class="text-slate-400 hover:text-white text-xs">✕</button>
      </div>
      <div class="grid grid-cols-2 gap-2 text-xs">
        ${buttonsHtml}
      </div>
    `;

    this.container.appendChild(this.element);

    this.element.querySelector('#btnCloseCostume').addEventListener('click', () => this.toggle(false));

    this.element.querySelectorAll('.costume-item-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-costume');
        if (typeof this.onSelectCostume === 'function') {
          this.onSelectCostume(id);
        }
        this.toggle(false);
      });
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
}

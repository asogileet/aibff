export class ActionSelector {
  constructor(container, onSelectAction) {
    this.container = container;
    this.onSelectAction = onSelectAction;
    this.element = null;

    this.actions = [
      { id: 'stand', name: '站立待機', icon: '🧍', desc: '恢復站姿' },
      { id: 'heart_pose', name: '胸前比愛心', icon: '💖', desc: '雙手比心' },
      { id: 'wave', name: '熱情揮手', icon: '👋', desc: '打招呼' },
      { id: 'bow', name: '禮貌鞠躬', icon: '🙇‍♀️', desc: '感謝致敬' },
      { id: 'tilt_head', name: '歪頭賣萌', icon: '😽', desc: '傾頭微笑' },
      { id: 'clap', name: '鼓掌喝采', icon: '👏', desc: '拍手讚美' },
      { id: 'stretch', name: '伸個懶腰', icon: '🙆‍♀️', desc: '放鬆紓壓' },
      { id: 'cheer', name: '歡呼雀躍', icon: '🙌', desc: '跳躍慶祝' },
      { id: 'nod', name: '點頭贊同', icon: '🙆', desc: '正面認可' },
      { id: 'shake_head', name: '搖頭否定', icon: '🙅', desc: '嬌嗔拒絕' },
      { id: 'pout', name: '生氣叉腰', icon: '😤', desc: '傲嬌嬌嗔' },
      { id: 'sit', name: '坐下休息', icon: '🪑', desc: '乖巧坐著' },
      { id: 'run', name: '原地跑步', icon: '🏃', desc: '運動慢跑' },
      { id: 'jump', name: '開心跳躍', icon: '🦘', desc: '騰空跳起' },
      { id: 'squat', name: '萌萌蹲下', icon: '🧘', desc: '蹲地仰望' },
      { id: 'kneel', name: '正襟跪坐', icon: '🙇', desc: '日式正座' }
    ];

    this._render();
  }

  _render() {
    this.element = document.createElement('div');
    this.element.id = 'actionMenu';
    this.element.className = 'hidden absolute bottom-20 left-1/2 -translate-x-1/2 glass-panel rounded-2xl p-4 shadow-2xl border border-pink-500/40 w-84 z-40 max-h-96 overflow-y-auto';

    let buttonsHtml = '';
    for (const item of this.actions) {
      buttonsHtml += `
        <button data-action="${item.id}" class="action-item-btn p-2 rounded-lg bg-pink-950/40 hover:bg-pink-600/40 border border-pink-400/30 text-left transition flex items-center space-x-2">
          <span class="text-base">${item.icon}</span>
          <div>
            <div class="font-medium text-slate-200 text-xs">${item.name}</div>
            <div class="text-[10px] text-pink-300/80">${item.desc}</div>
          </div>
        </button>
      `;
    }

    this.element.innerHTML = `
      <div class="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
        <span class="text-xs font-semibold text-pink-300">💃 15 大動作庫 (互動與全身)</span>
        <button id="btnCloseAction" class="text-slate-400 hover:text-white text-xs">✕</button>
      </div>
      <div class="grid grid-cols-2 gap-2 text-xs">
        ${buttonsHtml}
      </div>
    `;

    this.container.appendChild(this.element);

    this.element.querySelector('#btnCloseAction').addEventListener('click', () => this.toggle(false));

    this.element.querySelectorAll('.action-item-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-action');
        if (typeof this.onSelectAction === 'function') {
          this.onSelectAction(id);
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

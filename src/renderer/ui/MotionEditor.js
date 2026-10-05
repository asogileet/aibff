/**
 * MotionEditor
 * Side panel for building a motion out of several poses: collect poses as
 * keyframes, set how long each transition takes, play it back, and save it.
 */
export class MotionEditor {
  constructor(container, motionManager, poseManager, onShowBubble) {
    this.container = container;
    this.motionManager = motionManager;
    this.poseManager = poseManager;
    this.onShowBubble = onShowBubble;

    this.element = null;

    this._render();
    this._bindEvents();
    this.refresh();
  }

  _render() {
    this.element = document.createElement('div');
    this.element.id = 'motionEditor';
    this.element.className = 'hidden fixed top-36 left-3 bottom-20 w-[300px] max-w-[88vw] glass-panel rounded-2xl p-3.5 shadow-2xl border border-pink-500/40 z-50 pointer-events-auto overflow-y-auto custom-scrollbar transition-all duration-300';

    this.element.innerHTML = `
      <div class="flex items-center justify-between pb-2 mb-2.5 border-b border-white/10">
        <div class="flex items-center gap-1.5">
          <span class="text-base">🎬</span>
          <span class="text-xs font-bold text-pink-300">動作編輯・連續姿勢播放</span>
        </div>
        <button id="btnCloseMotionEditor" class="text-slate-400 hover:text-white text-xs px-2 py-0.5">✕</button>
      </div>

      <!-- Keyframe list -->
      <div class="bg-slate-900/80 rounded-xl p-2.5 border border-slate-800 mb-3 space-y-2">
        <div class="flex justify-between items-center">
          <span class="text-[11px] font-semibold text-pink-300">姿勢序列:</span>
          <button id="btnClearKeyframes" class="text-[10px] text-slate-400 hover:text-rose-300 underline">全部清除</button>
        </div>
        <div id="motionKeyframeList" class="space-y-1 max-h-56 overflow-y-auto custom-scrollbar pr-1">
          <!-- Populated by JS -->
        </div>
        <button id="btnAddKeyframe" class="w-full px-3 py-1.5 bg-pink-600 hover:bg-pink-500 text-white rounded-lg text-xs font-semibold shadow transition" title="把人偶現在的姿勢加到序列最後">
          ＋ 加入目前姿勢
        </button>
        <div class="flex gap-1.5">
          <select id="motionPoseSelect" class="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-lg p-1 text-[11px] text-slate-200 focus:outline-none focus:border-pink-500"></select>
          <button id="btnAddSavedPose" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] transition whitespace-nowrap" title="把已存姿勢加到序列最後">
            加入已存姿勢
          </button>
        </div>
      </div>

      <!-- Playback -->
      <div class="bg-slate-900/80 rounded-xl p-2.5 border border-slate-800 mb-3 flex items-center gap-2">
        <button id="btnPlayMotion" class="flex-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition">
          ▶ 播放
        </button>
        <label class="flex items-center gap-1 text-[11px] text-slate-300 select-none cursor-pointer whitespace-nowrap">
          <input id="chkLoopMotion" type="checkbox" class="accent-pink-500" />
          <span>🔁 循環</span>
        </label>
      </div>

      <!-- Save motion -->
      <div class="bg-slate-900/80 rounded-xl p-2.5 border border-slate-800 mb-3 space-y-2">
        <label class="text-[11px] font-semibold text-pink-300 block">儲存為動作:</label>
        <div class="flex gap-2">
          <input id="inputMotionName" type="text" placeholder="輸入動作名稱 (例如: 揮手舞)" class="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-pink-500" />
          <button id="btnSaveMotion" class="px-3 py-1 bg-pink-600 hover:bg-pink-500 text-white rounded-lg text-xs font-semibold shadow transition whitespace-nowrap">
            儲存動作
          </button>
        </div>
      </div>

      <!-- Saved motions -->
      <div class="space-y-1.5">
        <div class="flex justify-between items-center text-xs">
          <span class="font-semibold text-slate-300 text-[11px]">🎞️ 已存動作:</span>
          <span class="text-[10px] text-slate-500 font-mono">支援斜線指令 /motion</span>
        </div>
        <div id="savedMotionList" class="space-y-1 max-h-36 overflow-y-auto custom-scrollbar pr-1">
          <!-- Populated by JS -->
        </div>
      </div>
    `;

    this.container.appendChild(this.element);
  }

  _bindEvents() {
    this.keyframeList = this.element.querySelector('#motionKeyframeList');
    this.savedList = this.element.querySelector('#savedMotionList');
    this.poseSelect = this.element.querySelector('#motionPoseSelect');
    this.btnPlay = this.element.querySelector('#btnPlayMotion');
    this.chkLoop = this.element.querySelector('#chkLoopMotion');
    this.inputName = this.element.querySelector('#inputMotionName');

    this.element.querySelector('#btnCloseMotionEditor').addEventListener('click', () => this.toggle(false));

    // Poses may have been saved elsewhere while this panel was open
    this.element.addEventListener('mouseenter', () => this.refreshPoseOptions());

    this.element.querySelector('#btnAddKeyframe').addEventListener('click', () => {
      try {
        const index = this.motionManager.addKeyframeFromCurrent();
        this.onShowBubble?.(`已加入第 ${index + 1} 個姿勢！再擺下一個姿勢繼續加入吧～`, 'happy');
      } catch (err) {
        this.onShowBubble?.('未能讀取到人偶姿態，請確認模型已載入完成。', 'sad');
      }
    });

    this.element.querySelector('#btnAddSavedPose').addEventListener('click', () => {
      const pose = this.poseManager.getSavedPoses().find((p) => p.id === this.poseSelect.value);
      if (pose) this.motionManager.addKeyframeFromPose(pose);
    });

    this.element.querySelector('#btnClearKeyframes').addEventListener('click', () => {
      this.motionManager.clearKeyframes();
    });

    this.btnPlay.addEventListener('click', () => {
      if (this.motionManager.isPlaying) {
        this.motionManager.stop();
        return;
      }
      if (!this.motionManager.play({ loop: this.chkLoop.checked })) {
        this.onShowBubble?.('請先加入至少一個姿勢再播放哦～', 'shy');
      }
    });

    const handleSaveMotion = () => {
      const name = this.inputName.value.trim();
      if (!name) {
        this.onShowBubble?.('請先輸入動作名稱再進行儲存哦～', 'shy');
        this.inputName.focus();
        return;
      }
      if (this.motionManager.keyframes.length < 2) {
        this.onShowBubble?.('一個動作至少需要 2 個姿勢哦～', 'shy');
        return;
      }
      this.motionManager.saveMotion(name, this.chkLoop.checked);
      this.refreshSavedMotions();
      this.onShowBubble?.(`動作「${name}」已成功儲存！`, 'happy');
    };

    this.element.querySelector('#btnSaveMotion').addEventListener('click', handleSaveMotion);
    this.inputName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveMotion();
      }
    });
  }

  /** Redraws the keyframe list and play button from the manager's state. */
  refresh() {
    const { keyframes, isPlaying, currentIndex } = this.motionManager;

    this.btnPlay.textContent = isPlaying ? '⏹ 停止' : '▶ 播放';
    this.btnPlay.className = isPlaying
      ? 'flex-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow transition'
      : 'flex-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition';

    this.keyframeList.innerHTML = '';
    if (keyframes.length === 0) {
      const hint = document.createElement('div');
      hint.className = 'text-[10px] text-slate-500 py-2 text-center';
      hint.textContent = '擺好姿勢後按「＋ 加入目前姿勢」，重複幾次就能串成動作';
      this.keyframeList.appendChild(hint);
      return;
    }

    keyframes.forEach((keyframe, index) => {
      const isActive = isPlaying && index === currentIndex;
      const row = document.createElement('div');
      row.className = `flex items-center gap-1 p-1.5 rounded-lg border transition text-[11px] ${isActive ? 'bg-pink-600/30 border-pink-400' : 'bg-slate-950/70 border-slate-800'}`;
      row.innerHTML = `
        <button class="btnShowKeyframe px-2 py-0.5 rounded bg-pink-600/30 text-pink-300 hover:bg-pink-600 hover:text-white font-medium transition whitespace-nowrap" title="讓人偶擺出這個姿勢">姿勢 ${index + 1}</button>
        <input class="inputKeyframeSeconds w-12 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[11px] text-slate-200 text-right focus:outline-none focus:border-pink-500" type="number" min="0.1" max="10" step="0.1" value="${keyframe.duration}" title="從上一個姿勢移動到這個姿勢所花的秒數" />
        <span class="text-slate-500">秒</span>
        <span class="flex-1"></span>
        <button class="btnUpdateKeyframe text-slate-400 hover:text-emerald-300 px-0.5" title="用人偶目前的姿勢覆蓋這一格">⟳</button>
        <button class="btnMoveUp text-slate-400 hover:text-white px-0.5" title="往前移">↑</button>
        <button class="btnMoveDown text-slate-400 hover:text-white px-0.5" title="往後移">↓</button>
        <button class="btnRemoveKeyframe text-slate-500 hover:text-rose-400 px-0.5" title="刪除這一格">✕</button>
      `;

      row.querySelector('.btnShowKeyframe').addEventListener('click', () => this.motionManager.showKeyframe(index));
      row.querySelector('.inputKeyframeSeconds').addEventListener('change', (e) => {
        e.target.value = this.motionManager.setKeyframeDuration(index, e.target.value);
      });
      row.querySelector('.btnUpdateKeyframe').addEventListener('click', () => {
        try {
          this.motionManager.updateKeyframeFromCurrent(index);
          this.onShowBubble?.(`已用目前姿勢更新「姿勢 ${index + 1}」！`, 'happy');
        } catch (err) {
          this.onShowBubble?.('未能讀取到人偶姿態，請確認模型已載入完成。', 'sad');
        }
      });
      row.querySelector('.btnMoveUp').addEventListener('click', () => this.motionManager.moveKeyframe(index, -1));
      row.querySelector('.btnMoveDown').addEventListener('click', () => this.motionManager.moveKeyframe(index, 1));
      row.querySelector('.btnRemoveKeyframe').addEventListener('click', () => this.motionManager.removeKeyframe(index));

      this.keyframeList.appendChild(row);
    });
  }

  refreshPoseOptions() {
    this.poseSelect.innerHTML = '';
    this.poseManager.getSavedPoses().forEach((pose) => {
      const option = document.createElement('option');
      option.value = pose.id;
      option.textContent = pose.name;
      this.poseSelect.appendChild(option);
    });
  }

  refreshSavedMotions() {
    this.savedList.innerHTML = '';

    this.motionManager.getSavedMotions().forEach((motion) => {
      const item = document.createElement('div');
      item.className = 'flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-pink-500/40 transition text-xs';
      item.innerHTML = `
        <div class="flex items-center gap-1.5 truncate max-w-[50%]">
          <span class="text-xs">🎞️</span>
          <span class="motionName truncate text-slate-200 font-medium"></span>
        </div>
        <div class="flex items-center gap-1.5">
          <button class="btnPlaySavedMotion px-2 py-0.5 rounded bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600 hover:text-white font-medium transition text-[11px]">播放</button>
          <button class="btnEditSavedMotion px-2 py-0.5 rounded bg-pink-600/30 text-pink-300 hover:bg-pink-600 hover:text-white font-medium transition text-[11px]">編輯</button>
          <button class="btnDeleteSavedMotion text-slate-500 hover:text-rose-400 p-0.5 text-xs" title="刪除此動作">✕</button>
        </div>
      `;
      item.querySelector('.motionName').textContent = `${motion.name}${motion.loop ? ' 🔁' : ''}`;

      const loadIntoEditor = () => {
        this.motionManager.loadMotion(motion.id);
        this.inputName.value = motion.name;
        this.chkLoop.checked = Boolean(motion.loop);
      };

      item.querySelector('.btnPlaySavedMotion').addEventListener('click', () => {
        loadIntoEditor();
        this.motionManager.play({ loop: motion.loop });
      });
      item.querySelector('.btnEditSavedMotion').addEventListener('click', () => {
        loadIntoEditor();
        this.onShowBubble?.(`已載入動作「${motion.name}」，可以調整後重新儲存～`, 'happy');
      });
      item.querySelector('.btnDeleteSavedMotion').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`確定要刪除「${motion.name}」動作嗎？`)) {
          this.motionManager.deleteMotion(motion.id);
          this.refreshSavedMotions();
        }
      });

      this.savedList.appendChild(item);
    });
  }

  toggle(visible = null) {
    if (visible === null) {
      this.element.classList.toggle('hidden');
    } else {
      this.element.classList.toggle('hidden', !visible);
    }

    if (!this.element.classList.contains('hidden')) {
      this.refresh();
      this.refreshPoseOptions();
      this.refreshSavedMotions();
    }
  }
}

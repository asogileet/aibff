/**
 * MultiAvatarBar
 * Floating toolbar providing controls for managing shadow clones (multiple avatars),
 * switching active avatar slots, individual scaling, screen patrol roaming,
 * gravity drop tests, resetting positions, and broadcasting poses.
 */
export class MultiAvatarBar {
  constructor(container, avatarManager, onShowBubble) {
    this.container = container;
    this.avatarManager = avatarManager;
    this.onShowBubble = onShowBubble;

    this.element = null;
    this.isVisible = true;

    this._render();
    this._bindEvents();

    // Subscribe to avatarManager events
    this.avatarManager.onSlotsChanged = () => this.update();
    this.avatarManager.onSelectionChanged = () => this.update();

    this.update();
  }

  _render() {
    this.element = document.createElement('div');
    this.element.id = 'multiAvatarBar';
    this.element.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-40 pointer-events-auto glass-panel rounded-full px-3 py-1.5 flex items-center space-x-2 shadow-2xl border border-cyan-500/40 text-xs text-slate-200 transition-all duration-300 backdrop-blur-md bg-slate-950/85';

    this.element.innerHTML = `
      <div class="flex items-center space-x-1 pl-1 pr-2 border-r border-white/10 font-bold text-cyan-300 select-none">
        <span class="text-sm">👥</span>
        <span class="text-[11px] hidden sm:inline">影分身</span>
      </div>

      <!-- Avatar Slot Buttons List -->
      <div id="cloneSlotsContainer" class="flex items-center space-x-1.5 overflow-x-auto max-w-[220px] sm:max-w-xs py-0.5">
        <!-- Rendered dynamically -->
      </div>

      <!-- Individual Scale Controls -->
      <div class="flex items-center space-x-1 px-1.5 border-l border-white/10 select-none">
        <span class="text-slate-400 text-[11px]" title="縮放 (也可將游標懸停在人偶上直接滾動滾輪)">📏</span>
        <button id="btnScaleDown" class="w-4 h-4 flex items-center justify-center rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[10px] active:scale-95" title="縮小">-</button>
        <span id="labelCurrentScale" class="font-mono text-cyan-300 text-[11px] min-w-[26px] text-center">1.0x</span>
        <button id="btnScaleUp" class="w-4 h-4 flex items-center justify-center rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[10px] active:scale-95" title="放大">+</button>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center space-x-1 pl-1 border-l border-white/10">
        <!-- Screen Patrol Roaming -->
        <button id="btnTogglePatrol" class="flex items-center space-x-1 px-2 py-1 rounded-full bg-slate-800 hover:bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 text-[11px] transition active:scale-95" title="切換桌面漫步巡邏（在螢幕左右來回奔跑）">
          <span>🏃</span>
          <span class="hidden md:inline">巡邏</span>
        </button>

        <!-- High Drop Physics Test -->
        <button id="btnDropFromHigh" class="flex items-center space-x-1 px-2 py-1 rounded-full bg-slate-800 hover:bg-indigo-950/60 text-indigo-300 border border-indigo-500/30 text-[11px] transition active:scale-95" title="從螢幕上方高空拋落（體驗重力加速度與碰撞反彈）">
          <span>🪂</span>
          <span class="hidden lg:inline">拋落</span>
        </button>

        <!-- Add Clone -->
        <button id="btnSpawnClone" class="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-pink-500/80 to-rose-500/80 hover:from-pink-500 hover:to-rose-500 text-white font-medium text-[11px] shadow transition active:scale-95" title="召喚新分身（最多 4 人）">
          <span>✨</span>
          <span class="hidden md:inline">召喚</span>
        </button>

        <!-- Remove Clone -->
        <button id="btnRemoveClone" class="flex items-center space-x-1 px-2 py-1 rounded-full bg-slate-800 hover:bg-rose-950/60 text-rose-300 hover:text-rose-200 border border-rose-500/30 font-medium text-[11px] transition active:scale-95" title="移除選中分身（主身無法移除）">
          <span>✕</span>
          <span class="hidden md:inline">移除</span>
        </button>

        <!-- Reset Positions -->
        <button id="btnResetPositions" class="flex items-center space-x-1 px-2 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] transition" title="站位排開與姿勢重置">
          <span>📐</span>
          <span class="hidden lg:inline">重整</span>
        </button>

        <!-- Sync Pose to All -->
        <button id="btnSyncPose" class="flex items-center space-x-1 px-2 py-1 rounded-full bg-slate-800 hover:bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 text-[11px] transition" title="將當前選中人偶姿勢同步給全員">
          <span>📋</span>
          <span class="hidden lg:inline">同步</span>
        </button>
      </div>
    `;

    this.container.appendChild(this.element);
  }

  _bindEvents() {
    const btnSpawn = this.element.querySelector('#btnSpawnClone');
    const btnRemove = this.element.querySelector('#btnRemoveClone');
    const btnReset = this.element.querySelector('#btnResetPositions');
    const btnSync = this.element.querySelector('#btnSyncPose');
    const btnPatrol = this.element.querySelector('#btnTogglePatrol');
    const btnDrop = this.element.querySelector('#btnDropFromHigh');
    const btnScaleDown = this.element.querySelector('#btnScaleDown');
    const btnScaleUp = this.element.querySelector('#btnScaleUp');

    btnScaleDown.addEventListener('click', () => {
      const activeIdx = this.avatarManager.activeIndex;
      const currentScale = this.avatarManager.getScale(activeIdx);
      this.avatarManager.setScale(activeIdx, currentScale - 0.1);
      this.update();
    });

    btnScaleUp.addEventListener('click', () => {
      const activeIdx = this.avatarManager.activeIndex;
      const currentScale = this.avatarManager.getScale(activeIdx);
      this.avatarManager.setScale(activeIdx, currentScale + 0.1);
      this.update();
    });

    btnPatrol.addEventListener('click', () => {
      const activeSlot = this.avatarManager.getActiveSlot();
      const isPatrolling = this.avatarManager.togglePatrol();
      if (this.onShowBubble) {
        if (isPatrolling) {
          this.onShowBubble(`${activeSlot?.title || '人偶'}：出發～在螢幕桌面上小跑步巡邏囉！🏃`, 'happy');
        } else {
          this.onShowBubble(`${activeSlot?.title || '人偶'}：巡邏暫停，原地休息中～🍵`, 'calm');
        }
      }
      this.update();
    });

    btnDrop.addEventListener('click', () => {
      const activeSlot = this.avatarManager.getActiveSlot();
      this.avatarManager.dropAvatarFromHigh();
      if (this.onShowBubble) {
        this.onShowBubble(`${activeSlot?.title || '人偶'}：呀啊啊！從高空掉下來啦！🪂`, 'surprised');
      }
    });

    btnSpawn.addEventListener('click', async () => {
      try {
        btnSpawn.disabled = true;
        const newSlot = await this.avatarManager.spawnClone();
        if (this.onShowBubble) {
          this.onShowBubble(`忍法・影分身！召喚了${newSlot.title}～✨`, 'happy');
        }
      } catch (err) {
        if (this.onShowBubble) {
          this.onShowBubble(err.message || '無法召喚分身', 'surprised');
        }
      } finally {
        btnSpawn.disabled = false;
        this.update();
      }
    });

    btnRemove.addEventListener('click', () => {
      const activeSlot = this.avatarManager.getActiveSlot();
      const title = activeSlot?.title || '分身';
      const success = this.avatarManager.removeClone();
      if (success) {
        if (this.onShowBubble) {
          this.onShowBubble(`已收回${title}～`, 'happy');
        }
      } else {
        if (this.onShowBubble) {
          this.onShowBubble('主身無法移除喔！至少需保留一個人偶。', 'shy');
        }
      }
    });

    btnReset.addEventListener('click', () => {
      this.avatarManager.resetPositions();
      if (this.onShowBubble) {
        this.onShowBubble('所有人偶已重新均勻排開站位，物理狀態已重置！', 'happy');
      }
    });

    btnSync.addEventListener('click', () => {
      this.avatarManager.syncPoseToAll();
      if (this.onShowBubble) {
        this.onShowBubble('已將當前姿勢同步套用至所有人偶～齊步走！💃', 'happy');
      }
    });
  }

  update() {
    if (!this.element) return;

    const slotsContainer = this.element.querySelector('#cloneSlotsContainer');
    const btnSpawn = this.element.querySelector('#btnSpawnClone');
    const btnRemove = this.element.querySelector('#btnRemoveClone');
    const btnPatrol = this.element.querySelector('#btnTogglePatrol');
    const labelScale = this.element.querySelector('#labelCurrentScale');

    slotsContainer.innerHTML = '';

    const slots = this.avatarManager.getAllSlots();
    const activeIdx = this.avatarManager.activeIndex;
    const activeSlot = this.avatarManager.getActiveSlot();

    if (activeSlot && labelScale) {
      labelScale.textContent = `${(activeSlot.scale || 1.0).toFixed(1)}x`;
    }

    if (btnPatrol && activeSlot) {
      const isPatrol = activeSlot.physicsState === 'patrol';
      btnPatrol.classList.toggle('bg-emerald-600/40', isPatrol);
      btnPatrol.classList.toggle('border-emerald-400', isPatrol);
    }

    slots.forEach((slot, idx) => {
      const isSelected = idx === activeIdx;
      const btn = document.createElement('button');
      btn.className = `flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition active:scale-95 whitespace-nowrap ${
        isSelected
          ? 'bg-cyan-500/30 text-cyan-200 border-2 border-cyan-400 shadow-md shadow-cyan-500/25 font-bold'
          : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-700/80 hover:bg-slate-800'
      }`;

      // Costume indicator dot
      const colorDot = isSelected ? 'bg-cyan-400 animate-pulse' : 'bg-slate-500';
      const scaleText = (slot.scale && slot.scale !== 1.0) ? ` (${slot.scale.toFixed(1)}x)` : '';
      btn.innerHTML = `
        <span class="w-1.5 h-1.5 rounded-full ${colorDot}"></span>
        <span>${slot.title}${scaleText}</span>
      `;

      btn.addEventListener('click', () => {
        this.avatarManager.selectAvatar(idx);
        if (this.onShowBubble) {
          this.onShowBubble(`切換控制：${slot.title}！`, 'happy');
        }
      });

      slotsContainer.appendChild(btn);
    });

    // Disable spawn if maximum reached
    const isMax = slots.length >= 4;
    btnSpawn.disabled = isMax;
    btnSpawn.classList.toggle('opacity-40', isMax);
    btnSpawn.classList.toggle('cursor-not-allowed', isMax);

    // Disable remove if only 1 avatar remains
    const isSingle = slots.length <= 1;
    btnRemove.disabled = isSingle;
    btnRemove.classList.toggle('opacity-40', isSingle);
    btnRemove.classList.toggle('cursor-not-allowed', isSingle);
  }

  setVisible(visible) {
    this.isVisible = visible;
    if (this.element) {
      this.element.classList.toggle('hidden', !visible);
    }
  }

  toggle() {
    this.setVisible(!this.isVisible);
    return this.isVisible;
  }
}

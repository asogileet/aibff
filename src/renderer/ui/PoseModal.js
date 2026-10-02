/**
 * PoseModal
 * UI modal for bone joint inspection, 3-axis rotation tuning,
 * camera quick angles, and custom pose shortcut management.
 */
export class PoseModal {
  constructor(container, poseManager, sceneManager, onShowBubble) {
    this.container = container;
    this.poseManager = poseManager;
    this.sceneManager = sceneManager;
    this.onShowBubble = onShowBubble;

    this.element = null;
    this.selectedJoint = 'head';

    this._render();
    this._bindEvents();
    this.refreshSavedPoses();
  }

  _render() {
    this.element = document.createElement('div');
    this.element.id = 'poseModal';
    this.element.className = 'hidden fixed top-6 right-3 bottom-20 w-[330px] sm:w-[360px] max-w-[88vw] glass-panel rounded-2xl p-3.5 shadow-2xl border border-pink-500/40 z-50 pointer-events-auto overflow-y-auto custom-scrollbar transition-all duration-300';

    this.element.innerHTML = `
      <div class="flex items-center justify-between pb-2 mb-2.5 border-b border-white/10">
        <div class="flex items-center gap-1.5">
          <span class="text-base">🦴</span>
          <span class="text-xs font-bold text-pink-300">骨架關節微調・自訂姿勢</span>
        </div>
        <div class="flex items-center gap-1">
          <button id="btnToggleSide" class="text-[10px] text-slate-400 hover:text-pink-300 px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700" title="切換靠右 / 靠左顯示">
            ⇄ 換邊
          </button>
          <button id="btnClosePoseModal" class="text-slate-400 hover:text-white text-xs px-2 py-0.5">✕</button>
        </div>
      </div>

      <!-- Quick Camera View Angle Bar -->
      <div class="mb-3 bg-slate-900/80 rounded-xl p-2.5 border border-slate-800">
        <div class="flex justify-between items-center mb-1.5">
          <span class="text-[11px] font-semibold text-slate-300">🎥 鏡頭視角快速定位:</span>
          <button id="btnModalResetCam" class="text-[10px] text-pink-400 hover:underline">重設視角</button>
        </div>
        <div class="grid grid-cols-4 gap-1.5 text-xs">
          <button id="btnCamTop" class="px-2 py-1 rounded bg-slate-800 hover:bg-pink-600 text-slate-200 text-[10px] transition">頭頂俯瞰</button>
          <button id="btnCamFace" class="px-2 py-1 rounded bg-slate-800 hover:bg-pink-600 text-slate-200 text-[10px] transition">臉部特寫</button>
          <button id="btnCamFull" class="px-2 py-1 rounded bg-slate-800 hover:bg-pink-600 text-slate-200 text-[10px] transition">全身視角</button>
          <button id="btnCamFeet" class="px-2 py-1 rounded bg-slate-800 hover:bg-pink-600 text-slate-200 text-[10px] transition">腳底仰角</button>
        </div>
      </div>

      <!-- Bone Joint Selector & Sliders -->
      <div class="bg-slate-900/80 rounded-xl p-3 border border-slate-800 space-y-3 mb-3">
        <!-- Capture current avatar pose bar -->
        <div class="flex items-center justify-between pb-2 border-b border-white/5">
          <div class="text-[10px] text-slate-400">以當前人偶動作為基準微調：</div>
          <button id="btnCaptureCurrentPose" class="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600/40 hover:bg-indigo-600 text-indigo-200 border border-indigo-500/40 text-[10px] font-semibold transition shadow" title="抓取人偶當前所有關節角度與高度至編輯器">
            <span>📥</span>
            <span>讀取當前姿勢</span>
          </button>
        </div>

        <div class="flex justify-between items-center">
          <label class="text-[11px] font-semibold text-pink-300">選擇調整關節 (Bone Node):</label>
          <button id="btnResetCurrentJoint" class="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 bg-slate-800 rounded">
            重設此關節
          </button>
        </div>

        <select id="poseJointSelect" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-200 focus:outline-none focus:border-pink-500">
          <optgroup label="頭頸部">
            <option value="head" selected>頭部 (Head)</option>
            <option value="neck">頸部 (Neck)</option>
          </optgroup>
          <optgroup label="左上肢手臂">
            <option value="leftUpperArm">左上臂 (Left Upper Arm)</option>
            <option value="leftLowerArm">左前臂 (Left Lower Arm)</option>
            <option value="leftHand">左手掌 (Left Hand)</option>
          </optgroup>
          <optgroup label="右上肢手臂">
            <option value="rightUpperArm">右上臂 (Right Upper Arm)</option>
            <option value="rightLowerArm">右前臂 (Right Lower Arm)</option>
            <option value="rightHand">右手掌 (Right Hand)</option>
          </optgroup>
          <optgroup label="軀幹與重心">
            <option value="spine">脊椎 (Spine)</option>
            <option value="chest">胸部 (Chest)</option>
            <option value="hips">骨盆重心 (Hips)</option>
          </optgroup>
          <optgroup label="左下肢腿部">
            <option value="leftUpperLeg">左大腿 (Left Upper Leg)</option>
            <option value="leftLowerLeg">左小腿 (Left Lower Leg)</option>
            <option value="leftFoot">左腳掌 (Left Foot)</option>
          </optgroup>
          <optgroup label="右下肢腿部">
            <option value="rightUpperLeg">右大腿 (Right Upper Leg)</option>
            <option value="rightLowerLeg">右小腿 (Right Lower Leg)</option>
            <option value="rightFoot">右腳掌 (Right Foot)</option>
          </optgroup>
        </select>

        <!-- 3-Axis Sliders -->
        <div class="space-y-2 text-xs">
          <div>
            <div class="flex justify-between text-[11px] mb-0.5">
              <span class="text-rose-400">X 軸旋轉 (俯仰 / Pitch)</span>
              <span id="labelRotX" class="font-mono text-slate-200">0°</span>
            </div>
            <input id="sliderPoseX" type="range" min="-180" max="180" step="1" value="0" class="w-full accent-rose-500 bg-slate-800 h-1.5 rounded-lg">
          </div>

          <div>
            <div class="flex justify-between text-[11px] mb-0.5">
              <span class="text-emerald-400">Y 軸旋轉 (扭轉 / Yaw)</span>
              <span id="labelRotY" class="font-mono text-slate-200">0°</span>
            </div>
            <input id="sliderPoseY" type="range" min="-180" max="180" step="1" value="0" class="w-full accent-emerald-500 bg-slate-800 h-1.5 rounded-lg">
          </div>

          <div>
            <div class="flex justify-between text-[11px] mb-0.5">
              <span class="text-blue-400">Z 軸旋轉 (側擺 / Roll)</span>
              <span id="labelRotZ" class="font-mono text-slate-200">0°</span>
            </div>
            <input id="sliderPoseZ" type="range" min="-180" max="180" step="1" value="0" class="w-full accent-blue-500 bg-slate-800 h-1.5 rounded-lg">
          </div>
        </div>

        <div class="flex justify-between pt-1">
          <button id="btnResetAllBones" class="text-[10px] text-slate-400 hover:text-pink-300 underline">
            恢復標準待機站姿 (Reset All)
          </button>
        </div>
      </div>

      <!-- Save Pose as Shortcut -->
      <div class="bg-slate-900/80 rounded-xl p-2.5 border border-slate-800 mb-3 space-y-2">
        <label class="text-[11px] font-semibold text-pink-300 block">儲存為姿勢快捷鍵:</label>
        <div class="flex gap-2">
          <input id="inputNewPoseName" type="text" placeholder="輸入姿勢名稱 (例如: 剪刀手)" class="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-pink-500" />
          <button id="btnSaveNewPose" class="px-3 py-1 bg-pink-600 hover:bg-pink-500 text-white rounded-lg text-xs font-semibold shadow transition whitespace-nowrap">
            儲存姿勢
          </button>
        </div>
      </div>

      <!-- Saved Pose List & Shortcuts -->
      <div class="space-y-1.5">
        <div class="flex justify-between items-center text-xs">
          <span class="font-semibold text-slate-300 text-[11px]">⚡ 已存姿勢快捷鍵:</span>
          <span class="text-[10px] text-slate-500 font-mono">支援斜線指令 /pose</span>
        </div>
        <div id="modalSavedPoseList" class="space-y-1 max-h-36 overflow-y-auto custom-scrollbar pr-1">
          <!-- Populated by JS -->
        </div>
      </div>
    `;

    this.container.appendChild(this.element);
  }

  _bindEvents() {
    this.jointSelect = this.element.querySelector('#poseJointSelect');
    this.sliderX = this.element.querySelector('#sliderPoseX');
    this.sliderY = this.element.querySelector('#sliderPoseY');
    this.sliderZ = this.element.querySelector('#sliderPoseZ');
    this.labelX = this.element.querySelector('#labelRotX');
    this.labelY = this.element.querySelector('#labelRotY');
    this.labelZ = this.element.querySelector('#labelRotZ');
    this.inputName = this.element.querySelector('#inputNewPoseName');

    // Close button
    this.element.querySelector('#btnClosePoseModal').addEventListener('click', () => this.toggle(false));

    // Toggle side (right / left)
    this.isLeftDocked = false;
    this.element.querySelector('#btnToggleSide')?.addEventListener('click', () => {
      this.isLeftDocked = !this.isLeftDocked;
      if (this.isLeftDocked) {
        this.element.classList.remove('right-3');
        this.element.classList.add('left-3');
      } else {
        this.element.classList.remove('left-3');
        this.element.classList.add('right-3');
      }
    });

    // Camera Quick View Angle Buttons
    this.element.querySelector('#btnCamTop').addEventListener('click', () => {
      this.sceneManager.setCameraPreset('top');
      this.onShowBubble?.('切換為頭頂俯瞰視角！', 'surprised');
    });
    this.element.querySelector('#btnCamFace').addEventListener('click', () => {
      this.sceneManager.setCameraPreset('bust');
      this.onShowBubble?.('切換為臉部半身特寫！', 'happy');
    });
    this.element.querySelector('#btnCamFull').addEventListener('click', () => {
      this.sceneManager.setCameraPreset('full');
      this.onShowBubble?.('切換為全身全身視角！', 'happy');
    });
    this.element.querySelector('#btnCamFeet').addEventListener('click', () => {
      this.sceneManager.setCameraPreset('feet');
      this.onShowBubble?.('切換為腳底仰視視角！', 'surprised');
    });
    this.element.querySelector('#btnModalResetCam').addEventListener('click', () => {
      this.sceneManager.resetCamera();
      this.onShowBubble?.('鏡頭已重設回預設視角。', 'idle');
    });

    // Joint select change
    this.jointSelect.addEventListener('change', (e) => {
      this.selectedJoint = e.target.value;
      this._updateSlidersFromJoint();
    });

    // Sliders input
    const onSliderChange = () => {
      const x = parseInt(this.sliderX.value, 10);
      const y = parseInt(this.sliderY.value, 10);
      const z = parseInt(this.sliderZ.value, 10);

      this.labelX.innerText = `${x}°`;
      this.labelY.innerText = `${y}°`;
      this.labelZ.innerText = `${z}°`;

      this.poseManager.setJointRotation(this.selectedJoint, { x, y, z });
    };

    this.sliderX.addEventListener('input', onSliderChange);
    this.sliderY.addEventListener('input', onSliderChange);
    this.sliderZ.addEventListener('input', onSliderChange);

    // Capture current avatar pose button
    this.element.querySelector('#btnCaptureCurrentPose')?.addEventListener('click', () => {
      const ok = this.poseManager.captureCurrentPoseFromAvatar();
      if (ok) {
        this._updateSlidersFromJoint();
        this.onShowBubble?.('已成功讀取人偶當前肢體與關節姿勢！', 'happy');
      } else {
        this.onShowBubble?.('未能讀取到人偶姿態，請確認模型已載入完成。', 'sad');
      }
    });

    // Reset current joint
    this.element.querySelector('#btnResetCurrentJoint').addEventListener('click', () => {
      const def = this.poseManager.resetJoint(this.selectedJoint);
      if (def) {
        this.sliderX.value = def.x;
        this.sliderY.value = def.y;
        this.sliderZ.value = def.z;
        this.labelX.innerText = `${def.x}°`;
        this.labelY.innerText = `${def.y}°`;
        this.labelZ.innerText = `${def.z}°`;
      }
    });

    // Reset all bones
    this.element.querySelector('#btnResetAllBones').addEventListener('click', () => {
      this.poseManager.resetToDefault();
      this._updateSlidersFromJoint();
      this.onShowBubble?.('骨架已還原為自然待機站姿！', 'happy');
    });

    // Save pose button & Enter key
    const handleSavePose = () => {
      const name = this.inputName.value.trim();
      if (!name) {
        this.onShowBubble?.('請先輸入姿勢名稱再進行儲存哦～', 'shy');
        this.inputName.focus();
        return;
      }
      if (this.poseManager?.captureCurrentPoseFromAvatar) {
        this.poseManager.captureCurrentPoseFromAvatar();
      }
      this.poseManager.saveCurrentPose(name);
      this.inputName.value = '';
      this.refreshSavedPoses();
      const isOverride = ['坐姿', '坐下', 'sit', '蹲姿', '蹲下', 'squat', '跪姿', '跪坐', 'kneel'].some(k => name.toLowerCase().includes(k));
      const extraMsg = isOverride ? '（已優先覆蓋對應內建動作！）' : '';
      this.onShowBubble?.(`姿勢「${name}」已成功儲存為快捷鍵！${extraMsg}`, 'happy');
    };

    this.element.querySelector('#btnSaveNewPose').addEventListener('click', handleSavePose);

    this.inputName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSavePose();
      }
    });
  }

  _updateSlidersFromJoint() {
    const rot = this.poseManager.getJointRotation(this.selectedJoint);
    this.sliderX.value = rot.x;
    this.sliderY.value = rot.y;
    this.sliderZ.value = rot.z;
    this.labelX.innerText = `${rot.x}°`;
    this.labelY.innerText = `${rot.y}°`;
    this.labelZ.innerText = `${rot.z}°`;
  }

  refreshSavedPoses() {
    const listEl = this.element.querySelector('#modalSavedPoseList');
    if (!listEl) return;
    listEl.innerHTML = '';

    const overrideKeywords = ['坐姿', '坐下', 'sit', '蹲姿', '蹲下', 'squat', '跪姿', '跪坐', 'kneel'];
    const poses = this.poseManager.getSavedPoses();
    poses.forEach((pose) => {
      const item = document.createElement('div');
      item.className = 'flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-pink-500/40 transition text-xs';

      const isOverride = overrideKeywords.some(k => pose.name.toLowerCase().includes(k));
      const badgeHtml = isOverride
        ? `<span class="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">覆蓋內建</span>`
        : '';

      item.innerHTML = `
        <div class="flex items-center gap-1.5 truncate max-w-[65%]">
          <span class="text-xs">💃</span>
          <span class="truncate text-slate-200 font-medium">${pose.name}</span>
          ${badgeHtml}
        </div>
        <div class="flex items-center gap-1.5">
          <button class="btnApplyPose px-2.5 py-0.5 rounded bg-pink-600/30 text-pink-300 hover:bg-pink-600 hover:text-white font-medium transition text-[11px]">
            套用
          </button>
          <button class="btnDeletePose text-slate-500 hover:text-rose-400 p-0.5 text-xs" title="刪除此姿勢">
            ✕
          </button>
        </div>
      `;

      item.querySelector('.btnApplyPose').addEventListener('click', () => {
        this.poseManager.applyPose(pose);
        this._updateSlidersFromJoint();
        this.onShowBubble?.(`已切換為「${pose.name}」姿勢！`, 'happy');
      });

      item.querySelector('.btnDeletePose').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`確定要刪除「${pose.name}」姿勢嗎？`)) {
          this.poseManager.deletePose(pose.id);
          this.refreshSavedPoses();
        }
      });

      listEl.appendChild(item);
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

    if (!this.element.classList.contains('hidden')) {
      // Auto-capture current avatar pose when opening modal so sliders reflect actual posture
      if (this.poseManager?.captureCurrentPoseFromAvatar) {
        this.poseManager.captureCurrentPoseFromAvatar();
      }
      this._updateSlidersFromJoint();
      this.refreshSavedPoses();
    }
  }
}

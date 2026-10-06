import { SceneManager } from './core/SceneManager.js';
import { SnapshotService } from './core/SnapshotService.js';
import { ARManager } from './core/ARManager.js';
import { HandTracker } from './core/HandTracker.js';
import { MotionTracker } from './core/MotionTracker.js';
import { RaycastManager } from './core/RaycastManager.js';
import { AvatarManager } from './vrm/AvatarManager.js';
import { AvatarController } from './vrm/AvatarController.js';
import { AnimationController } from './vrm/AnimationController.js';
import { EmotionController } from './vrm/EmotionController.js';
import { LipSyncController } from './vrm/LipSyncController.js';
import { EyeTrackingController } from './vrm/EyeTrackingController.js';
import { ActionController } from './vrm/ActionController.js';
import { PoseManager } from './vrm/PoseManager.js';
import { MotionManager } from './vrm/MotionManager.js';
import { PuppetController } from './vrm/PuppetController.js';
import { MascotPhysicsController } from './vrm/MascotPhysicsController.js';
import { MotionCaptureController } from './vrm/MotionCaptureController.js';

import { Toolbar } from './ui/Toolbar.js';
import { ChatBox } from './ui/ChatBox.js';
import { CostumeSelector } from './ui/CostumeSelector.js';
import { ActionSelector } from './ui/ActionSelector.js';
import { PoseModal } from './ui/PoseModal.js';
import { MotionEditor } from './ui/MotionEditor.js';
import { PuppetVisualizer } from './ui/PuppetVisualizer.js';
import { HeartWidget } from './ui/HeartWidget.js';
import { SettingsModal } from './ui/SettingsModal.js';
import { PuppetPoseBar } from './ui/PuppetPoseBar.js';
import { MultiAvatarBar } from './ui/MultiAvatarBar.js';
import { MocapPreview } from './ui/MocapPreview.js';
import { LoginModal } from './ui/LoginModal.js';

import { ConversationManager } from './services/ConversationManager.js';
import { WebSocketClient } from './services/WebSocketClient.js';
import { AuthService } from './services/AuthService.js';

window.addEventListener('DOMContentLoaded', async () => {
  // Apply in-browser styling if running outside Electron (e.g. mobile or web browser)
  if (!window.electronAPI) {
    document.body.classList.add('in-browser');
  }

  const canvasContainer = document.getElementById('canvas-container');
  const uiContainer = document.getElementById('ui-container');
  const dialogueBubble = document.getElementById('dialogueBubble');
  const dialogueMessage = document.getElementById('dialogueMessage');
  const dialogueEmotionTag = document.getElementById('dialogueEmotionTag');
  const btnCollapseBubble = document.getElementById('btnCollapseBubble');
  const btnExpandBubble = document.getElementById('btnExpandBubble');
  const btnCloseBubble = document.getElementById('btnCloseBubble');
  const btnRestoreBubble = document.getElementById('btnRestoreBubble');

  let bubbleTimeout = null;
  let isBubbleExpanded = false;

  function updateBubbleOffset() {
    const isMultiVisible = typeof multiAvatarBar !== 'undefined' && multiAvatarBar?.isVisible;
    const isPuppetVisible = typeof isPuppetMode !== 'undefined' && isPuppetMode;

    const targetClass = (isMultiVisible && isPuppetVisible)
      ? 'bubble-offset-stacked'
      : (isMultiVisible || isPuppetVisible)
        ? 'bubble-offset-single'
        : 'bubble-offset-top';

    [dialogueBubble, btnRestoreBubble].forEach(el => {
      if (!el) return;
      el.classList.remove('bubble-offset-stacked', 'bubble-offset-single', 'bubble-offset-top');
      el.classList.add(targetClass);
    });
  }

  function setBubbleExpanded(expanded) {
    isBubbleExpanded = expanded;
    if (expanded) {
      dialogueMessage.classList.remove('line-clamp-3');
      dialogueBubble.classList.add('max-w-md');
      if (btnExpandBubble) btnExpandBubble.textContent = '⤡';
    } else {
      dialogueMessage.classList.add('line-clamp-3');
      dialogueBubble.classList.remove('max-w-md');
      if (btnExpandBubble) btnExpandBubble.textContent = '⤢';
    }
  }

  function showBubble(text, emotion = 'happy') {
    clearTimeout(bubbleTimeout);
    dialogueMessage.innerText = text;
    dialogueEmotionTag.innerText = emotion;
    updateBubbleOffset();
    btnRestoreBubble?.classList.add('hidden');
    dialogueBubble.classList.remove('hidden');

    bubbleTimeout = setTimeout(() => {
      dialogueBubble.classList.add('hidden');
      if (isBubbleExpanded) {
        setBubbleExpanded(false);
      }
    }, 5000);
  }

  btnCollapseBubble?.addEventListener('click', () => {
    clearTimeout(bubbleTimeout);
    dialogueBubble.classList.add('hidden');
    btnRestoreBubble?.classList.remove('hidden');
  });

  btnRestoreBubble?.addEventListener('click', () => {
    btnRestoreBubble.classList.add('hidden');
    dialogueBubble.classList.remove('hidden');
    clearTimeout(bubbleTimeout);
    bubbleTimeout = setTimeout(() => {
      dialogueBubble.classList.add('hidden');
    }, 4500);
  });

  btnExpandBubble?.addEventListener('click', () => {
    clearTimeout(bubbleTimeout);
    setBubbleExpanded(!isBubbleExpanded);
  });

  btnCloseBubble?.addEventListener('click', () => {
    clearTimeout(bubbleTimeout);
    dialogueBubble.classList.add('hidden');
    btnRestoreBubble?.classList.add('hidden');
  });

  // Pause fadeout when user hovers dialogue bubble
  dialogueBubble?.addEventListener('mouseenter', () => {
    clearTimeout(bubbleTimeout);
  });
  dialogueBubble?.addEventListener('mouseleave', () => {
    if (!dialogueBubble.classList.contains('hidden')) {
      bubbleTimeout = setTimeout(() => {
        dialogueBubble.classList.add('hidden');
      }, 3000);
    }
  });

  const apiBase = (typeof window !== 'undefined' && window.location?.origin && !window.location.origin.startsWith('file://'))
    ? window.location.origin
    : 'http://127.0.0.1:8765';

  const authService = new AuthService(apiBase);
  const loginModal = new LoginModal(document.body, authService, (user) => {
    toolbar?.setAuthState(true, user);
    showBubble(`歡迎回來，${user.name || '主人'}！✨`, 'happy');
    if (canvasContainer) canvasContainer.style.pointerEvents = 'auto';
    wsClient?.connect();
  });

  authService.onAuthRequired = () => {
    if (canvasContainer) canvasContainer.style.pointerEvents = 'none';
    loginModal.show();
  };

  authService.onAuthChange = (isLoggedIn, user) => {
    toolbar?.setAuthState(isLoggedIn, user);
    if (!isLoggedIn && authService.authEnabled) {
      if (canvasContainer) canvasContainer.style.pointerEvents = 'none';
    } else {
      if (canvasContainer) canvasContainer.style.pointerEvents = 'auto';
    }
  };

  // Check auth requirement immediately on startup
  authService.checkAuthStatus().then((status) => {
    if (status.auth_enabled) {
      if (status.logged_in && status.user) {
        toolbar?.setAuthState(true, status.user);
        if (canvasContainer) canvasContainer.style.pointerEvents = 'auto';
      } else {
        if (canvasContainer) canvasContainer.style.pointerEvents = 'none';
        loginModal.show();
      }
    }
  });

  // 1. Initialize 3D Engine & Scene
  const sceneManager = new SceneManager(canvasContainer);

  // Restore cached perspective & vanishing point settings if available
  try {
    const cachedPerspective = localStorage.getItem('aibff_camera_perspective');
    if (cachedPerspective) {
      const p = JSON.parse(cachedPerspective);
      if (p.fov !== undefined) sceneManager.setFov(p.fov, true);
      if (p.vp_offset_x !== undefined || p.vp_offset_y !== undefined) {
        sceneManager.setVanishingPoint(p.vp_offset_x || 0, p.vp_offset_y || 0, true);
      }
      if (p.show_grid !== undefined) sceneManager.setGridVisible(p.show_grid);
      if (p.grid_style) sceneManager.setGridStyle(p.grid_style);
    }
  } catch (e) {
    console.warn('[App] Failed to load cached perspective config:', e);
  }

  // 2. Initialize Controllers with AvatarManager
  const avatarManager = new AvatarManager(sceneManager, {
    onSelectionChanged: (slot, index) => {
      if (slot) {
        costumeSelector?.setTargetAvatarTitle(slot.title);
        poseManager?.reloadFromActiveAvatar();
      }
    }
  });
  const avatarController = avatarManager;
  const animationController = new AnimationController(avatarController);
  const emotionController = new EmotionController(avatarController);
  const lipSyncController = new LipSyncController(avatarController);
  const eyeTrackingController = new EyeTrackingController(sceneManager, avatarController);
  const mascotPhysicsController = new MascotPhysicsController(sceneManager, avatarManager, {
    onAvatarImpact: (slot, speed) => {
      showBubble(`${slot.title}：哇啊！好痛痛～屁屁著地了😵`, 'surprised');
    },
    onAvatarLanded: (slot) => {
      // Gentle landing settled
    }
  });

  sceneManager.addUpdatable(avatarController);
  sceneManager.addUpdatable(animationController);
  sceneManager.addUpdatable(emotionController);
  sceneManager.addUpdatable(lipSyncController);
  sceneManager.addUpdatable(eyeTrackingController);
  sceneManager.addUpdatable(mascotPhysicsController);

  if (window.electronAPI?.getDisplayLayout) {
    window.electronAPI.getDisplayLayout().then((layout) => {
      if (layout && mascotPhysicsController) {
        mascotPhysicsController.setDisplayLayout(layout);
      }
    }).catch(() => {});
  }

  // Hook camera reset to instantly rescue any lost or out-of-bounds avatars
  sceneManager.onCameraReset = () => {
    if (mascotPhysicsController) {
      mascotPhysicsController.rescueAllAvatars();
    }
  };

  // Mobile Web Audio autoplay policy unlock on user gesture
  const unlockAudio = () => {
    if (lipSyncController) {
      lipSyncController.unlock();
    }
  };
  window.addEventListener('touchstart', unlockAudio, { passive: true });
  window.addEventListener('touchend', unlockAudio, { passive: true });
  window.addEventListener('click', unlockAudio);

  // Multi-Monitor UI Alignment Helper
  const updateUIPositioning = (layout) => {
    const bottomToolbar = document.getElementById('bottomToolbar');
    const topBar = document.getElementById('multiAvatarBar');
    const miniBar = document.getElementById('miniAvatarRestoreBar');
    const chatModal = document.getElementById('chatModal');

    if (layout && layout.primary && window.innerWidth > 600) {
      const primaryCenter = Math.round(layout.primary.offsetX + layout.primary.width / 2);
      if (bottomToolbar) {
        bottomToolbar.style.left = `${primaryCenter}px`;
        bottomToolbar.style.bottom = '52px'; // Elevate safely above Windows taskbar
      }
      if (topBar) topBar.style.left = `${primaryCenter}px`;
      if (miniBar) miniBar.style.left = `${primaryCenter}px`;
      if (chatModal && !chatModal.classList.contains('docked-right')) {
        chatModal.style.left = `${primaryCenter}px`;
        chatModal.style.bottom = '116px';
      }
    } else {
      if (bottomToolbar) {
        bottomToolbar.style.left = '';
        bottomToolbar.style.bottom = '';
      }
      if (topBar) topBar.style.left = '';
      if (miniBar) miniBar.style.left = '';
      if (chatModal && !chatModal.classList.contains('docked-right')) {
        chatModal.style.left = '';
        chatModal.style.bottom = '';
      }
    }
  };

  const handleToggleFullscreen = async () => {
    if (window.electronAPI?.toggleFullscreen) {
      const isFull = await window.electronAPI.toggleFullscreen();
      if (typeof puppetPoseBar !== 'undefined' && puppetPoseBar) {
        puppetPoseBar.setFullscreenState(isFull);
      }
      if (isFull) {
        if (sceneManager) sceneManager.setCameraPreset('full', true);
        if (window.electronAPI?.getDisplayLayout) {
          try {
            const layout = await window.electronAPI.getDisplayLayout();
            if (mascotPhysicsController) {
              mascotPhysicsController.setDisplayLayout(layout);
            }
            updateUIPositioning(layout);
          } catch (_) {}
        }
      } else {
        if (sceneManager) sceneManager.setCameraPreset('bust', true);
        if (mascotPhysicsController) {
          mascotPhysicsController.setDisplayLayout(null);
        }
        updateUIPositioning(null);
      }
      showBubble(isFull ? '🖥️ 已切換為多螢幕全域透明畫布模式！' : '已切換回桌面懸浮小視窗～', 'happy');
      return isFull;
    }
    return false;
  };

  // F11 Fullscreen Canvas shortcut
  window.addEventListener('keydown', async (e) => {
    if (e.key === 'F11') {
      e.preventDefault();
      await handleToggleFullscreen();
    }
  });

  if (window.electronAPI?.onDisplayMetricsChanged) {
    window.electronAPI.onDisplayMetricsChanged((layout) => {
      updateUIPositioning(layout);
      if (mascotPhysicsController) {
        mascotPhysicsController.setDisplayLayout(layout);
      }
      if (layout && sceneManager) {
        sceneManager.setCameraPreset('full', true);
      } else if (!layout && sceneManager) {
        sceneManager.setCameraPreset('bust', true);
      }
    });
  }

  // 3. UI & Feature Modules
  let isResting = false;
  let isPuppetMode = false;

  const puppetController = new PuppetController(
    avatarController,
    animationController,
    sceneManager,
    {
      onReaction: (jointKey, text, emotion) => {
        showBubble(text, emotion);
        conversationManager.speakText(text);
      }
    }
  );
  sceneManager.addUpdatable(puppetController);

  const puppetVisualizer = new PuppetVisualizer(uiContainer, puppetController);
  sceneManager.addUpdatable({
    update: () => puppetVisualizer.render()
  });

  const handTracker = new HandTracker({
    onHandUpdate: ({ x, y, isPinching, hands }) => {
      puppetController.updateFinger(x, y, isPinching, hands);
    }
  });

  const arManager = new ARManager({
    onStateChange: (isActive) => {
      if (toolbar) toolbar.setARActive(isActive);
      if (isPuppetMode) {
        if (isActive && arManager.getVideoElement()) {
          handTracker.startCameraTracking(arManager.getVideoElement());
        } else {
          handTracker.stopCameraTracking();
        }
      }
    }
  });

  const togglePuppetMode = async (forceState = null) => {
    isPuppetMode = forceState !== null ? forceState : !isPuppetMode;
    if (isPuppetMode && isMocapMode) {
      // Dragging limbs and motion capture both drive the same bones
      await toggleMocapMode(false, true);
    }
    puppetController.setEnabled(isPuppetMode);
    puppetVisualizer.setVisible(isPuppetMode);
    if (puppetPoseBar) puppetPoseBar.setVisible(isPuppetMode);
    if (toolbar) toolbar.setPuppetActive(isPuppetMode);
    if (multiAvatarBar?.element) {
      multiAvatarBar.element.classList.toggle('stacked-offset', isPuppetMode);
    }
    updateBubbleOffset();

    if (isPuppetMode) {
      if (arManager.isActive && arManager.getVideoElement()) {
        await handTracker.startCameraTracking(arManager.getVideoElement());
      }
      showBubble('🤏 玩偶捏人模式已開啟！按住手、腳拉出姿勢，放開即自動保持，點擊「存為新姿勢」可隨時保存～✨', 'happy');
      chatBox.addAssistantMessage('🤏 玩偶捏人模式已開啟！拉扯肢體放開後會保持形狀，點擊上方「存為新姿勢」即可永久儲存；想恢復站姿點擊「復位」即可。');
    } else {
      handTracker.stopCameraTracking();
      showBubble('已恢復普通桌面模式（可隨意拖曳移動視窗）～', 'happy');
      chatBox.addAssistantMessage('已退出玩偶拉扯模式，現在按住滑鼠可以移動應用程式視窗。');
    }
    return isPuppetMode;
  };

  // Webcam motion capture: the avatar mirrors the body and face of the person on camera
  let isMocapMode = false;
  const motionCaptureController = new MotionCaptureController(avatarController, animationController, {
    lipSyncController
  });
  const mocapPreview = new MocapPreview(uiContainer);
  const motionTracker = new MotionTracker({
    onResults: (result) => {
      motionCaptureController.applyResults(result);
      if (result.pose) {
        const parts = ['身體'];
        if (result.face) parts.push('臉部');
        if (result.hands?.length) parts.push(`手指×${result.hands.length}`);
        mocapPreview.setStatus(`✅ 追蹤中：${parts.join('＋')}`);
      } else {
        mocapPreview.setStatus('👀 找不到人，請退後一點');
      }
    },
    onStatus: (text) => mocapPreview.setStatus(text)
  });

  const toggleMocapMode = async (forceState = null, silent = false) => {
    const next = forceState !== null ? forceState : !isMocapMode;
    if (next === isMocapMode) return isMocapMode;

    if (next) {
      if (isPuppetMode) await togglePuppetMode(false);
      motionManager.stop();
      mocapPreview.show(null, motionCaptureController.isMirror);
      try {
        await motionTracker.start({ deviceId: arManager.selectedDeviceId });
      } catch (err) {
        mocapPreview.hide();
        showBubble('無法啟動動作捕捉，請檢查鏡頭權限與網路連線', 'surprised');
        chatBox.addAssistantMessage('⚠️ 動作捕捉啟動失敗：無法開啟鏡頭，或辨識模型下載失敗（首次使用需要網路）。');
        return false;
      }
      isMocapMode = true;
      motionCaptureController.setEnabled(true);
      mocapPreview.show(motionTracker.mediaStream, motionCaptureController.isMirror);
      if (!silent) {
        showBubble('🕺 動作捕捉已開啟！我會跟著主人一起動～', 'happy');
        chatBox.addAssistantMessage('🕺 動作捕捉已開啟！請讓上半身出現在鏡頭中，退後到全身入鏡時腿部也會跟著動。輸入 /mocap mirror 可切換鏡像。');
      }
    } else {
      isMocapMode = false;
      motionTracker.stop();
      motionCaptureController.setEnabled(false);
      mocapPreview.hide();
      if (!silent) {
        showBubble('動作捕捉已關閉，恢復待機動作～', 'happy');
        chatBox.addAssistantMessage('已關閉動作捕捉並釋放鏡頭。');
      }
    }
    if (toolbar) toolbar.setMocapActive(isMocapMode);
    return isMocapMode;
  };

  const snapshotService = new SnapshotService(sceneManager, arManager);
  const poseManager = new PoseManager(avatarController, animationController);
  const poseModal = new PoseModal(uiContainer, poseManager, sceneManager, showBubble);

  // Custom motions: several poses played back in sequence
  const motionManager = new MotionManager(avatarController, animationController, poseManager, {
    // Grabbing a limb or springing back to the stand takes the bones away from playback
    isInterrupted: () => puppetController.isRecovering
      || puppetController.getActivePointers().some((p) => p.grabbedJointKey),
    onBeforePlay: () => {
      puppetController.isRecovering = false;
    },
    onStateChanged: () => motionEditor.refresh()
  });
  const motionEditor = new MotionEditor(uiContainer, motionManager, poseManager, showBubble);
  sceneManager.addUpdatable(motionManager);

  puppetController.setPoseManager(poseManager);
  const puppetPoseBar = new PuppetPoseBar(
    uiContainer,
    puppetController,
    poseManager,
    poseModal,
    (text, emotion) => showBubble(text, emotion),
    sceneManager,
    motionEditor
  );

  const multiAvatarBar = new MultiAvatarBar(
    uiContainer,
    avatarManager,
    (text, emotion) => showBubble(text, emotion)
  );
  multiAvatarBar.onVisibilityChanged = (visible) => {
    toolbar?.setCloneActive(visible);
    updateBubbleOffset();
  };

  const handleSlashCommand = async (cmdText) => {
    const trimmed = cmdText.trim();
    if (trimmed === '/puppet' || trimmed === '/puppet toggle') {
      await togglePuppetMode();
      return true;
    }
    if (trimmed === '/puppet on') {
      await togglePuppetMode(true);
      return true;
    }
    if (trimmed === '/puppet off') {
      await togglePuppetMode(false);
      return true;
    }
    if (trimmed === '/mocap' || trimmed === '/mocap toggle') {
      await toggleMocapMode();
      return true;
    }
    if (trimmed === '/mocap on') {
      await toggleMocapMode(true);
      return true;
    }
    if (trimmed === '/mocap off') {
      await toggleMocapMode(false);
      return true;
    }
    if (trimmed === '/mocap mirror') {
      const isMirror = motionCaptureController.setMirror();
      mocapPreview.setMirror(isMirror);
      showBubble(isMirror ? '🪞 動作捕捉：鏡像模式' : '🔄 動作捕捉：左右對應模式', 'happy');
      chatBox.addAssistantMessage(isMirror ? '🪞 鏡像模式：你舉右手，畫面同一側的手會舉起（像照鏡子）。' : '🔄 左右對應模式：你舉右手，角色也舉她自己的右手。');
      return true;
    }
    if (trimmed === '/fullscreen' || trimmed === '/fs') {
      await handleToggleFullscreen();
      return true;
    }
    if (trimmed === '/ar' || trimmed === '/ar toggle') {
      try {
        const active = await arManager.toggle();
        if (active) {
          await togglePuppetMode(true);
          showBubble('📷 視訊 AR 與手指拉扯模式已啟動！我就在你的房間裡，伸手捏捏看我吧～✨', 'happy');
          chatBox.addAssistantMessage('📷 筆電鏡頭與手指玩偶模式已同步開啟！伸出手指靠近手腕、腰部捏合即可拉扯移動～');
        } else {
          await togglePuppetMode(false);
          showBubble('已回到透明桌面模式～', 'happy');
          chatBox.addAssistantMessage('已關閉筆電鏡頭，回到透明桌面模式囉～');
        }
      } catch (err) {
        showBubble('無法存取視訊鏡頭，請檢查權限設定', 'surprised');
        chatBox.addAssistantMessage('⚠️ 無法存取視訊攝影機，請確認筆電鏡頭權限是否已開啟。');
      }
      return true;
    }
    if (trimmed === '/ar on') {
      try {
        await arManager.start();
        await togglePuppetMode(true);
        showBubble('📷 視訊 AR 與手指拉扯模式已啟動！伸手捏捏看我吧～✨', 'happy');
        chatBox.addAssistantMessage('📷 筆電鏡頭與手指玩偶模式已開啟～');
      } catch (err) {
        showBubble('無法存取視訊鏡頭，請檢查權限設定', 'surprised');
        chatBox.addAssistantMessage('⚠️ 無法存取視訊攝影機，請確認筆電鏡頭權限是否已開啟。');
      }
      return true;
    }
    if (trimmed === '/ar off') {
      arManager.stop();
      await togglePuppetMode(false);
      showBubble('已回到透明桌面模式～', 'happy');
      chatBox.addAssistantMessage('已關閉筆電鏡頭，回到透明桌面模式囉～');
      return true;
    }
    if (trimmed === '/ar mirror') {
      const isMirror = arManager.setMirror();
      showBubble(isMirror ? '🪞 已開啟自拍鏡像！' : '🔄 已切換為正常視角！', 'happy');
      chatBox.addAssistantMessage(isMirror ? '🪞 已開啟視訊鏡像（自拍鏡感）' : '🔄 已切換為正常視角方向');
      return true;
    }
    if (trimmed === '/pose list') {
      const poses = poseManager.getSavedPoses();
      const listStr = poses.map(p => `• ${p.name}`).join('\n');
      chatBox.addAssistantMessage(`目前已儲存的姿勢快捷鍵列表：\n${listStr}`);
      return true;
    }
    if (trimmed === '/pose reset') {
      poseManager.resetToDefault();
      showBubble('骨架已恢復自然待機站姿！', 'happy');
      chatBox.addAssistantMessage('已為主人恢復自然待機站姿～');
      return true;
    }
    if (trimmed.startsWith('/pose ')) {
      const nameQuery = trimmed.replace('/pose ', '').trim();
      const found = poseManager.findPoseByName(nameQuery);
      if (found) {
        poseManager.applyPose(found);
        showBubble(`已擺出「${found.name}」姿勢！`, 'happy');
        chatBox.addAssistantMessage(`好呀！馬上為主人擺出「${found.name}」的姿勢～✨`);
      } else {
        chatBox.addAssistantMessage(`找不到名為「${nameQuery}」的姿勢。可以使用 /pose list 查看所有姿勢，或使用「🦴 姿勢」面板儲存新姿勢喔！`);
      }
      return true;
    }
    if (trimmed === '/motion list') {
      const motions = motionManager.getSavedMotions();
      const listStr = motions.map(m => `• ${m.name}`).join('\n');
      chatBox.addAssistantMessage(motions.length
        ? `目前已儲存的動作列表：\n${listStr}`
        : '還沒有儲存任何動作，可以在玩偶捏人模式點「🎬 動作編輯」製作喔！');
      return true;
    }
    if (trimmed === '/motion stop') {
      motionManager.stop();
      chatBox.addAssistantMessage('已停止播放動作～');
      return true;
    }
    if (trimmed.startsWith('/motion ')) {
      const nameQuery = trimmed.replace('/motion ', '').trim();
      const found = motionManager.findMotionByName(nameQuery);
      if (found) {
        motionManager.loadMotion(found.id);
        motionManager.play({ loop: found.loop });
        showBubble(`開始表演「${found.name}」！`, 'happy');
        chatBox.addAssistantMessage(`好呀！馬上為主人表演「${found.name}」～✨${found.loop ? '（循環播放中，輸入 /motion stop 停止）' : ''}`);
      } else {
        chatBox.addAssistantMessage(`找不到名為「${nameQuery}」的動作。可以使用 /motion list 查看所有動作喔！`);
      }
      return true;
    }
    if (trimmed === '/photo' || trimmed === '/snapshot') {
      const res = await snapshotService.capture({ transparent: false });
      const locDesc = res?.filePath ? `\n已儲存至：${res.filePath}` : '（已下載至下載資料夾）';
      showBubble('📸 喀嚓！照片已成功儲存！', 'happy');
      chatBox.addAssistantMessage(`📸 拍照完成！已經為主人存檔囉～${locDesc}`);
      return true;
    }
    if (trimmed === '/photo transparent' || trimmed === '/snapshot transparent') {
      const res = await snapshotService.capture({ transparent: true });
      const locDesc = res?.filePath ? `\n已儲存至：${res.filePath}` : '（已下載至下載資料夾）';
      showBubble('📸 喀嚓！透明去背照片已成功儲存！', 'happy');
      chatBox.addAssistantMessage(`📸 透明去背照片拍照完成！已經為主人存檔囉～${locDesc}`);
      return true;
    }
    if (trimmed.startsWith('/camera ')) {
      const camPreset = trimmed.replace('/camera ', '').trim();
      if (['bust', 'full', 'top', 'feet'].includes(camPreset)) {
        sceneManager.setCameraPreset(camPreset);
        showBubble(`鏡頭已切換至：${camPreset}`, 'happy');
        chatBox.addAssistantMessage(`已切換鏡頭至：${camPreset}`);
        return true;
      }
    }
    if (trimmed === '/reset' || trimmed === '/rescue') {
      sceneManager.resetCamera();
      showBubble('✨ 視角與人偶已全面歸位中央地面！', 'happy');
      chatBox.addAssistantMessage('✨ 視角與所有桌寵人偶已成功重置回到主螢幕中央！');
      return true;
    }
    if (trimmed === '/clone' || trimmed === '/clone toggle') {
      const isVis = multiAvatarBar.toggle();
      toolbar.setCloneActive(isVis);
      updateBubbleOffset();
      return true;
    }
    if (trimmed === '/clone on') {
      multiAvatarBar.setVisible(true);
      toolbar.setCloneActive(true);
      updateBubbleOffset();
      return true;
    }
    if (trimmed === '/clone off') {
      multiAvatarBar.setVisible(false);
      toolbar.setCloneActive(false);
      updateBubbleOffset();
      return true;
    }
    if (trimmed === '/clone add' || trimmed === '/clone spawn') {
      try {
        const slot = await avatarManager.spawnClone();
        showBubble(`忍法・影分身！召喚了${slot.title}～✨`, 'happy');
        chatBox.addAssistantMessage(`已召喚${slot.title}！點擊人偶或頂部標籤即可切換選中與調整姿勢。`);
      } catch (err) {
        showBubble(err.message, 'surprised');
        chatBox.addAssistantMessage(`⚠️ ${err.message}`);
      }
      return true;
    }
    if (trimmed.startsWith('/clone add ') || trimmed.startsWith('/clone spawn ')) {
      const costKey = trimmed.replace('/clone add ', '').replace('/clone spawn ', '').trim();
      try {
        const slot = await avatarManager.spawnClone(costKey);
        showBubble(`忍法・影分身！召喚了穿著「${costKey}」的${slot.title}～✨`, 'happy');
        chatBox.addAssistantMessage(`已召喚${slot.title}（外觀：${costKey}）！`);
      } catch (err) {
        showBubble(err.message, 'surprised');
        chatBox.addAssistantMessage(`⚠️ ${err.message}`);
      }
      return true;
    }
    if (trimmed === '/clone remove' || trimmed === '/clone delete') {
      const activeSlot = avatarManager.getActiveSlot();
      const title = activeSlot?.title || '分身';
      const success = avatarManager.removeClone();
      if (success) {
        showBubble(`已收回${title}～`, 'happy');
        chatBox.addAssistantMessage(`已成功移除${title}。`);
      } else {
        showBubble('主身無法移除喔！至少需保留一個人偶。', 'shy');
        chatBox.addAssistantMessage('⚠️ 主身人偶無法移除，至少必須保留 1 個人偶在場景中。');
      }
      return true;
    }
    if (trimmed === '/clone reset') {
      avatarManager.resetPositions();
      showBubble('所有人偶已重新均勻排開站位！', 'happy');
      chatBox.addAssistantMessage('已為主人將所有同台人偶均勻排開站位～');
      return true;
    }
    if (trimmed === '/clone sync') {
      avatarManager.syncPoseToAll();
      showBubble('已將當前選中人偶姿勢同步至全員！💃', 'happy');
      chatBox.addAssistantMessage('已將當前姿勢同步廣播給所有人偶囉～');
      return true;
    }
    if (trimmed === '/clone list') {
      const slots = avatarManager.getAllSlots();
      const listStr = slots.map((s, i) => `${i === avatarManager.activeIndex ? '👉 ' : '   '}• ${s.title} (外觀: ${s.costumeKey}, X: ${s.vrm?.scene?.position?.x?.toFixed(2) || 0})`).join('\n');
      chatBox.addAssistantMessage(`目前同台人偶清單 (${slots.length}/4)：\n${listStr}`);
      return true;
    }
    if (trimmed.startsWith('/clone select ')) {
      const numStr = trimmed.replace('/clone select ', '').trim();
      const idx = parseInt(numStr, 10) - 1;
      if (!isNaN(idx) && idx >= 0 && idx < avatarManager.slots.length) {
        avatarManager.selectAvatar(idx);
        const slot = avatarManager.getActiveSlot();
        showBubble(`切換控制：${slot.title}！`, 'happy');
        chatBox.addAssistantMessage(`已切換至「${slot.title}」，接下來的姿勢與換裝將以此人偶為目標。`);
      } else {
        chatBox.addAssistantMessage(`請輸入有效的人偶編號（1 ~ ${avatarManager.slots.length}）。`);
      }
      return true;
    }
    if (trimmed === '/patrol' || trimmed === '/roam') {
      const isPatrol = mascotPhysicsController.togglePatrol();
      const slot = avatarManager.getActiveSlot();
      showBubble(isPatrol ? `${slot?.title}：出發～在螢幕桌面上小跑步巡邏囉！🏃` : `${slot?.title}：巡邏暫停，原地休息中～🍵`, 'happy');
      chatBox.addAssistantMessage(isPatrol ? `已啟動「${slot?.title}」的全螢幕漫步巡邏模式。` : `已停止「${slot?.title}」的巡邏。`);
      multiAvatarBar.update();
      return true;
    }
    if (trimmed === '/drop' || trimmed === '/fall') {
      const slot = avatarManager.getActiveSlot();
      mascotPhysicsController.dropAvatar();
      showBubble(`${slot?.title}：呀啊啊！從高空掉下來啦！🪂`, 'surprised');
      chatBox.addAssistantMessage(`已將「${slot?.title}」從螢幕頂部高空拋落，觸發重力下墜與地面彈跳物理。`);
      return true;
    }
    if (trimmed.startsWith('/scale ')) {
      const val = parseFloat(trimmed.replace('/scale ', '').trim());
      if (!isNaN(val) && val >= 0.2 && val <= 3.5) {
        avatarManager.setScale(avatarManager.activeIndex, val);
        const slot = avatarManager.getActiveSlot();
        showBubble(`${slot?.title}：大小縮放為 ${val.toFixed(2)}x！`, 'happy');
        chatBox.addAssistantMessage(`已將「${slot?.title}」的縮放比例設定為 ${val.toFixed(2)}x。`);
        multiAvatarBar.update();
      } else {
        chatBox.addAssistantMessage('請輸入有效數值（0.3 ~ 3.0），例如：/scale 1.5 或 /scale 0.8');
      }
      return true;
    }
    if (trimmed.startsWith('/fov ')) {
      const val = parseFloat(trimmed.replace('/fov ', '').trim());
      if (!isNaN(val) && val >= 15 && val <= 85) {
        sceneManager.setFov(val);
        showBubble(`視野廣角已設定為 ${val}°！📐`, 'happy');
        chatBox.addAssistantMessage(`相機視野廣角 (FOV) 已設定為 ${val}°（數值越大近大遠小透視越強烈）。`);
      } else {
        chatBox.addAssistantMessage('請輸入有效數值（15 ~ 85），例如：/fov 65 或 /fov 30');
      }
      return true;
    }
    if (trimmed.startsWith('/vp ')) {
      const parts = trimmed.replace('/vp ', '').trim().split(/\s+/);
      const x = parseFloat(parts[0]);
      const y = parts.length > 1 ? parseFloat(parts[1]) : 0.0;
      if (!isNaN(x)) {
        sceneManager.setVanishingPoint(x, isNaN(y) ? 0.0 : y);
        showBubble(`消失點偏移已設定為 (${x.toFixed(2)}, ${(isNaN(y) ? 0 : y).toFixed(2)})！✨`, 'happy');
        chatBox.addAssistantMessage(`相機光學消失點已偏移至 X: ${x.toFixed(2)}, Y: ${(isNaN(y) ? 0 : y).toFixed(2)}。`);
      } else {
        chatBox.addAssistantMessage('請輸入有效數值（-1.0 ~ 1.0），例如：/vp 0 -0.45 或 /vp 0 0');
      }
      return true;
    }
    if (trimmed === '/grid' || trimmed === '/grid toggle') {
      const state = !sceneManager.isGridVisible;
      sceneManager.setGridVisible(state);
      showBubble(state ? '3D 地面立體透視網格已開啟！📐' : '3D 地面參考網格已隱藏。', 'happy');
      chatBox.addAssistantMessage(state ? '已開啟 3D 地面空間立體透視網格。' : '已關閉地面網格。');
      return true;
    }
    if (trimmed.startsWith('/perspective ')) {
      const preset = trimmed.replace('/perspective ', '').trim().toLowerCase();
      if (['standard', 'anime', 'figure', 'dramatic'].includes(preset)) {
        sceneManager.setPerspectivePreset(preset);
        showBubble(`已套用「${preset}」透視風格！✨`, 'happy');
        chatBox.addAssistantMessage(`已切換相機透視模式為：${preset}。`);
      } else {
        chatBox.addAssistantMessage('可選預設：standard（標準平視）、anime（動漫廣角）、figure（公仔展示）、dramatic（張力仰視）');
      }
      return true;
    }
    return false;
  };

  const heartWidget = new HeartWidget(uiContainer, () => {
    // Click heart to recall
    actionController.dispatch({
      reply: '我回來啦！主人有沒有想我呀？',
      emotion: 'happy',
      action: 'return',
      costume: null
    });
  });

  const chatBox = new ChatBox(uiContainer, (msg) => {
    lipSyncController?.unlock();
    conversationManager.handleUserMessage(msg);
  }, (cmd) => {
    lipSyncController?.unlock();
    handleSlashCommand(cmd);
  });

  const costumeSelector = new CostumeSelector(uiContainer, (costumeId) => {
    const targetTitle = avatarManager.getActiveSlot()?.title || '人偶';
    let reply = `好呀，馬上為${targetTitle}換裝給你看！`;
    if (costumeId === 'ayame') {
      reply = 'Konnakiri～！余是百鬼綾目！主人今天也是元氣滿滿的一天呢～😈';
    } else if (costumeId === 'mint') {
      reply = '哇！是海邊的感覺！我是薄荷，主人要和我一起去海邊玩嗎～？🩱';
    }
    actionController.dispatch({
      reply,
      emotion: 'happy',
      action: 'change_costume',
      costume: costumeId
    });
  });

  const actionSelector = new ActionSelector(uiContainer, (actionId) => {
    actionController.dispatch({
      action: actionId
    });
  });

  const settingsModal = new SettingsModal(uiContainer, async (newConfig) => {
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders()
      };
      const res = await fetch(`${apiBase}/api/config`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newConfig)
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          loginModal.show();
          return;
        }
      }
      showBubble('設定已成功儲存與更新！', 'happy');
    } catch (e) {
      console.warn('[App] Error saving config:', e);
    }
  }, sceneManager);

  const toolbar = new Toolbar(uiContainer, {
    onMic: async () => {
      lipSyncController?.unlock();
      await wsClient.toggleListening((active) => {
        toolbar.setMicActive(active);
      });
    },
    onChat: () => {
      chatBox.toggle();
    },
    onCostume: () => {
      costumeSelector.toggle();
    },
    onAction: () => {
      actionSelector.toggle();
    },
    onPose: () => {
      poseModal.toggle();
    },
    onSnapshot: async () => {
      const res = await snapshotService.capture({ transparent: false });
      const prefix = arManager.isActive ? '📸 喀嚓！AR 同框合照' : '📸 喀嚓！照片';
      if (res?.filePath) {
        showBubble(`${prefix}已儲存至「圖片」資料夾！`, 'happy');
      } else {
        showBubble(`${prefix}已成功儲存並下載！`, 'happy');
      }
    },
    onAR: async () => {
      try {
        const active = await arManager.toggle();
        if (active) {
          await togglePuppetMode(true);
          showBubble('📷 視訊 AR 與手指拉扯模式已啟動！我就在你的房間裡，伸手捏捏看我吧～✨', 'happy');
        } else {
          await togglePuppetMode(false);
          showBubble('已回到透明桌面模式～', 'happy');
        }
      } catch (err) {
        showBubble('無法存取視訊鏡頭，請檢查權限設定', 'surprised');
      }
    },
    onPuppet: () => {
      togglePuppetMode();
    },
    onMocap: () => {
      toggleMocapMode();
    },
    onClone: () => {
      const isVis = multiAvatarBar.toggle();
      toolbar.setCloneActive(isVis);
      updateBubbleOffset();
    },
    onViewToggle: () => {
      sceneManager.setCameraPreset('toggle');
      const isFull = sceneManager.targetCameraDist > 2.6;
      toolbar.setViewMode(isFull ? 'full' : 'bust');
    },
    onLeave: () => {
      actionController.dispatch({
        reply: '好呀，那我先去休息啦，主人記得早點休息哦。',
        emotion: 'happy',
        action: 'leave',
        costume: null
      });
    },
    onSettings: () => {
      settingsModal.toggle(true);
    },
    onAuth: async () => {
      if (confirm(`目前登入帳號：${authService.getUser()?.email || '已授權用戶'}\n是否確定要登出？`)) {
        await authService.logout();
        toolbar.setAuthState(false, null);
        showBubble('已登出帳號。', 'shy');
        if (authService.authEnabled) {
          loginModal.show();
        }
      }
    }
  });

  // Synchronize clone bar active state with bottom toolbar
  toolbar.setCloneActive(multiAvatarBar.isVisible);

  // Synchronize chat open state with toolbar button highlight
  chatBox.onStateChanged = ({ isVisible, isMinimized }) => {
    const btn = toolbar.element?.querySelector('#btnChat');
    if (btn) {
      if (isVisible && !isMinimized) {
        btn.classList.add('text-pink-400', 'bg-pink-500/20');
      } else {
        btn.classList.remove('text-pink-400', 'bg-pink-500/20');
      }
    }
  };

  // Enable pointer events for active UI children
  [
    toolbar.element,
    chatBox.element,
    chatBox.miniElement,
    costumeSelector.element,
    actionSelector.element,
    poseModal.element,
    motionEditor.element,
    heartWidget.element,
    settingsModal.element,
    puppetPoseBar.element,
    mocapPreview.element,
    multiAvatarBar.element,
    multiAvatarBar.miniElement
  ].forEach(el => {
    if (el) el.style.pointerEvents = 'auto';
  });

  // Calculate initial bubble offset
  updateBubbleOffset();

  // Initial multi-monitor layout positioning if starting in fullscreen mode
  if (window.innerWidth > 600 && window.electronAPI?.getDisplayLayout) {
    window.electronAPI.getDisplayLayout().then(layout => {
      updateUIPositioning(layout);
    }).catch(() => {});
  }

  // 4. Action Controller Dispatcher
  const actionController = new ActionController(
    avatarController,
    animationController,
    emotionController,
    lipSyncController,
    sceneManager,
    {
      onLeave: () => {
        isResting = true;
        if (isPuppetMode) {
          togglePuppetMode(false);
        }
        if (arManager.isActive) {
          arManager.stop();
        }
        if (isMocapMode) {
          toggleMocapMode(false, true);
        }
        canvasContainer.style.display = 'none';
        toolbar.element.style.display = 'none';
        chatBox.toggle(false);
        costumeSelector.toggle(false);
        actionSelector.toggle(false);
        poseModal.toggle(false);
        motionManager.stop();
        motionEditor.toggle(false);
        puppetPoseBar.setVisible(false);
        heartWidget.show();
        if (window.electronAPI?.setRestingMode) {
          window.electronAPI.setRestingMode(true);
        }
      },
      onReturn: () => {
        isResting = false;
        heartWidget.hide();
        canvasContainer.style.display = 'block';
        toolbar.element.style.display = 'flex';
        if (isPuppetMode) {
          puppetPoseBar.setVisible(true);
        }
        if (window.electronAPI?.setRestingMode) {
          window.electronAPI.setRestingMode(false);
        }
      },
      showDialogue: (text, emotion) => {
        showBubble(text, emotion);
      },
      onPatSpeech: (text) => {
        conversationManager.speakText(text);
      }
    },
    poseManager
  );

  // 5. Raycast Interaction (Head Pat vs Drag vs Puppet)
  const raycastManager = new RaycastManager(sceneManager, avatarController, (hitPoint) => {
    if (!isResting) {
      actionController.triggerHeadPat(hitPoint);
    }
  }, avatarManager);
  raycastManager.setPuppetController(puppetController);
  raycastManager.setMascotPhysicsController(mascotPhysicsController);

  // Registered last so captured motion overrides idle / eye-tracking / action bone writes
  sceneManager.addUpdatable(motionCaptureController);
  toolbar.setPuppetActive(false);

  // Expose controllers for testing and inspection
  window.appControllers = {
    avatarManager,
    avatarController,
    animationController,
    actionController,
    emotionController,
    mascotPhysicsController,
    sceneManager,
    poseManager,
    poseModal,
    motionManager,
    motionEditor,
    puppetPoseBar,
    puppetController,
    handTracker,
    arManager,
    motionTracker,
    motionCaptureController,
    toggleMocapMode,
    multiAvatarBar,
    toolbar,
    chatBox,
    updateBubbleOffset,
    showBubble
  };

  // 6. Services
  const conversationManager = new ConversationManager(actionController, chatBox, apiBase, authService);
  const wsProtocol = (typeof window !== 'undefined' && window.location?.protocol === 'https:') ? 'wss:' : 'ws:';
  const wsUrl = (typeof window !== 'undefined' && window.location?.origin && !window.location.origin.startsWith('file://'))
    ? `${wsProtocol}//${window.location.host}/ws`
    : 'ws://127.0.0.1:8765/ws';
  const wsClient = new WebSocketClient(wsUrl, conversationManager, (connected) => {
    console.log('[App] WebSocket connection status:', connected);
  }, authService);
  wsClient.connect();



  // 7. Initial Model Load
  try {
    await avatarController.loadCostume('casual');
    showBubble('主人好！今天有什麼我可以陪你的嗎？', 'happy');
  } catch (err) {
    console.warn('[App] Initial model load notice:', err);
    showBubble('主人好！今天有什麼我可以陪你的嗎？', 'happy');
  }

  // 8. Bind Electron IPC listeners (Tray & Global Shortcuts)
  if (window.electronAPI) {
    window.electronAPI.onReturn(() => {
      actionController.dispatch({
        reply: '我回來啦！',
        emotion: 'happy',
        action: 'return',
        costume: null
      });
    });

    window.electronAPI.onLeave(() => {
      actionController.dispatch({
        reply: '好呀，那我先去休息啦。',
        emotion: 'happy',
        action: 'leave',
        costume: null
      });
    });

    window.electronAPI.onCostumeChange((costume) => {
      let reply = '換好啦！主人覺得好看嗎？';
      if (costume === 'ayame') {
        reply = 'Konnakiri～！余是百鬼綾目！主人覺得余可愛嗎～😈';
      } else if (costume === 'mint') {
        reply = '哇！換成泳裝薄荷啦！主人覺得這套泳裝好看嗎～？🩱';
      }
      actionController.dispatch({
        reply,
        emotion: 'happy',
        action: 'change_costume',
        costume: costume
      });
    });

    window.electronAPI.onOpenSettings(() => {
      settingsModal.toggle(true);
    });

    window.electronAPI.onToggleView?.(() => {
      sceneManager.setCameraPreset('toggle');
      const isFull = sceneManager.targetCameraDist > 2.6;
      toolbar.setViewMode(isFull ? 'full' : 'bust');
    });
  }
});

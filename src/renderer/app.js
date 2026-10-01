import { SceneManager } from './core/SceneManager.js';
import { SnapshotService } from './core/SnapshotService.js';
import { ARManager } from './core/ARManager.js';
import { HandTracker } from './core/HandTracker.js';
import { RaycastManager } from './core/RaycastManager.js';
import { AvatarManager } from './vrm/AvatarManager.js';
import { AvatarController } from './vrm/AvatarController.js';
import { AnimationController } from './vrm/AnimationController.js';
import { EmotionController } from './vrm/EmotionController.js';
import { LipSyncController } from './vrm/LipSyncController.js';
import { EyeTrackingController } from './vrm/EyeTrackingController.js';
import { ActionController } from './vrm/ActionController.js';
import { PoseManager } from './vrm/PoseManager.js';
import { PuppetController } from './vrm/PuppetController.js';

import { Toolbar } from './ui/Toolbar.js';
import { ChatBox } from './ui/ChatBox.js';
import { CostumeSelector } from './ui/CostumeSelector.js';
import { ActionSelector } from './ui/ActionSelector.js';
import { PoseModal } from './ui/PoseModal.js';
import { PuppetVisualizer } from './ui/PuppetVisualizer.js';
import { HeartWidget } from './ui/HeartWidget.js';
import { SettingsModal } from './ui/SettingsModal.js';
import { PuppetPoseBar } from './ui/PuppetPoseBar.js';
import { MultiAvatarBar } from './ui/MultiAvatarBar.js';

import { ConversationManager } from './services/ConversationManager.js';
import { WebSocketClient } from './services/WebSocketClient.js';

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

  let bubbleTimeout = null;

  function showBubble(text, emotion = 'happy') {
    clearTimeout(bubbleTimeout);
    dialogueMessage.innerText = text;
    dialogueEmotionTag.innerText = emotion;
    dialogueBubble.classList.remove('hidden');
    bubbleTimeout = setTimeout(() => {
      dialogueBubble.classList.add('hidden');
    }, 4500);
  }

  // 1. Initialize 3D Engine & Scene
  const sceneManager = new SceneManager(canvasContainer);

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

  sceneManager.addUpdatable(avatarController);
  sceneManager.addUpdatable(animationController);
  sceneManager.addUpdatable(emotionController);
  sceneManager.addUpdatable(lipSyncController);
  sceneManager.addUpdatable(eyeTrackingController);

  // Mobile Web Audio autoplay policy unlock on first user gesture
  const unlockAudio = () => {
    if (lipSyncController.audioContext && lipSyncController.audioContext.state === 'suspended') {
      lipSyncController.audioContext.resume();
    }
  };
  window.addEventListener('touchstart', unlockAudio, { once: true });
  window.addEventListener('click', unlockAudio, { once: true });

  // F11 Fullscreen Canvas shortcut
  window.addEventListener('keydown', async (e) => {
    if (e.key === 'F11') {
      e.preventDefault();
      if (window.electronAPI?.toggleFullscreen) {
        const isFull = await window.electronAPI.toggleFullscreen();
        if (puppetPoseBar) puppetPoseBar.setFullscreenState(isFull);
        showBubble(isFull ? '🖥️ 已切換為全螢幕透明畫布模式！' : '已切換回桌面懸浮小視窗～', 'happy');
      }
    }
  });

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
    onHandUpdate: ({ x, y, isPinching }) => {
      puppetController.updateFinger(x, y, isPinching);
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
    puppetController.setEnabled(isPuppetMode);
    puppetVisualizer.setVisible(isPuppetMode);
    if (puppetPoseBar) puppetPoseBar.setVisible(isPuppetMode);
    if (toolbar) toolbar.setPuppetActive(isPuppetMode);
    if (multiAvatarBar?.element) {
      multiAvatarBar.element.classList.toggle('stacked-offset', isPuppetMode);
    }

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

  const snapshotService = new SnapshotService(sceneManager, arManager);
  const poseManager = new PoseManager(avatarController, animationController);
  const poseModal = new PoseModal(uiContainer, poseManager, sceneManager, showBubble);

  puppetController.setPoseManager(poseManager);
  const puppetPoseBar = new PuppetPoseBar(
    uiContainer,
    puppetController,
    poseManager,
    poseModal,
    (text, emotion) => showBubble(text, emotion),
    sceneManager
  );

  const multiAvatarBar = new MultiAvatarBar(
    uiContainer,
    avatarManager,
    (text, emotion) => showBubble(text, emotion)
  );

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
    if (trimmed === '/fullscreen' || trimmed === '/fs') {
      if (window.electronAPI?.toggleFullscreen) {
        const isFull = await window.electronAPI.toggleFullscreen();
        puppetPoseBar.setFullscreenState(isFull);
        showBubble(isFull ? '🖥️ 已切換為全螢幕透明畫布模式！' : '已切換回桌面懸浮小視窗～', 'happy');
      }
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
    if (trimmed === '/clone' || trimmed === '/clone toggle') {
      const isVis = multiAvatarBar.toggle();
      toolbar.setCloneActive(isVis);
      return true;
    }
    if (trimmed === '/clone on') {
      multiAvatarBar.setVisible(true);
      toolbar.setCloneActive(true);
      return true;
    }
    if (trimmed === '/clone off') {
      multiAvatarBar.setVisible(false);
      toolbar.setCloneActive(false);
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
    conversationManager.handleUserMessage(msg);
  }, handleSlashCommand);

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

  const apiBase = (typeof window !== 'undefined' && window.location?.origin && !window.location.origin.startsWith('file://'))
    ? window.location.origin
    : 'http://127.0.0.1:8765';

  const settingsModal = new SettingsModal(uiContainer, async (newConfig) => {
    try {
      await fetch(`${apiBase}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      showBubble('設定已成功儲存與更新！', 'happy');
    } catch (e) {
      console.warn('[App] Error saving config:', e);
    }
  });

  const toolbar = new Toolbar(uiContainer, {
    onMic: async () => {
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
    onClone: () => {
      const isVis = multiAvatarBar.toggle();
      toolbar.setCloneActive(isVis);
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
    }
  });

  // Enable pointer events for active UI children
  [toolbar.element, chatBox.element, costumeSelector.element, actionSelector.element, poseModal.element, heartWidget.element, settingsModal.element, puppetPoseBar.element, multiAvatarBar.element].forEach(el => {
    if (el) el.style.pointerEvents = 'auto';
  });

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
        canvasContainer.style.display = 'none';
        toolbar.element.style.display = 'none';
        chatBox.toggle(false);
        costumeSelector.toggle(false);
        actionSelector.toggle(false);
        poseModal.toggle(false);
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
  });
  raycastManager.setPuppetController(puppetController);
  toolbar.setPuppetActive(false);

  // 6. Services
  const conversationManager = new ConversationManager(actionController, chatBox);
  const wsClient = new WebSocketClient('ws://127.0.0.1:8765/ws', conversationManager, (connected) => {
    console.log('[App] WebSocket connection status:', connected);
  });
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

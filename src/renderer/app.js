import { SceneManager } from './core/SceneManager.js';
import { SnapshotService } from './core/SnapshotService.js';
import { RaycastManager } from './core/RaycastManager.js';
import { AvatarController } from './vrm/AvatarController.js';
import { AnimationController } from './vrm/AnimationController.js';
import { EmotionController } from './vrm/EmotionController.js';
import { LipSyncController } from './vrm/LipSyncController.js';
import { EyeTrackingController } from './vrm/EyeTrackingController.js';
import { ActionController } from './vrm/ActionController.js';
import { PoseManager } from './vrm/PoseManager.js';

import { Toolbar } from './ui/Toolbar.js';
import { ChatBox } from './ui/ChatBox.js';
import { CostumeSelector } from './ui/CostumeSelector.js';
import { ActionSelector } from './ui/ActionSelector.js';
import { PoseModal } from './ui/PoseModal.js';
import { HeartWidget } from './ui/HeartWidget.js';
import { SettingsModal } from './ui/SettingsModal.js';

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

  // 2. Initialize Controllers
  const avatarController = new AvatarController(sceneManager);
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

  // 3. UI & Feature Modules
  let isResting = false;

  const snapshotService = new SnapshotService(sceneManager);
  const poseManager = new PoseManager(avatarController, animationController);
  const poseModal = new PoseModal(uiContainer, poseManager, sceneManager, showBubble);

  const handleSlashCommand = (cmdText) => {
    const trimmed = cmdText.trim();
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
      snapshotService.capture({ transparent: false });
      showBubble('📸 喀嚓！照片已儲存並下載！', 'happy');
      chatBox.addAssistantMessage('📸 拍照完成！已經為主人下載存檔囉～');
      return true;
    }
    if (trimmed === '/photo transparent' || trimmed === '/snapshot transparent') {
      snapshotService.capture({ transparent: true });
      showBubble('📸 喀嚓！透明去背照片已儲存並下載！', 'happy');
      chatBox.addAssistantMessage('📸 透明去背照片拍照完成！已經為主人下載存檔囉～');
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
    let reply = '好呀，馬上換裝給你看！';
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
    onSnapshot: () => {
      snapshotService.capture({ transparent: false });
      showBubble('📸 喀嚓！照片已成功儲存並下載！', 'happy');
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
  [toolbar.element, chatBox.element, costumeSelector.element, actionSelector.element, poseModal.element, heartWidget.element, settingsModal.element].forEach(el => {
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
        canvasContainer.style.display = 'none';
        toolbar.element.style.display = 'none';
        chatBox.toggle(false);
        costumeSelector.toggle(false);
        actionSelector.toggle(false);
        poseModal.toggle(false);
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

  // 5. Raycast Interaction (Head Pat vs Drag)
  new RaycastManager(sceneManager, avatarController, (hitPoint) => {
    if (!isResting) {
      actionController.triggerHeadPat(hitPoint);
    }
  });

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

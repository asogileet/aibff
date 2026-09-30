import { SceneManager } from './core/SceneManager.js';
import { RaycastManager } from './core/RaycastManager.js';
import { AvatarController } from './vrm/AvatarController.js';
import { AnimationController } from './vrm/AnimationController.js';
import { EmotionController } from './vrm/EmotionController.js';
import { LipSyncController } from './vrm/LipSyncController.js';
import { EyeTrackingController } from './vrm/EyeTrackingController.js';
import { ActionController } from './vrm/ActionController.js';

import { Toolbar } from './ui/Toolbar.js';
import { ChatBox } from './ui/ChatBox.js';
import { CostumeSelector } from './ui/CostumeSelector.js';
import { HeartWidget } from './ui/HeartWidget.js';
import { SettingsModal } from './ui/SettingsModal.js';

import { ConversationManager } from './services/ConversationManager.js';
import { WebSocketClient } from './services/WebSocketClient.js';

window.addEventListener('DOMContentLoaded', async () => {
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

  // 3. UI Modules
  let isResting = false;

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
  });

  const costumeSelector = new CostumeSelector(uiContainer, (costumeId) => {
    actionController.dispatch({
      reply: '好呀，馬上換裝給你看！',
      emotion: 'happy',
      action: 'change_costume',
      costume: costumeId
    });
  });

  const settingsModal = new SettingsModal(uiContainer, async (newConfig) => {
    try {
      await fetch('http://127.0.0.1:8765/api/config', {
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
  [toolbar.element, chatBox.element, costumeSelector.element, heartWidget.element, settingsModal.element].forEach(el => {
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
    }
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
  await avatarController.loadCostume('casual');
  showBubble('主人好！今天有什麼我可以陪你的嗎？', 'happy');

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
      actionController.dispatch({
        reply: '換好啦！主人覺得好看嗎？',
        emotion: 'happy',
        action: 'change_costume',
        costume: costume
      });
    });

    window.electronAPI.onOpenSettings(() => {
      settingsModal.toggle(true);
    });
  }
});

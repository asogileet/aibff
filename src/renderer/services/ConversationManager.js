export class ConversationManager {
  constructor(actionController, chatBox, backendBaseUrl = 'http://127.0.0.1:8765') {
    this.actionController = actionController;
    this.chatBox = chatBox;
    this.baseUrl = backendBaseUrl;
    this.isProcessing = false;
  }

  async handleUserMessage(message) {
    if (!message || this.isProcessing) return;
    this.isProcessing = true;

    // Check voice recall keywords if character was resting
    const trimmed = message.trim();
    if (['回來', '出來', '我想你了', '回到桌面'].some(k => trimmed.includes(k))) {
      await this.actionController.dispatch({
        reply: '我回來啦！主人有沒有想我呀？',
        emotion: 'happy',
        action: 'return',
        costume: null
      });
      this.isProcessing = false;
      return;
    }

    try {
      // Immediately notify UI that AI is thinking
      if (this.chatBox) {
        this.chatBox.addAssistantMessage("小櫻正在思考中... 💭");
      }
      if (typeof this.actionController.uiCallbacks?.showDialogue === 'function') {
        this.actionController.uiCallbacks.showDialogue("小櫻正在思考中... 💭", "thinking");
      }

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed })
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      // Remove temporary thinking bubble and add assistant message to chat window
      if (this.chatBox && data.reply) {
        this.chatBox.removeLastMessage();
        this.chatBox.addAssistantMessage(data.reply);
      }

      // Dispatch through Action state machine
      await this.actionController.dispatch(data, data.audio_base64);

    } catch (err) {
      console.warn('[ConversationManager] Request failed, using client-side fallback:', err);
      // Client-side fallback if backend is momentarily unreachable
      const fallbackResult = this._getClientFallback(trimmed);
      if (this.chatBox) {
        this.chatBox.addAssistantMessage(fallbackResult.reply);
      }
      await this.actionController.dispatch(fallbackResult, null);
    } finally {
      this.isProcessing = false;
    }
  }

  async speakText(text) {
    try {
      const response = await fetch(`${this.baseUrl}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.audio_base64) {
          await this.actionController.lipSyncController.playAudioBase64(data.audio_base64);
        }
      }
    } catch (e) {
      console.warn('[ConversationManager] TTS speech request failed:', e);
    }
  }

  _getClientFallback(message) {
    if (message.includes('累') || message.includes('辛苦')) {
      return {
        reply: '辛苦啦，今天是不是又忙了一整天？要不要先休息一下，我陪你聊聊。',
        emotion: 'caring',
        action: 'comfort',
        costume: null
      };
    }
    if (message.includes('去休息') || message.includes('離開') || message.includes('晚安')) {
      return {
        reply: '好呀，那我先去休息啦，記得早點休息哦。',
        emotion: 'happy',
        action: 'leave',
        costume: null
      };
    }
    if (message.includes('水手服') || message.includes('學生裝')) {
      return {
        reply: '好呀，馬上換成水手服給你看！',
        emotion: 'happy',
        action: 'change_costume',
        costume: 'school'
      };
    }
    return {
      reply: '收到啦，主人！我在這裡一直陪伴著你呢。',
      emotion: 'happy',
      action: 'idle',
      costume: null
    };
  }
}

export class ConversationManager {
  constructor(actionController, chatBox, backendBaseUrl = null) {
    this.actionController = actionController;
    this.chatBox = chatBox;
    if (backendBaseUrl) {
      this.baseUrl = backendBaseUrl;
    } else if (typeof window !== 'undefined' && window.location?.origin && !window.location.origin.startsWith('file://')) {
      this.baseUrl = window.location.origin;
    } else {
      this.baseUrl = 'http://127.0.0.1:8765';
    }
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

    // Check Slash Commands (e.g. /heart, /bow, /clap, /tilt, /stretch, /nod, /shake, /cheer, /pout, /wave)
    if (trimmed.startsWith('/')) {
      const slashMap = {
        '/heart': 'heart_pose',
        '/love': 'heart_pose',
        '/bow': 'bow',
        '/thanks': 'bow',
        '/clap': 'clap',
        '/applause': 'clap',
        '/tilt': 'tilt_head',
        '/stretch': 'stretch',
        '/nod': 'nod',
        '/shake': 'shake_head',
        '/cheer': 'cheer',
        '/pout': 'pout',
        '/angry': 'pout',
        '/wave': 'wave',
        '/sit': 'sit',
        '/run': 'run',
        '/jump': 'jump',
        '/squat': 'squat',
        '/crouch': 'squat',
        '/kneel': 'kneel',
        '/seiza': 'kneel',
        '/stand': 'stand',
        '/stop': 'stand',
        '/up': 'stand',
        '/idle': 'stand',
        '/casual': { costume: 'casual', action: 'change_costume' },
        '/school': { costume: 'school', action: 'change_costume' },
        '/stylish': { costume: 'stylish', action: 'change_costume' },
        '/gothic': { costume: 'gothic', action: 'change_costume' },
        '/seed': { costume: 'seed', action: 'change_costume' }
      };

      const cmdKey = trimmed.toLowerCase().split(' ')[0];
      const matched = slashMap[cmdKey];
      if (matched) {
        const dispatchPayload = typeof matched === 'string' ? { action: matched } : matched;
        const defaultQuote = typeof matched === 'string' && this.actionController.actionDefaultQuotes[matched]
          ? this.actionController.actionDefaultQuotes[matched].text
          : '收到指令囉！';

        if (this.chatBox) {
          this.chatBox.addAssistantMessage(defaultQuote);
        }

        await this.actionController.dispatch(dispatchPayload);
        this.isProcessing = false;
        return;
      }
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

      // Defensive check: if reply contains raw JSON string or python dict string, extract dialogue content
      if (typeof data.reply === 'string') {
        const trimmedReply = data.reply.trim();
        if (trimmedReply.startsWith('{') || trimmedReply.startsWith('[')) {
          try {
            const parsed = JSON.parse(trimmedReply);
            const target = Array.isArray(parsed) ? parsed[0] : parsed;
            if (target && typeof target === 'object') {
              data.reply = target.response || target.reply || target.message || target.content || target.text || data.reply;
            }
          } catch (_) {
            // Support single and double quotes for vision content blocks like {'type': 'text', 'text': '...'}
            const match = trimmedReply.match(/['"](?:response|reply|message|content|text)['"]\s*:\s*['"]((?:\\.|[^'"])*)['"]/i);
            if (match && match[1]) {
              data.reply = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'");
            }
          }
        }
      }

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
    if (message.includes('愛心') || message.includes('比心') || message.includes('愛你')) {
      return {
        reply: '給主人一個大大的愛心！今天也要超級開心哦～',
        emotion: 'shy',
        action: 'heart_pose',
        costume: null
      };
    }
    if (message.includes('鞠躬') || message.includes('謝謝') || message.includes('感謝')) {
      return {
        reply: '十分感謝主人的照顧！今後也請多多指教呢～',
        emotion: 'happy',
        action: 'bow',
        costume: null
      };
    }
    if (message.includes('拍手') || message.includes('鼓掌') || message.includes('太棒') || message.includes('厲害')) {
      return {
        reply: '哇！太棒太厲害了！主人真是太優秀啦！',
        emotion: 'happy',
        action: 'clap',
        costume: null
      };
    }
    if (message.includes('歪頭') || message.includes('賣萌')) {
      return {
        reply: '嗯？主人在看小櫻嗎？小櫻今天可愛嗎～？',
        emotion: 'happy',
        action: 'tilt_head',
        costume: null
      };
    }
    if (message.includes('伸懶腰') || message.includes('放鬆')) {
      return {
        reply: '哈啊～好舒服！主人也跟小櫻一起站起來動一動吧～',
        emotion: 'caring',
        action: 'stretch',
        costume: null
      };
    }
    if (message.includes('歡呼') || message.includes('萬歲') || message.includes('慶祝')) {
      return {
        reply: '萬歲！太好了！今天真是最棒的一天呢！',
        emotion: 'happy',
        action: 'cheer',
        costume: null
      };
    }
    if (message.includes('點頭') || message.includes('贊成') || message.includes('沒問題')) {
      return {
        reply: '嗯嗯！小櫻完全贊成主人的想法哦！',
        emotion: 'happy',
        action: 'nod',
        costume: null
      };
    }
    if (message.includes('不要') || message.includes('搖頭') || message.includes('不行')) {
      return {
        reply: '不可以這樣啦～主人偶爾也要聽小櫻的話嘛！',
        emotion: 'shy',
        action: 'shake_head',
        costume: null
      };
    }
    if (message.includes('生氣') || message.includes('哼') || message.includes('叉腰') || message.includes('不理')) {
      return {
        reply: '哼～！主人如果再不理小櫻，小櫻可真的要生氣囉！',
        emotion: 'angry',
        action: 'pout',
        costume: null
      };
    }
    if (message.includes('早安') || message.includes('你好') || message.includes('嗨') || message.includes('揮手')) {
      return {
        reply: '主人好呀！小櫻隨時都在這裡陪著你哦～',
        emotion: 'happy',
        action: 'wave',
        costume: null
      };
    }
    if (message.includes('站起來') || message.includes('站好') || message.includes('起來') || message.includes('站著') || message.includes('停下來') || message.includes('停止')) {
      return {
        reply: '小櫻站好囉！主人還有什麼想看的動作嗎？',
        emotion: 'happy',
        action: 'stand',
        costume: null
      };
    }
    if (message.includes('坐下') || message.includes('坐著')) {
      return {
        reply: '小櫻乖乖坐下了哦，主人要坐在小櫻旁邊嗎？',
        emotion: 'happy',
        action: 'sit',
        costume: null
      };
    }
    if (message.includes('跑步') || message.includes('跑起來') || message.includes('慢跑')) {
      return {
        reply: '一、二、一、二！跟主人一起運動跑步真開心！',
        emotion: 'happy',
        action: 'run',
        costume: null
      };
    }
    if (message.includes('跳起來') || message.includes('跳一下') || message.includes('跳躍')) {
      return {
        reply: '嘿咻——！跳得很高吧？小櫻今天活力滿滿呢！',
        emotion: 'happy',
        action: 'jump',
        costume: null
      };
    }
    if (message.includes('蹲下') || message.includes('蹲著')) {
      return {
        reply: '蹲在地上抬頭看主人，視角好特別呢～',
        emotion: 'happy',
        action: 'squat',
        costume: null
      };
    }
    if (message.includes('跪下') || message.includes('跪坐') || message.includes('跪著')) {
      return {
        reply: '正襟跪坐……主人有什麼重要的事要吩咐小櫻嗎？',
        emotion: 'caring',
        action: 'kneel',
        costume: null
      };
    }
    if (message.includes('累') || message.includes('辛苦')) {
      return {
        reply: '辛苦啦，今天是不是又忙了一整天？要不要先休息一下，我陪你聊聊。',
        emotion: 'caring',
        action: 'stretch',
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

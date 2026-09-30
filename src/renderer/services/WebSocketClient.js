export class WebSocketClient {
  constructor(url, conversationManager, onStatusChange) {
    this.url = url || 'ws://127.0.0.1:8765/ws';
    this.conversationManager = conversationManager;
    this.onStatusChange = onStatusChange;
    this.ws = null;
    this.mediaRecorder = null;
    this.audioStream = null;
    this.audioChunks = [];
  }

  connect() {
    try {
      this.ws = new WebSocket(this.url);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        console.log('[WebSocketClient] Connected to backend service.');
        this.onStatusChange?.(true);
      };

      this.ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'dialogue_response') {
            if (data.user_text && this.conversationManager.chatBox) {
              this.conversationManager.chatBox.addUserMessage(data.user_text);
            }
            if (data.reply && this.conversationManager.chatBox) {
              this.conversationManager.chatBox.addAssistantMessage(data.reply);
            }
            await this.conversationManager.actionController.dispatch(data, data.audio_base64);
          }
        } catch (e) {
          console.warn('[WebSocketClient] Failed to parse message:', e);
        }
      };

      this.ws.onclose = () => {
        this.onStatusChange?.(false);
        // Retry connection in 3 seconds
        setTimeout(() => this.connect(), 3000);
      };
    } catch (err) {
      console.warn('[WebSocketClient] Connection failed:', err);
    }
  }

  async startListening(onStateChange) {
    if (this.isListening) return;

    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];

      // Prefer audio/webm;codecs=opus or standard audio/webm
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '');

      this.mediaRecorder = mimeType ? new MediaRecorder(this.audioStream, { mimeType }) : new MediaRecorder(this.audioStream);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      this.mediaRecorder.start();
      this.isListening = true;
      onStateChange?.(true);

      const showDialogue = this.conversationManager?.actionController?.uiCallbacks?.showDialogue;
      if (typeof showDialogue === 'function') {
        showDialogue('小櫻正在聆聽中... 🎙️', 'happy');
      }
    } catch (e) {
      console.warn('[WebSocketClient] Microphone access error:', e);
      this.isListening = false;
      onStateChange?.(false);

      const showDialogue = this.conversationManager?.actionController?.uiCallbacks?.showDialogue;
      if (typeof showDialogue === 'function') {
        showDialogue('無法存取麥克風，請檢查 Windows 權限設定。', 'surprised');
      }
    }
  }

  async stopListening(onStateChange) {
    if (!this.isListening) return;
    this.isListening = false;
    onStateChange?.(false);

    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      this._cleanupAudioStream();
      return;
    }

    return new Promise((resolve) => {
      this.mediaRecorder.onstop = async () => {
        this._cleanupAudioStream();

        const showDialogue = this.conversationManager?.actionController?.uiCallbacks?.showDialogue;

        if (this.audioChunks.length === 0) {
          resolve();
          return;
        }

        const mimeType = this.mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        this.audioChunks = [];

        // Check if recorded data contains sufficient audio content
        if (audioBlob.size < 1000) {
          if (typeof showDialogue === 'function') {
            showDialogue('小櫻沒有聽清楚，可以再說一次嗎？', 'shy');
          }
          resolve();
          return;
        }

        if (typeof showDialogue === 'function') {
          showDialogue('語音辨識中... 💭', 'thinking');
        }

        try {
          const formData = new FormData();
          formData.append('file', audioBlob, 'speech.webm');

          const response = await fetch(`${this.conversationManager.baseUrl}/api/stt`, {
            method: 'POST',
            body: formData
          });

          if (response.ok) {
            const data = await response.json();
            const text = data.text ? data.text.trim() : '';
            if (text) {
              console.log('[WebSocketClient] Recognized speech text:', text);
              await this.conversationManager.handleUserMessage(text);
            } else {
              if (typeof showDialogue === 'function') {
                showDialogue('小櫻沒有聽清楚，可以再說一次嗎？', 'shy');
              }
            }
          } else {
            console.warn('[WebSocketClient] STT request failed with status:', response.status);
          }
        } catch (err) {
          console.warn('[WebSocketClient] STT communication error:', err);
        } finally {
          resolve();
        }
      };

      this.mediaRecorder.stop();
    });
  }

  _cleanupAudioStream() {
    if (this.audioStream) {
      try {
        this.audioStream.getTracks().forEach((track) => track.stop());
      } catch (err) {
        console.warn('[WebSocketClient] Error stopping audio tracks:', err);
      }
      this.audioStream = null;
    }
  }

  async toggleListening(onStateChange) {
    if (this.isListening) {
      await this.stopListening(onStateChange);
    } else {
      await this.startListening(onStateChange);
    }
    return this.isListening;
  }
}


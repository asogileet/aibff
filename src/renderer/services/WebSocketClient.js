export class WebSocketClient {
  constructor(url, conversationManager, onStatusChange, authService = null) {
    if (url) {
      this.url = url;
    } else if (typeof window !== 'undefined' && window.location?.origin && !window.location.origin.startsWith('file://')) {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.url = `${wsProtocol}//${window.location.host}/ws`;
    } else {
      this.url = 'ws://127.0.0.1:8765/ws';
    }
    this.conversationManager = conversationManager;
    this.onStatusChange = onStatusChange;
    this.authService = authService;
    this.ws = null;
    this.mediaRecorder = null;
    this.audioStream = null;
    this.audioChunks = [];
    this.recordedMimeType = '';
  }

  connect() {
    try {
      let targetUrl = this.url;
      const token = this.authService?.getToken();
      if (token) {
        const separator = targetUrl.includes('?') ? '&' : '?';
        targetUrl = `${targetUrl}${separator}token=${encodeURIComponent(token)}`;
      }

      this.ws = new WebSocket(targetUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        console.log('[WebSocketClient] Connected to backend service at:', targetUrl);
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

    // Check Secure Context for microphone access
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('[WebSocketClient] navigator.mediaDevices.getUserMedia is unavailable.');
      this.isListening = false;
      onStateChange?.(false);

      const showDialogue = this.conversationManager?.actionController?.uiCallbacks?.showDialogue;
      if (typeof showDialogue === 'function') {
        const isSecure = window.isSecureContext ?? (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        if (!isSecure) {
          showDialogue('手機瀏覽器限制：麥克風需在 HTTPS 或安全連線（如 ngrok）下才能開啟喔！', 'surprised');
        } else {
          showDialogue('無法存取麥克風設備，請確認裝置與瀏覽器權限。', 'surprised');
        }
      }
      return;
    }

    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];

      // Determine supported mimeType (iOS Safari only supports audio/mp4 / audio/aac)
      let mimeType = '';
      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/aac',
        'audio/ogg'
      ];
      for (const t of preferredTypes) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) {
          mimeType = t;
          break;
        }
      }

      this.recordedMimeType = mimeType;
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
        const isSecure = window.isSecureContext ?? (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        if (!isSecure) {
          showDialogue('手機瀏覽器限制：麥克風需在 HTTPS 或安全連線（如 ngrok）下才能啟用喔！', 'surprised');
        } else {
          showDialogue('無法存取麥克風，請檢查裝置的瀏覽器權限設定。', 'surprised');
        }
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

        const actualMimeType = this.mediaRecorder.mimeType || this.recordedMimeType || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: actualMimeType });
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
          const ext = actualMimeType.includes('mp4') ? 'mp4'
            : (actualMimeType.includes('aac') ? 'm4a'
            : (actualMimeType.includes('ogg') ? 'ogg' : 'webm'));
          const formData = new FormData();
          formData.append('file', audioBlob, `speech.${ext}`);

          const headers = {
            ...(this.authService ? this.authService.getAuthHeaders() : {})
          };

          const response = await fetch(`${this.conversationManager.baseUrl}/api/stt`, {
            method: 'POST',
            headers,
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


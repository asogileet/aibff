export class SettingsModal {
  constructor(container, onSaveConfig) {
    this.container = container;
    this.onSaveConfig = onSaveConfig;
    this.element = null;
    this.currentConfig = null;

    this._render();
  }

  _render() {
    this.element = document.createElement('div');
    this.element.id = 'settingsModal';
    this.element.className = 'hidden absolute inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4';

    this.element.innerHTML = `
      <div class="glass-panel w-full max-w-xl rounded-2xl p-5 border border-slate-700 shadow-2xl max-h-[92%] overflow-y-auto custom-scrollbar">
        <div class="flex items-center justify-between pb-3 border-b border-slate-700">
          <div class="flex items-center space-x-2">
            <span class="text-xl">⚙️</span>
            <h3 class="text-sm font-bold text-slate-200">系統與 AI 核心配置面板</h3>
          </div>
          <button id="btnCloseSettings" class="text-slate-400 hover:text-white">✕</button>
        </div>

        <div class="space-y-4 mt-4 text-xs">
          <!-- LLM -->
          <div>
            <h4 class="font-semibold text-pink-400 mb-2 flex items-center space-x-1.5">
              <span>🧠</span> <span>本地 LLM (Ollama / OpenAI 相容)</span>
            </h4>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-slate-400 mb-1">API URL (Ollama 或 OpenAI)</label>
                <input id="cfgLlmUrl" type="text" value="http://127.0.0.1:11434" class="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200" />
              </div>
              <div>
                <label class="block text-slate-400 mb-1">模型名稱 (Model Name)</label>
                <input id="cfgLlmModel" type="text" value="qwen3.8:27b" class="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200" />
              </div>
            </div>
          </div>

          <!-- Persona -->
          <div>
            <h4 class="font-semibold text-pink-400 mb-2 flex items-center space-x-1.5">
              <span>💖</span> <span>女友身份與個性配置 (Persona)</span>
            </h4>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-slate-400 mb-1">角色名字</label>
                <input id="cfgCharName" type="text" value="小櫻" class="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200" />
              </div>
              <div>
                <label class="block text-slate-400 mb-1">使用者稱呼</label>
                <input id="cfgUserNickname" type="text" value="主人" class="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200" />
              </div>
              <div class="col-span-2">
                <label class="block text-slate-400 mb-1">性格 System Prompt</label>
                <textarea id="cfgSystemPrompt" rows="2" class="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200">生活在 Windows 桌面的可愛、自然、有情緒反饋的 AI 女友。回覆自然簡短且輸出結構化意圖 JSON。</textarea>
              </div>
            </div>
          </div>

          <!-- TTS -->
          <div>
            <h4 class="font-semibold text-pink-400 mb-2 flex items-center space-x-1.5">
              <span>🔊</span> <span>語音合成 (Edge-TTS 模組化)</span>
            </h4>
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="block text-slate-400 mb-1">音色 (Voice)</label>
                <select id="cfgTtsVoice" class="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200">
                  <option value="zh-CN-XiaoxiaoNeural" selected>曉曉 (Xiaoxiao)</option>
                  <option value="zh-CN-XiaoyiNeural">曉伊 (Xiaoyi)</option>
                  <option value="zh-CN-YunjianNeural">雲健 (Yunjian)</option>
                </select>
              </div>
              <div>
                <label class="block text-slate-400 mb-1">語速 (Rate)</label>
                <input id="cfgTtsRate" type="text" value="+0%" class="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200" />
              </div>
              <div>
                <label class="block text-slate-400 mb-1">音量 (Volume)</label>
                <input id="cfgTtsVolume" type="text" value="+0%" class="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200" />
              </div>
            </div>
          </div>

          <!-- STT -->
          <div>
            <h4 class="font-semibold text-pink-400 mb-2 flex items-center space-x-1.5">
              <span>🎙️</span> <span>語音識別 (Faster-Whisper CUDA)</span>
            </h4>
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="block text-slate-400 mb-1">模型尺寸</label>
                <select id="cfgSttModel" class="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200">
                  <option value="small" selected>small</option>
                  <option value="medium">medium</option>
                  <option value="large-v3">large-v3</option>
                </select>
              </div>
              <div>
                <label class="block text-slate-400 mb-1">運算類型</label>
                <input type="text" value="float16 (CUDA)" disabled class="w-full bg-slate-900/60 border border-slate-700 rounded p-1.5 text-slate-400" />
              </div>
              <div>
                <label class="block text-slate-400 mb-1">VAD 靜音門檻</label>
                <input id="cfgSttVad" type="number" value="500" class="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200" />
              </div>
            </div>
          </div>

          <!-- System -->
          <div>
            <h4 class="font-semibold text-pink-400 mb-2 flex items-center space-x-1.5">
              <span>⚡</span> <span>快捷鍵與系統設定</span>
            </h4>
            <div class="grid grid-cols-2 gap-3">
              <div class="flex items-center space-x-2">
                <input type="checkbox" id="cfgStartup" class="rounded accent-pink-500" checked />
                <label for="cfgStartup" class="text-slate-300">開機自動啟動</label>
              </div>
              <div class="flex items-center space-x-2">
                <input type="checkbox" id="cfgTray" class="rounded accent-pink-500" checked />
                <label for="cfgTray" class="text-slate-300">最小化到 Windows 托盤</label>
              </div>
              <div class="col-span-2">
                <label class="block text-slate-400 mb-1">全域快捷鍵</label>
                <input type="text" value="Ctrl + Alt + G" disabled class="w-full bg-slate-900/60 border border-slate-700 rounded p-1.5 text-slate-400 font-mono" />
              </div>
            </div>
          </div>
        </div>

        <div class="mt-5 flex justify-end space-x-3 pt-3 border-t border-slate-700">
          <button id="btnCancelSettings" class="px-4 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs">取消</button>
          <button id="btnSaveSettings" class="px-4 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold">儲存設定</button>
        </div>
      </div>
    `;

    this.container.appendChild(this.element);

    this.element.querySelector('#btnCloseSettings').addEventListener('click', () => this.toggle(false));
    this.element.querySelector('#btnCancelSettings').addEventListener('click', () => this.toggle(false));
    this.element.querySelector('#btnSaveSettings').addEventListener('click', () => this._save());
  }

  toggle(visible = null) {
    if (visible === null) {
      this.element.classList.toggle('hidden');
    } else if (visible) {
      this.element.classList.remove('hidden');
    } else {
      this.element.classList.add('hidden');
    }
  }

  _save() {
    const payload = {
      llm: {
        api_url: this.element.querySelector('#cfgLlmUrl').value.trim(),
        model_name: this.element.querySelector('#cfgLlmModel').value.trim()
      },
      character: {
        name: this.element.querySelector('#cfgCharName').value.trim(),
        user_nickname: this.element.querySelector('#cfgUserNickname').value.trim(),
        system_prompt: this.element.querySelector('#cfgSystemPrompt').value.trim()
      },
      tts: {
        voice: this.element.querySelector('#cfgTtsVoice').value,
        rate: this.element.querySelector('#cfgTtsRate').value.trim(),
        volume: this.element.querySelector('#cfgTtsVolume').value.trim()
      },
      stt: {
        model_size: this.element.querySelector('#cfgSttModel').value,
        vad_silence_duration_ms: parseInt(this.element.querySelector('#cfgSttVad').value, 10) || 500
      }
    };

    const startupEnabled = this.element.querySelector('#cfgStartup').checked;
    if (window.electronAPI?.setStartup) {
      window.electronAPI.setStartup(startupEnabled);
    }

    if (typeof this.onSaveConfig === 'function') {
      this.onSaveConfig(payload);
    }
    this.toggle(false);
  }
}

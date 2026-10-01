export class SettingsModal {
  constructor(container, onSaveConfig) {
    this.container = container;
    this.onSaveConfig = onSaveConfig;
    this.element = null;
    this.currentConfig = null;
    this.currentProvider = 'ollama';

    this.providerPresets = {
      ollama: {
        name: 'Ollama (本地)',
        defaultUrl: 'http://127.0.0.1:11434',
        showKey: false,
        models: [
          { label: 'Qwen 2.5 7B (推薦)', value: 'qwen2.5:7b' },
          { label: 'Qwen 2.5 14B', value: 'qwen2.5:14b' },
          { label: 'Llama 3.1 8B', value: 'llama3.1:8b' },
          { label: 'DeepSeek R1 8B', value: 'deepseek-r1:8b' },
          { label: '本地 GGUF 模型 (Qwen3.6-35B)', value: 'models\\Qwen3.6-35B-A3B-Uncensored-HauhauCS-Aggressive-IQ2_M.gguf' },
          { label: '自訂其他模型...', value: 'custom' }
        ]
      },
      nvidia: {
        name: 'NVIDIA NIM (雲端)',
        defaultUrl: 'https://integrate.api.nvidia.com/v1',
        showKey: true,
        models: [
          { label: 'Llama 3.2 11B (推薦，秒回自然流暢)', value: 'meta/llama-3.2-11b-vision-instruct' },
          { label: 'DeepSeek v4.1 Flash (高智商思考旗艦)', value: 'deepseek-ai/deepseek-v4.1-flash' },
          { label: 'Llama 3.2 90B (超大參數量視覺模型)', value: 'meta/llama-3.2-90b-vision-instruct' },
          { label: 'GLM 5.3 Flash (極速輕量)', value: 'z-ai/glm-5.3-flash' },
          { label: '自訂其他 NVIDIA 模型...', value: 'custom' }
        ]
      },
      custom: {
        name: '自訂相容 API',
        defaultUrl: 'http://127.0.0.1:8080/v1',
        showKey: true,
        models: [
          { label: '預設模型 (default)', value: 'default' },
          { label: '自訂其他模型...', value: 'custom' }
        ]
      }
    };

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
          <!-- LLM Configuration & Multi-Provider Switch -->
          <div class="space-y-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
            <h4 class="font-semibold text-pink-400 flex items-center justify-between">
              <span class="flex items-center space-x-1.5">
                <span>🧠</span> <span>LLM 核心與提供者切換 (Provider)</span>
              </span>
              <span id="cfgLlmProviderBadge" class="text-[10px] px-2 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30">Ollama (本地)</span>
            </h4>

            <!-- Provider Mode Buttons -->
            <div class="grid grid-cols-3 gap-2">
              <button type="button" id="btnProvOllama" class="py-1.5 px-2 rounded-lg border text-xs font-medium transition flex items-center justify-center space-x-1 bg-pink-600/30 border-pink-500 text-pink-200 shadow-sm">
                <span>🦙</span> <span>Ollama</span>
              </button>
              <button type="button" id="btnProvNvidia" class="py-1.5 px-2 rounded-lg border text-xs font-medium transition flex items-center justify-center space-x-1 bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500">
                <span>🟢</span> <span>NVIDIA NIM</span>
              </button>
              <button type="button" id="btnProvCustom" class="py-1.5 px-2 rounded-lg border text-xs font-medium transition flex items-center justify-center space-x-1 bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500">
                <span>🌐</span> <span>自訂相容</span>
              </button>
            </div>

            <!-- API URL -->
            <div>
              <div class="flex justify-between items-center mb-1">
                <label class="block text-slate-400">API Base URL</label>
                <span id="cfgLlmUrlHint" class="text-[10px] text-slate-500 font-mono">預設: http://127.0.0.1:11434</span>
              </div>
              <input id="cfgLlmUrl" type="text" value="http://127.0.0.1:11434" class="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-slate-200 font-mono text-xs focus:border-pink-500 outline-none" />
            </div>

            <!-- API Key (For NVIDIA and Custom) -->
            <div id="cfgApiKeyContainer" class="hidden space-y-1">
              <div class="flex justify-between items-center">
                <label class="text-slate-400 flex items-center gap-1">
                  <span>🔑</span> <span>API Key (NVIDIA / 雲端授權)</span>
                </label>
                <a href="https://build.nvidia.com/" target="_blank" class="text-[10px] text-emerald-400 hover:underline">取得 nvapi key ↗</a>
              </div>
              <div class="relative">
                <input id="cfgLlmApiKey" type="password" placeholder="nvapi-xxxxxxxxxxxxxxxxxxxxxxxx" class="w-full bg-slate-950 border border-slate-700 rounded p-1.5 pr-14 text-slate-200 font-mono text-xs focus:border-pink-500 outline-none" />
                <button type="button" id="btnToggleApiKey" class="absolute right-1 top-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300">顯示</button>
              </div>
            </div>

            <!-- Model Selection & Presets -->
            <div>
              <div class="flex justify-between items-center mb-1">
                <label class="block text-slate-400">模型選擇 (Model)</label>
                <span class="text-[10px] text-slate-500">推薦預設或自訂輸入</span>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <select id="selectLlmPreset" class="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-slate-200 text-xs focus:border-pink-500 outline-none">
                </select>
                <input id="cfgLlmModel" type="text" value="qwen2.5:7b" class="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-slate-200 font-mono text-xs focus:border-pink-500 outline-none" placeholder="模型名稱" />
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
                <input type="checkbox" id="cfgStartup" class="rounded accent-pink-500" />
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

    // Event Bindings
    this.element.querySelector('#btnCloseSettings').addEventListener('click', () => this.toggle(false));
    this.element.querySelector('#btnCancelSettings').addEventListener('click', () => this.toggle(false));
    this.element.querySelector('#btnSaveSettings').addEventListener('click', () => this._save());

    // Provider Switching Listeners
    this.element.querySelector('#btnProvOllama').addEventListener('click', () => this.selectProvider('ollama'));
    this.element.querySelector('#btnProvNvidia').addEventListener('click', () => this.selectProvider('nvidia'));
    this.element.querySelector('#btnProvCustom').addEventListener('click', () => this.selectProvider('custom'));

    // Preset Selection Listener
    this.element.querySelector('#selectLlmPreset').addEventListener('change', (e) => {
      const val = e.target.value;
      if (val !== 'custom') {
        this.element.querySelector('#cfgLlmModel').value = val;
      }
    });

    // Toggle API Key Visibility
    this.element.querySelector('#btnToggleApiKey').addEventListener('click', () => {
      const keyInput = this.element.querySelector('#cfgLlmApiKey');
      const btn = this.element.querySelector('#btnToggleApiKey');
      if (keyInput.type === 'password') {
        keyInput.type = 'text';
        btn.innerText = '隱藏';
      } else {
        keyInput.type = 'password';
        btn.innerText = '顯示';
      }
    });

    // Populate initial provider
    this.selectProvider('ollama', false);
  }

  selectProvider(providerKey, preserveValues = false) {
    if (!this.providerPresets[providerKey]) return;
    this.currentProvider = providerKey;
    const preset = this.providerPresets[providerKey];

    // Update button styles
    const provs = ['ollama', 'nvidia', 'custom'];
    provs.forEach(p => {
      const btn = this.element.querySelector('#btnProv' + p.charAt(0).toUpperCase() + p.slice(1));
      if (btn) {
        if (p === providerKey) {
          btn.className = 'py-1.5 px-2 rounded-lg border text-xs font-medium transition flex items-center justify-center space-x-1 bg-pink-600/30 border-pink-500 text-pink-200 shadow-sm';
        } else {
          btn.className = 'py-1.5 px-2 rounded-lg border text-xs font-medium transition flex items-center justify-center space-x-1 bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500';
        }
      }
    });

    // Update badge & hints
    const badge = this.element.querySelector('#cfgLlmProviderBadge');
    if (badge) badge.innerText = preset.name;

    const urlHint = this.element.querySelector('#cfgLlmUrlHint');
    if (urlHint) urlHint.innerText = '預設: ' + preset.defaultUrl;

    const urlInput = this.element.querySelector('#cfgLlmUrl');
    if (urlInput && !preserveValues) {
      urlInput.value = preset.defaultUrl;
    }

    // Toggle API Key Container
    const keyContainer = this.element.querySelector('#cfgApiKeyContainer');
    if (keyContainer) {
      if (preset.showKey) {
        keyContainer.classList.remove('hidden');
      } else {
        keyContainer.classList.add('hidden');
      }
    }

    // Populate Model Presets
    const selectPreset = this.element.querySelector('#selectLlmPreset');
    if (selectPreset) {
      selectPreset.innerHTML = '';
      preset.models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.value;
        opt.textContent = m.label;
        selectPreset.appendChild(opt);
      });
    }

    const modelInput = this.element.querySelector('#cfgLlmModel');
    if (modelInput && !preserveValues) {
      modelInput.value = preset.models[0].value;
      if (selectPreset) selectPreset.value = preset.models[0].value;
    }
  }

  async loadConfig() {
    try {
      const res = await fetch('http://127.0.0.1:8765/api/config');
      if (!res.ok) return;
      const cfg = await res.json();
      this.currentConfig = cfg;

      if (cfg.llm) {
        const prov = cfg.llm.provider || 'ollama';
        this.selectProvider(prov, true);
        if (cfg.llm.api_url) this.element.querySelector('#cfgLlmUrl').value = cfg.llm.api_url;
        if (cfg.llm.model_name) {
          this.element.querySelector('#cfgLlmModel').value = cfg.llm.model_name;
          const selectPreset = this.element.querySelector('#selectLlmPreset');
          if (selectPreset) {
            const hasOption = Array.from(selectPreset.options).some(o => o.value === cfg.llm.model_name);
            selectPreset.value = hasOption ? cfg.llm.model_name : 'custom';
          }
        }
        if (cfg.llm.api_key) this.element.querySelector('#cfgLlmApiKey').value = cfg.llm.api_key;
      }

      if (cfg.character) {
        if (cfg.character.name) this.element.querySelector('#cfgCharName').value = cfg.character.name;
        if (cfg.character.user_nickname) this.element.querySelector('#cfgUserNickname').value = cfg.character.user_nickname;
        if (cfg.character.system_prompt) this.element.querySelector('#cfgSystemPrompt').value = cfg.character.system_prompt;
      }

      if (cfg.tts) {
        if (cfg.tts.voice) this.element.querySelector('#cfgTtsVoice').value = cfg.tts.voice;
        if (cfg.tts.rate) this.element.querySelector('#cfgTtsRate').value = cfg.tts.rate;
        if (cfg.tts.volume) this.element.querySelector('#cfgTtsVolume').value = cfg.tts.volume;
      }

      if (cfg.stt) {
        if (cfg.stt.model_size) this.element.querySelector('#cfgSttModel').value = cfg.stt.model_size;
        if (cfg.stt.vad_silence_duration_ms) this.element.querySelector('#cfgSttVad').value = cfg.stt.vad_silence_duration_ms;
      }
    } catch (e) {
      console.warn('[SettingsModal] Failed to load remote config:', e);
    }
  }

  toggle(visible = null) {
    if (visible === null) {
      const isHidden = this.element.classList.toggle('hidden');
      if (!isHidden) this.loadConfig();
    } else if (visible) {
      this.element.classList.remove('hidden');
      this.loadConfig();
    } else {
      this.element.classList.add('hidden');
    }
  }

  _save() {
    const payload = {
      llm: {
        provider: this.currentProvider,
        api_url: this.element.querySelector('#cfgLlmUrl').value.trim(),
        model_name: this.element.querySelector('#cfgLlmModel').value.trim(),
        api_key: this.element.querySelector('#cfgLlmApiKey').value.trim()
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

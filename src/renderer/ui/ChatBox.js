export class ChatBox {
  constructor(container, onSendMessage, onSlashCommand = null) {
    this.container = container;
    this.onSendMessage = onSendMessage;
    this.onSlashCommand = onSlashCommand;
    this.element = null;
    this.historyEl = null;
    this.inputEl = null;

    this._render();
  }

  _render() {
    this.element = document.createElement('div');
    this.element.id = 'chatModal';
    this.element.className = 'hidden fixed bottom-20 left-1/2 -translate-x-1/2 w-[92vw] max-w-sm glass-panel rounded-2xl p-4 shadow-2xl border border-pink-500/30 z-50 pointer-events-auto';

    this.element.innerHTML = `
      <div class="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
        <span class="text-xs font-semibold text-pink-300">💬 AI 女友即時文字對話</span>
        <button id="btnCloseChat" class="text-slate-400 hover:text-white text-xs">✕</button>
      </div>
      <div id="chatHistory" class="h-44 overflow-y-auto space-y-2 pr-1 text-xs mb-3 custom-scrollbar">
        <div class="flex justify-start">
          <div class="bg-pink-950/60 border border-pink-500/30 rounded-xl px-3 py-1.5 text-pink-200 max-w-[85%]">
            主人好呀！我是你的專屬 3D 桌面女友，今天想聊些什麼呢？
          </div>
        </div>
      </div>
      <div class="flex space-x-2">
        <input id="chatInput" type="text" placeholder="輸入訊息... 或 /puppet /ar /pose /photo (Enter 發送)" class="flex-1 bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-pink-500" />
        <button id="btnSendChat" class="bg-pink-600 hover:bg-pink-500 text-white text-xs px-3.5 py-1.5 rounded-lg transition font-medium">發送</button>
      </div>
    `;

    this.container.appendChild(this.element);

    this.historyEl = this.element.querySelector('#chatHistory');
    this.inputEl = this.element.querySelector('#chatInput');

    this.element.querySelector('#btnCloseChat').addEventListener('click', () => this.toggle(false));
    this.element.querySelector('#btnSendChat').addEventListener('click', () => this._send());
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._send();
    });
  }

  toggle(visible = null) {
    if (visible === null) {
      this.element.classList.toggle('hidden');
    } else if (visible) {
      this.element.classList.remove('hidden');
      this.inputEl.focus();
    } else {
      this.element.classList.add('hidden');
    }
  }

  addUserMessage(text) {
    const item = document.createElement('div');
    item.className = 'flex justify-end';
    item.innerHTML = `
      <div class="bg-indigo-600/70 border border-indigo-400/40 rounded-xl px-3 py-1.5 text-white max-w-[85%]">
        ${this._escapeHtml(text)}
      </div>
    `;
    this.historyEl.appendChild(item);
    this.historyEl.scrollTop = this.historyEl.scrollHeight;
  }

  addAssistantMessage(text) {
    const item = document.createElement('div');
    item.className = 'flex justify-start';
    item.innerHTML = `
      <div class="bg-pink-950/60 border border-pink-500/30 rounded-xl px-3 py-1.5 text-pink-200 max-w-[85%]">
        ${this._escapeHtml(text)}
      </div>
    `;
    this.historyEl.appendChild(item);
    this.historyEl.scrollTop = this.historyEl.scrollHeight;
  }

  removeLastMessage() {
    if (this.historyEl && this.historyEl.lastElementChild) {
      this.historyEl.removeChild(this.historyEl.lastElementChild);
    }
  }

  _send() {
    const text = this.inputEl.value.trim();
    if (!text) return;
    this.addUserMessage(text);
    this.inputEl.value = '';

    if (text.startsWith('/') && typeof this.onSlashCommand === 'function') {
      const handled = this.onSlashCommand(text);
      if (handled) return;
    }

    if (typeof this.onSendMessage === 'function') {
      this.onSendMessage(text);
    }
  }

  _escapeHtml(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }
}

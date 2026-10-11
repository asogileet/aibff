/**
 * LoginModal - Google Sign-In, Access Code & LAN Authorization Modal.
 */
export class LoginModal {
  constructor(container, authService, onLoginSuccess) {
    this.container = container;
    this.authService = authService;
    this.onLoginSuccess = onLoginSuccess;
    this.element = null;
    this.gisLoaded = false;
    this.currentMode = 'google'; // 'google' | 'code'

    // Determine if environment supports Google GIS (requires localhost or HTTPS)
    const isLocalhost = typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    this.canUseGoogle = isLocalhost || isHttps;

    // Default to 'code' mode on mobile / LAN HTTP IP where Google OAuth is blocked by Google policy
    if (!this.canUseGoogle) {
      this.currentMode = 'code';
    }

    this._render();
    if (this.canUseGoogle) {
      this._loadGoogleGis();
    }
  }

  _render() {
    this.element = document.createElement('div');
    this.element.id = 'loginModal';
    this.element.className = 'hidden fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 select-none pointer-events-auto';

    this.element.innerHTML = `
      <div class="glass-panel w-full max-w-sm rounded-2xl p-6 border border-pink-500/30 shadow-2xl flex flex-col items-center text-center space-y-4">
        <!-- Avatar Icon -->
        <div class="w-16 h-16 rounded-full bg-pink-500/20 border border-pink-400/40 flex items-center justify-center text-3xl shadow-lg animate-heart-pulse">
          🔒
        </div>

        <div>
          <h2 class="text-lg font-bold text-slate-100">AI 女友 訪客存取防護</h2>
          <p class="text-xs text-slate-400 mt-1">此服務已開啟身分驗證，請驗證身分後進入。</p>
        </div>

        <!-- Non-HTTPS mobile warning banner -->
        <div id="mobileNoticeBanner" class="${this.canUseGoogle ? 'hidden' : ''} w-full text-[11px] py-2 px-3 rounded-xl bg-amber-950/50 border border-amber-500/40 text-amber-200 text-left leading-relaxed">
          <div class="font-bold flex items-center gap-1 text-amber-300 mb-0.5">
            <span>📱</span> <span>行動裝置 / 內網連線提示</span>
          </div>
          Google 官方安全政策限制非 HTTPS 網址無法啟用 Google 登入。請使用下方「存取密碼 / PIN」登入，或啟用區域網路免登入。
        </div>

        <!-- Status message -->
        <div id="loginStatusMessage" class="hidden w-full text-xs py-2 px-3 rounded-lg border text-left"></div>

        <!-- Google Sign-in Mode Section -->
        <div id="googleAuthSection" class="${this.currentMode === 'google' ? '' : 'hidden'} w-full flex flex-col items-center space-y-3">
          <div id="googleBtnWrapper" class="w-full flex justify-center min-h-[44px]">
            <div id="googleBtnContainer" class="flex justify-center"></div>
          </div>
          <div class="text-[11px] text-slate-500 leading-relaxed">
            限已加入後端 <code class="text-pink-300">config.local.json</code> 白名單之 Google 帳號。
          </div>
        </div>

        <!-- Access Code Mode Section -->
        <div id="accessCodeSection" class="${this.currentMode === 'code' ? '' : 'hidden'} w-full flex flex-col items-center space-y-3">
          <div class="w-full space-y-2">
            <input 
              type="password" 
              id="inputAccessCode" 
              placeholder="請輸入存取密碼 (預設: 888888)" 
              class="w-full bg-slate-900 border border-pink-500/40 focus:border-pink-400 rounded-xl px-3.5 py-2.5 text-center text-sm tracking-widest text-pink-200 outline-none transition placeholder:text-slate-600 placeholder:text-xs placeholder:tracking-normal"
            />
            <button 
              id="btnVerifyAccessCode" 
              type="button" 
              class="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium text-xs shadow-lg shadow-pink-500/20 active:scale-95 transition"
            >
              🔑 驗證存取碼並進入
            </button>
          </div>
          <div class="text-[11px] text-slate-500 leading-relaxed text-center">
            密碼可於後端 <code class="text-pink-300">config.local.json</code> 的 <code class="text-pink-300">access_code</code> 設定。
          </div>
        </div>

        <!-- LAN Bypass Button (if allowed by server) -->
        <button 
          id="btnLanQuickEnter" 
          type="button" 
          class="hidden w-full py-2 px-3 rounded-xl bg-emerald-600/25 border border-emerald-500/40 hover:bg-emerald-600/40 text-emerald-300 font-medium text-xs transition active:scale-95"
        >
          🏠 區域網路一鍵直接進入
        </button>

        <!-- Mode Toggle Button -->
        <div class="w-full pt-2 border-t border-slate-800 flex justify-center">
          <button 
            id="btnToggleLoginMode" 
            type="button" 
            class="text-[11px] text-pink-400 hover:text-pink-300 underline underline-offset-4 transition"
          >
            ${this.currentMode === 'google' ? '切換為 存取密碼 (PIN) 登入' : '切換為 Google 帳號登入'}
          </button>
        </div>
      </div>
    `;

    // Stop mouse & touch event bubbling so background Canvas & RaycastManager don't capture them,
    // but DO NOT use capture: true which breaks touch events inside the modal on mobile/tablet!
    ['pointerdown', 'mousedown', 'mouseup', 'click', 'touchstart', 'touchend'].forEach(evtType => {
      this.element.addEventListener(evtType, (e) => {
        e.stopPropagation();
      });
    });

    // Bind UI actions
    const btnToggle = this.element.querySelector('#btnToggleLoginMode');
    btnToggle?.addEventListener('click', () => this._toggleMode());

    const btnVerify = this.element.querySelector('#btnVerifyAccessCode');
    const inputCode = this.element.querySelector('#inputAccessCode');
    btnVerify?.addEventListener('click', () => {
      const code = inputCode?.value || '';
      this._handleAccessCodeLogin(code);
    });
    inputCode?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this._handleAccessCodeLogin(inputCode.value || '');
      }
    });

    const btnLan = this.element.querySelector('#btnLanQuickEnter');
    btnLan?.addEventListener('click', () => {
      this.hide();
      this.onLoginSuccess?.({ email: 'lan@user', name: '區域網路用戶' });
    });

    this.container.appendChild(this.element);
  }

  _toggleMode() {
    this.currentMode = this.currentMode === 'google' ? 'code' : 'google';
    const googleSec = this.element.querySelector('#googleAuthSection');
    const codeSec = this.element.querySelector('#accessCodeSection');
    const btnToggle = this.element.querySelector('#btnToggleLoginMode');

    if (this.currentMode === 'google') {
      googleSec?.classList.remove('hidden');
      codeSec?.classList.add('hidden');
      if (btnToggle) btnToggle.textContent = '切換為 存取密碼 (PIN) 登入';
      if (!this.gisLoaded) {
        this._loadGoogleGis();
      } else {
        this._initGoogleButton();
      }
    } else {
      googleSec?.classList.add('hidden');
      codeSec?.classList.remove('hidden');
      if (btnToggle) btnToggle.textContent = '切換為 Google 帳號登入';
      setTimeout(() => {
        this.element.querySelector('#inputAccessCode')?.focus();
      }, 50);
    }
  }

  _loadGoogleGis() {
    if (document.getElementById('google-gis-script')) {
      this.gisLoaded = true;
      if (this.isVisible() && this.currentMode === 'google') {
        this._initGoogleButton();
      }
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gis-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      this.gisLoaded = true;
      if (this.isVisible() && this.currentMode === 'google') {
        this._initGoogleButton();
      }
    };
    script.onerror = () => {
      console.warn('[LoginModal] Failed to load Google Identity Services SDK');
    };
    document.head.appendChild(script);
  }

  _initGoogleButton() {
    const clientId = this.authService.googleClientId;
    const container = this.element.querySelector('#googleBtnContainer');
    const statusMsg = this.element.querySelector('#loginStatusMessage');

    if (!clientId) {
      if (statusMsg) {
        statusMsg.className = 'w-full text-xs py-2 px-3 rounded-lg border bg-amber-950/40 border-amber-500/50 text-amber-300';
        statusMsg.textContent = '後端尚未設定 Google Client ID，請在 config.local.json 中填入 google_client_id。';
        statusMsg.classList.remove('hidden');
      }
      return;
    }

    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => this._handleCredentialResponse(response),
          auto_select: false,
          cancel_on_tap_outside: false
        });

        if (container) {
          container.innerHTML = '';
          window.google.accounts.id.renderButton(container, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: 'signin_with',
            shape: 'pill',
            logo_alignment: 'left',
            width: 250
          });
        }
      } catch (e) {
        console.warn('[LoginModal] GSI initialization failed:', e);
      }
    }
  }

  async _handleAccessCodeLogin(code) {
    const statusMsg = this.element.querySelector('#loginStatusMessage');
    if (!code || !code.trim()) {
      if (statusMsg) {
        statusMsg.className = 'w-full text-xs py-2 px-3 rounded-lg border bg-rose-950/40 border-rose-500/50 text-rose-300';
        statusMsg.textContent = '請輸入存取密碼。';
        statusMsg.classList.remove('hidden');
      }
      return;
    }

    try {
      if (statusMsg) {
        statusMsg.className = 'w-full text-xs py-2 px-3 rounded-lg border bg-blue-950/40 border-blue-500/50 text-blue-300';
        statusMsg.textContent = '驗證存取碼中...';
        statusMsg.classList.remove('hidden');
      }

      const res = await this.authService.loginWithAccessCode(code.trim());
      if (statusMsg) {
        statusMsg.className = 'w-full text-xs py-2 px-3 rounded-lg border bg-emerald-950/40 border-emerald-500/50 text-emerald-300';
        statusMsg.textContent = '🎉 驗證成功，歡迎光臨！';
        statusMsg.classList.remove('hidden');
      }

      setTimeout(() => {
        this.hide();
        this.onLoginSuccess?.(res.user);
      }, 500);

    } catch (err) {
      console.warn('[LoginModal] Code login error:', err);
      if (statusMsg) {
        statusMsg.className = 'w-full text-xs py-2 px-3 rounded-lg border bg-rose-950/40 border-rose-500/50 text-rose-300';
        statusMsg.textContent = err.message || '存取碼錯誤，請確認後端 config.local.json 設定。';
        statusMsg.classList.remove('hidden');
      }
    }
  }

  async _handleCredentialResponse(response) {
    const statusMsg = this.element.querySelector('#loginStatusMessage');
    try {
      if (statusMsg) {
        statusMsg.className = 'w-full text-xs py-2 px-3 rounded-lg border bg-blue-950/40 border-blue-500/50 text-blue-300';
        statusMsg.textContent = '驗證 Google 登入中，請稍候...';
        statusMsg.classList.remove('hidden');
      }

      const res = await this.authService.loginWithGoogleCredential(response.credential);
      if (statusMsg) {
        statusMsg.className = 'w-full text-xs py-2 px-3 rounded-lg border bg-emerald-950/40 border-emerald-500/50 text-emerald-300';
        statusMsg.textContent = `歡迎回來，${res.user?.name || res.user?.email}！`;
        statusMsg.classList.remove('hidden');
      }

      setTimeout(() => {
        this.hide();
        this.onLoginSuccess?.(res.user);
      }, 700);

    } catch (err) {
      console.warn('[LoginModal] Login error:', err);
      if (statusMsg) {
        statusMsg.className = 'w-full text-xs py-2 px-3 rounded-lg border bg-rose-950/40 border-rose-500/50 text-rose-300';
        statusMsg.textContent = err.message || '登入失敗，請確認你的帳號在白名單內。';
        statusMsg.classList.remove('hidden');
      }
    }
  }

  show() {
    this.element.classList.remove('hidden');
    const canvasContainer = document.getElementById('canvas-container');
    if (canvasContainer) canvasContainer.style.pointerEvents = 'none';

    // Check if LAN bypass button should be displayed
    const authStatus = this.authService.authStatus;
    const btnLan = this.element.querySelector('#btnLanQuickEnter');
    if (btnLan && authStatus?.allow_lan_bypass && authStatus?.is_lan) {
      btnLan.classList.remove('hidden');
    }

    if (this.currentMode === 'google' && this.gisLoaded) {
      this._initGoogleButton();
    }
  }

  hide() {
    this.element.classList.add('hidden');
    const canvasContainer = document.getElementById('canvas-container');
    if (canvasContainer) canvasContainer.style.pointerEvents = 'auto';
  }

  isVisible() {
    return !this.element.classList.contains('hidden');
  }
}

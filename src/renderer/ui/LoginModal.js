/**
 * LoginModal - Google Sign-In and Whitelist Authorization Modal.
 */
export class LoginModal {
  constructor(container, authService, onLoginSuccess) {
    this.container = container;
    this.authService = authService;
    this.onLoginSuccess = onLoginSuccess;
    this.element = null;
    this.gisLoaded = false;

    this._render();
    this._loadGoogleGis();
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
          <p class="text-xs text-slate-400 mt-1">此服務已開啟身分驗證，僅限授權白名單之 Google 帳號使用。</p>
        </div>

        <!-- Whitelist warning / status message -->
        <div id="loginStatusMessage" class="hidden w-full text-xs py-2 px-3 rounded-lg border"></div>

        <!-- Google Sign-in button wrapper -->
        <div id="googleBtnWrapper" class="w-full flex justify-center min-h-[44px]">
          <div id="googleBtnContainer" class="flex justify-center"></div>
        </div>

        <!-- Fallback message if GIS fails or client ID empty -->
        <div id="loginHelpText" class="text-[11px] text-slate-500 leading-relaxed">
          請登入在後端 <code class="text-pink-300">config.local.json</code> 中設定的允許 Google 帳號。
        </div>
      </div>
    `;

    // Crucial: Stop mouse and touch event propagation completely inside the modal
    // so background Three.js Canvas and RaycastManager never capture clicks
    ['pointerdown', 'mousedown', 'mouseup', 'click', 'touchstart', 'touchend'].forEach(evtType => {
      this.element.addEventListener(evtType, (e) => {
        e.stopPropagation();
      }, { capture: true });
    });

    this.container.appendChild(this.element);
  }

  _loadGoogleGis() {
    if (document.getElementById('google-gis-script')) {
      this.gisLoaded = true;
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gis-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      this.gisLoaded = true;
      if (this.isVisible()) {
        this._initGoogleButton();
      }
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
    if (this.gisLoaded) {
      this._initGoogleButton();
    }
  }

  hide() {
    this.element.classList.add('hidden');
  }

  isVisible() {
    return !this.element.classList.contains('hidden');
  }
}

/**
 * AuthService - Client-side authentication and Google Sign-In helper.
 */
export class AuthService {
  constructor(baseUrl = null) {
    if (baseUrl) {
      this.baseUrl = baseUrl;
    } else if (typeof window !== 'undefined' && window.location?.origin && !window.location.origin.startsWith('file://')) {
      this.baseUrl = window.location.origin;
    } else {
      this.baseUrl = 'http://127.0.0.1:8765';
    }

    this.tokenStorageKey = 'aibff_auth_token';
    this.userStorageKey = 'aibff_auth_user';
    this.token = localStorage.getItem(this.tokenStorageKey) || '';
    this.user = null;
    this.authEnabled = false;
    this.googleClientId = '';
    this.onAuthChange = null;

    try {
      const stored = localStorage.getItem(this.userStorageKey);
      if (stored) this.user = JSON.parse(stored);
    } catch (_) {}
  }

  getToken() {
    return this.token;
  }

  getUser() {
    return this.user;
  }

  getAuthHeaders() {
    const headers = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
      headers['X-Auth-Token'] = this.token;
    }
    return headers;
  }

  async checkAuthStatus() {
    try {
      const res = await fetch(`${this.baseUrl}/api/auth/status`, {
        headers: this.getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        this.authEnabled = !!data.auth_enabled;
        this.googleClientId = data.google_client_id || '';
        if (data.logged_in && data.user) {
          this.user = data.user;
          localStorage.setItem(this.userStorageKey, JSON.stringify(data.user));
        } else if (this.authEnabled && !data.logged_in) {
          // Token expired or invalid
          this.clearSession();
        }
        return data;
      }
    } catch (e) {
      console.warn('[AuthService] checkAuthStatus failed:', e);
    }
    return { auth_enabled: false, logged_in: true, user: null };
  }

  async loginWithGoogleCredential(credential) {
    const res = await fetch(`${this.baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: '登入失敗' }));
      throw new Error(err.detail || `登入失敗 (${res.status})`);
    }

    const data = await res.json();
    this.token = data.token;
    this.user = data.user;
    localStorage.setItem(this.tokenStorageKey, this.token);
    localStorage.setItem(this.userStorageKey, JSON.stringify(this.user));

    this.onAuthChange?.(true, this.user);
    return data;
  }

  async logout() {
    try {
      await fetch(`${this.baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });
    } catch (_) {}
    this.clearSession();
    this.onAuthChange?.(false, null);
  }

  clearSession() {
    this.token = '';
    this.user = null;
    localStorage.removeItem(this.tokenStorageKey);
    localStorage.removeItem(this.userStorageKey);
  }
}

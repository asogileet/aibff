import time
import secrets
from typing import Dict, Any, Optional, List
import httpx

# In-memory session cache: token -> { email: str, name: str, picture: str, exp: float }
# Token validity duration: 7 days
SESSION_EXPIRATION_SECONDS = 7 * 24 * 3600
_sessions: Dict[str, Dict[str, Any]] = {}

def create_session(user_info: Dict[str, Any]) -> str:
    """Generate a random secure session token and cache user info."""
    clean_expired_sessions()
    token = secrets.token_urlsafe(32)
    _sessions[token] = {
        "email": user_info.get("email", "").lower(),
        "name": user_info.get("name", ""),
        "picture": user_info.get("picture", ""),
        "exp": time.time() + SESSION_EXPIRATION_SECONDS
    }
    return token

def get_session(token: str) -> Optional[Dict[str, Any]]:
    """Retrieve session info if valid and not expired."""
    if not token or token not in _sessions:
        return None
    data = _sessions[token]
    if time.time() > data.get("exp", 0):
        _sessions.pop(token, None)
        return None
    return data

def revoke_session(token: str) -> bool:
    """Remove session from cache."""
    return bool(_sessions.pop(token, None))

def clean_expired_sessions() -> None:
    """Periodically purge expired tokens."""
    now = time.time()
    expired = [k for k, v in _sessions.items() if v.get("exp", 0) < now]
    for k in expired:
        _sessions.pop(k, None)

async def verify_google_credential(credential: str, expected_client_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Verify Google OAuth2 ID Token using Google's tokeninfo endpoint.
    Returns user payload dictionary (email, name, picture, sub, etc.) or None if invalid.
    """
    if not credential:
        return None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": credential}
            )
            if resp.status_code != 200:
                print(f"[Auth] Google tokeninfo verification failed ({resp.status_code}): {resp.text}")
                return None
            payload = resp.json()

            # Verify audience matches google_client_id if configured
            if expected_client_id and expected_client_id.strip():
                aud = payload.get("aud", "")
                if aud != expected_client_id.strip():
                    print(f"[Auth] Client ID mismatch: aud={aud} vs expected={expected_client_id}")
                    return None

            email = payload.get("email")
            email_verified = payload.get("email_verified")
            if not email:
                return None
            if email_verified not in [True, "true", "True"]:
                print(f"[Auth] Email not verified by Google: {email}")
                return None

            return {
                "email": email.lower(),
                "name": payload.get("name", ""),
                "picture": payload.get("picture", ""),
                "sub": payload.get("sub", "")
            }
    except Exception as e:
        print(f"[Auth] Error verifying google credential: {e}")
        return None

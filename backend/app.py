import sys
import base64
import asyncio

# Reconfigure stdout and stderr for UTF-8 on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
from pathlib import Path
from typing import Dict, Any, Optional
from fastapi import FastAPI, UploadFile, File, Form, WebSocket, WebSocketDisconnect, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.config import load_config, save_config, AppConfig
from backend.tts.edge_tts_provider import EdgeTTSProvider
from backend.stt.whisper_service import WhisperSTTService
from backend.llm.ollama_client import OllamaLLMClient
from backend.auth.google_auth import (
    verify_google_credential,
    create_session,
    get_session,
    revoke_session
)

app = FastAPI(title="3D AI Girlfriend Backend Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

config: AppConfig = load_config()
tts_provider = EdgeTTSProvider()
stt_service = WhisperSTTService(
    model_size=config.stt.model_size,
    device=config.stt.device,
    compute_type=config.stt.compute_type,
    language=config.stt.language
)
llm_client = OllamaLLMClient(
    api_url=config.llm.api_url,
    model_name=config.llm.model_name,
    system_prompt=config.character.system_prompt,
    api_key=config.llm.api_key,
    provider=config.llm.provider
)

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    reply: str
    emotion: str
    action: str
    costume: Optional[str] = None
    audio_base64: Optional[str] = None

class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = None

def is_auth_required() -> bool:
    """Return True if auth protection is activated in config."""
    return bool(config.auth and config.auth.enabled)

def verify_email_whitelist(email: str) -> bool:
    """Check if the email matches the whitelist (case-insensitive)."""
    if not is_auth_required():
        return True
    if not email:
        return False
    allowed = [e.strip().lower() for e in config.auth.allowed_emails if e.strip()]
    if not allowed:
        # If whitelist is empty when auth enabled, nobody except explicitly allowed can access
        return False
    return email.strip().lower() in allowed

async def get_current_user(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    x_auth_token: Optional[str] = Header(None, alias="X-Auth-Token")
) -> Optional[Dict[str, Any]]:
    """Dependency that enforces authentication & whitelist if auth is enabled."""
    if not is_auth_required():
        return {"email": "local@user", "name": "Local User", "authenticated": False}

    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
    elif x_auth_token:
        token = x_auth_token.strip()

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Authentication required. Please sign in with Google."
        )

    session = get_session(token)
    if not session:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired session. Please sign in again."
        )

    user_email = session.get("email", "")
    if not verify_email_whitelist(user_email):
        raise HTTPException(
            status_code=403,
            detail=f"Access denied: {user_email} is not in the authorized whitelist."
        )

    return session

class GoogleLoginRequest(BaseModel):
    credential: str

class AuthStatusResponse(BaseModel):
    auth_enabled: bool
    google_client_id: str
    logged_in: bool
    user: Optional[Dict[str, Any]] = None

@app.get("/api/auth/status")
async def get_auth_status(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    x_auth_token: Optional[str] = Header(None, alias="X-Auth-Token")
):
    """Public endpoint to let frontend discover auth requirements & current user info."""
    auth_enabled = is_auth_required()
    google_client_id = config.auth.google_client_id if config.auth else ""

    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
    elif x_auth_token:
        token = x_auth_token.strip()

    current_user = None
    logged_in = False
    if token:
        sess = get_session(token)
        if sess and verify_email_whitelist(sess.get("email", "")):
            current_user = sess
            logged_in = True

    return {
        "auth_enabled": auth_enabled,
        "google_client_id": google_client_id,
        "logged_in": logged_in,
        "user": current_user
    }

@app.post("/api/auth/google")
async def login_google(req: GoogleLoginRequest):
    """Authenticate with Google ID Token (credential) and check whitelist."""
    expected_cid = config.auth.google_client_id if config.auth else None
    user_info = await verify_google_credential(req.credential, expected_cid)
    if not user_info:
        raise HTTPException(status_code=400, detail="Invalid Google credential.")

    user_email = user_info.get("email", "")
    if is_auth_required() and not verify_email_whitelist(user_email):
        raise HTTPException(
            status_code=403,
            detail=f"權限不足：信箱 {user_email} 不在允許的使用者白名單內。"
        )

    session_token = create_session(user_info)
    return {
        "status": "success",
        "token": session_token,
        "user": user_info
    }

@app.post("/api/auth/logout")
async def logout(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    x_auth_token: Optional[str] = Header(None, alias="X-Auth-Token")
):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
    elif x_auth_token:
        token = x_auth_token.strip()

    if token:
        revoke_session(token)
    return {"status": "logged_out"}

@app.post("/api/config")
async def update_configuration(new_config: AppConfig, user = Depends(get_current_user)):
    global config, llm_client, stt_service
    config = new_config
    save_config(config)
    llm_client = OllamaLLMClient(
        api_url=config.llm.api_url,
        model_name=config.llm.model_name,
        system_prompt=config.character.system_prompt,
        api_key=config.llm.api_key,
        provider=config.llm.provider
    )
    return {"status": "updated", "config": config.model_dump()}

@app.post("/api/chat", response_model=ChatResponse)
async def chat_interaction(req: ChatRequest, user = Depends(get_current_user)):
    # 1. Query LLM with structured intent output
    llm_result = await llm_client.chat(req.message)
    reply_text = llm_result.get("reply", "")
    speech_text = llm_result.get("speech_text", reply_text)

    # 2. Synthesize audio via Edge-TTS using sanitized speech_text
    audio_base64 = None
    if speech_text:
        try:
            audio_bytes = await tts_provider.synthesize(
                text=speech_text,
                voice=config.tts.voice,
                rate=config.tts.rate,
                volume=config.tts.volume
            )
            audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
        except Exception as e:
            print(f"[Backend] TTS generation failed: {e}")

    return ChatResponse(
        reply=reply_text,
        emotion=llm_result.get("emotion", "happy"),
        action=llm_result.get("action", "idle"),
        costume=llm_result.get("costume"),
        audio_base64=audio_base64
    )

@app.post("/api/tts")
async def text_to_speech(req: TTSRequest, user = Depends(get_current_user)):
    voice = req.voice or config.tts.voice
    audio_bytes = await tts_provider.synthesize(text=req.text, voice=voice)
    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
    return {"audio_base64": audio_b64}

@app.post("/api/stt")
async def speech_to_text(file: UploadFile = File(...), user = Depends(get_current_user)):
    audio_data = await file.read()
    transcription = await stt_service.transcribe_audio(audio_data)
    return {"text": transcription}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    # Check token from query param ?token=... if auth enabled
    if is_auth_required():
        query_token = websocket.query_params.get("token")
        sess = get_session(query_token) if query_token else None
        if not sess or not verify_email_whitelist(sess.get("email", "")):
            print("[WebSocket] Rejected connection: unauthorized or not in whitelist.")
            await websocket.close(code=4403, reason="Forbidden")
            return

    await websocket.accept()
    print("[WebSocket] Client connected.")
    try:
        while True:
            data = await websocket.receive_bytes()
            # Process received chunk or message
            transcription = await stt_service.transcribe_audio(data)
            if transcription.strip():
                # Process transcribed text through LLM and TTS pipeline
                llm_result = await llm_client.chat(transcription)
                reply_text = llm_result.get("reply", "")
                audio_bytes = await tts_provider.synthesize(
                    text=reply_text,
                    voice=config.tts.voice
                )
                audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

                await websocket.send_json({
                    "type": "dialogue_response",
                    "user_text": transcription,
                    "reply": reply_text,
                    "emotion": llm_result.get("emotion", "happy"),
                    "action": llm_result.get("action", "idle"),
                    "costume": llm_result.get("costume"),
                    "audio_base64": audio_b64
                })
    except WebSocketDisconnect:
        print("[WebSocket] Client disconnected.")
    except Exception as e:
        print(f"[WebSocket] Error: {e}")

ROOT_DIR = Path(__file__).resolve().parent.parent

# Mount static asset folders for mobile browser and web clients
if (ROOT_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(ROOT_DIR / "assets")), name="assets")
if (ROOT_DIR / "node_modules").exists():
    app.mount("/node_modules", StaticFiles(directory=str(ROOT_DIR / "node_modules")), name="node_modules")

# Mount renderer directory at root for web browser access
RENDERER_DIR = ROOT_DIR / "src" / "renderer"
if RENDERER_DIR.exists():
    app.mount("/", StaticFiles(directory=str(RENDERER_DIR), html=True), name="renderer")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app:app", host=config.server_host, port=config.server_port, reload=False)

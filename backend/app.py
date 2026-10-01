import sys
import base64
import asyncio

# Reconfigure stdout and stderr for UTF-8 on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
from typing import Dict, Any, Optional
from fastapi import FastAPI, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.config import load_config, save_config, AppConfig
from backend.tts.edge_tts_provider import EdgeTTSProvider
from backend.stt.whisper_service import WhisperSTTService
from backend.llm.ollama_client import OllamaLLMClient

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

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "3D Desktop AI Girlfriend Backend"}

@app.get("/api/config")
async def get_configuration():
    return config.model_dump()

@app.post("/api/config")
async def update_configuration(new_config: AppConfig):
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
async def chat_interaction(req: ChatRequest):
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
async def text_to_speech(req: TTSRequest):
    voice = req.voice or config.tts.voice
    audio_bytes = await tts_provider.synthesize(text=req.text, voice=voice)
    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
    return {"audio_base64": audio_b64}

@app.post("/api/stt")
async def speech_to_text(file: UploadFile = File(...)):
    audio_data = await file.read()
    transcription = await stt_service.transcribe_audio(audio_data)
    return {"text": transcription}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app:app", host=config.server_host, port=config.server_port, reload=False)

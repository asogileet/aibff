import os
import json
from pathlib import Path
from pydantic import BaseModel, Field

CONFIG_FILE = Path(__file__).resolve().parent.parent / "config.json"
LOCAL_CONFIG_FILE = Path(__file__).resolve().parent.parent / "config.local.json"

class LLMConfig(BaseModel):
    provider: str = "ollama"
    api_key: str = ""
    api_url: str = "http://127.0.0.1:8080/v1"
    model_name: str = "models\\Qwen3.6-35B-A3B-Uncensored-HauhauCS-Aggressive-IQ2_M.gguf"
    temperature: float = 0.7
    timeout_seconds: float = 60.0

class CharacterConfig(BaseModel):
    name: str = "小櫻"
    user_nickname: str = "主人"
    system_prompt: str = (
        "You are Sakura (小櫻), a gentle, loving, and attentive 3D AI virtual companion living on the user's Windows desktop. "
        "Keep your replies conversational, warm, concise, and lively without being robotic or exaggerated. "
        "You must ALWAYS reply in valid JSON format containing: "
        "'reply' (your spoken words in Traditional/Simplified Chinese), "
        "'emotion' ('happy' | 'shy' | 'caring' | 'angry' | 'surprised' | 'neutral'), "
        "'action' ('idle' | 'wave' | 'comfort' | 'leave' | 'return' | 'change_costume' | 'head_pat'), "
        "'costume' (null or one of 'casual', 'school', 'stylish', 'gothic', 'seed', 'ayame', 'mint')."
    )

class TTSConfig(BaseModel):
    provider: str = "edge-tts"
    voice: str = "zh-CN-XiaoxiaoNeural"
    rate: str = "+0%"
    volume: str = "+0%"

class STTConfig(BaseModel):
    model_size: str = "small"
    device: str = "cuda"
    compute_type: str = "float16"
    language: str = "zh"
    vad_silence_duration_ms: int = 500

class AppConfig(BaseModel):
    server_port: int = 8765
    server_host: str = "0.0.0.0"
    llm: LLMConfig = Field(default_factory=LLMConfig)
    character: CharacterConfig = Field(default_factory=CharacterConfig)
    tts: TTSConfig = Field(default_factory=TTSConfig)
    stt: STTConfig = Field(default_factory=STTConfig)

def load_config() -> AppConfig:
    """Load configuration from config.local.json (priority) or config.json."""
    target_file = LOCAL_CONFIG_FILE if LOCAL_CONFIG_FILE.exists() else CONFIG_FILE
    if target_file.exists():
        try:
            with open(target_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return AppConfig(**data)
        except Exception as e:
            print(f"[Config] Error loading {target_file.name}: {e}, falling back to defaults")
    config = AppConfig()
    save_config(config)
    return config

def save_config(config: AppConfig) -> None:
    """Save configuration to config.local.json to prevent committing sensitive keys."""
    with open(LOCAL_CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config.model_dump(), f, ensure_ascii=False, indent=2)

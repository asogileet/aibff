import io
import edge_tts
from typing import Optional
from backend.tts.base import ITTSProvider

class EdgeTTSProvider(ITTSProvider):
    """Implementation of Edge-TTS voice provider."""

    DEFAULT_VOICE = "zh-CN-XiaoxiaoNeural"

    async def synthesize(self, text: str, voice: Optional[str] = None, rate: str = "+0%", volume: str = "+0%") -> bytes:
        selected_voice = voice or self.DEFAULT_VOICE
        communicate = edge_tts.Communicate(text=text, voice=selected_voice, rate=rate, volume=volume)
        audio_stream = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_stream.write(chunk["data"])
        return audio_stream.getvalue()

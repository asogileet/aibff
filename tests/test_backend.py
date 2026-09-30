import io
import wave
import asyncio
import unittest
from backend.config import load_config, AppConfig
from backend.llm.ollama_client import OllamaLLMClient
from backend.tts.edge_tts_provider import EdgeTTSProvider
from backend.stt.whisper_service import WhisperSTTService

class TestBackendComponents(unittest.TestCase):
    def test_config_defaults(self):
        config = load_config()
        self.assertIsInstance(config, AppConfig)
        self.assertIsNotNone(config.llm.model_name)
        self.assertEqual(config.tts.voice, "zh-CN-XiaoxiaoNeural")

    def test_llm_sanitizer(self):
        client = OllamaLLMClient()
        raw_markdown_json = '```json\n{"reply": "主人好！", "emotion": "happy", "action": "wave", "costume": null}\n```'
        display = client._sanitize_for_display(raw_markdown_json)
        self.assertEqual(display, "主人好！")

    def test_tts_provider_init(self):
        provider = EdgeTTSProvider()
        self.assertEqual(provider.DEFAULT_VOICE, "zh-CN-XiaoxiaoNeural")

    def test_stt_whisper_pyav_compatibility(self):
        stt = WhisperSTTService(model_size="small", device="cuda", compute_type="float16", language="zh")
        if stt.model is None:
            self.skipTest("Faster-Whisper model not initialized")

        # Generate 1s silence wav
        wav_io = io.BytesIO()
        with wave.open(wav_io, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(16000)
            wf.writeframes(b'\x00\x00' * 16000)

        wav_bytes = wav_io.getvalue()
        # Ensure transcribe does not crash with metadata_errors
        result = asyncio.run(stt.transcribe_audio(wav_bytes))
        self.assertIsInstance(result, str)

if __name__ == "__main__":
    unittest.main()


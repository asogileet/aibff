import io
import os
import asyncio
from typing import Optional
import numpy as np

# Apply compatibility patch for PyAV 19+ where metadata_errors was removed
try:
    import av
    _orig_av_open = av.open
    def _patched_av_open(*args, **kwargs):
        kwargs.pop("metadata_errors", None)
        return _orig_av_open(*args, **kwargs)
    av.open = _patched_av_open
except Exception as _patch_err:
    print(f"[WhisperSTT] PyAV patch note: {_patch_err}")

class WhisperSTTService:
    """Faster-Whisper STT service with CUDA float16 and VAD integration."""

    def __init__(self, model_size: str = "small", device: str = "cuda", compute_type: str = "float16", language: str = "zh"):
        self.model_size = model_size
        self.device = device
        self.compute_type = compute_type
        self.language = language
        self.model = None
        self._init_model()

    def _init_model(self):
        try:
            from faster_whisper import WhisperModel
            print(f"[WhisperSTT] Initializing model '{self.model_size}' on {self.device} ({self.compute_type})...")
            self.model = WhisperModel(
                self.model_size,
                device=self.device,
                compute_type=self.compute_type
            )
            # Verify CUDA runtime libraries if device is cuda
            if self.device == "cuda":
                dummy_audio = np.zeros(1600, dtype=np.float32)
                list(self.model.transcribe(dummy_audio, language=self.language)[0])
            print(f"[WhisperSTT] Model successfully loaded and verified on {self.device}.")
        except Exception as e:
            print(f"[WhisperSTT] Failed to initialize on {self.device} ({self.compute_type}): {e}")
            if self.device != "cpu":
                print("[WhisperSTT] Falling back to CPU int8...")
                try:
                    from faster_whisper import WhisperModel
                    self.device = "cpu"
                    self.compute_type = "int8"
                    self.model = WhisperModel(self.model_size, device="cpu", compute_type="int8")
                    print("[WhisperSTT] Fallback to CPU loaded successfully.")
                except Exception as fallback_err:
                    print(f"[WhisperSTT] CPU fallback failed: {fallback_err}")
                    self.model = None

    async def transcribe_audio(self, audio_data: bytes) -> str:
        """
        Transcribe given audio bytes (wav/mp3/webm) to text using faster-whisper.
        """
        if self.model is None:
            return ""

        loop = asyncio.get_event_loop()
        def _run_transcribe():
            try:
                audio_io = io.BytesIO(audio_data)
                segments, info = self.model.transcribe(
                    audio_io,
                    language=self.language,
                    beam_size=5,
                    vad_filter=True,
                    vad_parameters=dict(min_silence_duration_ms=500)
                )
                transcription = "".join([segment.text for segment in segments]).strip()
                return transcription
            except Exception as e:
                # If CUDA execution failed during transcription, retry on CPU fallback
                if self.device != "cpu":
                    print(f"[WhisperSTT] CUDA runtime failed during transcription ({e}), falling back to CPU...")
                    try:
                        from faster_whisper import WhisperModel
                        self.device = "cpu"
                        self.compute_type = "int8"
                        self.model = WhisperModel(self.model_size, device="cpu", compute_type="int8")
                        audio_io = io.BytesIO(audio_data)
                        segments, info = self.model.transcribe(
                            audio_io,
                            language=self.language,
                            beam_size=5,
                            vad_filter=True,
                            vad_parameters=dict(min_silence_duration_ms=500)
                        )
                        return "".join([segment.text for segment in segments]).strip()
                    except Exception as retry_err:
                        print(f"[WhisperSTT] CPU retry failed: {retry_err}")
                        return ""
                else:
                    print(f"[WhisperSTT] Transcription error: {e}")
                    return ""

        try:
            return await loop.run_in_executor(None, _run_transcribe)
        except Exception as e:
            print(f"[WhisperSTT] Async transcription error: {e}")
            return ""


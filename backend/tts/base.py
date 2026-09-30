from abc import ABC, abstractmethod
from typing import Optional

class ITTSProvider(ABC):
    """Abstract base class for all Text-To-Speech providers."""

    @abstractmethod
    async def synthesize(self, text: str, voice: Optional[str] = None, rate: str = "+0%", volume: str = "+0%") -> bytes:
        """
        Synthesize text into audio bytes (e.g. mp3/wav).
        :param text: Text to speak
        :param voice: Voice identifier
        :param rate: Speed rate adjustment
        :param volume: Volume adjustment
        :return: Raw audio bytes
        """
        pass

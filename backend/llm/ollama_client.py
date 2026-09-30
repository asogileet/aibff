import json
import re
from typing import List, Dict, Any, Optional
import httpx

class OllamaLLMClient:
    """High-performance LLM Client with deep text sanitation for clean TTS and display."""

    def __init__(self, api_url: str = "http://127.0.0.1:8080/v1", model_name: str = "default", system_prompt: Optional[str] = None):
        self.api_url = api_url.rstrip("/")
        self.base_root_url = self.api_url.replace("/v1", "")
        self.model_name = model_name
        self.system_prompt = system_prompt or (
            "你是小櫻，生活在 Windows 桌面的可愛、溫柔、貼心 3D AI 虛擬女友。"
            "請直接用溫柔自然、甜美生動的中文回覆主人。不要使用代碼標籤或 JSON 結構，直接輸出想對主人說的話。"
        )
        self.conversation_history: List[Dict[str, str]] = []

    def clear_history(self):
        self.conversation_history = []

    def _sanitize_for_display(self, raw_text: str) -> str:
        """Strip markdown codeblocks, JSON wrappers, and literal escape slashes for clean UI reading."""
        text = raw_text.strip()

        # 1. Strip think tags
        text = re.sub(r"<think>[\s\S]*?</think>", "", text).strip()
        text = re.sub(r"<think>[\s\S]*", "", text).strip()
        text = re.sub(r"</think>", "", text).strip()
        text = re.sub(r"<\|im_start\|>[\s\S]*?<\|im_end\|>", "", text).strip()
        text = re.sub(r"<\|im_end\|>", "", text).strip()

        # 2. Extract reply from JSON if model output JSON format
        # Case A: Complete or partial {"reply": "..."}
        json_match = re.search(r'"reply"\s*:\s*"((?:\\.|[^"\\])*)"', text)
        if json_match:
            try:
                # Decode JSON string escapes like \n, \", etc.
                text = json.loads(f'"{json_match.group(1)}"')
            except Exception:
                text = json_match.group(1)
        else:
            # Case B: Markdown codeblock wrapper
            text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
            text = re.sub(r"\s*```$", "", text, flags=re.MULTILINE)

        # 3. Clean literal backslash sequences
        text = text.replace("\\n", "\n").replace("\\r", "").replace("\\t", " ")
        text = text.replace('\\"', '"').replace("\\'", "'")

        # 4. Strip stray JSON syntax
        text = re.sub(r'^\s*\{\s*"reply"\s*:\s*"?', "", text)
        text = re.sub(r'"?\s*,\s*"emotion"[\s\S]*$', "", text)
        text = re.sub(r'"?\s*,\s*"action"[\s\S]*$', "", text)
        text = re.sub(r'"?\s*\}\s*$', "", text)

        # 5. Clean markdown headers and bullet stars
        text = re.sub(r"^[#*>\-]+\s+", "", text, flags=re.MULTILINE)

        return text.strip()

    def _sanitize_for_speech(self, display_text: str) -> str:
        """Strip stage directions in parentheses and special punctuation for natural TTS pronunciation."""
        text = display_text

        # 1. Remove parenthetical actions like (輕輕歪頭), （揉揉眼睛）, (微笑), (giggles)
        text = re.sub(r"[\(（][^()（）]*?[）\)]", "", text)
        text = re.sub(r"\*[^*]*?\*", "", text)

        # 2. Remove emojis and unusual symbols that TTS might read aloud
        text = re.sub(r"[💖✨💕❤️🌸🐾🎉👍👏😊😉😄😋😍🥰😘😗😙😚]", "", text)

        # 3. Replace newlines with gentle comma pauses
        text = re.sub(r"\n+", "，", text)

        # 4. Clean consecutive punctuation
        text = re.sub(r"[，,]{2,}", "，", text)
        text = re.sub(r"[。\.]{2,}", "。", text)
        text = re.sub(r"[~～]+", "～", text)
        text = re.sub(r"\s+", " ", text)

        return text.strip()

    def _extract_intent(self, raw_content: str) -> Dict[str, Any]:
        """Produce sanitized display text, clean speech text, and detected emotion/action."""
        display = self._sanitize_for_display(raw_content)
        if not display:
            display = "主人好！我在這裡一直陪著你呢～"

        speech = self._sanitize_for_speech(display)
        if not speech:
            speech = display

        emotion = "happy"
        action = "idle"
        costume = None

        raw_lower = raw_content.lower()
        if any(w in raw_lower for w in ["害羞", "臉紅", "不要看", "討厭啦"]):
            emotion = "shy"
        elif any(w in raw_lower for w in ["辛苦", "累", "抱抱", "休息一下", "安慰"]):
            emotion = "caring"
            action = "comfort"
        elif any(w in raw_lower for w in ["早安", "你好", "回來", "嗨"]):
            emotion = "happy"
            action = "wave"
        elif any(w in raw_lower for w in ["水手服", "學生裝"]):
            action = "change_costume"
            costume = "school"
        elif any(w in raw_lower for w in ["科技裝", "未來裝"]):
            action = "change_costume"
            costume = "seed"
        elif any(w in raw_lower for w in ["去休息", "先休息", "晚安"]):
            action = "leave"

        return {
            "reply": display,
            "speech_text": speech,
            "emotion": emotion,
            "action": action,
            "costume": costume
        }

    async def chat(self, user_message: str) -> Dict[str, Any]:
        """Send message using skip-think ChatML prompt to bypass lengthy reasoning chain."""
        self.conversation_history.append({"role": "user", "content": user_message})
        
        if len(self.conversation_history) > 8:
            self.conversation_history = self.conversation_history[-8:]

        prompt = f"<|im_start|>system\n{self.system_prompt}<|im_end|>\n"
        for turn in self.conversation_history:
            role = turn["role"]
            content = turn["content"]
            prompt += f"<|im_start|>{role}\n{content}<|im_end|>\n"
        prompt += "<|im_start|>assistant\n<think>\n</think>\n"

        async with httpx.AsyncClient(timeout=90.0) as client:
            try:
                completion_endpoint = f"{self.base_root_url}/completion"
                payload = {
                    "prompt": prompt,
                    "n_predict": 180,
                    "temperature": 0.75,
                    "stop": ["<|im_end|>", "<|endoftext|>"]
                }
                resp = await client.post(completion_endpoint, json=payload)
                if resp.status_code == 200:
                    raw_content = resp.json().get("content", "")
                    result = self._extract_intent(raw_content)
                    self.conversation_history.append({"role": "assistant", "content": result["reply"]})
                    return result
            except Exception as e:
                print(f"[OllamaLLMClient] Completion failed: {e}, attempting /v1/chat/completions fallback...")

            try:
                chat_endpoint = f"{self.api_url}/chat/completions"
                payload = {
                    "messages": [
                        {"role": "system", "content": self.system_prompt}
                    ] + self.conversation_history,
                    "max_tokens": 180
                }
                resp = await client.post(chat_endpoint, json=payload)
                if resp.status_code == 200:
                    msg = resp.json()["choices"][0]["message"]
                    raw = msg.get("content") or msg.get("reasoning_content") or ""
                    result = self._extract_intent(raw)
                    self.conversation_history.append({"role": "assistant", "content": result["reply"]})
                    return result
            except Exception as e:
                print(f"[OllamaLLMClient] Fallback failed: {e}")

        fallback_reply = "主人好！我在這裡陪你聊天呢～"
        return {
            "reply": fallback_reply,
            "speech_text": fallback_reply,
            "emotion": "happy",
            "action": "idle",
            "costume": None
        }

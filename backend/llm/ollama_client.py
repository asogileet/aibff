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
        if any(w in raw_lower for w in ["愛心", "比心", "比個心", "愛你", "喜歡你"]):
            emotion = "shy"
            action = "heart_pose"
        elif any(w in raw_lower for w in ["鞠躬", "謝謝", "感謝", "辛苦了", "拜託"]):
            emotion = "happy"
            action = "bow"
        elif any(w in raw_lower for w in ["拍手", "鼓掌", "好棒", "太棒", "厲害", "讚"]):
            emotion = "happy"
            action = "clap"
        elif any(w in raw_lower for w in ["歪頭", "賣萌", "裝可愛"]):
            emotion = "happy"
            action = "tilt_head"
        elif any(w in raw_lower for w in ["伸懶腰", "好累", "放鬆一下", "伸展"]):
            emotion = "caring"
            action = "stretch"
        elif any(w in raw_lower for w in ["歡呼", "慶祝", "萬歲", "太好了", "成功了"]):
            emotion = "happy"
            action = "cheer"
        elif any(w in raw_lower for w in ["點頭", "贊成", "好的", "沒問題", "可以的"]):
            emotion = "happy"
            action = "nod"
        elif any(w in raw_lower for w in ["不要", "搖頭", "不行", "不可以", "才沒有"]):
            emotion = "shy"
            action = "shake_head"
        elif any(w in raw_lower for w in ["生氣", "哼", "叉腰", "氣噗噗", "不理你了"]):
            emotion = "angry"
            action = "pout"
        elif any(w in raw_lower for w in ["害羞", "臉紅", "不要看", "討厭啦"]):
            emotion = "shy"
        elif any(w in raw_lower for w in ["坐下", "坐著", "坐這裡", "坐坐"]):
            emotion = "happy"
            action = "sit"
        elif any(w in raw_lower for w in ["跑步", "跑起來", "慢跑", "去跑步", "運動一下"]):
            emotion = "happy"
            action = "run"
        elif any(w in raw_lower for w in ["跳起來", "跳一下", "跳躍", "跳高", "原地跳"]):
            emotion = "happy"
            action = "jump"
        elif any(w in raw_lower for w in ["蹲下", "蹲著", "蹲在地上"]):
            emotion = "happy"
            action = "squat"
        elif any(w in raw_lower for w in ["跪下", "跪坐", "跪著", "正座", "道歉跪"]):
            emotion = "caring"
            action = "kneel"
        elif any(w in raw_lower for w in ["站起來", "起來", "站好", "站著", "停下來", "不要坐了", "不要跪了", "不要蹲了", "停止跑步"]):
            emotion = "happy"
            action = "stand"
        elif any(w in raw_lower for w in ["早安", "你好", "回來", "嗨", "揮手"]):
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

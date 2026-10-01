import ast
import json
import re
from typing import List, Dict, Any, Optional
import httpx

class OllamaLLMClient:
    """High-performance LLM Client with deep text sanitation for clean TTS and display."""

    def __init__(
        self,
        api_url: str = "http://127.0.0.1:8080/v1",
        model_name: str = "default",
        system_prompt: Optional[str] = None,
        api_key: Optional[str] = None,
        provider: str = "ollama"
    ):
        self.api_url = api_url.rstrip("/")
        self.base_root_url = self.api_url.replace("/v1", "")
        self.model_name = model_name
        self.api_key = api_key or ""
        self.provider = provider or "ollama"
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

        # 1. Strip think and model control tags
        text = re.sub(r"<think>[\s\S]*?</think>", "", text).strip()
        text = re.sub(r"<think>[\s\S]*", "", text).strip()
        text = re.sub(r"</think>", "", text).strip()
        text = re.sub(r"<\|im_start\|>[\s\S]*?<\|im_end\|>", "", text).strip()
        text = re.sub(r"<\|im_end\|>", "", text).strip()

        # 2. Try parsing complete or enclosed JSON block or Python dictionary/list
        cleaned_json = re.sub(r"^```(?:json|python)?\s*", "", text, flags=re.MULTILINE)
        cleaned_json = re.sub(r"\s*```$", "", cleaned_json, flags=re.MULTILINE).strip()
        cand = None

        # Find outermost braces or brackets for JSON or Python dict/list
        first_bracket = min([pos for pos in [cleaned_json.find('{'), cleaned_json.find('[')] if pos != -1] or [-1])
        last_bracket = max([pos for pos in [cleaned_json.rfind('}'), cleaned_json.rfind(']')] if pos != -1] or [-1])

        if first_bracket != -1 and last_bracket > first_bracket:
            substring = cleaned_json[first_bracket:last_bracket + 1]
            try:
                cand = json.loads(substring)
            except Exception:
                try:
                    cand = ast.literal_eval(substring)
                except Exception:
                    cand = None

        if isinstance(cand, list) and len(cand) > 0 and isinstance(cand[0], dict):
            cand = cand[0]

        if isinstance(cand, dict):
            for key in ["response", "reply", "message", "content", "text", "dialogue", "say", "answer"]:
                if key in cand and isinstance(cand[key], str) and cand[key].strip():
                    return cand[key].strip()

        # 3. Regex extraction for 'response', 'text', etc. matching either single or double quotes
        regex_match = re.search(
            r"""['"](?:response|reply|message|content|text|dialogue)['"]\s*:\s*['"]((?:\\.|[^'"])*)['"]""",
            text,
            re.IGNORECASE
        )
        if regex_match:
            try:
                return json.loads(f'"{regex_match.group(1)}"').strip()
            except Exception:
                return regex_match.group(1).replace("\\n", "\n").replace('\\"', '"').replace("\\'", "'").strip()

        # 4. Fallback markdown codeblock stripping
        text = cleaned_json

        # 5. Clean literal backslash sequences
        text = text.replace("\\n", "\n").replace("\\r", "").replace("\\t", " ")
        text = text.replace('\\"', '"').replace("\\'", "'")

        # 6. Strip stray JSON or python dict syntax (both single and double quotes)
        text = re.sub(r"""^\s*[\{\[]\s*['"](?:type|intention|sentiment|intent|mood)['"]\s*:\s*['"][^'"]*['"],?\s*""", "", text)
        text = re.sub(r"""^\s*['"](?:response|reply|message|content|text)['"]\s*:\s*['"]?""", "", text)
        text = re.sub(r"""['"]?\s*,\s*['"](?:emotion|sentiment|action|costume|intention)['"][\s\S]*$""", "", text)
        text = re.sub(r"""['"]?\s*[\}\]]\s*$""", "", text)

        # 7. Clean markdown headers and bullet stars
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

        # Try extracting structured emotion and action if JSON is present
        try:
            first_brace = raw_content.find('{')
            last_brace = raw_content.rfind('}')
            if first_brace != -1 and last_brace > first_brace:
                parsed = json.loads(raw_content[first_brace:last_brace + 1])
                if isinstance(parsed, dict):
                    raw_emotion = str(parsed.get("emotion") or parsed.get("sentiment") or parsed.get("mood") or "").lower()
                    if raw_emotion in ["happy", "shy", "caring", "angry", "surprised", "neutral"]:
                        emotion = raw_emotion

                    raw_action = str(parsed.get("action") or parsed.get("intention") or parsed.get("intent") or "").lower()
                    if raw_action in ["greeting", "hello", "hi"]:
                        action = "wave"
                    elif raw_action in ["heart", "love"]:
                        action = "heart_pose"
                    elif raw_action in ["idle", "wave", "bow", "clap", "tilt_head", "stretch", "cheer", "nod", "shake_head", "pout", "sit", "run", "jump", "squat", "kneel", "stand", "leave", "heart_pose", "change_costume"]:
                        action = raw_action

                    if parsed.get("costume") in ["casual", "school", "stylish", "gothic", "seed", "ayame", "mint"]:
                        costume = parsed["costume"]
        except Exception:
            pass

        # Fallback to keyword matching if action or emotion not definitively extracted
        if action == "idle":
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
            elif any(w in raw_lower for w in ["百鬼", "綾目", "ayame"]):
                action = "change_costume"
                costume = "ayame"
            elif any(w in raw_lower for w in ["薄荷", "泳裝", "mint"]):
                action = "change_costume"
                costume = "mint"
            elif any(w in raw_lower for w in ["哥德", "蘿莉", "暗黑裝", "gothic"]):
                action = "change_costume"
                costume = "gothic"
            elif any(w in raw_lower for w in ["便服", "日常裝", "休閒裝", "小櫻", "casual"]):
                action = "change_costume"
                costume = "casual"
            elif any(w in raw_lower for w in ["換角色", "切換角色", "換人", "換個角色", "換裝", "換衣服"]):
                action = "change_costume"
                # Default toggle between favorite characters
                costume = "ayame" if "ayame" not in raw_lower else "mint"
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
        """Send message using standard OpenAI-compatible chat completions or completion fallback."""
        self.conversation_history.append({"role": "user", "content": user_message})
        
        if len(self.conversation_history) > 8:
            self.conversation_history = self.conversation_history[-8:]

        headers = {
            "Content-Type": "application/json"
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        async with httpx.AsyncClient(timeout=60.0) as client:
            # 1. Primary: Standard OpenAI-compatible /v1/chat/completions
            try:
                chat_endpoint = f"{self.api_url}/chat/completions"
                # Increase max_tokens for cloud providers (NVIDIA NIM) or reasoning models
                max_tokens = 1024 if (self.api_key or self.provider == "nvidia") else 256
                payload = {
                    "model": self.model_name,
                    "messages": [
                        {"role": "system", "content": self.system_prompt}
                    ] + self.conversation_history,
                    "max_tokens": max_tokens,
                    "temperature": 0.7
                }
                resp = await client.post(chat_endpoint, json=payload, headers=headers)
                if resp.status_code == 200:
                    msg = resp.json()["choices"][0]["message"]
                    content = msg.get("content")
                    # If content is a list of multi-modal content parts
                    if isinstance(content, list):
                        parts = [
                            part.get("text", "") for part in content
                            if isinstance(part, dict) and "text" in part
                        ]
                        content = "".join(parts) if parts else str(content)
                    reasoning = msg.get("reasoning_content")
                    raw = content if (content and str(content).strip()) else (reasoning or "")
                    result = self._extract_intent(raw)
                    self.conversation_history.append({"role": "assistant", "content": result["reply"]})
                    return result
                else:
                    print(f"[OllamaLLMClient] Chat completions returned status {resp.status_code}: {resp.text}")
            except Exception as e:
                print(f"[OllamaLLMClient] Chat completions failed: {e}")

            # 2. Secondary fallback: llama.cpp native /completion (local only)
            if not self.api_key and self.provider != "nvidia":
                try:
                    prompt = f"<|im_start|>system\n{self.system_prompt}<|im_end|>\n"
                    for turn in self.conversation_history:
                        role = turn["role"]
                        content = turn["content"]
                        prompt += f"<|im_start|>{role}\n{content}<|im_end|>\n"
                    prompt += "<|im_start|>assistant\n"

                    completion_endpoint = f"{self.base_root_url}/completion"
                    payload = {
                        "prompt": prompt,
                        "n_predict": 180,
                        "temperature": 0.75,
                        "stop": ["<|im_end|>", "<|endoftext|>"]
                    }
                    resp = await client.post(completion_endpoint, json=payload, headers=headers)
                    if resp.status_code == 200:
                        raw_content = resp.json().get("content", "")
                        result = self._extract_intent(raw_content)
                        self.conversation_history.append({"role": "assistant", "content": result["reply"]})
                        return result
                except Exception as e:
                    print(f"[OllamaLLMClient] Completion fallback failed: {e}")

        fallback_reply = "主人好！我在這裡陪你聊天呢～"
        return {
            "reply": fallback_reply,
            "speech_text": fallback_reply,
            "emotion": "happy",
            "action": "idle",
            "costume": None
        }

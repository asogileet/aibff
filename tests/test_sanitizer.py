import unittest
from backend.llm.ollama_client import OllamaLLMClient

class TestSanitizer(unittest.TestCase):
    def test_json_and_escapes(self):
        client = OllamaLLMClient()
        raw = '```json { "reply": "哇！你聽聽看～\\n\\n你是夜空中最亮的星，\\n閃耀著光。 (輕輕歪頭)" }'
        result = client._extract_intent(raw)
        
        # Display text should not contain ```json or raw \n
        self.assertNotIn("```json", result["reply"])
        self.assertNotIn("\\n", result["reply"])
        self.assertIn("你是夜空中最亮的星", result["reply"])

        # Speech text should not contain parentheses or backslash
        self.assertNotIn("輕輕歪頭", result["speech_text"])
        self.assertNotIn("\\", result["speech_text"])
        self.assertNotIn("n", result["speech_text"]) # No literal 'n' from \n
        print("\n[Sanitizer Test Passed]")
        print("DISPLAY:\n" + result["reply"])
        print("SPEECH:\n" + result["speech_text"])

    def test_structured_response_field(self):
        client = OllamaLLMClient()
        raw1 = '{ "intention": "greeting", "sentiment": "happy", "response": "主人好呀～✨ 人家一直在這裡等你呢～💕"}'
        result1 = client._extract_intent(raw1)
        self.assertEqual(result1["reply"], "主人好呀～✨ 人家一直在這裡等你呢～💕")
        self.assertEqual(result1["emotion"], "happy")
        self.assertEqual(result1["action"], "wave")

        raw2 = '{ "intention": "confirm_language", "sentiment": "happy", "response": "Yes, I do! I can chat with you in English~ What would you like to talk about? 💕"}'
        result2 = client._extract_intent(raw2)
        self.assertEqual(result2["reply"], "Yes, I do! I can chat with you in English~ What would you like to talk about? 💕")

if __name__ == "__main__":
    unittest.main()

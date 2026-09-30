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

if __name__ == "__main__":
    unittest.main()

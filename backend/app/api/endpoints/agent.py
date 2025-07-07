from google import genai

from .base import AIPlatform


class Gemini(AIPlatform):
    def __init__(self, api_key: str, system_prompt: str = ""):
        self.api_key = api_key
        self.system_prompt = system_prompt
        self.client = genai.Client(api_key=self.api_key)
        self.model = "gemini-2.5-flash"

    def chat(self, prompt: str) -> str:
        if self.system_prompt:
            prompt = f"{self.system_prompt}\n\n{prompt}"

        try:
            response = self.client.models.generate_content(
                model=self.model, contents=prompt
            )
        except Exception as e:
            return f"An error occurred: {e}"

        return response.text

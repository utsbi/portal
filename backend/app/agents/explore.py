from typing import Dict, Any, List, Optional
from google import genai

from app.core.config import settings
from app.agents.graph import run_graph


async def run_explore_agent(query: str, client_id: str,
    history: Optional[List[Dict[str, str]]] = None,
    attachments: Optional[List[Dict[str, str]]] = None,
    model_preference: str = "fast"
) -> Dict[str, Any]:
    """Main entry point for running the Explore AI Agent."""
    result = await run_graph(
        query=query,
        client_id=client_id,
        history=history or [],
        attachments=attachments or [],
        model_preference=model_preference
    )
    
    return result


class GeminiClient:
    def __init__(self, model=settings.fast_model):
        self.client = genai.Client(api_key=settings.api_key)
        self.model = model
    
    def generate(self, prompt: str, system_prompt: str = "") -> str:
        """Generate a response from the model."""
        full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
        
        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=full_prompt
            )
            return response.text
        except Exception as e:
            return f"Error generating response: {str(e)}"
    
    async def agenerate(self, prompt: str, system_prompt: str = "") -> str:
        """Async version of generate."""
        return self.generate(prompt, system_prompt)

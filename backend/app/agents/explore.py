from typing import Dict, Any, List, Optional
from openai import OpenAI, AsyncOpenAI

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


class OpenRouterClient:
    def __init__(self, model=settings.fast_model):
        self.client = OpenAI(
            api_key=settings.api_key,
            base_url="https://openrouter.ai/api/v1"
        )
        self.async_client = AsyncOpenAI(
            api_key=settings.api_key,
            base_url="https://openrouter.ai/api/v1"
        )
        self.model = model

    def generate(self, prompt: str, system_prompt: str = "") -> str:
        """Generate a response from the model."""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            return f"Error generating response: {str(e)}"

    async def agenerate(self, prompt: str, system_prompt: str = "") -> str:
        """Async version of generate."""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        try:
            response = await self.async_client.chat.completions.create(
                model=self.model,
                messages=messages
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            return f"Error generating response: {str(e)}"

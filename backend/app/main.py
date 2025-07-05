import os
from fastapi import FastAPI
from pydantic import BaseModel
from .ai.gemini import Gemini
from .auth.dependencies import get_user_identifier
from .auth.throttling import apply_rate_limit

app = FastAPI()

def load_system_prompt():
    try:
        with open("system_prompt.md", "r") as f:
            return f.read()
    except FileNotFoundError:
        return "System prompt file was unable to be read"

system_prompt = load_system_prompt()
gemini_api_key = os.getenv("GEMINI_API_KEY")

ai_platform = Gemini(api_key=gemini_api_key, system_prompt=system_prompt)

class ChatRequest(BaseModel):
    prompt: str
    
class ChatResponse(BaseModel):
    response: str
    
@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    response_test = ai_platform.chat(request.prompt)
    return ChatResponse(response=response_test)    

@app.get("/")
async def root():
    return{"message": "API is running"}
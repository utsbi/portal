from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class ChatRequest(BaseModel):
    prompt: str
    
class ChatResponse(BaseModel):
    response: str
    
@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    response_test = "..."
    return ChatResponse(response=response_test)    

@app.get("/")
async def root():
    return{"message": "API  is running"}
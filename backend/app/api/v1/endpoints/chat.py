from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime

from app.schemas.chat import ChatRequest, ChatResponse, ChatMessage, SourceDocument
from app.agents.explore import run_explore_agent
from app.api.deps import get_current_user_id


router = APIRouter()


@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest, user_id: str = Depends(get_current_user_id)):
    """Chat with the Explore AI Agent."""
    try:
        history = [
            {
                "role": msg.role,
                "content": msg.content
            }
            for msg in request.history
        ]
        
        result = await run_explore_agent(
            query=request.query,
            client_id=user_id,
            history=history
        )
        
        sources = []
        if request.include_sources:
            for source in result.get("sources", []):
                sources.append(SourceDocument(
                    content=source.get("content", ""),
                    filename=source.get("filename", "Unknown"),
                    page_number=source.get("page_number"),
                    relevance_score=source.get("relevance_score")
                ))
        
        return ChatResponse(
            answer=result.get("response", ""),
            sources=sources,
            timestamp=datetime.now()
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing chat request: {str(e)}"
        )


@router.get("/health")
async def chat_health():
    """Health check endpoint for chat service."""
    return {
        "status": "healthy",
        "service": "chat",
        "timestamp": datetime.now().isoformat()
    }

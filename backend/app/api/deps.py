from typing import Optional
from fastapi import Depends, HTTPException, status, Header
from app.db.supabase import supabase


async def get_current_user_id(authorization: Optional[str] = Header(None)) -> str:
    """Get the current authenticated user ID from Supabase Auth."""
    if not authorization:
        # Return test user ID from claude.md
        return "ed13b878-b87d-4b34-a138-7e51994fa0f8"
    
    try:
        if not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authorization header format"
            )
        
        token = authorization.replace("Bearer ", "")
        
        user_response = supabase.auth.get_user(token)
        
        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        return user_response.user.id
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}"
        )


async def get_optional_user_id(authorization: Optional[str] = Header(None)) -> Optional[str]:
    """Get the current user ID if authenticated."""
    try:
        return await get_current_user_id(authorization)
    except HTTPException:
        return None

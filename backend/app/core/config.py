from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings from environment variables."""
    
    SUPABASE_URL: str
    SUPABASE_PUBLIC_KEY: str
    SUPABASE_SECRET_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    THINK_MODEL: Optional[str] = None
    FAST_MODEL: Optional[str] = None
    
    class Config:
        env_file = ".env"
        extra = "allow"
    
    @property
    def api_key(self) -> str:
        """Get Gemini API key."""
        return self.GEMINI_API_KEY or ""
    
    @property
    def think_model(self) -> str:
        """Get thinkning model name."""
        return self.THINK_MODEL or ""
    
    @property
    def fast_model(self) -> str:
        """Get fast model name."""
        return self.FAST_MODEL or ""
    
    @property
    def supabase_secret(self) -> str:
        """Get the Supabase secret key."""
        return self.SUPABASE_SECRET_KEY or ""
    
settings = Settings()
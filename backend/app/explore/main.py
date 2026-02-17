import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.explore.api.v1.router import router as v1_router

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="SBI Client Portal API",
    description="AI-powered project management dashboard",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router, prefix="/api")


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "message": "SBI Client Portal API is running",
        "version": "1.0.0",
        "status": "healthy"
    }


@app.get("/health")
async def health():
    """Detailed health check."""
    return {
        "status": "healthy",
        "api": "online",
        "version": "1.0.0"
    }


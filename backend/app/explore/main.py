import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.explore.core.config import settings
from app.explore.core.limiter import limiter
from app.explore.api.v1.router import router as v1_router
from app.explore.schemas.chat import MAX_TOTAL_IMAGE_CHARS

logging.basicConfig(level=logging.INFO)

_is_prod = settings.ENV == "production"

# Hard request-body ceiling, checked from Content-Length BEFORE uvicorn buffers
# and Pydantic parses the whole JSON body. Sits just above the aggregate
# image-payload cap so a client can't force multi-MB allocations only to be
# rejected by the post-parse validators.
_MAX_BODY_BYTES = MAX_TOTAL_IMAGE_CHARS + 4 * 1024 * 1024  # ~32 MB

app = FastAPI(
    title="SBI Client Portal API",
    description="AI-powered project management dashboard",
    docs_url=None if _is_prod else "/docs",
    redoc_url=None if _is_prod else "/redoc",
    openapi_url=None if _is_prod else "/openapi.json",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.allowed_hosts_list,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    """Reject oversized request bodies before they are buffered and parsed."""
    content_length = request.headers.get("content-length")
    if content_length is not None:
        try:
            declared = int(content_length)
        except ValueError:
            return JSONResponse(
                {"detail": "Invalid Content-Length"}, status_code=400
            )
        if declared > _MAX_BODY_BYTES:
            return JSONResponse(
                {"detail": "Request body too large"}, status_code=413
            )
    return await call_next(request)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Attach security headers to every response."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if _is_prod:
        response.headers["Strict-Transport-Security"] = (
            "max-age=63072000; includeSubDomains"
        )
    return response


app.include_router(v1_router, prefix="/api")


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "message": "SBI Client Portal API is running",
        "status": "healthy",
    }


@app.get("/health")
async def health():
    """Detailed health check."""
    return {
        "status": "healthy",
        "api": "online",
    }

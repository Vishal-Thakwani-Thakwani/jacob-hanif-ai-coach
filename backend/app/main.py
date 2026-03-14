from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.limiter import limiter
from app.routers.chat import router as chat_router
from app.routers.integrations import router as integrations_router
from app.routers.voice import router as voice_router


app = FastAPI(title="Jacob Hanif AI Coach")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://www.jacobcoach.website",
        "https://jacobcoach.website",
        "https://jacob-hanif-ai-coach.vercel.app",
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(chat_router)
app.include_router(integrations_router)
app.include_router(voice_router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}

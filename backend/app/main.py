from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.chat import router as chat_router
from app.routers.integrations import router as integrations_router


app = FastAPI(title="Jacob Hanif AI Coach")

# Allow CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(integrations_router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}

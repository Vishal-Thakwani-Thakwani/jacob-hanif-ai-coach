from __future__ import annotations

from pathlib import Path
from typing import Optional
import os

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8",
        extra="ignore"  # Ignore extra env vars
    )

    # OpenAI
    openai_api_key: Optional[str] = None
    openai_model: str = Field(default="gpt-4o-mini")
    embedding_model: str = Field(default="text-embedding-3-large")

    # RAG / Vector Store - use relative paths for Railway
    ebooks_dir: Path = Field(default=Path("data/ebooks"))
    ebook_glob: str = Field(default="*.pdf,*.docx,*.txt,*.md")
    chroma_dir: Path = Field(default=Path("data/chroma"))
    
    # Supabase
    supabase_url: Optional[str] = None
    supabase_service_key: Optional[str] = None
    supabase_jwt_secret: Optional[str] = None


settings = Settings()

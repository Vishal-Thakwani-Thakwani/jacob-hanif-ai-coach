from __future__ import annotations

from pathlib import Path

from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings

from app.core.config import settings


def get_embeddings() -> OpenAIEmbeddings:
    if not settings.openai_api_key:
        raise ValueError("OPENAI_API_KEY is required to build embeddings.")
    return OpenAIEmbeddings(model=settings.embedding_model, api_key=settings.openai_api_key)


def get_vector_store(persist_dir: Path | None = None) -> Chroma:
    persist_directory = str(persist_dir or settings.chroma_dir)
    return Chroma(persist_directory=persist_directory, embedding_function=get_embeddings())

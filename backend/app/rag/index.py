from __future__ import annotations

import re
from pathlib import Path

from langchain_community.document_loaders import Docx2txtLoader, PyPDFLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.core.config import settings
from app.rag.vector_store import get_embeddings


_POLLUTION_PATTERNS = re.compile(
    r"\b(?:LLM|transformer|Ollama|Langchain|docker|kubernetes|containeris|"
    r"neural network|machine learning|deep learning|GPT-[234]|"
    r"fine.?tun|token(?:is|iz)|bitnet|fastAPI interface|coursework|"
    r"RAG pipeline|vector database|embedding model)\b",
    re.IGNORECASE,
)


def _is_relevant_chunk(text: str) -> bool:
    """Return False if the chunk is polluted with non-training content."""
    matches = len(_POLLUTION_PATTERNS.findall(text))
    return matches < 3


def _iter_files(root: Path, patterns: list[str]) -> list[Path]:
    files: list[Path] = []
    for pattern in patterns:
        files.extend(root.rglob(pattern))
    return [path for path in files if path.is_file()]


def _load_file(path: Path):
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return PyPDFLoader(str(path)).load()
    if suffix in {".txt", ".md"}:
        return TextLoader(str(path), encoding="utf-8").load()
    if suffix == ".docx":
        return Docx2txtLoader(str(path)).load()
    return []


def load_documents(ebooks_dir: Path | None = None, glob: str | None = None):
    root = ebooks_dir or settings.ebooks_dir
    patterns = (glob or settings.ebook_glob).split(",")
    patterns = [pattern.strip() for pattern in patterns if pattern.strip()]

    documents = []
    for path in _iter_files(Path(root), patterns):
        documents.extend(_load_file(path))
    return documents


def build_vector_store(
    ebooks_dir: Path | None = None,
    glob: str | None = None,
    persist_dir: Path | None = None,
    chunk_size: int = 1000,
    chunk_overlap: int = 150,
):
    docs = load_documents(ebooks_dir=ebooks_dir, glob=glob)
    if not docs:
        raise ValueError("No documents found. Check EBOOKS_DIR and EBOOK_GLOB.")

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", " ", ""],
    )
    chunks = splitter.split_documents(docs)

    original_count = len(chunks)
    chunks = [c for c in chunks if _is_relevant_chunk(c.page_content)]
    filtered_count = original_count - len(chunks)
    if filtered_count:
        print(f"Filtered out {filtered_count} polluted chunks ({original_count} → {len(chunks)})")

    embeddings = get_embeddings()
    persist_directory = str(persist_dir or settings.chroma_dir)

    from langchain_community.vectorstores import Chroma

    store = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory=persist_directory,
    )
    return store

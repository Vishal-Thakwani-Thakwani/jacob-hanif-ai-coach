#!/usr/bin/env python3
"""Rebuild the RAG vector store from clean ebook data.

Usage:
    python scripts/rebuild_rag.py [--ebooks-dir data/ebooks] [--chroma-dir data/chroma]

This script:
1. Deletes the existing ChromaDB vector store
2. Loads documents from the ebooks directory
3. Filters out non-training-related content (LLM course notes, etc.)
4. Rebuilds the vector store with clean embeddings
"""
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from app.core.config import settings  # noqa: E402
from app.rag.index import build_vector_store  # noqa: E402


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Rebuild RAG vector store")
    parser.add_argument("--ebooks-dir", default=None, help="Path to ebooks directory")
    parser.add_argument("--chroma-dir", default=None, help="Path to ChromaDB directory")
    parser.add_argument("--include-pdf", action="store_true",
                        help="Also index data/me.pdf (the mixed PDF)")
    args = parser.parse_args()

    chroma_dir = Path(args.chroma_dir) if args.chroma_dir else settings.chroma_dir
    ebooks_dir = Path(args.ebooks_dir) if args.ebooks_dir else settings.ebooks_dir

    if chroma_dir.exists():
        print(f"Deleting existing vector store at {chroma_dir}...")
        shutil.rmtree(chroma_dir)
        print("Deleted.")

    if args.include_pdf:
        ebooks_dir = Path("data")
        print(f"Including all files in {ebooks_dir} (with pollution filter)")

    print(f"Building vector store from {ebooks_dir}...")
    print(f"Output: {chroma_dir}")

    store = build_vector_store(ebooks_dir=ebooks_dir, persist_dir=chroma_dir)

    collection = store._collection
    count = collection.count()
    print(f"\nDone! Vector store has {count} chunks.")


if __name__ == "__main__":
    main()

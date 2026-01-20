from __future__ import annotations

import argparse
from pathlib import Path

from backend.app.rag.index import build_vector_store


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build Chroma vector store from ebooks.")
    parser.add_argument("--ebooks-dir", type=str, default=None)
    parser.add_argument("--glob", type=str, default=None, help="Comma-separated patterns, e.g. *.pdf,*.docx")
    parser.add_argument("--output", type=str, default=None, help="Chroma persist directory")
    parser.add_argument("--chunk-size", type=int, default=1000)
    parser.add_argument("--chunk-overlap", type=int, default=150)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    build_vector_store(
        ebooks_dir=Path(args.ebooks_dir) if args.ebooks_dir else None,
        glob=args.glob,
        persist_dir=Path(args.output) if args.output else None,
        chunk_size=args.chunk_size,
        chunk_overlap=args.chunk_overlap,
    )
    print("Vector store built successfully.")


if __name__ == "__main__":
    main()

# Jacob Hanif AI Coach (RAG + Voice)

Monetizable AI clone of calisthenics coach Jacob Hanif with retrieval-augmented coaching and optional voice.

## Architecture
- `backend/` — FastAPI API + RAG pipeline (LangChain + Chroma)
- `frontend/` — UI placeholder (Streamlit or React later)
- `scripts/` — data ingestion utilities
- `data/` — local vector store (ignored in production)

## Quick Start (Local)
1. Create env:
   - `cp env.example .env`
   - Add `OPENAI_API_KEY`
2. Build vector store from ebooks:
   - `python3 scripts/build_vector_store.py --ebooks-dir "/Users/vishalthakwani/Downloads" --glob "*.pdf,*.docx"`
3. Run API:
   - `uvicorn backend.app.main:app --reload`

## RAG Flow
1. `scripts/build_vector_store.py` loads PDFs/DOCX, chunks text, builds Chroma store in `data/chroma`.
2. API calls retrieve relevant chunks and answer with Jacob-style system prompt.

## Notes
- You can change `EBOOKS_DIR`, `EBOOK_GLOB`, and `CHROMA_DIR` in `.env`.
- If you want a different embeddings provider, update `backend/app/rag/vector_store.py`.
# Trigger deploy

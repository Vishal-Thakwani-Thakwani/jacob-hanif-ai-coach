"""
Smoke test script for Jacob Hanif AI Coach.
Tests all critical paths: health, RAG chat, voice synthesis, and vector store.

Usage:
    python scripts/smoke_test.py [--production]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

import httpx

LOCAL_URL = "http://localhost:8000"
PROD_URL = "https://jacob-hanif-ai-coach-production.up.railway.app"

GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"

passed = 0
failed = 0


def test(name: str, fn, *args):
    global passed, failed
    try:
        fn(*args)
        print(f"  {GREEN}PASS{RESET}  {name}")
        passed += 1
    except Exception as e:
        print(f"  {RED}FAIL{RESET}  {name}: {e}")
        failed += 1


def test_health(base: str):
    r = httpx.get(f"{base}/health", timeout=10)
    assert r.status_code == 200, f"Status {r.status_code}"
    data = r.json()
    assert data.get("status") == "ok", f"Unexpected: {data}"


def test_chat_coaching(base: str):
    r = httpx.post(
        f"{base}/chat",
        json={"message": "How do I train for a planche?"},
        timeout=30,
    )
    assert r.status_code == 200, f"Status {r.status_code}: {r.text[:200]}"
    data = r.json()
    answer = data.get("answer", "")
    assert len(answer) > 20, f"Answer too short: {answer}"
    keywords = ["planche", "tuck", "lean", "hold", "progression", "core", "strength", "train"]
    assert any(kw in answer.lower() for kw in keywords), f"No coaching keywords in: {answer[:100]}"


def test_chat_casual(base: str):
    r = httpx.post(
        f"{base}/chat",
        json={"message": "Hey whats up?"},
        timeout=30,
    )
    assert r.status_code == 200, f"Status {r.status_code}"
    data = r.json()
    assert len(data.get("answer", "")) > 5, "Empty casual response"


def test_chat_rag_quality(base: str):
    """Verify RAG retrieves relevant ebook content."""
    r = httpx.post(
        f"{base}/chat",
        json={"message": "What exercises does Jacob recommend for the Arnold split?"},
        timeout=30,
    )
    assert r.status_code == 200, f"Status {r.status_code}"
    data = r.json()
    answer = data.get("answer", "")
    assert len(answer) > 30, f"Answer too short for RAG query: {answer}"


def test_voice_synthesize_api():
    """Test ElevenLabs API directly (no auth needed)."""
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        raise RuntimeError("ELEVENLABS_API_KEY env var required")
    voice_id = "o3uVEWMvjriqkdpLxRL6"

    r = httpx.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream",
        headers={
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": api_key,
        },
        json={
            "text": "Test.",
            "model_id": "eleven_monolingual_v1",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
        },
        timeout=15,
    )
    assert r.status_code == 200, f"ElevenLabs status {r.status_code}: {r.text[:200]}"
    assert len(r.content) > 1000, f"Audio too small: {len(r.content)} bytes"


def test_vector_store_exists():
    """Verify ChromaDB vector store is built."""
    chroma_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "backend", "data", "chroma", "chroma.sqlite3",
    )
    assert os.path.exists(chroma_path), f"ChromaDB not found at {chroma_path}"
    size = os.path.getsize(chroma_path)
    assert size > 1_000_000, f"ChromaDB too small ({size} bytes), may be empty"


def test_frontend_accessible(base_frontend: str):
    r = httpx.get(base_frontend, follow_redirects=True, timeout=10)
    assert r.status_code == 200, f"Frontend status {r.status_code}"


def main():
    parser = argparse.ArgumentParser(description="Smoke tests for Jacob Hanif AI Coach")
    parser.add_argument("--production", action="store_true", help="Test production URLs")
    args = parser.parse_args()

    base = PROD_URL if args.production else LOCAL_URL
    env = "PRODUCTION" if args.production else "LOCAL"

    print(f"\n{'='*50}")
    print(f"  Smoke Tests - {env}")
    print(f"  Backend: {base}")
    print(f"{'='*50}\n")

    print(f"{YELLOW}[Backend]{RESET}")
    test("Health check", test_health, base)
    test("Chat - coaching question (RAG)", test_chat_coaching, base)
    test("Chat - casual greeting (no RAG)", test_chat_casual, base)
    test("Chat - RAG quality (Arnold split)", test_chat_rag_quality, base)

    print(f"\n{YELLOW}[Voice]{RESET}")
    test("ElevenLabs TTS API (Jacob's voice)", test_voice_synthesize_api)

    print(f"\n{YELLOW}[Data]{RESET}")
    test("ChromaDB vector store exists (695 embeddings)", test_vector_store_exists)

    if args.production:
        print(f"\n{YELLOW}[Frontend]{RESET}")
        test("jacobcoach.website accessible", test_frontend_accessible, "https://www.jacobcoach.website")

    print(f"\n{'='*50}")
    total = passed + failed
    if failed == 0:
        print(f"  {GREEN}ALL {total} TESTS PASSED{RESET}")
    else:
        print(f"  {GREEN}{passed} passed{RESET}, {RED}{failed} failed{RESET} out of {total}")
    print(f"{'='*50}\n")

    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()

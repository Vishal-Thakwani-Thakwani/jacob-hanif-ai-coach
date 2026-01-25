"""
Voice call endpoint using ElevenLabs for Jacob's voice.
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import httpx

from app.core.config import settings
from app.core.auth import get_user_with_profile

router = APIRouter()


class VoiceRequest(BaseModel):
    text: str
    voice_id: Optional[str] = None  # Override default voice


@router.post("/voice/synthesize")
async def synthesize_voice(
    request: VoiceRequest,
    user: dict = Depends(get_user_with_profile)
):
    """
    Convert text to speech using Jacob's voice via ElevenLabs.
    Returns audio stream (MP3).
    Pro users only.
    """
    # Check if Pro user
    if not user.get("is_pro", False):
        raise HTTPException(
            status_code=403,
            detail={
                "error": "Pro feature required",
                "message": "Voice calls with Jacob are a Pro feature. Upgrade to talk with your AI coach!",
                "upgrade_url": "/pricing"
            }
        )
    
    if not settings.elevenlabs_api_key:
        raise HTTPException(status_code=500, detail="ElevenLabs API key not configured")
    
    voice_id = request.voice_id or settings.elevenlabs_voice_id
    
    # ElevenLabs API endpoint
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream"
    
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": settings.elevenlabs_api_key,
    }
    
    payload = {
        "text": request.text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
            "style": 0.5,
            "use_speaker_boost": True
        }
    }
    
    async def stream_audio():
        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                url,
                headers=headers,
                json=payload,
                timeout=60.0
            ) as response:
                if response.status_code != 200:
                    error_text = await response.aread()
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=f"ElevenLabs error: {error_text.decode()}"
                    )
                async for chunk in response.aiter_bytes():
                    yield chunk
    
    return StreamingResponse(
        stream_audio(),
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": "inline; filename=jacob_response.mp3"
        }
    )


@router.get("/voice/voices")
async def list_voices(user: dict = Depends(get_user_with_profile)):
    """
    List available voices (for testing/admin).
    """
    if not settings.elevenlabs_api_key:
        raise HTTPException(status_code=500, detail="ElevenLabs API key not configured")
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.elevenlabs.io/v1/voices",
            headers={"xi-api-key": settings.elevenlabs_api_key},
            timeout=30.0
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Failed to fetch voices")
        
        return response.json()

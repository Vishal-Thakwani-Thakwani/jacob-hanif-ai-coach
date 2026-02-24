from __future__ import annotations

from typing import Optional
import json
import asyncio

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from openai import AsyncOpenAI

from app.core.config import settings
from app.core.auth import (
    require_subscription, 
    get_supabase, 
    check_message_limit, 
    get_user_with_profile,
    increment_usage
)
from app.rag.prompt import SYSTEM_PROMPT, VISION_PROMPT
from app.rag.vector_store import get_vector_store
from app.db import database as db


router = APIRouter()


class WearableData(BaseModel):
    recovery_score: Optional[int] = None
    hrv: Optional[int] = None
    rhr: Optional[int] = None
    sleep_score: Optional[int] = None
    readiness_score: Optional[int] = None


class ChatRequest(BaseModel):
    message: str
    image_b64: Optional[str] = None
    image_type: Optional[str] = None  # e.g., "image/jpeg"
    whoop_data: Optional[dict] = None
    oura_data: Optional[dict] = None


class ChatResponse(BaseModel):
    answer: str


def _is_coaching_question(message: str) -> bool:
    """Determine if the message is a coaching/fitness question vs casual chat."""
    msg_lower = message.lower().strip()
    casual_patterns = ["hi", "hey", "hello", "sup", "what's up", "how are you", "thanks", "thank you", "bye", "goodbye"]
    if any(msg_lower.startswith(p) or msg_lower == p for p in casual_patterns):
        return False
    fitness_keywords = ["workout", "exercise", "train", "planche", "pullup", "pushup", "muscle", "strength", 
                        "form", "progression", "routine", "diet", "protein", "recovery", "testosterone",
                        "debloat", "lean", "fat", "weight", "rep", "set", "hold", "skill", "handstand",
                        "dip", "row", "core", "ab", "arm", "leg", "back", "chest", "shoulder"]
    return any(kw in msg_lower for kw in fitness_keywords) or len(message.split()) > 6


def _build_wearable_context(whoop_data: dict | None, oura_data: dict | None) -> str:
    """Build context string from wearable data."""
    parts = []
    if whoop_data:
        parts.append(f"Whoop Data - Recovery: {whoop_data.get('recovery_score', 'N/A')}%, "
                     f"HRV: {whoop_data.get('hrv', 'N/A')}ms, RHR: {whoop_data.get('rhr', 'N/A')}bpm")
    if oura_data:
        parts.append(f"Oura Data - Readiness: {oura_data.get('readiness_score', 'N/A')}, "
                     f"Sleep Score: {oura_data.get('sleep_score', 'N/A')}")
    return "\n".join(parts) if parts else ""


def _build_progress_context() -> str:
    """Build context string from historical progress data."""
    try:
        summary = db.get_user_progress_summary()
        parts = []
        
        # Oura trends
        oura = summary.get("oura", {})
        weekly = oura.get("weekly_avg", {})
        if weekly.get("days_with_data", 0) > 0:
            parts.append("=== 7-DAY RECOVERY AVERAGES ===")
            parts.append(f"Readiness: {weekly.get('readiness_avg', 'N/A')} (range: {weekly.get('readiness_min', 'N/A')}-{weekly.get('readiness_max', 'N/A')})")
            parts.append(f"Sleep: {weekly.get('sleep_avg', 'N/A')} (range: {weekly.get('sleep_min', 'N/A')}-{weekly.get('sleep_max', 'N/A')})")
            parts.append(f"Activity: {weekly.get('activity_avg', 'N/A')}")
            parts.append(f"Steps/day: {int(weekly.get('steps_avg', 0)):,}" if weekly.get('steps_avg') else "")
            
            # Add trends
            readiness_trend = oura.get("readiness_trend", {})
            sleep_trend = oura.get("sleep_trend", {})
            if readiness_trend.get("trend") != "insufficient_data":
                parts.append(f"\nReadiness trend: {readiness_trend.get('trend', 'N/A').upper()} ({readiness_trend.get('change_percent', 0):+.1f}% vs previous week)")
            if sleep_trend.get("trend") != "insufficient_data":
                parts.append(f"Sleep trend: {sleep_trend.get('trend', 'N/A').upper()} ({sleep_trend.get('change_percent', 0):+.1f}% vs previous week)")
        
        # Training progress
        training = summary.get("training", {})
        if training:
            parts.append("\n=== TRAINING PROGRESS ===")
            for key, data in training.items():
                exercise = data.get("exercise", "").replace("_", " ").title()
                metric = data.get("metric", "")
                trend = data.get("trend", "")
                change = data.get("change_percent", 0)
                recent = data.get("recent_avg", 0)
                previous = data.get("previous_avg", 0)
                
                unit = "s" if "time" in metric or "hold" in metric else ""
                if "weight" in metric:
                    unit = "kg"
                
                parts.append(f"{exercise} ({metric}): {trend.upper()} - Recent avg: {recent}{unit} vs Previous: {previous}{unit} ({change:+.1f}%)")
        
        # Analysis flags - CRITICAL for coaching decisions
        flags = summary.get("analysis", {}).get("flags", [])
        if flags:
            parts.append("\n=== COACHING ALERTS ===")
            for flag in flags:
                parts.append(f"⚠️ {flag}")
        
        return "\n".join(filter(None, parts))
    except Exception as e:
        print(f"Warning: Could not build progress context: {e}")
        return ""


class StreamChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    image_b64: Optional[str] = None
    image_type: Optional[str] = None


@router.post("/chat/stream")
async def chat_stream(
    request: StreamChatRequest,
    user: dict = Depends(check_message_limit)
):
    """Stream chat response using Server-Sent Events.
    
    Free users: 5 messages/day, no image upload
    Pro users: Unlimited messages, image upload, Oura integration
    """
    if not settings.openai_api_key:
        raise HTTPException(status_code=400, detail="OPENAI_API_KEY not set.")
    
    user_id = user.get("sub")
    conversation_id = request.conversation_id
    has_image = bool(request.image_b64)
    is_pro = user.get("is_pro", False)
    
    import re
    _is_valid_uuid = bool(conversation_id and re.match(
        r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        conversation_id, re.IGNORECASE
    ))
    
    if has_image and not is_pro:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "Pro feature required",
                "message": "Image form analysis is a Pro feature. Upgrade to get personalized form feedback!",
                "upgrade_url": "/pricing"
            }
        )
    
    supabase = get_supabase()
    
    history = []
    if _is_valid_uuid:
        try:
            result = supabase.table("messages") \
                .select("role, content") \
                .eq("conversation_id", conversation_id) \
                .eq("user_id", user_id) \
                .order("created_at", desc=True) \
                .limit(10) \
                .execute()
            history = list(reversed(result.data)) if result.data else []
        except Exception:
            history = []
    
    # 2. Get Oura context FROM DATABASE (Pro only)
    oura_context = ""
    profile = user.get("profile", {})
    if is_pro and profile.get("oura_access_token"):
        oura_result = supabase.table("oura_daily") \
            .select("*") \
            .eq("user_id", user_id) \
            .order("date", desc=True) \
            .limit(7) \
            .execute()
        
        if oura_result.data:
            latest = oura_result.data[0]
            avg_readiness = sum(d.get("readiness_score", 0) or 0 for d in oura_result.data) / len(oura_result.data)
            oura_context = f"""
User's Recovery Data (from Oura Ring):
- Today: Readiness {latest.get('readiness_score', 'N/A')}, Sleep {latest.get('sleep_score', 'N/A')}
- 7-day avg readiness: {avg_readiness:.0f}
"""
    
    # 3. Retrieve RAG context for coaching questions
    context = ""
    if _is_coaching_question(request.message) or has_image:
        retriever = get_vector_store().as_retriever(search_kwargs={"k": 5})
        search_query = request.message
        if has_image:
            search_query += " form technique position alignment"
        docs = retriever.invoke(search_query)
        context = "\n\n---\n\n".join(doc.page_content for doc in docs)
    
    # 4. Build messages with system prompt + history + new message
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    
    # Add chat history
    for msg in history:
        messages.append({"role": msg["role"], "content": msg["content"]})
    
    # Add current user message with context
    user_content = request.message
    if oura_context:
        user_content += f"\n\n[User's Oura Data: {oura_context}]"
    if context:
        user_content += f"\n\n[Relevant training content: {context}]"
    messages.append({"role": "user", "content": user_content})
    
    # Choose model
    model = "gpt-4o" if has_image else settings.openai_model
    
    # Get current usage for response
    usage = user.get("usage", {})
    limits = user.get("limits", {})
    
    async def generate():
        """Generator that yields SSE events and saves response."""
        client = AsyncOpenAI(api_key=settings.openai_api_key)
        full_response = ""
        
        try:
            stream = await client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.7,
                max_tokens=2000,
                stream=True,
            )
            
            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    token = chunk.choices[0].delta.content
                    full_response += token
                    yield f"data: {json.dumps({'token': token})}\n\n"
            
            # Save to Supabase only if conversation_id is a valid UUID
            if _is_valid_uuid and user_id:
                try:
                    supabase.table("messages").insert({
                        "conversation_id": conversation_id,
                        "user_id": user_id,
                        "role": "assistant",
                        "content": full_response,
                    }).execute()
                except Exception:
                    pass
            
            # 6. INCREMENT USAGE: Track message count for free users
            increment_usage(supabase, user_id, "message_count")
            
            # Calculate remaining messages
            current_count = usage.get("message_count", 0) + 1
            daily_limit = limits.get("daily_messages", 5)
            remaining = max(0, daily_limit - current_count) if not is_pro else float('inf')
            
            # Send done event with usage info
            yield f"data: {json.dumps({'done': True, 'usage': {'used': current_count, 'limit': daily_limit if not is_pro else 'unlimited', 'remaining': remaining if not is_pro else 'unlimited', 'is_pro': is_pro}})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.get("/chat/usage")
async def get_usage(user: dict = Depends(get_user_with_profile)):
    """Get current user's usage and tier info."""
    usage = user.get("usage", {})
    limits = user.get("limits", {})
    is_pro = user.get("is_pro", False)
    
    daily_limit = limits.get("daily_messages", 5)
    current_count = usage.get("message_count", 0)
    
    return {
        "is_pro": is_pro,
        "subscription_status": user.get("profile", {}).get("subscription_status", "free"),
        "usage": {
            "messages_used": current_count,
            "messages_limit": daily_limit if not is_pro else None,
            "messages_remaining": max(0, daily_limit - current_count) if not is_pro else None,
            "image_uploads_used": usage.get("image_uploads", 0),
        },
        "features": {
            "image_upload": limits.get("image_upload", False),
            "oura_integration": limits.get("oura", False),
            "voice_call": limits.get("voice_call", False),
            "unlimited_messages": is_pro,
        }
    }


@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest, user: dict = Depends(check_message_limit)) -> ChatResponse:
    """Non-streaming chat endpoint."""
    if not settings.openai_api_key:
        raise HTTPException(status_code=400, detail="OPENAI_API_KEY not set.")

    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.openai_api_key)
        has_image = bool(request.image_b64)
        
        # Retrieve RAG context for coaching questions or image analysis
        context = ""
        if _is_coaching_question(request.message) or has_image:
            retriever = get_vector_store().as_retriever(search_kwargs={"k": 5})
            # For images, also search for form-related content
            search_query = request.message
            if has_image:
                search_query += " form technique position alignment"
            docs = retriever.invoke(search_query)
            context = "\n\n---\n\n".join(doc.page_content for doc in docs)
        
        # Build wearable context (today's data)
        wearable_context = _build_wearable_context(request.whoop_data, request.oura_data)
        
        # Build historical progress context from database
        progress_context = ""
        if _is_coaching_question(request.message) or has_image:
            progress_context = _build_progress_context()
        
        # Choose model based on whether we have an image
        model = "gpt-4o" if has_image else settings.openai_model
        
        # Build the user message content
        if has_image:
            # Vision request with image
            system_prompt = VISION_PROMPT
            
            user_content = []
            
            # Add the image
            user_content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:{request.image_type or 'image/jpeg'};base64,{request.image_b64}",
                    "detail": "high"
                }
            })
            
            # Build text part
            text_parts = [f"User's question: {request.message}"]
            if context:
                text_parts.append(f"\nRelevant training material excerpts:\n{context}")
            if wearable_context:
                text_parts.append(f"\nUser's current recovery data:\n{wearable_context}")
            if progress_context:
                text_parts.append(f"\nUser's historical progress data:\n{progress_context}")
            
            user_content.append({"type": "text", "text": "\n".join(text_parts)})
            
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ]
        else:
            # Text-only request
            system_prompt = SYSTEM_PROMPT
            
            text_parts = [f"User message: {request.message}"]
            if context:
                text_parts.append(f"\nRelevant excerpts from your training materials:\n{context}")
            if wearable_context:
                text_parts.append(f"\nUser's current recovery data:\n{wearable_context}")
            if progress_context:
                text_parts.append(f"\nUser's historical progress data:\n{progress_context}")
            
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "\n".join(text_parts)}
            ]
        
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.7,
            max_tokens=2000,
        )
        
        return ChatResponse(answer=response.choices[0].message.content)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

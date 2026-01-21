"""
JWT verification for Supabase tokens.
"""
from fastapi import HTTPException, Depends, Header
from jose import jwt, JWTError
from typing import Optional
from datetime import date
from supabase import create_client, Client

from app.core.config import settings

# Support both legacy HS256 and new algorithms
ALGORITHMS = ["HS256", "HS384", "HS512"]

# ============================================
# SUBSCRIPTION TIER LIMITS
# ============================================
TIER_LIMITS = {
    "free": {
        "daily_messages": 5,
        "image_upload": False,
        "oura": False,
        "voice_call": False,
    },
    "active": {
        "daily_messages": float('inf'),
        "image_upload": True,
        "oura": True,
        "voice_call": True,
    },
    "past_due": {
        "daily_messages": float('inf'),
        "image_upload": True,
        "oura": True,
        "voice_call": True,
    },
}


# Supabase client for database queries
def get_supabase() -> Client:
    if not settings.supabase_url or not settings.supabase_service_key:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    return create_client(settings.supabase_url, settings.supabase_service_key)


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """
    Verify Supabase JWT from Authorization header.
    Returns the decoded JWT payload containing user info.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization format")
    
    token = authorization.replace("Bearer ", "")
    
    if not settings.supabase_jwt_secret:
        raise HTTPException(status_code=500, detail="JWT secret not configured")
    
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=ALGORITHMS,
            audience="authenticated",
            options={"verify_aud": True}
        )
        return payload
    except JWTError as e:
        # If verification fails, try without audience check (some Supabase configs)
        try:
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=ALGORITHMS,
                options={"verify_aud": False}
            )
            return payload
        except JWTError:
            raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


def get_daily_usage(supabase: Client, user_id: str) -> dict:
    """Get or create today's usage record for a user."""
    today = date.today().isoformat()
    
    # Try to get existing record
    result = supabase.table("daily_usage") \
        .select("*") \
        .eq("user_id", user_id) \
        .eq("date", today) \
        .execute()
    
    if result.data and len(result.data) > 0:
        return result.data[0]
    
    # Create new record for today
    new_record = {
        "user_id": user_id,
        "date": today,
        "message_count": 0,
        "image_uploads": 0,
    }
    supabase.table("daily_usage").insert(new_record).execute()
    return new_record


def increment_usage(supabase: Client, user_id: str, field: str = "message_count"):
    """Increment a usage counter for today."""
    today = date.today().isoformat()
    
    # Get current usage
    usage = get_daily_usage(supabase, user_id)
    current_count = usage.get(field, 0)
    
    # Update the count
    supabase.table("daily_usage") \
        .update({field: current_count + 1}) \
        .eq("user_id", user_id) \
        .eq("date", today) \
        .execute()


async def get_user_with_profile(
    authorization: Optional[str] = Header(None)
) -> dict:
    """
    Get authenticated user with profile and usage data.
    Allows both free and paid users.
    Returns user payload with profile, usage, and tier limits.
    """
    # First verify the JWT
    user = await get_current_user(authorization)
    user_id = user.get("sub")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user ID in token")
    
    # Get user profile from Supabase
    supabase = get_supabase()
    result = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="User profile not found")
    
    profile = result.data
    subscription_status = profile.get("subscription_status", "free")
    
    # Get tier limits
    limits = TIER_LIMITS.get(subscription_status, TIER_LIMITS["free"])
    
    # Get today's usage
    usage = get_daily_usage(supabase, user_id)
    
    return {
        **user, 
        "profile": profile,
        "usage": usage,
        "limits": limits,
        "is_pro": subscription_status in ["active", "past_due"],
    }


async def require_subscription(
    authorization: Optional[str] = Header(None)
) -> dict:
    """
    Verify user has active subscription (Pro only).
    Returns user payload with profile data.
    """
    # First verify the JWT
    user = await get_current_user(authorization)
    user_id = user.get("sub")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user ID in token")
    
    # Get user profile from Supabase
    supabase = get_supabase()
    result = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="User profile not found")
    
    profile = result.data
    
    # Check subscription status
    if profile.get("subscription_status") not in ["active", "past_due"]:
        raise HTTPException(
            status_code=403, 
            detail="Active subscription required. Please upgrade at /pricing"
        )
    
    return {**user, "profile": profile}


async def check_message_limit(
    authorization: Optional[str] = Header(None)
) -> dict:
    """
    Check if user can send a message based on their tier and usage.
    Free users: 5 messages/day
    Pro users: Unlimited
    """
    user_data = await get_user_with_profile(authorization)
    
    if user_data["is_pro"]:
        return user_data
    
    # Check free tier limits
    usage = user_data["usage"]
    limits = user_data["limits"]
    message_count = usage.get("message_count", 0)
    daily_limit = limits.get("daily_messages", 5)
    
    if message_count >= daily_limit:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "Daily message limit reached",
                "message": f"You've used all {daily_limit} free messages today. Upgrade to Pro for unlimited messaging!",
                "used": message_count,
                "limit": daily_limit,
                "upgrade_url": "/pricing"
            }
        )
    
    return user_data


async def check_image_upload(
    authorization: Optional[str] = Header(None)
) -> dict:
    """
    Check if user can upload images (Pro only feature).
    """
    user_data = await get_user_with_profile(authorization)
    
    if not user_data["limits"].get("image_upload", False):
        raise HTTPException(
            status_code=403,
            detail={
                "error": "Pro feature required",
                "message": "Image form analysis is a Pro feature. Upgrade to get personalized form feedback!",
                "upgrade_url": "/pricing"
            }
        )
    
    return user_data

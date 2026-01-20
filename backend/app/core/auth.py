"""
JWT verification for Supabase tokens.
"""
from fastapi import HTTPException, Depends, Header
from jose import jwt, JWTError
from typing import Optional
from supabase import create_client, Client

from backend.app.core.config import settings

ALGORITHM = "HS256"

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
            algorithms=[ALGORITHM],
            audience="authenticated"
        )
        return payload
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


async def require_subscription(
    authorization: Optional[str] = Header(None)
) -> dict:
    """
    Verify user has active subscription.
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

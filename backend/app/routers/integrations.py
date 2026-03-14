from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import List, Optional

import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..core.auth import get_user_with_profile, get_supabase
from ..db import database as db


router = APIRouter(prefix="/integrations", tags=["integrations"])


# --- Request/Response Models ---

class WhoopSyncRequest(BaseModel):
    access_token: str


class OuraSyncRequest(BaseModel):
    access_token: str


class WhoopData(BaseModel):
    recovery_score: Optional[int] = None
    hrv: Optional[int] = None
    rhr: Optional[int] = None
    sleep_performance: Optional[int] = None
    strain: Optional[float] = None
    calories: Optional[int] = None
    synced_at: str


class OuraData(BaseModel):
    readiness_score: Optional[int] = None
    sleep_score: Optional[int] = None
    activity_score: Optional[int] = None
    hrv_balance: Optional[int] = None
    body_temperature: Optional[float] = None
    synced_at: str


class SyncResponse(BaseModel):
    success: bool
    data: dict
    message: str


# --- Whoop Integration ---

@router.post("/whoop/sync", response_model=SyncResponse)
async def sync_whoop(request: WhoopSyncRequest, user: dict = Depends(get_user_with_profile)) -> SyncResponse:
    """
    Sync recovery data from Whoop API.
    
    To get your Whoop access token:
    1. Go to https://developer.whoop.com/
    2. Create an app and get OAuth credentials
    3. Complete OAuth flow to get access token
    
    API Docs: https://developer.whoop.com/api
    """
    try:
        headers = {"Authorization": f"Bearer {request.access_token}"}
        
        # Get today's recovery data
        recovery_url = "https://api.prod.whoop.com/developer/v1/recovery"
        recovery_resp = requests.get(
            recovery_url,
            headers=headers,
            params={"limit": 1},
            timeout=15,
        )
        
        if recovery_resp.status_code == 401:
            raise HTTPException(status_code=401, detail="Invalid or expired Whoop token")
        
        recovery_resp.raise_for_status()
        recovery_data = recovery_resp.json()
        
        # Parse the latest recovery record
        latest = {}
        if recovery_data.get("records"):
            record = recovery_data["records"][0]
            score = record.get("score", {})
            latest = {
                "recovery_score": score.get("recovery_score"),
                "hrv": round(score.get("hrv_rmssd_milli", 0)) if score.get("hrv_rmssd_milli") else None,
                "rhr": round(score.get("resting_heart_rate", 0)) if score.get("resting_heart_rate") else None,
                "sleep_performance": score.get("sleep_performance_percentage"),
            }
        
        # Get today's strain/cycle data
        cycle_url = "https://api.prod.whoop.com/developer/v1/cycle"
        cycle_resp = requests.get(
            cycle_url,
            headers=headers,
            params={"limit": 1},
            timeout=15,
        )
        
        if cycle_resp.ok:
            cycle_data = cycle_resp.json()
            if cycle_data.get("records"):
                cycle = cycle_data["records"][0]
                score = cycle.get("score", {})
                latest["strain"] = round(score.get("strain", 0), 1) if score.get("strain") else None
                latest["calories"] = score.get("kilojoule")
                if latest["calories"]:
                    latest["calories"] = round(latest["calories"] * 0.239)  # kJ to kcal
        
        latest["synced_at"] = datetime.utcnow().isoformat()
        
        return SyncResponse(
            success=True,
            data=latest,
            message="Whoop data synced successfully"
        )
        
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Failed to reach Whoop API: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Oura Integration ---

@router.post("/oura/sync", response_model=SyncResponse)
async def sync_oura(request: OuraSyncRequest, user: dict = Depends(get_user_with_profile)) -> SyncResponse:
    """
    Sync readiness and sleep data from Oura API.
    
    To get your Oura Personal Access Token:
    1. Go to https://cloud.ouraring.com/personal-access-tokens
    2. Create a new token with required scopes (daily, sleep)
    
    API Docs: https://cloud.ouraring.com/v2/docs
    """
    try:
        headers = {"Authorization": f"Bearer {request.access_token}"}
        today = datetime.utcnow().date()
        yesterday = today - timedelta(days=1)
        
        latest = {}
        
        # Get daily readiness
        readiness_url = "https://api.ouraring.com/v2/usercollection/daily_readiness"
        readiness_resp = requests.get(
            readiness_url,
            headers=headers,
            params={"start_date": str(yesterday), "end_date": str(today)},
            timeout=15,
        )
        
        if readiness_resp.status_code == 401:
            raise HTTPException(status_code=401, detail="Invalid or expired Oura token")
        
        readiness_resp.raise_for_status()
        readiness_data = readiness_resp.json()
        
        if readiness_data.get("data"):
            record = readiness_data["data"][-1]  # Most recent
            latest["readiness_score"] = record.get("score")
            contributors = record.get("contributors", {})
            latest["hrv_balance"] = contributors.get("hrv_balance")
            latest["body_temperature"] = contributors.get("body_temperature")
        
        # Get daily sleep
        sleep_url = "https://api.ouraring.com/v2/usercollection/daily_sleep"
        sleep_resp = requests.get(
            sleep_url,
            headers=headers,
            params={"start_date": str(yesterday), "end_date": str(today)},
            timeout=15,
        )
        
        if sleep_resp.ok:
            sleep_data = sleep_resp.json()
            if sleep_data.get("data"):
                record = sleep_data["data"][-1]
                latest["sleep_score"] = record.get("score")
                # Get sleep contributors for more detail
                contributors = record.get("contributors", {})
                latest["sleep_efficiency"] = contributors.get("efficiency")
                latest["sleep_latency"] = contributors.get("latency")
                latest["sleep_timing"] = contributors.get("timing")
        
        # Get daily activity
        activity_url = "https://api.ouraring.com/v2/usercollection/daily_activity"
        activity_resp = requests.get(
            activity_url,
            headers=headers,
            params={"start_date": str(yesterday), "end_date": str(today)},
            timeout=15,
        )
        
        if activity_resp.ok:
            activity_data = activity_resp.json()
            if activity_data.get("data"):
                record = activity_data["data"][-1]
                latest["activity_score"] = record.get("score")
                latest["active_calories"] = record.get("active_calories")
                latest["steps"] = record.get("steps")
                latest["training_frequency"] = record.get("contributors", {}).get("training_frequency")
                latest["training_volume"] = record.get("contributors", {}).get("training_volume")
        
        latest["synced_at"] = datetime.utcnow().isoformat()
        
        user_id = user.get("sub", "default")
        
        # Store in SQLite for historical tracking
        try:
            db.upsert_oura_daily(
                date_val=yesterday,
                readiness_score=latest.get("readiness_score"),
                sleep_score=latest.get("sleep_score"),
                activity_score=latest.get("activity_score"),
                hrv_balance=latest.get("hrv_balance"),
                steps=latest.get("steps"),
                active_calories=latest.get("active_calories"),
                sleep_efficiency=latest.get("sleep_efficiency"),
                sleep_latency=latest.get("sleep_latency"),
                body_temperature=latest.get("body_temperature"),
                user_id=user_id,
            )
        except Exception as db_err:
            print(f"Warning: Failed to store Oura data in SQLite: {db_err}")

        # Also write to Supabase so chat_stream can read Oura context
        try:
            supabase = get_supabase()
            supabase.table("oura_daily").upsert({
                "user_id": user_id,
                "date": str(yesterday),
                "readiness_score": latest.get("readiness_score"),
                "sleep_score": latest.get("sleep_score"),
                "activity_score": latest.get("activity_score"),
                "hrv_balance": latest.get("hrv_balance"),
                "steps": latest.get("steps"),
                "active_calories": latest.get("active_calories"),
                "resting_heart_rate": latest.get("resting_heart_rate"),
                "body_temperature": latest.get("body_temperature"),
                "sleep_efficiency": latest.get("sleep_efficiency"),
                "sleep_latency": latest.get("sleep_latency"),
            }, on_conflict="user_id,date").execute()
        except Exception as supa_err:
            print(f"Warning: Failed to store Oura data in Supabase: {supa_err}")
        
        return SyncResponse(
            success=True,
            data=latest,
            message="Oura data synced successfully"
        )
        
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Failed to reach Oura API: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Historical data for rolling averages ---

@router.post("/oura/history", response_model=SyncResponse)
async def get_oura_history(request: OuraSyncRequest, user: dict = Depends(get_user_with_profile)) -> SyncResponse:
    """
    Fetch 7 days of Oura data for rolling average calculations.
    """
    try:
        headers = {"Authorization": f"Bearer {request.access_token}"}
        today = datetime.utcnow().date()
        start_date = today - timedelta(days=7)
        
        history = {
            "readiness": [],
            "sleep": [],
            "activity": [],
            "hrv": [],
        }
        
        # Get daily readiness history
        readiness_url = "https://api.ouraring.com/v2/usercollection/daily_readiness"
        readiness_resp = requests.get(
            readiness_url,
            headers=headers,
            params={"start_date": str(start_date), "end_date": str(today)},
            timeout=15,
        )
        
        if readiness_resp.status_code == 401:
            raise HTTPException(status_code=401, detail="Invalid or expired Oura token")
        
        if readiness_resp.ok:
            for record in readiness_resp.json().get("data", []):
                if record.get("score"):
                    history["readiness"].append({
                        "date": record.get("day"),
                        "score": record.get("score"),
                    })
                contributors = record.get("contributors", {})
                if contributors.get("hrv_balance"):
                    history["hrv"].append({
                        "date": record.get("day"),
                        "value": contributors.get("hrv_balance"),
                    })
        
        # Get daily sleep history
        sleep_url = "https://api.ouraring.com/v2/usercollection/daily_sleep"
        sleep_resp = requests.get(
            sleep_url,
            headers=headers,
            params={"start_date": str(start_date), "end_date": str(today)},
            timeout=15,
        )
        
        if sleep_resp.ok:
            for record in sleep_resp.json().get("data", []):
                if record.get("score"):
                    history["sleep"].append({
                        "date": record.get("day"),
                        "score": record.get("score"),
                    })
        
        # Get daily activity history
        activity_url = "https://api.ouraring.com/v2/usercollection/daily_activity"
        activity_resp = requests.get(
            activity_url,
            headers=headers,
            params={"start_date": str(start_date), "end_date": str(today)},
            timeout=15,
        )
        
        if activity_resp.ok:
            for record in activity_resp.json().get("data", []):
                if record.get("score"):
                    history["activity"].append({
                        "date": record.get("day"),
                        "score": record.get("score"),
                        "steps": record.get("steps"),
                        "active_calories": record.get("active_calories"),
                    })
        
        # Calculate rolling averages
        def calc_avg(items, key="score"):
            values = [item.get(key) for item in items if item.get(key) is not None]
            return round(sum(values) / len(values), 1) if values else None
        
        averages = {
            "readiness_avg_7d": calc_avg(history["readiness"]),
            "sleep_avg_7d": calc_avg(history["sleep"]),
            "activity_avg_7d": calc_avg(history["activity"]),
            "steps_avg_7d": calc_avg(history["activity"], "steps"),
            "hrv_trend": "stable",  # Will calculate below
            "days_of_data": len(history["readiness"]),
        }
        
        # Determine HRV trend (comparing first half vs second half of week)
        if len(history["hrv"]) >= 4:
            first_half = [h["value"] for h in history["hrv"][:len(history["hrv"])//2] if h.get("value")]
            second_half = [h["value"] for h in history["hrv"][len(history["hrv"])//2:] if h.get("value")]
            if first_half and second_half:
                first_avg = sum(first_half) / len(first_half)
                second_avg = sum(second_half) / len(second_half)
                diff = second_avg - first_avg
                if diff > 5:
                    averages["hrv_trend"] = "improving"
                elif diff < -5:
                    averages["hrv_trend"] = "declining"
                else:
                    averages["hrv_trend"] = "stable"
        
        # Store all historical data in database
        user_id = user.get("sub", "default")
        for record in history["readiness"]:
            try:
                hrv_val = None
                for h in history["hrv"]:
                    if h["date"] == record["date"]:
                        hrv_val = h["value"]
                        break
                
                # Find matching sleep and activity
                sleep_score = None
                for s in history["sleep"]:
                    if s["date"] == record["date"]:
                        sleep_score = s["score"]
                        break
                
                activity_data = None
                for a in history["activity"]:
                    if a["date"] == record["date"]:
                        activity_data = a
                        break
                
                db.upsert_oura_daily(
                    date_val=datetime.strptime(record["date"], "%Y-%m-%d").date(),
                    readiness_score=record.get("score"),
                    sleep_score=sleep_score,
                    activity_score=activity_data.get("score") if activity_data else None,
                    hrv_balance=hrv_val,
                    steps=activity_data.get("steps") if activity_data else None,
                    active_calories=activity_data.get("active_calories") if activity_data else None,
                )
            except Exception as db_err:
                print(f"Warning: Failed to store historical data: {db_err}")
        
        return SyncResponse(
            success=True,
            data={
                "history": history,
                "averages": averages,
                "fetched_at": datetime.utcnow().isoformat(),
            },
            message=f"Fetched {averages['days_of_data']} days of Oura data"
        )
        
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Failed to reach Oura API: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Training Log Endpoints ---

class TrainingLogRequest(BaseModel):
    exercise: str
    metric_type: str  # "hold_time", "reps", "weight", "max_hold"
    metric_value: float
    date: Optional[str] = None  # ISO format, defaults to today
    sets: Optional[int] = None
    notes: Optional[str] = None


class TrainingLogResponse(BaseModel):
    success: bool
    log_id: str
    message: str


class TrainingStatsResponse(BaseModel):
    exercise: str
    metric_type: str
    weekly_avg: dict
    biweekly_avg: dict
    trend: dict


@router.post("/training/log", response_model=TrainingLogResponse)
async def add_training_log(request: TrainingLogRequest, user: dict = Depends(get_user_with_profile)) -> TrainingLogResponse:
    """
    Log a training session.
    
    Examples:
    - Planche hold: exercise="planche", metric_type="hold_time", metric_value=25 (seconds)
    - Bench press: exercise="bench_press", metric_type="weight", metric_value=140 (kg)
    - Pull-ups: exercise="pullup", metric_type="reps", metric_value=12
    """
    user_id = user.get("sub", "default")
    date_val = request.date or str(date.today())
    if request.date:
        date_val = request.date

    supabase = get_supabase()
    try:
        result = supabase.table("training_logs").insert({
            "user_id": user_id,
            "date": date_val,
            "exercise": request.exercise,
            "metric_type": request.metric_type,
            "metric_value": request.metric_value,
            "sets": request.sets,
            "notes": request.notes,
        }).execute()
        log_id = result.data[0]["id"] if result.data else "unknown"
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save training log: {e}")

    try:
        parsed_date = datetime.strptime(date_val, "%Y-%m-%d").date() if isinstance(date_val, str) else date_val
        db.add_training_log(
            exercise=request.exercise,
            metric_type=request.metric_type,
            metric_value=request.metric_value,
            date_val=parsed_date,
            sets=request.sets,
            notes=request.notes,
            user_id=user_id,
        )
    except Exception:
        pass

    return TrainingLogResponse(
        success=True,
        log_id=log_id,
        message=f"Logged {request.exercise}: {request.metric_value} {request.metric_type}"
    )


@router.get("/training/stats/{exercise}/{metric_type}", response_model=TrainingStatsResponse)
async def get_training_stats(exercise: str, metric_type: str, user: dict = Depends(get_user_with_profile)) -> TrainingStatsResponse:
    """
    Get rolling averages and trend for a specific exercise metric.
    """
    try:
        user_id = user.get("sub", "default")
        return TrainingStatsResponse(
            exercise=exercise,
            metric_type=metric_type,
            weekly_avg=db.get_training_rolling_average(exercise, metric_type, 7, user_id),
            biweekly_avg=db.get_training_rolling_average(exercise, metric_type, 14, user_id),
            trend=db.get_training_trend(exercise, metric_type, user_id),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/training/exercises")
async def list_exercises(user: dict = Depends(get_user_with_profile)):
    """Get list of all exercises the user has logged."""
    user_id = user.get("sub", "default")
    return {"exercises": db.get_all_training_exercises(user_id)}


@router.get("/progress/summary")
async def get_progress_summary(user: dict = Depends(get_user_with_profile)):
    """
    Get comprehensive progress summary for AI coaching.
    Includes Oura trends, training trends, and analysis flags.
    """
    try:
        user_id = user.get("sub", "default")
        summary = db.get_user_progress_summary(user_id)
        return {"success": True, "summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/oura/averages")
async def get_oura_averages(user: dict = Depends(get_user_with_profile)):
    """
    Get Oura rolling averages from stored historical data.
    """
    try:
        user_id = user.get("sub", "default")
        return {
            "success": True,
            "weekly": db.get_oura_rolling_averages(7, user_id),
            "biweekly": db.get_oura_rolling_averages(14, user_id),
            "trends": {
                "readiness": db.get_oura_trend("readiness_score", user_id),
                "sleep": db.get_oura_trend("sleep_score", user_id),
                "hrv": db.get_oura_trend("hrv_balance", user_id),
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Info endpoints ---

@router.get("/whoop/info")
def whoop_info():
    """Instructions for setting up Whoop integration."""
    return {
        "name": "Whoop",
        "setup_steps": [
            "1. Go to https://developer.whoop.com/",
            "2. Create a developer account and register an app",
            "3. Set redirect URI to your app's callback URL",
            "4. Complete OAuth flow to get access token",
            "5. Paste the access token in the sidebar"
        ],
        "scopes_needed": ["read:recovery", "read:cycles", "read:sleep"],
        "docs_url": "https://developer.whoop.com/api"
    }


@router.get("/oura/info")
def oura_info():
    """Instructions for setting up Oura integration."""
    return {
        "name": "Oura Ring",
        "setup_steps": [
            "1. Go to https://cloud.ouraring.com/personal-access-tokens",
            "2. Click 'Create New Personal Access Token'",
            "3. Select scopes: daily, sleep, activity",
            "4. Copy the generated token",
            "5. Paste it in the sidebar"
        ],
        "scopes_needed": ["daily", "sleep", "activity"],
        "docs_url": "https://cloud.ouraring.com/v2/docs"
    }

"""
SQLite database for tracking user metrics over time.
Stores Oura daily data and training logs for rolling average calculations.
"""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Optional

# Database file location
DB_PATH = Path(__file__).parent.parent.parent.parent / "data" / "user_metrics.db"


def get_db_path() -> Path:
    """Get database path, ensuring directory exists."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    return DB_PATH


@contextmanager
def get_connection():
    """Context manager for database connections."""
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_database():
    """Initialize database tables."""
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # Oura daily metrics table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS oura_daily (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT DEFAULT 'default',
                date DATE NOT NULL,
                readiness_score INTEGER,
                sleep_score INTEGER,
                activity_score INTEGER,
                hrv_balance INTEGER,
                steps INTEGER,
                active_calories INTEGER,
                sleep_efficiency INTEGER,
                sleep_latency INTEGER,
                rhr INTEGER,
                body_temperature REAL,
                synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, date)
            )
        """)
        
        # Training logs table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS training_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT DEFAULT 'default',
                date DATE NOT NULL,
                exercise TEXT NOT NULL,
                metric_type TEXT NOT NULL,
                metric_value REAL NOT NULL,
                sets INTEGER,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create indexes for faster queries
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_oura_date ON oura_daily(user_id, date)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_training_date ON training_logs(user_id, date)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_training_exercise ON training_logs(user_id, exercise, date)
        """)


# --- Oura Data Operations ---

def upsert_oura_daily(
    date_val: date,
    readiness_score: Optional[int] = None,
    sleep_score: Optional[int] = None,
    activity_score: Optional[int] = None,
    hrv_balance: Optional[int] = None,
    steps: Optional[int] = None,
    active_calories: Optional[int] = None,
    sleep_efficiency: Optional[int] = None,
    sleep_latency: Optional[int] = None,
    rhr: Optional[int] = None,
    body_temperature: Optional[float] = None,
    user_id: str = "default",
) -> None:
    """Insert or update Oura daily data."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO oura_daily (
                user_id, date, readiness_score, sleep_score, activity_score,
                hrv_balance, steps, active_calories, sleep_efficiency,
                sleep_latency, rhr, body_temperature, synced_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, date) DO UPDATE SET
                readiness_score = COALESCE(excluded.readiness_score, readiness_score),
                sleep_score = COALESCE(excluded.sleep_score, sleep_score),
                activity_score = COALESCE(excluded.activity_score, activity_score),
                hrv_balance = COALESCE(excluded.hrv_balance, hrv_balance),
                steps = COALESCE(excluded.steps, steps),
                active_calories = COALESCE(excluded.active_calories, active_calories),
                sleep_efficiency = COALESCE(excluded.sleep_efficiency, sleep_efficiency),
                sleep_latency = COALESCE(excluded.sleep_latency, sleep_latency),
                rhr = COALESCE(excluded.rhr, rhr),
                body_temperature = COALESCE(excluded.body_temperature, body_temperature),
                synced_at = excluded.synced_at
        """, (
            user_id, date_val, readiness_score, sleep_score, activity_score,
            hrv_balance, steps, active_calories, sleep_efficiency,
            sleep_latency, rhr, body_temperature, datetime.utcnow()
        ))


def get_oura_rolling_averages(
    days: int = 7,
    user_id: str = "default",
    end_date: Optional[date] = None,
) -> dict:
    """
    Calculate rolling averages for Oura metrics.
    
    Args:
        days: Number of days to average (7 for weekly, 14 for bi-weekly)
        user_id: User identifier
        end_date: End date for the window (defaults to today)
    
    Returns:
        Dictionary with averages for each metric
    """
    if end_date is None:
        end_date = date.today()
    start_date = end_date - timedelta(days=days)
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                COUNT(*) as days_with_data,
                ROUND(AVG(readiness_score), 1) as readiness_avg,
                ROUND(AVG(sleep_score), 1) as sleep_avg,
                ROUND(AVG(activity_score), 1) as activity_avg,
                ROUND(AVG(hrv_balance), 1) as hrv_avg,
                ROUND(AVG(steps), 0) as steps_avg,
                ROUND(AVG(active_calories), 0) as calories_avg,
                ROUND(AVG(sleep_efficiency), 1) as efficiency_avg,
                ROUND(AVG(rhr), 1) as rhr_avg,
                MIN(readiness_score) as readiness_min,
                MAX(readiness_score) as readiness_max,
                MIN(sleep_score) as sleep_min,
                MAX(sleep_score) as sleep_max
            FROM oura_daily
            WHERE user_id = ? AND date > ? AND date <= ?
        """, (user_id, start_date, end_date))
        
        row = cursor.fetchone()
        if row:
            return dict(row)
        return {}


def get_oura_trend(
    metric: str = "readiness_score",
    user_id: str = "default",
) -> dict:
    """
    Calculate trend for a specific Oura metric.
    Compares last 7 days vs previous 7 days.
    
    Returns:
        trend: 'improving', 'declining', 'stable'
        change_percent: percentage change
    """
    today = date.today()
    
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # Last 7 days
        cursor.execute(f"""
            SELECT AVG({metric}) as avg_value
            FROM oura_daily
            WHERE user_id = ? AND date > ? AND date <= ?
            AND {metric} IS NOT NULL
        """, (user_id, today - timedelta(days=7), today))
        recent = cursor.fetchone()
        recent_avg = recent["avg_value"] if recent else None
        
        # Previous 7 days (days 8-14)
        cursor.execute(f"""
            SELECT AVG({metric}) as avg_value
            FROM oura_daily
            WHERE user_id = ? AND date > ? AND date <= ?
            AND {metric} IS NOT NULL
        """, (user_id, today - timedelta(days=14), today - timedelta(days=7)))
        previous = cursor.fetchone()
        previous_avg = previous["avg_value"] if previous else None
        
        if recent_avg is None or previous_avg is None or previous_avg == 0:
            return {"trend": "insufficient_data", "change_percent": None}
        
        change = ((recent_avg - previous_avg) / previous_avg) * 100
        
        if change > 5:
            trend = "improving"
        elif change < -5:
            trend = "declining"
        else:
            trend = "stable"
        
        return {
            "trend": trend,
            "change_percent": round(change, 1),
            "recent_avg": round(recent_avg, 1),
            "previous_avg": round(previous_avg, 1),
        }


# --- Training Log Operations ---

def add_training_log(
    exercise: str,
    metric_type: str,
    metric_value: float,
    date_val: Optional[date] = None,
    sets: Optional[int] = None,
    notes: Optional[str] = None,
    user_id: str = "default",
) -> int:
    """
    Add a training log entry.
    
    Args:
        exercise: Exercise name (e.g., "planche", "bench_press", "pullup")
        metric_type: Type of metric ("hold_time", "reps", "weight", "max_hold")
        metric_value: The value (seconds for holds, count for reps, kg for weight)
        date_val: Date of the workout (defaults to today)
        sets: Number of sets if applicable
        notes: Any additional notes
    
    Returns:
        ID of the inserted log
    """
    if date_val is None:
        date_val = date.today()
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO training_logs (user_id, date, exercise, metric_type, metric_value, sets, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (user_id, date_val, exercise.lower(), metric_type.lower(), metric_value, sets, notes))
        return cursor.lastrowid


def get_training_rolling_average(
    exercise: str,
    metric_type: str,
    days: int = 7,
    user_id: str = "default",
    end_date: Optional[date] = None,
) -> dict:
    """
    Calculate rolling average for a specific exercise metric.
    """
    if end_date is None:
        end_date = date.today()
    start_date = end_date - timedelta(days=days)
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                COUNT(*) as entries,
                ROUND(AVG(metric_value), 2) as avg_value,
                ROUND(MAX(metric_value), 2) as max_value,
                ROUND(MIN(metric_value), 2) as min_value
            FROM training_logs
            WHERE user_id = ? 
                AND exercise = ? 
                AND metric_type = ?
                AND date > ? AND date <= ?
        """, (user_id, exercise.lower(), metric_type.lower(), start_date, end_date))
        
        row = cursor.fetchone()
        return dict(row) if row else {}


def get_training_trend(
    exercise: str,
    metric_type: str,
    user_id: str = "default",
) -> dict:
    """
    Calculate trend for a specific exercise metric.
    Compares last 7 days vs previous 7 days.
    """
    today = date.today()
    
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # Last 7 days
        cursor.execute("""
            SELECT AVG(metric_value) as avg_value, MAX(metric_value) as max_value
            FROM training_logs
            WHERE user_id = ? AND exercise = ? AND metric_type = ?
            AND date > ? AND date <= ?
        """, (user_id, exercise.lower(), metric_type.lower(), 
              today - timedelta(days=7), today))
        recent = cursor.fetchone()
        recent_avg = recent["avg_value"] if recent else None
        recent_max = recent["max_value"] if recent else None
        
        # Previous 7 days
        cursor.execute("""
            SELECT AVG(metric_value) as avg_value, MAX(metric_value) as max_value
            FROM training_logs
            WHERE user_id = ? AND exercise = ? AND metric_type = ?
            AND date > ? AND date <= ?
        """, (user_id, exercise.lower(), metric_type.lower(),
              today - timedelta(days=14), today - timedelta(days=7)))
        previous = cursor.fetchone()
        previous_avg = previous["avg_value"] if previous else None
        previous_max = previous["max_value"] if previous else None
        
        if recent_avg is None or previous_avg is None or previous_avg == 0:
            return {"trend": "insufficient_data", "change_percent": None}
        
        change = ((recent_avg - previous_avg) / previous_avg) * 100
        
        # Determine if stalling, progressing, or regressing
        if change > 3:
            trend = "progressing"
        elif change < -3:
            trend = "regressing"
        else:
            trend = "stalling"
        
        return {
            "trend": trend,
            "change_percent": round(change, 1),
            "recent_avg": round(recent_avg, 2),
            "previous_avg": round(previous_avg, 2),
            "recent_max": recent_max,
            "previous_max": previous_max,
        }


def get_all_training_exercises(user_id: str = "default") -> list:
    """Get list of all exercises the user has logged."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT DISTINCT exercise FROM training_logs
            WHERE user_id = ?
            ORDER BY exercise
        """, (user_id,))
        return [row["exercise"] for row in cursor.fetchall()]


def get_user_progress_summary(user_id: str = "default") -> dict:
    """
    Generate a comprehensive progress summary for the AI to use.
    Includes Oura trends and training trends.
    """
    summary = {
        "oura": {
            "weekly_avg": get_oura_rolling_averages(7, user_id),
            "biweekly_avg": get_oura_rolling_averages(14, user_id),
            "readiness_trend": get_oura_trend("readiness_score", user_id),
            "sleep_trend": get_oura_trend("sleep_score", user_id),
            "hrv_trend": get_oura_trend("hrv_balance", user_id),
        },
        "training": {},
        "analysis": {},
    }
    
    # Get training trends for each exercise
    exercises = get_all_training_exercises(user_id)
    for exercise in exercises:
        # Check for common metric types
        for metric_type in ["hold_time", "reps", "weight", "max_hold"]:
            trend = get_training_trend(exercise, metric_type, user_id)
            if trend.get("trend") != "insufficient_data":
                key = f"{exercise}_{metric_type}"
                summary["training"][key] = {
                    "exercise": exercise,
                    "metric": metric_type,
                    **trend,
                }
    
    # Generate analysis flags
    analysis = []
    
    # Check for stalls
    stalling = [k for k, v in summary["training"].items() if v.get("trend") == "stalling"]
    if stalling:
        analysis.append(f"STALLING on: {', '.join(stalling)}")
    
    # Check for regression
    regressing = [k for k, v in summary["training"].items() if v.get("trend") == "regressing"]
    if regressing:
        analysis.append(f"REGRESSING on: {', '.join(regressing)}")
    
    # Check recovery trends
    if summary["oura"]["readiness_trend"].get("trend") == "declining":
        analysis.append("RECOVERY DECLINING - consider deload")
    
    if summary["oura"]["sleep_trend"].get("trend") == "declining":
        analysis.append("SLEEP DECLINING - address sleep hygiene")
    
    summary["analysis"]["flags"] = analysis
    
    return summary


# Initialize database on module import
init_database()

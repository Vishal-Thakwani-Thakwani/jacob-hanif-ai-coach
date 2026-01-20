import base64
import json
import os

import requests
import streamlit as st


BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

st.set_page_config(page_title="Jacob Hanif AI Coach", page_icon="💪", layout="wide")

# --- Sidebar for integrations ---
with st.sidebar:
    st.header("Integrations")
    
    # Whoop integration
    st.subheader("Whoop")
    whoop_token = st.text_input("Whoop Access Token", type="password", key="whoop_token")
    if whoop_token:
        if st.button("Sync Whoop Data"):
            with st.spinner("Fetching recovery data..."):
                try:
                    resp = requests.post(
                        f"{BACKEND_URL}/integrations/whoop/sync",
                        json={"access_token": whoop_token},
                        timeout=30,
                    )
                    if resp.ok:
                        st.success("Whoop data synced!")
                        st.session_state["whoop_data"] = resp.json().get("data")
                    else:
                        st.error(f"Failed: {resp.text}")
                except Exception as e:
                    st.error(f"Error: {e}")
    
    # Oura integration
    st.subheader("Oura Ring")
    oura_token = st.text_input("Oura Personal Access Token", type="password", key="oura_token")
    if oura_token:
        if st.button("🔄 Sync Oura Data", key="sync_oura"):
            with st.spinner("Fetching today + 7-day history..."):
                try:
                    # Fetch today's data
                    resp_today = requests.post(
                        f"{BACKEND_URL}/integrations/oura/sync",
                        json={"access_token": oura_token},
                        timeout=30,
                    )
                    if resp_today.ok:
                        st.session_state["oura_data"] = resp_today.json().get("data")
                    
                    # Fetch 7-day history (stores in DB for rolling averages)
                    resp_history = requests.post(
                        f"{BACKEND_URL}/integrations/oura/history",
                        json={"access_token": oura_token},
                        timeout=30,
                    )
                    if resp_history.ok:
                        st.session_state["oura_history"] = resp_history.json().get("data")
                    
                    if resp_today.ok and resp_history.ok:
                        st.success("✅ Synced today + 7-day history!")
                    elif resp_today.ok:
                        st.warning("Today synced, but history failed")
                    else:
                        st.error(f"Sync failed: {resp_today.text}")
                except Exception as e:
                    st.error(f"Error: {e}")
    
    # Display synced data summary
    if st.session_state.get("whoop_data"):
        st.divider()
        data = st.session_state["whoop_data"]
        st.metric("Recovery Score", f"{data.get('recovery_score', 'N/A')}%")
        st.metric("HRV", f"{data.get('hrv', 'N/A')} ms")
    
    if st.session_state.get("oura_data"):
        st.divider()
        st.caption("📊 Today's Oura Data")
        data = st.session_state["oura_data"]
        
        # Main scores
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("Readiness", data.get('readiness_score', '-'))
        with col2:
            st.metric("Sleep", data.get('sleep_score', '-'))
        with col3:
            st.metric("Activity", data.get('activity_score', '-'))
        
        # Additional details in expander
        with st.expander("Details"):
            if data.get('hrv_balance'):
                st.write(f"HRV Balance: {data['hrv_balance']}")
            if data.get('steps'):
                st.write(f"Steps: {data['steps']:,}")
            if data.get('active_calories'):
                st.write(f"Active Cal: {data['active_calories']}")
            if data.get('sleep_efficiency'):
                st.write(f"Sleep Efficiency: {data['sleep_efficiency']}%")
    
    # Display rolling averages if available
    if st.session_state.get("oura_history"):
        st.divider()
        st.caption("📈 7-Day Rolling Averages")
        history = st.session_state["oura_history"]
        avgs = history.get("averages", {})
        
        # Show averages with delta comparison to today
        today_data = st.session_state.get("oura_data", {})
        
        col1, col2 = st.columns(2)
        with col1:
            today_readiness = today_data.get('readiness_score')
            avg_readiness = avgs.get('readiness_avg_7d')
            delta = None
            if today_readiness and avg_readiness:
                delta = round(today_readiness - avg_readiness, 1)
            st.metric("Readiness Avg", avg_readiness or '-', delta=delta)
            
            today_sleep = today_data.get('sleep_score')
            avg_sleep = avgs.get('sleep_avg_7d')
            delta = None
            if today_sleep and avg_sleep:
                delta = round(today_sleep - avg_sleep, 1)
            st.metric("Sleep Avg", avg_sleep or '-', delta=delta)
        
        with col2:
            today_activity = today_data.get('activity_score')
            avg_activity = avgs.get('activity_avg_7d')
            delta = None
            if today_activity and avg_activity:
                delta = round(today_activity - avg_activity, 1)
            st.metric("Activity Avg", avg_activity or '-', delta=delta)
            
            steps_avg = avgs.get('steps_avg_7d')
            if steps_avg:
                st.metric("Steps Avg", f"{int(steps_avg):,}")
        
        # HRV Trend indicator
        hrv_trend = avgs.get('hrv_trend', 'stable')
        trend_emoji = {"improving": "📈", "declining": "📉", "stable": "➡️"}.get(hrv_trend, "➡️")
        st.write(f"HRV Trend: {trend_emoji} {hrv_trend.capitalize()}")
        st.caption(f"Based on {avgs.get('days_of_data', 0)} days of data")
    
    # --- Training Log Section ---
    st.divider()
    st.header("🏋️ Training Log")
    
    with st.expander("Log a Workout", expanded=False):
        # Common calisthenics exercises
        exercise_options = [
            "planche", "planche_lean", "planche_pushup",
            "front_lever", "back_lever", "maltese",
            "pullup", "one_arm_pullup", "muscle_up",
            "handstand", "handstand_pushup",
            "dip", "weighted_dip",
            "bench_press", "squat", "deadlift",
            "other"
        ]
        
        exercise = st.selectbox("Exercise", exercise_options, key="log_exercise")
        if exercise == "other":
            exercise = st.text_input("Custom exercise name", key="custom_exercise")
        
        metric_type = st.selectbox(
            "Metric Type",
            ["hold_time", "reps", "weight", "max_hold", "sets_x_reps"],
            key="log_metric_type",
            help="hold_time/max_hold in seconds, weight in kg"
        )
        
        metric_value = st.number_input(
            f"Value ({metric_type})",
            min_value=0.0,
            step=0.5 if "time" in metric_type or "hold" in metric_type else 1.0,
            key="log_value"
        )
        
        sets = st.number_input("Sets (optional)", min_value=0, max_value=20, value=0, key="log_sets")
        notes = st.text_input("Notes (optional)", key="log_notes")
        
        if st.button("📝 Log Workout", key="submit_log"):
            if exercise and metric_value > 0:
                try:
                    resp = requests.post(
                        f"{BACKEND_URL}/integrations/training/log",
                        json={
                            "exercise": exercise,
                            "metric_type": metric_type,
                            "metric_value": metric_value,
                            "sets": sets if sets > 0 else None,
                            "notes": notes if notes else None,
                        },
                        timeout=10,
                    )
                    if resp.ok:
                        st.success(f"✅ Logged: {exercise} - {metric_value}")
                    else:
                        st.error(f"Failed: {resp.text}")
                except Exception as e:
                    st.error(f"Error: {e}")
            else:
                st.warning("Please enter exercise and value")
    
    # Show progress summary
    with st.expander("📊 View Progress", expanded=False):
        if st.button("Load Progress Summary"):
            try:
                resp = requests.get(f"{BACKEND_URL}/integrations/progress/summary", timeout=15)
                if resp.ok:
                    summary = resp.json().get("summary", {})
                    
                    # Training progress
                    training = summary.get("training", {})
                    if training:
                        st.subheader("Training Trends")
                        for key, data in training.items():
                            trend = data.get("trend", "unknown")
                            emoji = {"progressing": "📈", "stalling": "➡️", "regressing": "📉"}.get(trend, "❓")
                            change = data.get("change_percent", 0)
                            exercise = data.get("exercise", "").replace("_", " ").title()
                            metric = data.get("metric", "")
                            st.write(f"{emoji} **{exercise}** ({metric}): {trend.upper()} ({change:+.1f}%)")
                    else:
                        st.info("No training data yet. Start logging workouts!")
                    
                    # Analysis flags
                    flags = summary.get("analysis", {}).get("flags", [])
                    if flags:
                        st.subheader("⚠️ Coaching Alerts")
                        for flag in flags:
                            st.warning(flag)
                else:
                    st.error(f"Failed to load progress: {resp.text}")
            except Exception as e:
                st.error(f"Error: {e}")

# --- Main chat area ---
st.title("Jacob Hanif AI Coach")
st.caption("Ask questions or upload a photo for form analysis.")

if "messages" not in st.session_state:
    st.session_state.messages = []

# Display chat history
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        if message.get("image"):
            st.image(message["image"], width=300)
        st.markdown(message["content"])

# Image upload section
uploaded_file = st.file_uploader(
    "Upload a photo for form check (optional)", 
    type=["jpg", "jpeg", "png", "webp"],
    key="form_photo"
)

if uploaded_file:
    st.image(uploaded_file, caption="Uploaded for analysis", width=300)

# Chat input
prompt = st.chat_input("Ask about planche, OAP, programming, recovery...")
if prompt:
    # Prepare image if uploaded
    image_b64 = None
    image_display = None
    if uploaded_file:
        image_bytes = uploaded_file.getvalue()
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")
        image_display = image_bytes
    
    # Add user message to history
    user_msg = {"role": "user", "content": prompt}
    if image_display:
        user_msg["image"] = image_display
    st.session_state.messages.append(user_msg)
    
    with st.chat_message("user"):
        if image_display:
            st.image(image_display, width=300)
        st.markdown(prompt)

    # Build request payload
    payload = {"message": prompt}
    if image_b64:
        payload["image_b64"] = image_b64
        payload["image_type"] = uploaded_file.type
    
    # Include wearable data if available
    if st.session_state.get("whoop_data"):
        payload["whoop_data"] = st.session_state["whoop_data"]
    if st.session_state.get("oura_data"):
        payload["oura_data"] = st.session_state["oura_data"]

    with st.chat_message("assistant"):
        with st.spinner("Analyzing..." if image_b64 else "Thinking..."):
            try:
                response = requests.post(
                    f"{BACKEND_URL}/chat",
                    headers={"Content-Type": "application/json"},
                    data=json.dumps(payload),
                    timeout=120,
                )
                response.raise_for_status()
                answer = response.json().get("answer", "")
            except Exception as exc:
                answer = f"Error talking to backend: {exc}"
        st.markdown(answer)
        st.session_state.messages.append({"role": "assistant", "content": answer})

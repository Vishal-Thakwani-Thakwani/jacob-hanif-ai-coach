-- Add training_logs table and service role policies
CREATE TABLE IF NOT EXISTS training_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    exercise TEXT NOT NULL,
    metric_type TEXT NOT NULL,
    metric_value REAL NOT NULL,
    sets INT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_logs_user_date ON training_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_training_logs_exercise ON training_logs(user_id, exercise, date);

ALTER TABLE training_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD own training logs" ON training_logs;
CREATE POLICY "Users can CRUD own training logs" ON training_logs
    FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access training_logs" ON training_logs;
CREATE POLICY "Service role full access training_logs" ON training_logs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access oura_daily" ON oura_daily;
CREATE POLICY "Service role full access oura_daily" ON oura_daily
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access daily_usage" ON daily_usage;
CREATE POLICY "Service role full access daily_usage" ON daily_usage
    FOR ALL TO service_role USING (true) WITH CHECK (true);

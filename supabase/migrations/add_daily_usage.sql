-- ============================================
-- MIGRATION: Add daily_usage table for free tier limits
-- ============================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)

-- Create daily_usage table
CREATE TABLE IF NOT EXISTS daily_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    message_count INT DEFAULT 0,
    image_uploads INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_daily_usage_user_date ON daily_usage(user_id, date);

-- Enable RLS
ALTER TABLE daily_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policy - users can only access their own usage
DROP POLICY IF EXISTS "Users can view own usage" ON daily_usage;
CREATE POLICY "Users can view own usage" ON daily_usage
    FOR ALL USING (auth.uid() = user_id);

-- Grant service role full access (for backend to update)
DROP POLICY IF EXISTS "Service role full access" ON daily_usage;
CREATE POLICY "Service role full access" ON daily_usage
    FOR ALL TO service_role USING (true) WITH CHECK (true);

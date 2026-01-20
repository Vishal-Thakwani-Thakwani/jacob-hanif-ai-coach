-- ============================================
-- JACOB HANIF AI COACH - SUPABASE SCHEMA
-- ============================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- This creates all tables, triggers, and RLS policies

-- ============================================
-- 1. PROFILES TABLE (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    name TEXT,
    avatar_url TEXT,
    subscription_status TEXT DEFAULT 'free', -- free, active, canceled, past_due
    subscription_plan TEXT, -- monthly, yearly
    stripe_customer_id TEXT,
    oura_access_token TEXT, -- encrypted with Fernet
    oura_refresh_token TEXT, -- encrypted with Fernet
    oura_token_expires_at TIMESTAMPTZ,
    oura_connected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. AUTO-CREATE PROFILE TRIGGER
-- ============================================
-- This trigger automatically creates a profile when a new user signs up
-- CRITICAL: Without this, checking subscription_status will crash

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 3. CONVERSATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);

-- ============================================
-- 4. MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- ============================================
-- 5. OURA DAILY DATA CACHE
-- ============================================
CREATE TABLE IF NOT EXISTS oura_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    readiness_score INT,
    sleep_score INT,
    activity_score INT,
    hrv_balance INT,
    steps INT,
    active_calories INT,
    resting_heart_rate INT,
    body_temperature REAL,
    sleep_efficiency INT,
    sleep_latency INT,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_oura_daily_user_id ON oura_daily(user_id);
CREATE INDEX IF NOT EXISTS idx_oura_daily_date ON oura_daily(date DESC);

-- ============================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE oura_daily ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. RLS POLICIES - PROFILES
-- ============================================
-- Users can only view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- ============================================
-- 8. RLS POLICIES - CONVERSATIONS
-- ============================================
-- Users can CRUD their own conversations
DROP POLICY IF EXISTS "Users can CRUD own conversations" ON conversations;
CREATE POLICY "Users can CRUD own conversations" ON conversations
    FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 9. RLS POLICIES - MESSAGES
-- ============================================
-- Users can CRUD messages in their own conversations
DROP POLICY IF EXISTS "Users can CRUD own messages" ON messages;
CREATE POLICY "Users can CRUD own messages" ON messages
    FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 10. RLS POLICIES - OURA DAILY
-- ============================================
-- Users can CRUD their own Oura data
DROP POLICY IF EXISTS "Users can CRUD own oura data" ON oura_daily;
CREATE POLICY "Users can CRUD own oura data" ON oura_daily
    FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 11. UPDATED_AT TRIGGER
-- ============================================
-- Automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply to conversations
DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SETUP COMPLETE!
-- ============================================
-- Next steps:
-- 1. Enable Google OAuth in Authentication > Providers
-- 2. Add your Site URL in Authentication > URL Configuration
-- 3. Copy your API keys from Settings > API

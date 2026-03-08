-- ========================================
-- Bolo — Supabase Database Schema
-- Run this in your Supabase SQL Editor
-- ========================================
-- ⚠️ IMPORTANT: Run each section one at a time if you get errors.
-- Copy-paste each block between the dashed lines separately.
-- ========================================
-- 1. Create Tables
-- ========================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    preferred_language TEXT DEFAULT 'unknown',
    stt_mode TEXT DEFAULT 'translate',
    plan TEXT DEFAULT 'free',
    daily_credits INTEGER DEFAULT 0,
    topup_credits INTEGER DEFAULT 10,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    language_code TEXT,
    stt_latency_ms INTEGER,
    llm_latency_ms INTEGER,
    audio_duration_s REAL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT,
    summary TEXT,
    requirements JSONB DEFAULT '[]',
    acceptance_criteria JSONB DEFAULT '[]',
    constraints JSONB DEFAULT '[]',
    examples JSONB DEFAULT '[]',
    original_transcript TEXT,
    confidence REAL,
    language_detected TEXT,
    is_favorite BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);
-- ========================================
-- 2. Indexes
-- ========================================
CREATE INDEX IF NOT EXISTS idx_usage_logs_user ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created ON usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_logs_event ON usage_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_prompts_user ON prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_prompts_created ON prompts(created_at DESC);
-- ========================================
-- 3. Enable Row Level Security
-- ========================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
-- ========================================
-- 4. RLS Policies
-- ========================================
-- Drop existing policies first (safe to run even if they don't exist)
DROP POLICY IF EXISTS "Users read own profile" ON profiles;
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users read own usage" ON usage_logs;
DROP POLICY IF EXISTS "Service insert usage" ON usage_logs;
DROP POLICY IF EXISTS "Users manage own prompts" ON prompts;
-- Profiles: users can read/update/insert their own
CREATE POLICY "Users read own profile" ON profiles FOR
SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR
UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON profiles FOR
INSERT WITH CHECK (auth.uid() = id);
-- Usage logs: anyone can insert (needed for Edge Functions), users can read their own
CREATE POLICY "Users read own usage" ON usage_logs FOR
SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service insert usage" ON usage_logs FOR
INSERT WITH CHECK (true);
-- Prompts: users can do everything with their own
CREATE POLICY "Users manage own prompts" ON prompts FOR ALL USING (auth.uid() = user_id);
-- ========================================
-- 5. Helper Functions
-- ========================================
-- Decrement credits (called by Edge Functions)
CREATE OR REPLACE FUNCTION decrement_credits(user_id_input UUID) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE user_plan TEXT;
current_daily INTEGER;
current_topup INTEGER;
last_reset DATE;
plan_daily_limit INTEGER;
BEGIN -- 1. Fetch user's current stats
SELECT plan,
    COALESCE(daily_credits, 0),
    COALESCE(topup_credits, 0),
    COALESCE(last_reset_date, CURRENT_DATE) INTO user_plan,
    current_daily,
    current_topup,
    last_reset
FROM profiles
WHERE id = user_id_input FOR
UPDATE;
-- 2. Set the daily limit based on plan
IF user_plan = 'power' THEN plan_daily_limit := 30;
ELSIF user_plan = 'pro' THEN plan_daily_limit := 10;
ELSE plan_daily_limit := 0;
-- Free users get 0 daily credits
END IF;
-- 3. Reset daily credits if it's a new day
IF last_reset < CURRENT_DATE THEN current_daily := plan_daily_limit;
last_reset := CURRENT_DATE;
END IF;
-- 4. Deduct the credit
IF current_daily > 0 THEN current_daily := current_daily - 1;
ELSIF current_topup > 0 THEN current_topup := current_topup - 1;
ELSE RAISE EXCEPTION 'No credits remaining. Please upgrade your plan or top up.';
END IF;
-- 5. Update the profile
UPDATE profiles
SET daily_credits = current_daily,
    topup_credits = current_topup,
    last_reset_date = last_reset
WHERE id = user_id_input;
END;
$$;
-- ========================================
-- 6. REMOVE old trigger (if it exists)
-- The profile is now created client-side after signup
-- ========================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();
-- ========================================
-- 7. Pricing Model Updates (Run this block to upgrade schema)
-- ========================================
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS daily_credits INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS topup_credits INTEGER DEFAULT 10,
    ADD COLUMN IF NOT EXISTS last_reset_date DATE DEFAULT CURRENT_DATE;
-- Migrate existing credits_remaining to topup_credits if the column still exists
DO $$ BEGIN IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'profiles'
        AND column_name = 'credits_remaining'
) THEN EXECUTE 'UPDATE profiles SET topup_credits = credits_remaining WHERE credits_remaining IS NOT NULL';
EXECUTE 'ALTER TABLE profiles DROP COLUMN credits_remaining';
END IF;
END $$;
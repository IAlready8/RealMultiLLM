-- Supabase Database Initialization Script
-- RealMultiLLM Production Setup
-- 
-- This script sets up the database with optimizations for Supabase
-- Run this AFTER deploying your Prisma schema
--
-- Usage:
-- 1. Deploy Prisma schema first: npx prisma db push
-- 2. Open Supabase SQL Editor
-- 3. Copy and run this script

-- =============================================================================
-- Enable Required Extensions
-- =============================================================================

-- UUID generation (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Performance monitoring
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- =============================================================================
-- Performance Indexes
-- =============================================================================

-- Note: Basic indexes are created by Prisma
-- These are additional performance indexes

-- User table optimizations
CREATE INDEX IF NOT EXISTS "idx_user_created_at" ON "User"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_user_updated_at" ON "User"("updatedAt" DESC);

-- Conversation optimizations
CREATE INDEX IF NOT EXISTS "idx_conversation_user_created" ON "Conversation"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_conversation_updated" ON "Conversation"("updatedAt" DESC);

-- Analytics optimizations
CREATE INDEX IF NOT EXISTS "idx_analytics_created" ON "Analytics"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_analytics_user_event" ON "Analytics"("userId", "event", "createdAt" DESC);

-- Provider config optimizations
CREATE INDEX IF NOT EXISTS "idx_provider_config_active" ON "ProviderConfig"("isActive", "userId");

-- Session optimizations (for active session queries)
CREATE INDEX IF NOT EXISTS "idx_session_expires" ON "Session"("expires" DESC);
CREATE INDEX IF NOT EXISTS "idx_session_user_expires" ON "Session"("userId", "expires" DESC);

-- =============================================================================
-- Database Functions
-- =============================================================================

-- Function to clean up expired sessions (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM "Session"
  WHERE expires < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get user statistics
CREATE OR REPLACE FUNCTION get_user_stats(user_id_param text)
RETURNS json AS $$
BEGIN
  RETURN json_build_object(
    'conversation_count', (SELECT COUNT(*) FROM "Conversation" WHERE "userId" = user_id_param),
    'provider_count', (SELECT COUNT(*) FROM "ProviderConfig" WHERE "userId" = user_id_param AND "isActive" = true),
    'goal_count', (SELECT COUNT(*) FROM "Goal" WHERE "userId" = user_id_param),
    'persona_count', (SELECT COUNT(*) FROM "Persona" WHERE "userId" = user_id_param),
    'analytics_events', (SELECT COUNT(*) FROM "Analytics" WHERE "userId" = user_id_param)
  );
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Row Level Security (RLS) Policies
-- =============================================================================

-- Note: RLS is disabled by default for this application
-- NextAuth and application logic handle authorization
-- Enable RLS if you want database-level security

-- Uncomment to enable RLS on User table
-- ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY user_select_own ON "User"
--   FOR SELECT
--   USING (id = current_setting('app.current_user_id', true)::text);

-- =============================================================================
-- Monitoring Views
-- =============================================================================

-- View for monitoring active sessions
CREATE OR REPLACE VIEW active_sessions AS
SELECT 
  s.id,
  s."userId",
  u.email,
  s.expires,
  s.expires > NOW() as is_active,
  EXTRACT(EPOCH FROM (s.expires - NOW())) / 3600 as hours_until_expiry
FROM "Session" s
JOIN "User" u ON s."userId" = u.id
WHERE s.expires > NOW()
ORDER BY s.expires DESC;

-- View for user activity summary
CREATE OR REPLACE VIEW user_activity_summary AS
SELECT 
  u.id,
  u.email,
  u.name,
  u."createdAt" as registered_at,
  COUNT(DISTINCT c.id) as conversation_count,
  COUNT(DISTINCT p.id) as active_providers,
  COUNT(DISTINCT g.id) as goal_count,
  MAX(c."updatedAt") as last_conversation_at
FROM "User" u
LEFT JOIN "Conversation" c ON u.id = c."userId"
LEFT JOIN "ProviderConfig" p ON u.id = p."userId" AND p."isActive" = true
LEFT JOIN "Goal" g ON u.id = g."userId"
GROUP BY u.id, u.email, u.name, u."createdAt"
ORDER BY u."createdAt" DESC;

-- =============================================================================
-- Scheduled Jobs (using pg_cron extension if available)
-- =============================================================================

-- Note: pg_cron is available on Supabase paid plans
-- Uncomment if you have pg_cron enabled

-- Clean up expired sessions daily
-- SELECT cron.schedule(
--   'cleanup-expired-sessions',
--   '0 2 * * *',  -- Run at 2 AM daily
--   $$ SELECT cleanup_expired_sessions(); $$
-- );

-- =============================================================================
-- Performance Monitoring Queries
-- =============================================================================

-- These are example queries you can run to monitor performance
-- Not executed automatically

-- Check table sizes
-- SELECT 
--   schemaname,
--   tablename,
--   pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check slow queries (requires pg_stat_statements)
-- SELECT
--   query,
--   calls,
--   total_exec_time,
--   mean_exec_time,
--   max_exec_time
-- FROM pg_stat_statements
-- ORDER BY mean_exec_time DESC
-- LIMIT 10;

-- =============================================================================
-- Initial Data (Optional)
-- =============================================================================

-- Uncomment to create a demo/test user
-- Replace password hash with actual hash generated from:
-- node -e "console.log(require('bcryptjs').hashSync('YourPassword123!', 10))"

-- INSERT INTO "User" (id, email, name, password, "createdAt", "updatedAt")
-- VALUES (
--   gen_random_uuid()::text,
--   'admin@example.com',
--   'Admin User',
--   '$2a$10$REPLACE_WITH_ACTUAL_HASH',
--   NOW(),
--   NOW()
-- )
-- ON CONFLICT (email) DO NOTHING;

-- =============================================================================
-- Verification
-- =============================================================================

-- Check that all tables were created
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check indexes
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- =============================================================================
-- Success Message
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Supabase initialization complete!';
  RAISE NOTICE 'Tables: %', (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public');
  RAISE NOTICE 'Indexes: %', (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public');
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Create your first user account';
  RAISE NOTICE '2. Test the connection from your application';
  RAISE NOTICE '3. Deploy to Vercel';
  RAISE NOTICE '';
  RAISE NOTICE 'Useful queries:';
  RAISE NOTICE '- SELECT * FROM active_sessions;';
  RAISE NOTICE '- SELECT * FROM user_activity_summary;';
  RAISE NOTICE '- SELECT cleanup_expired_sessions();';
END $$;

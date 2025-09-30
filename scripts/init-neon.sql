-- Neon Database Initialization Script
-- RealMultiLLM Production Setup
-- 
-- This script sets up the database with optimizations for Neon
-- Run this AFTER deploying your Prisma schema
--
-- Usage:
-- 1. Deploy Prisma schema first: npx prisma db push
-- 2. Open Neon SQL Editor
-- 3. Copy and run this script

-- =============================================================================
-- Enable Required Extensions
-- =============================================================================

-- UUID generation (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Performance monitoring (if available)
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- =============================================================================
-- Performance Indexes
-- =============================================================================

-- Note: Basic indexes are created by Prisma
-- These are additional performance indexes optimized for Neon

-- User table optimizations
CREATE INDEX IF NOT EXISTS "idx_user_created_at" ON "User"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_user_updated_at" ON "User"("updatedAt" DESC);

-- Conversation optimizations (Neon benefits from covering indexes)
CREATE INDEX IF NOT EXISTS "idx_conversation_user_created" ON "Conversation"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_conversation_updated" ON "Conversation"("updatedAt" DESC);

-- Analytics optimizations
CREATE INDEX IF NOT EXISTS "idx_analytics_created" ON "Analytics"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_analytics_user_event" ON "Analytics"("userId", "event", "createdAt" DESC);

-- Provider config optimizations
CREATE INDEX IF NOT EXISTS "idx_provider_config_active" ON "ProviderConfig"("isActive", "userId");

-- Session optimizations (important for JWT strategy)
CREATE INDEX IF NOT EXISTS "idx_session_expires" ON "Session"("expires" DESC);
CREATE INDEX IF NOT EXISTS "idx_session_user_expires" ON "Session"("userId", "expires" DESC);

-- Goal optimizations
CREATE INDEX IF NOT EXISTS "idx_goal_status_created" ON "Goal"("status", "createdAt" DESC);

-- =============================================================================
-- Database Functions
-- =============================================================================

-- Function to clean up expired sessions
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
    'analytics_events', (SELECT COUNT(*) FROM "Analytics" WHERE "userId" = user_id_param),
    'last_activity', (SELECT MAX("updatedAt") FROM "Conversation" WHERE "userId" = user_id_param)
  );
END;
$$ LANGUAGE plpgsql;

-- Function to archive old conversations (for data management)
CREATE OR REPLACE FUNCTION archive_old_conversations(days_old integer DEFAULT 90)
RETURNS TABLE(archived_count integer, total_size bigint) AS $$
DECLARE
  count integer;
  size bigint;
BEGIN
  -- This is a placeholder - actual archiving would move data to archive table
  SELECT COUNT(*), SUM(pg_column_size(messages))
  INTO count, size
  FROM "Conversation"
  WHERE "updatedAt" < NOW() - (days_old || ' days')::interval;
  
  RETURN QUERY SELECT count, size;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Monitoring Views
-- =============================================================================

-- View for monitoring active sessions
CREATE OR REPLACE VIEW active_sessions AS
SELECT 
  s.id,
  s."userId",
  u.email,
  u.name,
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
  COUNT(DISTINCT pe.id) as persona_count,
  MAX(c."updatedAt") as last_conversation_at,
  COUNT(DISTINCT s.id) as active_sessions
FROM "User" u
LEFT JOIN "Conversation" c ON u.id = c."userId"
LEFT JOIN "ProviderConfig" p ON u.id = p."userId" AND p."isActive" = true
LEFT JOIN "Goal" g ON u.id = g."userId"
LEFT JOIN "Persona" pe ON u.id = pe."userId"
LEFT JOIN "Session" s ON u.id = s."userId" AND s.expires > NOW()
GROUP BY u.id, u.email, u.name, u."createdAt"
ORDER BY u."createdAt" DESC;

-- View for database size monitoring
CREATE OR REPLACE VIEW table_sizes AS
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- =============================================================================
-- Neon-Specific Optimizations
-- =============================================================================

-- Vacuum and analyze for better query performance
VACUUM ANALYZE;

-- Update table statistics for query planner
ANALYZE "User";
ANALYZE "Conversation";
ANALYZE "Session";
ANALYZE "Analytics";
ANALYZE "ProviderConfig";

-- =============================================================================
-- Performance Monitoring Setup
-- =============================================================================

-- Enable query performance tracking (if pg_stat_statements is available)
-- This helps identify slow queries in Neon's metrics

-- Reset statistics
SELECT pg_stat_statements_reset();

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
-- Verification Queries
-- =============================================================================

-- Check that all tables were created
DO $$
DECLARE
  table_count integer;
  index_count integer;
BEGIN
  SELECT COUNT(*) INTO table_count FROM pg_tables WHERE schemaname = 'public';
  SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE schemaname = 'public';
  
  RAISE NOTICE '===========================================';
  RAISE NOTICE '✅ Neon Database Initialization Complete!';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Database Statistics:';
  RAISE NOTICE '  Tables created: %', table_count;
  RAISE NOTICE '  Indexes created: %', index_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Available Views:';
  RAISE NOTICE '  - active_sessions';
  RAISE NOTICE '  - user_activity_summary';
  RAISE NOTICE '  - table_sizes';
  RAISE NOTICE '';
  RAISE NOTICE 'Available Functions:';
  RAISE NOTICE '  - cleanup_expired_sessions()';
  RAISE NOTICE '  - get_user_stats(user_id)';
  RAISE NOTICE '  - archive_old_conversations(days)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Create your first user account';
  RAISE NOTICE '  2. Test database connection';
  RAISE NOTICE '  3. Deploy to Vercel';
  RAISE NOTICE '  4. Monitor performance in Neon Dashboard';
  RAISE NOTICE '';
  RAISE NOTICE 'Useful Queries:';
  RAISE NOTICE '  SELECT * FROM active_sessions;';
  RAISE NOTICE '  SELECT * FROM user_activity_summary;';
  RAISE NOTICE '  SELECT * FROM table_sizes;';
  RAISE NOTICE '  SELECT cleanup_expired_sessions();';
  RAISE NOTICE '';
  RAISE NOTICE 'Performance Tips:';
  RAISE NOTICE '  - Use Neon connection pooling (already in connection string)';
  RAISE NOTICE '  - Monitor queries in Neon Dashboard → Queries';
  RAISE NOTICE '  - Check storage usage in Neon Dashboard → Settings';
  RAISE NOTICE '  - Run VACUUM ANALYZE periodically for optimal performance';
  RAISE NOTICE '';
END $$;

-- Show table list
SELECT tablename, schemaname
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Show current database size
SELECT 
  pg_size_pretty(pg_database_size(current_database())) as database_size,
  current_database() as database_name;


-- SQLite Performance Optimization Script
-- Generated: 2025-08-03T18:24:12.165Z
-- optimization: Optimized for M2 MacBook Air with 8GB RAM

PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 10000;
PRAGMA temp_store = memory;
PRAGMA mmap_size = 268435456;
PRAGMA optimize;

-- barrier identification: Performance monitoring
SELECT 
  'Database optimization applied' as status,
  sqlite_version() as sqlite_version,
  datetime('now') as timestamp;

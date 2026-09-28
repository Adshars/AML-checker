-- Migration 07: Add rate_limits table
-- Required by backend/src/middleware/rateLimit.ts
-- Without this table the middleware silently falls back to IP-only limiting,
-- leaving per-developer and per-user quotas completely unenforced.

CREATE TABLE IF NOT EXISTS rate_limits (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier       TEXT NOT NULL,
    identifier_type  TEXT NOT NULL CHECK (identifier_type IN ('user', 'developer', 'ip')),
    request_count    INTEGER NOT NULL DEFAULT 0,
    window_start     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    blocked_until    TIMESTAMP WITH TIME ZONE,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fast lookup for the two queries the middleware runs on every request:
--   1. Check if currently blocked
--   2. Find the active window record
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
    ON rate_limits (identifier, identifier_type);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start
    ON rate_limits (window_start);

-- Partial index — only rows that are actually blocked (small fraction of total)
CREATE INDEX IF NOT EXISTS idx_rate_limits_blocked_until
    ON rate_limits (blocked_until)
    WHERE blocked_until IS NOT NULL;

-- Cleanup function to remove stale window records older than 48 hours.
-- Call periodically (e.g. via pg_cron or the retention cron in Task 23).
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM rate_limits
    WHERE window_start < NOW() - INTERVAL '48 hours'
      AND blocked_until IS NULL;
END;
$$;

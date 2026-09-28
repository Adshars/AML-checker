-- Provider performance metrics for A/B comparison and accuracy tracking.
-- Records latency, success/failure, and confidence score per provider invocation.
-- Kept separate from verification_requests to avoid bloating the main table
-- and to allow independent retention policies.

CREATE TABLE IF NOT EXISTS provider_metrics (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_name     TEXT    NOT NULL,
    provider_type     TEXT    NOT NULL CHECK (provider_type IN ('ocr', 'face', 'liveness')),
    verification_id   UUID    REFERENCES verification_requests(id) ON DELETE SET NULL,
    latency_ms        INTEGER,
    success           BOOLEAN NOT NULL,
    confidence_score  DECIMAL(4,3),
    error_type        TEXT,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_metrics_name    ON provider_metrics(provider_name);
CREATE INDEX IF NOT EXISTS idx_provider_metrics_created ON provider_metrics(created_at);

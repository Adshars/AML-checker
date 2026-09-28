-- Idempotency keys table: prevents duplicate verification records when the
-- same request is retried (e.g., network timeout causing a retry).
-- Keyed on (key, developer_id) so different developers can use the same key.
-- Rows expire after 24 hours; the middleware ignores expired rows.

CREATE TABLE IF NOT EXISTS idempotency_keys (
    key             TEXT        NOT NULL,
    developer_id    UUID        NOT NULL,
    response_status INTEGER     NOT NULL,
    response_body   JSONB       NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at      TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
    PRIMARY KEY (key, developer_id)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires
    ON idempotency_keys(expires_at);

-- Add revocation tracking columns to api_keys table
ALTER TABLE api_keys 
ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS revoked_reason TEXT;
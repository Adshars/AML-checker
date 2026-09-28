-- Add missing columns to verification_requests table

-- Add document_id to link to documents table
ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES documents(id) ON DELETE SET NULL;

-- Add selfie_id to link to selfies table  
ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS selfie_id UUID REFERENCES selfies(id) ON DELETE SET NULL;

-- Add face recognition results
ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS face_match_score DECIMAL(3,2);
ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS liveness_score DECIMAL(3,2);

-- Add live capture tracking
ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS live_capture_completed BOOLEAN DEFAULT FALSE;

-- Add external verification ID for third-party integrations
ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS external_verification_id VARCHAR(255);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_verification_requests_document_id ON verification_requests(document_id);
CREATE INDEX IF NOT EXISTS idx_verification_requests_selfie_id ON verification_requests(selfie_id);
CREATE INDEX IF NOT EXISTS idx_verification_requests_live_capture ON verification_requests(live_capture_completed);
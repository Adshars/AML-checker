-- Add photo consistency validation support
-- This migration adds columns for document photo cross-validation to prevent identity fraud

-- Add photo consistency score to verification_requests table
ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS photo_consistency_score DECIMAL(3,2);
ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS liveness_score DECIMAL(3,2);
ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS live_capture_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- Create index for photo consistency queries
CREATE INDEX IF NOT EXISTS idx_verification_requests_photo_consistency ON verification_requests(photo_consistency_score);
CREATE INDEX IF NOT EXISTS idx_verification_requests_liveness ON verification_requests(liveness_score);

-- Add more detailed status tracking
ALTER TABLE verification_requests DROP CONSTRAINT IF EXISTS verification_requests_status_check;
ALTER TABLE verification_requests ADD CONSTRAINT verification_requests_status_check 
    CHECK (status IN ('pending', 'verified', 'failed', 'manual_review'));

-- Add comments for documentation
COMMENT ON COLUMN verification_requests.photo_consistency_score IS 'Score from comparing photos between front and back documents (0.0-1.0) - critical security check';
COMMENT ON COLUMN verification_requests.liveness_score IS 'Score from liveness detection during live capture (0.0-1.0)';
COMMENT ON COLUMN verification_requests.live_capture_completed IS 'Indicates if live capture with liveness detection is completed';
COMMENT ON COLUMN verification_requests.failure_reason IS 'Detailed reason for verification failure for user feedback';
-- Add back-of-ID support to the documents table
-- This migration adds columns for back-of-ID scanning and cross-validation

-- Add columns to documents table for back-of-ID data
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_back_of_id BOOLEAN DEFAULT FALSE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS barcode_data JSONB;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS cross_validation_results JSONB;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS back_of_id_document_id UUID REFERENCES documents(id);

-- Add index for back-of-ID queries
CREATE INDEX IF NOT EXISTS idx_documents_is_back_of_id ON documents(is_back_of_id);
CREATE INDEX IF NOT EXISTS idx_documents_back_of_id_document_id ON documents(back_of_id_document_id);

-- Add columns to verification_requests table for enhanced verification
ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS back_of_id_uploaded BOOLEAN DEFAULT FALSE;
ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS cross_validation_score DECIMAL(3,2);
ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS enhanced_verification_completed BOOLEAN DEFAULT FALSE;

-- Create index for enhanced verification queries
CREATE INDEX IF NOT EXISTS idx_verification_requests_enhanced_verification ON verification_requests(enhanced_verification_completed);

-- Add trigger to automatically update back_of_id_uploaded when back-of-ID is uploaded
CREATE OR REPLACE FUNCTION update_back_of_id_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update verification request when a back-of-ID document is inserted
    IF NEW.is_back_of_id = TRUE THEN
        UPDATE verification_requests 
        SET back_of_id_uploaded = TRUE, updated_at = NOW()
        WHERE id = NEW.verification_request_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for back-of-ID status updates
DROP TRIGGER IF EXISTS trigger_update_back_of_id_status ON documents;
CREATE TRIGGER trigger_update_back_of_id_status
    AFTER INSERT ON documents
    FOR EACH ROW 
    EXECUTE FUNCTION update_back_of_id_status();

-- Create function to automatically link front and back of ID documents
CREATE OR REPLACE FUNCTION link_front_and_back_documents()
RETURNS TRIGGER AS $$
DECLARE
    front_document_id UUID;
BEGIN
    -- If this is a back-of-ID document, find the corresponding front document
    IF NEW.is_back_of_id = TRUE THEN
        SELECT id INTO front_document_id 
        FROM documents 
        WHERE verification_request_id = NEW.verification_request_id 
          AND is_back_of_id = FALSE 
          AND document_type = NEW.document_type
        ORDER BY created_at DESC 
        LIMIT 1;
        
        -- Update the back document with reference to front document
        IF front_document_id IS NOT NULL THEN
            UPDATE documents 
            SET back_of_id_document_id = front_document_id
            WHERE id = NEW.id;
            
            -- Also update the front document with reference to back document
            UPDATE documents 
            SET back_of_id_document_id = NEW.id
            WHERE id = front_document_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for linking documents
DROP TRIGGER IF EXISTS trigger_link_documents ON documents;
CREATE TRIGGER trigger_link_documents
    AFTER INSERT ON documents
    FOR EACH ROW 
    EXECUTE FUNCTION link_front_and_back_documents();

-- Add comments for documentation
COMMENT ON COLUMN documents.is_back_of_id IS 'Indicates if this document is the back side of an ID';
COMMENT ON COLUMN documents.barcode_data IS 'JSON data extracted from QR codes, barcodes, or magnetic strips on back of ID';
COMMENT ON COLUMN documents.cross_validation_results IS 'Results of cross-validation between front and back of ID';
COMMENT ON COLUMN documents.back_of_id_document_id IS 'Reference to the corresponding front or back document';

COMMENT ON COLUMN verification_requests.back_of_id_uploaded IS 'Indicates if back-of-ID has been uploaded for this verification';
COMMENT ON COLUMN verification_requests.cross_validation_score IS 'Score from cross-validating front and back of ID (0.0-1.0)';
COMMENT ON COLUMN verification_requests.enhanced_verification_completed IS 'Indicates if enhanced verification with back-of-ID is completed';
-- Add missing columns to documents table

-- Add ocr_extracted boolean column to track OCR processing status
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ocr_extracted BOOLEAN DEFAULT FALSE;

-- Add quality_analysis JSONB column to store detailed quality analysis results
ALTER TABLE documents ADD COLUMN IF NOT EXISTS quality_analysis JSONB;

-- Create index for ocr_extracted for better query performance
CREATE INDEX IF NOT EXISTS idx_documents_ocr_extracted ON documents(ocr_extracted);
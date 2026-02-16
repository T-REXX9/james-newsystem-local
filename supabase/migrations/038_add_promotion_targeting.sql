-- ============================================================================
-- Add Client and City Targeting to Promotions
-- Migration: 038_add_promotion_targeting.sql
-- ============================================================================

-- Add targeting columns to promotions table
ALTER TABLE promotions
ADD COLUMN IF NOT EXISTS target_all_clients BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE promotions
ADD COLUMN IF NOT EXISTS target_client_ids TEXT[] DEFAULT '{}';

ALTER TABLE promotions
ADD COLUMN IF NOT EXISTS target_cities TEXT[] DEFAULT '{}';

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_promotions_target_all_clients 
ON promotions(target_all_clients) WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_promotions_target_cities 
ON promotions USING GIN(target_cities) WHERE is_deleted = FALSE;

-- Add comments
COMMENT ON COLUMN promotions.target_all_clients IS 'When true, promotion applies to all clients. When false, only clients in target_client_ids.';
COMMENT ON COLUMN promotions.target_client_ids IS 'Array of contact IDs that this promotion targets. Only used when target_all_clients is FALSE.';
COMMENT ON COLUMN promotions.target_cities IS 'Optional array of city names to filter targeted clients by geography.';

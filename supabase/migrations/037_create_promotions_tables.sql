-- ============================================================================
-- Product Promotion Management System Schema
-- Migration: 037_create_promotions_tables.sql
-- ============================================================================

-- Table: promotions
CREATE TABLE promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_title TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft',
  created_by UUID NOT NULL REFERENCES profiles(id),
  assigned_to UUID[] DEFAULT '{}',
  target_platforms TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT promotions_valid_dates CHECK (end_date > COALESCE(start_date, NOW() - INTERVAL '1 day')),
  CONSTRAINT promotions_valid_status CHECK (status IN ('Draft', 'Active', 'Expired', 'Cancelled'))
);

CREATE INDEX idx_promotions_status ON promotions(status) WHERE is_deleted = FALSE;
CREATE INDEX idx_promotions_end_date ON promotions(end_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_promotions_created_by ON promotions(created_by);

-- Table: promotion_products
CREATE TABLE promotion_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  promo_price_aa NUMERIC(10, 2),
  promo_price_bb NUMERIC(10, 2),
  promo_price_cc NUMERIC(10, 2),
  promo_price_dd NUMERIC(10, 2),
  promo_price_vip1 NUMERIC(10, 2),
  promo_price_vip2 NUMERIC(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(promotion_id, product_id)
);

CREATE INDEX idx_promotion_products_promotion ON promotion_products(promotion_id);
CREATE INDEX idx_promotion_products_product ON promotion_products(product_id);

-- Table: promotion_postings
CREATE TABLE promotion_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  platform_name TEXT NOT NULL,
  posted_by UUID REFERENCES profiles(id),
  post_url TEXT,
  screenshot_url TEXT,
  status TEXT NOT NULL DEFAULT 'Not Posted',
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT promotion_postings_valid_status CHECK (status IN ('Not Posted', 'Pending Review', 'Approved', 'Rejected')),
  CONSTRAINT promotion_postings_rejection_reason_required CHECK (
    (status = 'Rejected' AND rejection_reason IS NOT NULL) OR (status != 'Rejected')
  )
);

CREATE INDEX idx_promotion_postings_promotion ON promotion_postings(promotion_id);
CREATE INDEX idx_promotion_postings_status ON promotion_postings(status);
CREATE INDEX idx_promotion_postings_posted_by ON promotion_postings(posted_by);

-- RLS Policies
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_postings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage all promotions" ON promotions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Owner'));

CREATE POLICY "Sales agents can view assigned promotions" ON promotions FOR SELECT TO authenticated
  USING (is_deleted = FALSE AND (assigned_to = '{}' OR auth.uid() = ANY(assigned_to)));

CREATE POLICY "Owners can manage promotion products" ON promotion_products FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Owner'));

CREATE POLICY "Sales agents can view promotion products" ON promotion_products FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM promotions WHERE promotions.id = promotion_products.promotion_id 
    AND promotions.is_deleted = FALSE AND (promotions.assigned_to = '{}' OR auth.uid() = ANY(promotions.assigned_to))));

CREATE POLICY "Owners can manage all postings" ON promotion_postings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Owner'));

CREATE POLICY "Sales agents can view postings for assigned promotions" ON promotion_postings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM promotions WHERE promotions.id = promotion_postings.promotion_id 
    AND promotions.is_deleted = FALSE AND (promotions.assigned_to = '{}' OR auth.uid() = ANY(promotions.assigned_to))));

CREATE POLICY "Sales agents can upload proofs" ON promotion_postings FOR UPDATE TO authenticated
  USING (posted_by = auth.uid() OR posted_by IS NULL) WITH CHECK (posted_by = auth.uid());

CREATE POLICY "Sales agents can insert proofs" ON promotion_postings FOR INSERT TO authenticated
  WITH CHECK (posted_by = auth.uid() AND EXISTS (SELECT 1 FROM promotions WHERE promotions.id = promotion_postings.promotion_id 
    AND promotions.is_deleted = FALSE AND (promotions.assigned_to = '{}' OR auth.uid() = ANY(promotions.assigned_to))));

-- Triggers
CREATE OR REPLACE FUNCTION update_promotion_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER update_promotions_updated_at BEFORE UPDATE ON promotions FOR EACH ROW EXECUTE FUNCTION update_promotion_updated_at();
CREATE TRIGGER update_promotion_postings_updated_at BEFORE UPDATE ON promotion_postings FOR EACH ROW EXECUTE FUNCTION update_promotion_updated_at();

-- Auto-expire function
CREATE OR REPLACE FUNCTION check_and_update_promotion_status() RETURNS void AS $$
BEGIN
  UPDATE promotions SET status = 'Active' WHERE status = 'Draft' AND is_deleted = FALSE AND (start_date IS NULL OR start_date <= NOW());
  UPDATE promotions SET status = 'Expired' WHERE status = 'Active' AND is_deleted = FALSE AND end_date < NOW();
END; $$ LANGUAGE plpgsql;

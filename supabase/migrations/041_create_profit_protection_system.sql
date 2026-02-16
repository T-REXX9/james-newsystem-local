-- ============================================================================
-- Profit Protection System
-- Migration: 041_create_profit_protection_system.sql
-- Note: products.id is TEXT, not UUID
-- ============================================================================

-- System settings for profit threshold
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ
);

-- Insert default profit threshold setting
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES (
  'min_gross_profit_threshold',
  '{"percentage": 50, "enforce_approval": true, "allow_override": true}',
  'Minimum gross profit percentage threshold. Sales below this require approval.'
)
ON CONFLICT (setting_key) DO NOTHING;

-- Insert AI Sales Agent settings
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES (
  'ai_sales_agent_config',
  '{"default_language": "tagalog", "fallback_language": "english", "max_retries": 3, "response_timeout_seconds": 30}',
  'AI Sales Agent configuration for automated outreach'
)
ON CONFLICT (setting_key) DO NOTHING;

-- Table: profit_override_logs (item_id is TEXT to match products.id)
CREATE TABLE profit_override_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID,
  invoice_id UUID,
  item_id TEXT REFERENCES products(id),
  original_price NUMERIC(12, 2) NOT NULL,
  override_price NUMERIC(12, 2) NOT NULL,
  cost NUMERIC(12, 2) NOT NULL,
  original_profit_pct NUMERIC(5, 2) NOT NULL,
  override_profit_pct NUMERIC(5, 2) NOT NULL,
  reason TEXT,
  override_type TEXT NOT NULL DEFAULT 'price_adjustment',
  approved_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT profit_override_logs_type_check CHECK (override_type IN ('price_adjustment', 'full_approval', 'discount_override'))
);

CREATE INDEX idx_profit_override_logs_order ON profit_override_logs(order_id);
CREATE INDEX idx_profit_override_logs_invoice ON profit_override_logs(invoice_id);
CREATE INDEX idx_profit_override_logs_item ON profit_override_logs(item_id);
CREATE INDEX idx_profit_override_logs_approved_by ON profit_override_logs(approved_by);
CREATE INDEX idx_profit_override_logs_created ON profit_override_logs(created_at DESC);

-- Table: admin_override_logs
CREATE TABLE admin_override_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  override_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  original_value JSONB,
  override_value JSONB,
  reason TEXT,
  performed_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_override_logs_type ON admin_override_logs(override_type);
CREATE INDEX idx_admin_override_logs_entity ON admin_override_logs(entity_type, entity_id);
CREATE INDEX idx_admin_override_logs_performed_by ON admin_override_logs(performed_by);
CREATE INDEX idx_admin_override_logs_created ON admin_override_logs(created_at DESC);

-- RLS Policies
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profit_override_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_override_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage system settings" ON system_settings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Owner'));

CREATE POLICY "Authenticated users can view system settings" ON system_settings FOR SELECT TO authenticated
  USING (is_deleted = FALSE);

CREATE POLICY "Owners can manage profit override logs" ON profit_override_logs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Owner'));

CREATE POLICY "Authenticated users can insert profit overrides" ON profit_override_logs FOR INSERT TO authenticated
  WITH CHECK (approved_by = auth.uid());

CREATE POLICY "Authenticated users can view profit overrides" ON profit_override_logs FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "Owners can manage admin override logs" ON admin_override_logs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Owner'));

CREATE POLICY "Authenticated users can insert admin overrides" ON admin_override_logs FOR INSERT TO authenticated
  WITH CHECK (performed_by = auth.uid());

CREATE POLICY "Authenticated users can view admin overrides" ON admin_override_logs FOR SELECT TO authenticated
  USING (TRUE);

-- Trigger for updated_at on system_settings
CREATE TRIGGER update_system_settings_updated_at 
  BEFORE UPDATE ON system_settings 
  FOR EACH ROW EXECUTE FUNCTION update_loyalty_tables_updated_at();

-- Function to get a system setting
CREATE OR REPLACE FUNCTION get_system_setting(p_key TEXT)
RETURNS JSONB AS $$
DECLARE
  v_value JSONB;
BEGIN
  SELECT setting_value INTO v_value
  FROM system_settings
  WHERE setting_key = p_key AND is_deleted = FALSE;
  
  RETURN COALESCE(v_value, '{}'::JSONB);
END;
$$ LANGUAGE plpgsql;

-- Function to update a system setting
CREATE OR REPLACE FUNCTION set_system_setting(p_key TEXT, p_value JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO system_settings (setting_key, setting_value)
  VALUES (p_key, p_value)
  ON CONFLICT (setting_key)
  DO UPDATE SET setting_value = p_value, updated_at = NOW();
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate gross profit percentage
CREATE OR REPLACE FUNCTION calculate_gross_profit_pct(
  p_selling_price NUMERIC,
  p_cost NUMERIC,
  p_discount NUMERIC DEFAULT 0
)
RETURNS NUMERIC AS $$
DECLARE
  v_net_price NUMERIC;
  v_profit NUMERIC;
BEGIN
  IF p_selling_price IS NULL OR p_selling_price = 0 THEN
    RETURN 0;
  END IF;
  
  v_net_price := p_selling_price - COALESCE(p_discount, 0);
  v_profit := v_net_price - COALESCE(p_cost, 0);
  
  RETURN ROUND((v_profit / v_net_price) * 100, 2);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Loyalty Discount (Regular Buyer Discount) System
-- Migration: 040_create_loyalty_discount_system.sql
-- Note: contacts.id is TEXT, not UUID
-- ============================================================================

-- Table: loyalty_discount_rules
CREATE TABLE loyalty_discount_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  min_purchase_amount NUMERIC(12, 2) NOT NULL,
  discount_percentage NUMERIC(5, 2) NOT NULL,
  evaluation_period TEXT NOT NULL DEFAULT 'calendar_month',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  priority INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT loyalty_discount_rules_percentage_check CHECK (discount_percentage > 0 AND discount_percentage <= 100),
  CONSTRAINT loyalty_discount_rules_min_amount_check CHECK (min_purchase_amount > 0),
  CONSTRAINT loyalty_discount_rules_period_check CHECK (evaluation_period IN ('calendar_month', 'rolling_30_days'))
);

CREATE INDEX idx_loyalty_discount_rules_active ON loyalty_discount_rules(is_active) WHERE is_deleted = FALSE;
CREATE INDEX idx_loyalty_discount_rules_priority ON loyalty_discount_rules(priority DESC) WHERE is_deleted = FALSE AND is_active = TRUE;

-- Table: client_monthly_purchases (client_id is TEXT to match contacts.id)
CREATE TABLE client_monthly_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL REFERENCES contacts(id),
  year_month TEXT NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  order_count INTEGER NOT NULL DEFAULT 0,
  last_order_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, year_month)
);

CREATE INDEX idx_client_monthly_purchases_client ON client_monthly_purchases(client_id);
CREATE INDEX idx_client_monthly_purchases_month ON client_monthly_purchases(year_month);
CREATE INDEX idx_client_monthly_purchases_amount ON client_monthly_purchases(total_amount DESC);

-- Table: client_discount_eligibility
CREATE TABLE client_discount_eligibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL REFERENCES contacts(id),
  rule_id UUID NOT NULL REFERENCES loyalty_discount_rules(id),
  eligible_month TEXT NOT NULL,
  qualifying_month TEXT NOT NULL,
  qualifying_amount NUMERIC(12, 2) NOT NULL,
  discount_percentage NUMERIC(5, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'eligible',
  total_discount_applied NUMERIC(12, 2) DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT client_discount_eligibility_status_check CHECK (status IN ('eligible', 'partially_used', 'fully_used', 'expired'))
);

CREATE INDEX idx_client_discount_eligibility_client ON client_discount_eligibility(client_id);
CREATE INDEX idx_client_discount_eligibility_month ON client_discount_eligibility(eligible_month);
CREATE INDEX idx_client_discount_eligibility_status ON client_discount_eligibility(status);
CREATE INDEX idx_client_discount_eligibility_active ON client_discount_eligibility(client_id, status) 
  WHERE status IN ('eligible', 'partially_used');

-- Table: discount_usage_log
CREATE TABLE discount_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eligibility_id UUID NOT NULL REFERENCES client_discount_eligibility(id),
  order_id UUID,
  invoice_id UUID,
  order_amount NUMERIC(12, 2) NOT NULL,
  discount_amount NUMERIC(12, 2) NOT NULL,
  applied_by UUID REFERENCES profiles(id),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX idx_discount_usage_log_eligibility ON discount_usage_log(eligibility_id);
CREATE INDEX idx_discount_usage_log_order ON discount_usage_log(order_id);

-- RLS Policies
ALTER TABLE loyalty_discount_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_monthly_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_discount_eligibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage loyalty discount rules" ON loyalty_discount_rules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Owner'));

CREATE POLICY "Authenticated users can view active rules" ON loyalty_discount_rules FOR SELECT TO authenticated
  USING (is_active = TRUE AND is_deleted = FALSE);

CREATE POLICY "Owners can manage client monthly purchases" ON client_monthly_purchases FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Owner'));

CREATE POLICY "Authenticated users can view client purchases" ON client_monthly_purchases FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "Owners can manage discount eligibility" ON client_discount_eligibility FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Owner'));

CREATE POLICY "Authenticated users can view eligibility" ON client_discount_eligibility FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "Owners can manage discount usage" ON discount_usage_log FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Owner'));

CREATE POLICY "Authenticated users can log discount usage" ON discount_usage_log FOR INSERT TO authenticated
  WITH CHECK (applied_by = auth.uid());

CREATE POLICY "Authenticated users can view usage logs" ON discount_usage_log FOR SELECT TO authenticated
  USING (TRUE);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_loyalty_tables_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER update_loyalty_discount_rules_updated_at 
  BEFORE UPDATE ON loyalty_discount_rules 
  FOR EACH ROW EXECUTE FUNCTION update_loyalty_tables_updated_at();

CREATE TRIGGER update_client_monthly_purchases_updated_at 
  BEFORE UPDATE ON client_monthly_purchases 
  FOR EACH ROW EXECUTE FUNCTION update_loyalty_tables_updated_at();

-- Function to update client monthly purchase totals
CREATE OR REPLACE FUNCTION update_client_monthly_purchase(
  p_client_id TEXT,
  p_amount NUMERIC,
  p_order_date TIMESTAMPTZ DEFAULT NOW()
) RETURNS void AS $$
DECLARE
  v_year_month TEXT;
BEGIN
  v_year_month := TO_CHAR(p_order_date, 'YYYY-MM');
  
  INSERT INTO client_monthly_purchases (client_id, year_month, total_amount, order_count, last_order_date)
  VALUES (p_client_id, v_year_month, p_amount, 1, p_order_date)
  ON CONFLICT (client_id, year_month)
  DO UPDATE SET 
    total_amount = client_monthly_purchases.total_amount + EXCLUDED.total_amount,
    order_count = client_monthly_purchases.order_count + 1,
    last_order_date = EXCLUDED.last_order_date,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to evaluate client eligibility at month end
CREATE OR REPLACE FUNCTION evaluate_monthly_discount_eligibility() RETURNS void AS $$
DECLARE
  v_last_month TEXT;
  v_this_month TEXT;
  v_month_end TIMESTAMPTZ;
  v_rule RECORD;
  v_purchase RECORD;
BEGIN
  v_last_month := TO_CHAR(NOW() - INTERVAL '1 month', 'YYYY-MM');
  v_this_month := TO_CHAR(NOW(), 'YYYY-MM');
  v_month_end := DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 second';
  
  FOR v_rule IN 
    SELECT * FROM loyalty_discount_rules 
    WHERE is_active = TRUE AND is_deleted = FALSE
    ORDER BY priority DESC
  LOOP
    FOR v_purchase IN
      SELECT client_id, total_amount
      FROM client_monthly_purchases
      WHERE year_month = v_last_month
        AND total_amount >= v_rule.min_purchase_amount
    LOOP
      INSERT INTO client_discount_eligibility (
        client_id, rule_id, eligible_month, qualifying_month,
        qualifying_amount, discount_percentage, expires_at
      )
      VALUES (
        v_purchase.client_id, v_rule.id, v_this_month, v_last_month,
        v_purchase.total_amount, v_rule.discount_percentage, v_month_end
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to get active discount for a client
CREATE OR REPLACE FUNCTION get_client_active_discount(p_client_id TEXT)
RETURNS TABLE (
  eligibility_id UUID,
  discount_percentage NUMERIC,
  qualifying_amount NUMERIC,
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.discount_percentage,
    e.qualifying_amount,
    e.expires_at
  FROM client_discount_eligibility e
  WHERE e.client_id = p_client_id
    AND e.status IN ('eligible', 'partially_used')
    AND e.expires_at > NOW()
  ORDER BY e.discount_percentage DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Seed a default rule
INSERT INTO loyalty_discount_rules (name, description, min_purchase_amount, discount_percentage, priority)
VALUES (
  'Standard Loyalty Discount',
  'Customers who spend ₱30,000 or more in a month receive 5% discount the following month',
  30000,
  5,
  1
);

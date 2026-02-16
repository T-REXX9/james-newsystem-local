-- ============================================================================
-- AI Sales Agent Campaign Outreach Extensions
-- Migration: 042_create_ai_campaign_outreach.sql
-- Note: contacts.id is TEXT, ai_conversations.id is UUID
-- ============================================================================

-- Extend ai_conversations table if it exists (add language and campaign_id)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ai_conversations' AND column_name = 'language') THEN
        ALTER TABLE ai_conversations ADD COLUMN language TEXT DEFAULT 'tagalog';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ai_conversations' AND column_name = 'campaign_id') THEN
        ALTER TABLE ai_conversations ADD COLUMN campaign_id UUID REFERENCES promotions(id);
    END IF;
END $$;

-- Table: ai_campaign_outreach (client_id is TEXT to match contacts.id)
CREATE TABLE IF NOT EXISTS ai_campaign_outreach (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES promotions(id),
  client_id TEXT NOT NULL REFERENCES contacts(id),
  outreach_type TEXT NOT NULL DEFAULT 'sms',
  status TEXT NOT NULL DEFAULT 'pending',
  language TEXT NOT NULL DEFAULT 'tagalog',
  message_content TEXT,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  response_received BOOLEAN DEFAULT FALSE,
  response_content TEXT,
  outcome TEXT,
  conversation_id UUID REFERENCES ai_conversations(id),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_campaign_outreach_type_check CHECK (outreach_type IN ('sms', 'call', 'chat')),
  CONSTRAINT ai_campaign_outreach_status_check CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'responded')),
  CONSTRAINT ai_campaign_outreach_language_check CHECK (language IN ('tagalog', 'english')),
  CONSTRAINT ai_campaign_outreach_outcome_check CHECK (outcome IS NULL OR outcome IN ('interested', 'not_interested', 'no_response', 'converted', 'escalated'))
);

CREATE INDEX idx_ai_campaign_outreach_campaign ON ai_campaign_outreach(campaign_id);
CREATE INDEX idx_ai_campaign_outreach_client ON ai_campaign_outreach(client_id);
CREATE INDEX idx_ai_campaign_outreach_status ON ai_campaign_outreach(status);
CREATE INDEX idx_ai_campaign_outreach_scheduled ON ai_campaign_outreach(scheduled_at) WHERE status = 'pending';

-- Table: ai_campaign_feedback (client_id is TEXT to match contacts.id)
CREATE TABLE IF NOT EXISTS ai_campaign_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES promotions(id),
  outreach_id UUID REFERENCES ai_campaign_outreach(id),
  client_id TEXT REFERENCES contacts(id),
  feedback_type TEXT NOT NULL,
  content TEXT NOT NULL,
  sentiment TEXT,
  tags TEXT[],
  ai_analysis JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_campaign_feedback_type_check CHECK (feedback_type IN ('objection', 'interest', 'question', 'conversion', 'complaint', 'positive')),
  CONSTRAINT ai_campaign_feedback_sentiment_check CHECK (sentiment IS NULL OR sentiment IN ('positive', 'neutral', 'negative'))
);

CREATE INDEX idx_ai_campaign_feedback_campaign ON ai_campaign_feedback(campaign_id);
CREATE INDEX idx_ai_campaign_feedback_outreach ON ai_campaign_feedback(outreach_id);
CREATE INDEX idx_ai_campaign_feedback_type ON ai_campaign_feedback(feedback_type);
CREATE INDEX idx_ai_campaign_feedback_sentiment ON ai_campaign_feedback(sentiment);

-- Table: ai_message_templates
CREATE TABLE IF NOT EXISTS ai_message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'tagalog',
  template_type TEXT NOT NULL,
  content TEXT NOT NULL,
  variables TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_message_templates_language_check CHECK (language IN ('tagalog', 'english'))
);

CREATE INDEX idx_ai_message_templates_language ON ai_message_templates(language);
CREATE INDEX idx_ai_message_templates_type ON ai_message_templates(template_type);

-- RLS Policies
ALTER TABLE ai_campaign_outreach ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_campaign_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage campaign outreach" ON ai_campaign_outreach FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Owner'));

CREATE POLICY "Authenticated users can view campaign outreach" ON ai_campaign_outreach FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "Owners can manage campaign feedback" ON ai_campaign_feedback FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Owner'));

CREATE POLICY "Authenticated users can insert feedback" ON ai_campaign_feedback FOR INSERT TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY "Authenticated users can view feedback" ON ai_campaign_feedback FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "Owners can manage message templates" ON ai_message_templates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Owner'));

CREATE POLICY "Authenticated users can view templates" ON ai_message_templates FOR SELECT TO authenticated
  USING (is_active = TRUE);

-- Triggers
CREATE TRIGGER update_ai_campaign_outreach_updated_at 
  BEFORE UPDATE ON ai_campaign_outreach 
  FOR EACH ROW EXECUTE FUNCTION update_loyalty_tables_updated_at();

CREATE TRIGGER update_ai_message_templates_updated_at 
  BEFORE UPDATE ON ai_message_templates 
  FOR EACH ROW EXECUTE FUNCTION update_loyalty_tables_updated_at();

-- Seed default message templates
INSERT INTO ai_message_templates (name, language, template_type, content, variables) VALUES
('Tagalog Greeting', 'tagalog', 'greeting', 'Magandang araw po, {client_name}! Ito po si {agent_name} mula sa aming kumpanya.', ARRAY['client_name', 'agent_name']),
('Tagalog Promo Intro', 'tagalog', 'promo_intro', 'May magandang balita po kami para sa inyo! Kasalukuyang may promo ang {product_name} na may {discount_percentage}% discount. Gusto niyo po bang malaman ang detalye?', ARRAY['product_name', 'discount_percentage']),
('Tagalog Follow Up', 'tagalog', 'follow_up', 'Kumusta po? Follow up lang po sa aming pinag-usapan tungkol sa {product_name}. May tanong pa po ba kayo?', ARRAY['product_name']),
('Tagalog Closing', 'tagalog', 'closing', 'Maraming salamat po sa inyong oras! Kung may katanungan kayo, tawag o text lang po kayo anytime. Ingat po!', ARRAY[]::TEXT[]),
('English Greeting', 'english', 'greeting', 'Good day, {client_name}! This is {agent_name} from our company.', ARRAY['client_name', 'agent_name']),
('English Promo Intro', 'english', 'promo_intro', 'We have great news for you! {product_name} is currently on promotion with {discount_percentage}% off. Would you like to know more?', ARRAY['product_name', 'discount_percentage']),
('English Follow Up', 'english', 'follow_up', 'Hi there! Just following up on our conversation about {product_name}. Do you have any questions?', ARRAY['product_name']),
('English Closing', 'english', 'closing', 'Thank you for your time! If you have any questions, feel free to call or text us anytime. Take care!', ARRAY[]::TEXT[])
ON CONFLICT DO NOTHING;

-- AI Customer Service Infrastructure Migration
-- Creates tables for AI-powered SMS customer service with Tagalog Standard Answers

-- 1. Standard Answers Table (Tagalog response dataset)
CREATE TABLE IF NOT EXISTS ai_standard_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    trigger_keywords TEXT[] NOT NULL DEFAULT '{}',
    question_template TEXT NOT NULL,
    answer_template TEXT NOT NULL,
    variables JSONB DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    priority INT NOT NULL DEFAULT 0,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. AI Conversations Table (SMS interaction sessions)
CREATE TABLE IF NOT EXISTS ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id TEXT REFERENCES contacts(id),
    phone_number TEXT, -- For new leads not yet in contacts
    channel TEXT NOT NULL DEFAULT 'sms' CHECK (channel = 'sms'),
    purpose TEXT NOT NULL CHECK (purpose IN ('lead_gen', 'inquiry', 'complaint', 'delivery', 'sales')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'escalated', 'abandoned')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_seconds INT,
    outcome TEXT CHECK (outcome IN ('resolved', 'escalated', 'follow_up', 'converted')),
    sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
    summary TEXT,
    assigned_agent_id UUID REFERENCES profiles(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. AI Conversation Messages Table (Individual messages)
CREATE TABLE IF NOT EXISTS ai_conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('customer', 'ai', 'agent')),
    content TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    standard_answer_id UUID REFERENCES ai_standard_answers(id),
    confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1)
);

-- 4. AI Escalations Table (Human handoff queue)
CREATE TABLE IF NOT EXISTS ai_escalations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    reason TEXT NOT NULL CHECK (reason IN ('low_confidence', 'customer_request', 'complex_issue', 'vip_customer')),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
    assigned_to UUID REFERENCES profiles(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_standard_answers_category ON ai_standard_answers(category);
CREATE INDEX IF NOT EXISTS idx_ai_standard_answers_active ON ai_standard_answers(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_ai_conversations_status ON ai_conversations(status);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_contact ON ai_conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_started ON ai_conversations(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_conversation_messages_conv ON ai_conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_escalations_status ON ai_escalations(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_ai_escalations_priority ON ai_escalations(priority, created_at);

-- Updated_at trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS ai_standard_answers_updated_at ON ai_standard_answers;
CREATE TRIGGER ai_standard_answers_updated_at
    BEFORE UPDATE ON ai_standard_answers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS ai_conversations_updated_at ON ai_conversations;
CREATE TRIGGER ai_conversations_updated_at
    BEFORE UPDATE ON ai_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE ai_standard_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_escalations ENABLE ROW LEVEL SECURITY;

-- Standard Answers: readable by all authenticated, writable by owner/manager
CREATE POLICY "ai_standard_answers_select" ON ai_standard_answers
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "ai_standard_answers_insert" ON ai_standard_answers
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('owner', 'manager', 'admin', 'master')
        )
    );

CREATE POLICY "ai_standard_answers_update" ON ai_standard_answers
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('owner', 'manager', 'admin', 'master')
        )
    );

CREATE POLICY "ai_standard_answers_delete" ON ai_standard_answers
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('owner', 'manager', 'admin', 'master')
        )
    );

-- Conversations: readable by all authenticated
CREATE POLICY "ai_conversations_select" ON ai_conversations
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "ai_conversations_insert" ON ai_conversations
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "ai_conversations_update" ON ai_conversations
    FOR UPDATE TO authenticated USING (true);

-- Messages: readable by all authenticated
CREATE POLICY "ai_conversation_messages_select" ON ai_conversation_messages
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "ai_conversation_messages_insert" ON ai_conversation_messages
    FOR INSERT TO authenticated WITH CHECK (true);

-- Escalations: readable by all authenticated
CREATE POLICY "ai_escalations_select" ON ai_escalations
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "ai_escalations_insert" ON ai_escalations
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "ai_escalations_update" ON ai_escalations
    FOR UPDATE TO authenticated USING (true);

-- Grant permissions
GRANT ALL ON ai_standard_answers TO authenticated;
GRANT ALL ON ai_conversations TO authenticated;
GRANT ALL ON ai_conversation_messages TO authenticated;
GRANT ALL ON ai_escalations TO authenticated;

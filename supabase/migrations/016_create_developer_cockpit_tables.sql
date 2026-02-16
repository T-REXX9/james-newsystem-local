-- 016_create_developer_cockpit_tables.sql
-- Creates tables for Developer Cockpit system

-- System Logs table for audit trail
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_type TEXT NOT NULL,
  log_level TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB,
  user_id TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ
);

-- System Metrics table for performance monitoring
CREATE TABLE IF NOT EXISTS system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  metric_value JSONB NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ
);

-- Deployment Records table for tracking deployments
CREATE TABLE IF NOT EXISTS deployment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_type TEXT NOT NULL,
  deployment_version TEXT NOT NULL,
  deployment_description TEXT,
  deployment_status TEXT NOT NULL,
  deployment_start TIMESTAMPTZ NOT NULL,
  deployment_end TIMESTAMPTZ,
  deployment_log TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ
);

-- System Settings table for configuration
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_system_logs_log_type ON system_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_log_level ON system_logs(log_level);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_system_metrics_metric_name ON system_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp);

CREATE INDEX IF NOT EXISTS idx_deployment_records_deployment_type ON deployment_records(deployment_type);
CREATE INDEX IF NOT EXISTS idx_deployment_records_deployment_status ON deployment_records(deployment_status);
CREATE INDEX IF NOT EXISTS idx_deployment_records_deployment_start ON deployment_records(deployment_start);

CREATE INDEX IF NOT EXISTS idx_system_settings_setting_key ON system_settings(setting_key);

-- RLS policies for system_logs
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow developers to view logs" ON system_logs
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('Developer', 'Owner')));

CREATE POLICY "Allow developers to create logs" ON system_logs
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('Developer', 'Owner')));

CREATE POLICY "Allow developers to update logs" ON system_logs
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('Developer', 'Owner')));

CREATE POLICY "Allow developers to delete logs" ON system_logs
  FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('Developer', 'Owner')));

-- RLS policies for system_metrics
ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow developers to view metrics" ON system_metrics
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('Developer', 'Owner')));

CREATE POLICY "Allow developers to create metrics" ON system_metrics
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('Developer', 'Owner')));

CREATE POLICY "Allow developers to update metrics" ON system_metrics
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('Developer', 'Owner')));

CREATE POLICY "Allow developers to delete metrics" ON system_metrics
  FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('Developer', 'Owner')));

-- RLS policies for deployment_records
ALTER TABLE deployment_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow developers to view deployments" ON deployment_records
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('Developer', 'Owner')));

CREATE POLICY "Allow developers to create deployments" ON deployment_records
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('Developer', 'Owner')));

CREATE POLICY "Allow developers to update deployments" ON deployment_records
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('Developer', 'Owner')));

CREATE POLICY "Allow developers to delete deployments" ON deployment_records
  FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('Developer', 'Owner')));

-- RLS policies for system_settings
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow developers to view settings" ON system_settings
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('Developer', 'Owner')));

CREATE POLICY "Allow developers to update settings" ON system_settings
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('Developer', 'Owner')));

CREATE POLICY "Allow developers to delete settings" ON system_settings
  FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('Developer', 'Owner')));

-- Add soft delete trigger for system_logs
CREATE OR REPLACE FUNCTION system_logs_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_deleted = FALSE AND NEW.is_deleted = TRUE THEN
    NEW.deleted_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER system_logs_soft_delete_trigger
BEFORE UPDATE ON system_logs
FOR EACH ROW
EXECUTE FUNCTION system_logs_soft_delete();

-- Add soft delete trigger for system_metrics
CREATE OR REPLACE FUNCTION system_metrics_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_deleted = FALSE AND NEW.is_deleted = TRUE THEN
    NEW.deleted_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER system_metrics_soft_delete_trigger
BEFORE UPDATE ON system_metrics
FOR EACH ROW
EXECUTE FUNCTION system_metrics_soft_delete();

-- Add soft delete trigger for deployment_records
CREATE OR REPLACE FUNCTION deployment_records_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_deleted = FALSE AND NEW.is_deleted = TRUE THEN
    NEW.deleted_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deployment_records_soft_delete_trigger
BEFORE UPDATE ON deployment_records
FOR EACH ROW
EXECUTE FUNCTION deployment_records_soft_delete();

-- Add soft delete trigger for system_settings
CREATE OR REPLACE FUNCTION system_settings_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_deleted = FALSE AND NEW.is_deleted = TRUE THEN
    NEW.deleted_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER system_settings_soft_delete_trigger
BEFORE UPDATE ON system_settings
FOR EACH ROW
EXECUTE FUNCTION system_settings_soft_delete();
-- Phase E — Module 2/3 additive schema (idempotent)

BEGIN;

-- security_scans: Evidence snapshot
ALTER TABLE security_scans ADD COLUMN IF NOT EXISTS verdict varchar(32);
ALTER TABLE security_scans ADD COLUMN IF NOT EXISTS risk_level varchar(16);
ALTER TABLE security_scans ADD COLUMN IF NOT EXISTS confidence integer;
ALTER TABLE security_scans ADD COLUMN IF NOT EXISTS evidence_json jsonb DEFAULT '[]'::jsonb;
ALTER TABLE security_scans ADD COLUMN IF NOT EXISTS dimensions_json jsonb DEFAULT '{}'::jsonb;
ALTER TABLE security_scans ADD COLUMN IF NOT EXISTS ai_analysis_json jsonb DEFAULT '{}'::jsonb;
ALTER TABLE security_scans ADD COLUMN IF NOT EXISTS authorized_by_user boolean NOT NULL DEFAULT false;

-- org_assets
CREATE TABLE IF NOT EXISTS org_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label varchar(120) NOT NULL,
  url text NOT NULL,
  domain varchar(255),
  status varchar(32) NOT NULL DEFAULT 'active',
  last_verdict varchar(32),
  last_risk_level varchar(16),
  last_confidence integer,
  last_checked_at timestamptz,
  last_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS org_assets_user_idx ON org_assets (user_id);
CREATE INDEX IF NOT EXISTS org_assets_domain_idx ON org_assets (domain);

-- org_alerts
CREATE TABLE IF NOT EXISTS org_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES org_assets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  severity varchar(16) NOT NULL DEFAULT 'info',
  title varchar(255) NOT NULL,
  body text,
  status varchar(32) NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS org_alerts_asset_idx ON org_alerts (asset_id);
CREATE INDEX IF NOT EXISTS org_alerts_user_idx ON org_alerts (user_id);
CREATE INDEX IF NOT EXISTS org_alerts_status_idx ON org_alerts (status);

COMMIT;

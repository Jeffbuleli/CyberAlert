-- Cyber Alert RDC — prepare Phase B/C/D schema on VPS
-- Safe additive migration: does not drop data; old app code ignores new columns.
-- Idempotent (IF NOT EXISTS / guarded DO blocks).

BEGIN;

-- ---------------------------------------------------------------------------
-- link_checks: Phase B / C / D columns (additive)
-- ---------------------------------------------------------------------------
ALTER TABLE link_checks ADD COLUMN IF NOT EXISTS verdict varchar(32);
ALTER TABLE link_checks ADD COLUMN IF NOT EXISTS confidence integer;
ALTER TABLE link_checks ADD COLUMN IF NOT EXISTS evidence_json jsonb DEFAULT '[]'::jsonb;
ALTER TABLE link_checks ADD COLUMN IF NOT EXISTS dimensions_json jsonb DEFAULT '{}'::jsonb;
ALTER TABLE link_checks ADD COLUMN IF NOT EXISTS tools_used jsonb DEFAULT '[]'::jsonb;
ALTER TABLE link_checks ADD COLUMN IF NOT EXISTS needs_deep_analysis boolean NOT NULL DEFAULT false;
ALTER TABLE link_checks ADD COLUMN IF NOT EXISTS ai_analysis_json jsonb DEFAULT '{}'::jsonb;
ALTER TABLE link_checks ADD COLUMN IF NOT EXISTS status varchar(32) NOT NULL DEFAULT 'completed';
ALTER TABLE link_checks ADD COLUMN IF NOT EXISTS hackerai_json jsonb DEFAULT '{}'::jsonb;
ALTER TABLE link_checks ADD COLUMN IF NOT EXISTS cache_hit boolean NOT NULL DEFAULT false;
ALTER TABLE link_checks ADD COLUMN IF NOT EXISTS duration_ms integer;

-- ---------------------------------------------------------------------------
-- analysis_cache (Phase D)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analysis_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key varchar(64) NOT NULL,
  normalized_url text NOT NULL,
  domain varchar(255),
  link_check_id uuid REFERENCES link_checks(id) ON DELETE SET NULL,
  risk_level varchar(16) NOT NULL,
  verdict varchar(32),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS analysis_cache_key_uidx ON analysis_cache (cache_key);
CREATE INDEX IF NOT EXISTS analysis_cache_expires_idx ON analysis_cache (expires_at);

-- ---------------------------------------------------------------------------
-- analysis_jobs (Phase D — queue for deep path / future deep-worker)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analysis_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_check_id uuid NOT NULL REFERENCES link_checks(id) ON DELETE CASCADE,
  provider varchar(64) NOT NULL DEFAULT 'hackerai',
  external_job_id varchar(128),
  status varchar(32) NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  input_json jsonb DEFAULT '{}'::jsonb,
  result_json jsonb DEFAULT '{}'::jsonb,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analysis_jobs_link_idx ON analysis_jobs (link_check_id);
CREATE INDEX IF NOT EXISTS analysis_jobs_status_idx ON analysis_jobs (status);

COMMIT;

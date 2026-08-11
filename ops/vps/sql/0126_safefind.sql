-- SafeFind V1 — lost/found identity document restitution (Cyber Alert RDC)

CREATE TABLE IF NOT EXISTS safefind_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(200) NOT NULL,
  type varchar(64) NOT NULL DEFAULT 'commerce',
  address text NOT NULL,
  commune varchar(120) NOT NULL,
  quartier varchar(120),
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  opening_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(32) NOT NULL DEFAULT 'draft',
  verification_status varchar(32) NOT NULL DEFAULT 'none',
  security_score integer NOT NULL DEFAULT 50,
  commission_policy_id uuid,
  phone varchar(32),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS safefind_partners_status_idx ON safefind_partners (status);
CREATE INDEX IF NOT EXISTS safefind_partners_commune_idx ON safefind_partners (commune);

CREATE TABLE IF NOT EXISTS safefind_partner_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES safefind_partners(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role varchar(32) NOT NULL DEFAULT 'partner_agent',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS safefind_partner_agents_partner_user_uidx
  ON safefind_partner_agents (partner_id, user_id);
CREATE INDEX IF NOT EXISTS safefind_partner_agents_user_idx ON safefind_partner_agents (user_id);

CREATE TABLE IF NOT EXISTS safefind_reward_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type varchar(64) NOT NULL,
  base_reward numeric(18, 2) NOT NULL,
  max_bonus numeric(18, 2) NOT NULL DEFAULT 0,
  currency varchar(8) NOT NULL DEFAULT 'CDF',
  active boolean NOT NULL DEFAULT true,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS safefind_reward_policies_type_active_idx
  ON safefind_reward_policies (document_type, active);

CREATE TABLE IF NOT EXISTS safefind_partner_commission_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  deposit_commission numeric(18, 2) NOT NULL DEFAULT 0,
  return_commission numeric(18, 2) NOT NULL DEFAULT 0,
  performance_bonus numeric(18, 2) NOT NULL DEFAULT 0,
  currency varchar(8) NOT NULL DEFAULT 'CDF',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS safefind_config (
  key varchar(64) PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS safefind_case_counters (
  year integer PRIMARY KEY,
  last_seq integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS safefind_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id varchar(32) NOT NULL,
  document_type varchar(64) NOT NULL,
  status varchar(40) NOT NULL DEFAULT 'FOUND',
  holder_first_name varchar(128),
  holder_last_name varchar(128),
  document_number_hash varchar(128),
  document_number_last4 varchar(8),
  visual_notes text,
  appearance_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  media_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  found_commune varchar(120),
  found_quartier varchar(120),
  found_approx_date timestamptz,
  lost_commune varchar(120),
  lost_quartier varchar(120),
  lost_approx_date timestamptz,
  current_partner_id uuid REFERENCES safefind_partners(id) ON DELETE SET NULL,
  initial_finder_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reward_owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  collection_otp_hash varchar(128),
  collection_otp_expires_at timestamptz,
  reward_policy_id uuid REFERENCES safefind_reward_policies(id) ON DELETE SET NULL,
  reward_amount numeric(18, 2),
  reward_currency varchar(8) DEFAULT 'CDF',
  reward_status varchar(32) DEFAULT 'PENDING',
  reward_frozen boolean NOT NULL DEFAULT false,
  match_group_id uuid,
  finder_trust_snapshot integer,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS safefind_cases_public_id_uidx ON safefind_cases (public_id);
CREATE INDEX IF NOT EXISTS safefind_cases_status_idx ON safefind_cases (status);
CREATE INDEX IF NOT EXISTS safefind_cases_doc_type_idx ON safefind_cases (document_type);
CREATE INDEX IF NOT EXISTS safefind_cases_partner_idx ON safefind_cases (current_partner_id);
CREATE INDEX IF NOT EXISTS safefind_cases_finder_idx ON safefind_cases (initial_finder_user_id);
CREATE INDEX IF NOT EXISTS safefind_cases_owner_idx ON safefind_cases (owner_user_id);
CREATE INDEX IF NOT EXISTS safefind_cases_doc_hash_idx ON safefind_cases (document_number_hash);
CREATE INDEX IF NOT EXISTS safefind_cases_match_group_idx ON safefind_cases (match_group_id);

CREATE TABLE IF NOT EXISTS safefind_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES safefind_cases(id) ON DELETE SET NULL,
  kind varchar(32) NOT NULL,
  declarant_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  document_type varchar(64) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  commune varchar(120),
  quartier varchar(120),
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  status varchar(32) NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS safefind_declarations_case_idx ON safefind_declarations (case_id);
CREATE INDEX IF NOT EXISTS safefind_declarations_declarant_idx ON safefind_declarations (declarant_user_id);
CREATE INDEX IF NOT EXISTS safefind_declarations_kind_status_idx ON safefind_declarations (kind, status);

CREATE TABLE IF NOT EXISTS safefind_custody_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES safefind_cases(id) ON DELETE RESTRICT,
  event_type varchar(64) NOT NULL,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_role varchar(40) NOT NULL,
  partner_id uuid REFERENCES safefind_partners(id) ON DELETE SET NULL,
  previous_value jsonb,
  new_value jsonb,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_ref varchar(255),
  event_hash varchar(128),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS safefind_custody_events_case_idx ON safefind_custody_events (case_id, created_at);
CREATE INDEX IF NOT EXISTS safefind_custody_events_partner_idx ON safefind_custody_events (partner_id);
CREATE INDEX IF NOT EXISTS safefind_custody_events_type_idx ON safefind_custody_events (event_type);

CREATE TABLE IF NOT EXISTS safefind_match_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES safefind_cases(id) ON DELETE CASCADE,
  claimant_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  declaration_id uuid REFERENCES safefind_declarations(id) ON DELETE SET NULL,
  match_score integer NOT NULL DEFAULT 0,
  signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(32) NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS safefind_match_candidates_case_idx ON safefind_match_candidates (case_id);
CREATE INDEX IF NOT EXISTS safefind_match_candidates_claimant_idx ON safefind_match_candidates (claimant_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS safefind_match_candidates_case_claimant_uidx
  ON safefind_match_candidates (case_id, claimant_user_id);

CREATE TABLE IF NOT EXISTS safefind_owner_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES safefind_cases(id) ON DELETE CASCADE,
  claimant_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  step varchar(64) NOT NULL,
  challenge jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  passed boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS safefind_owner_verifications_case_idx ON safefind_owner_verifications (case_id);

CREATE TABLE IF NOT EXISTS safefind_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES safefind_cases(id) ON DELETE SET NULL,
  partner_id uuid NOT NULL REFERENCES safefind_partners(id) ON DELETE RESTRICT,
  reported_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  incident_type varchar(64) NOT NULL,
  description text,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  status varchar(32) NOT NULL DEFAULT 'open',
  freeze_rewards boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolution_note text
);
CREATE INDEX IF NOT EXISTS safefind_incidents_partner_idx ON safefind_incidents (partner_id);
CREATE INDEX IF NOT EXISTS safefind_incidents_case_idx ON safefind_incidents (case_id);
CREATE INDEX IF NOT EXISTS safefind_incidents_status_idx ON safefind_incidents (status);

CREATE TABLE IF NOT EXISTS safefind_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES safefind_cases(id) ON DELETE RESTRICT,
  beneficiary_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount numeric(18, 2) NOT NULL,
  currency varchar(8) NOT NULL DEFAULT 'CDF',
  status varchar(32) NOT NULL DEFAULT 'PENDING',
  payout_reference uuid,
  provider_tx_id varchar(128),
  phone_number varchar(32),
  provider varchar(64),
  failure_reason text,
  authorized_at timestamptz,
  paid_at timestamptz,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS safefind_rewards_case_uidx ON safefind_rewards (case_id);
CREATE UNIQUE INDEX IF NOT EXISTS safefind_rewards_payout_ref_uidx ON safefind_rewards (payout_reference);
CREATE INDEX IF NOT EXISTS safefind_rewards_beneficiary_idx ON safefind_rewards (beneficiary_user_id);
CREATE INDEX IF NOT EXISTS safefind_rewards_status_idx ON safefind_rewards (status);

CREATE TABLE IF NOT EXISTS safefind_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES safefind_cases(id) ON DELETE RESTRICT,
  opened_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reason varchar(64) NOT NULL,
  description text,
  status varchar(32) NOT NULL DEFAULT 'open',
  resolution text,
  resolved_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS safefind_disputes_case_idx ON safefind_disputes (case_id);
CREATE INDEX IF NOT EXISTS safefind_disputes_status_idx ON safefind_disputes (status);

CREATE TABLE IF NOT EXISTS safefind_match_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status varchar(32) NOT NULL DEFAULT 'open',
  case_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS safefind_trust_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type varchar(32) NOT NULL,
  subject_id uuid NOT NULL,
  score integer NOT NULL DEFAULT 50,
  components jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS safefind_trust_scores_subject_uidx
  ON safefind_trust_scores (subject_type, subject_id);

CREATE TABLE IF NOT EXISTS safefind_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES safefind_cases(id) ON DELETE SET NULL,
  action varchar(64) NOT NULL,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  resource_type varchar(64),
  resource_id varchar(128),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS safefind_audit_events_case_idx ON safefind_audit_events (case_id, created_at);
CREATE INDEX IF NOT EXISTS safefind_audit_events_action_idx ON safefind_audit_events (action);

CREATE TABLE IF NOT EXISTS safefind_partner_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES safefind_partners(id) ON DELETE RESTRICT,
  case_id uuid REFERENCES safefind_cases(id) ON DELETE SET NULL,
  kind varchar(32) NOT NULL,
  amount numeric(18, 2) NOT NULL,
  currency varchar(8) NOT NULL DEFAULT 'CDF',
  status varchar(32) NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS safefind_partner_commissions_partner_idx ON safefind_partner_commissions (partner_id);

-- Seed default reward policies (idempotent)
INSERT INTO safefind_reward_policies (document_type, base_reward, max_bonus, currency, active)
SELECT v.document_type, v.base_reward, 0, 'CDF', true
FROM (VALUES
  ('carte_electeur', 5000::numeric),
  ('permis_conduire', 10000::numeric),
  ('passeport', 20000::numeric)
) AS v(document_type, base_reward)
WHERE NOT EXISTS (
  SELECT 1 FROM safefind_reward_policies p WHERE p.document_type = v.document_type AND p.active = true
);

INSERT INTO safefind_config (key, value) VALUES
  ('INITIAL_REVIEW_WINDOW_MS', '259200000'::jsonb),
  ('INCIDENT_REVIEW_WINDOW_MS', '604800000'::jsonb),
  ('NEARBY_PARTNER_RADIUS_KM', '8'::jsonb)
ON CONFLICT (key) DO NOTHING;

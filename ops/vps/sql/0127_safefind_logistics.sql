-- SafeFind logistics extension (storage, pickup, delivery, capacity)

ALTER TABLE safefind_partners
  ADD COLUMN IF NOT EXISTS storage_capacity integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS current_storage_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS capacity_status varchar(32) NOT NULL DEFAULT 'AVAILABLE',
  ADD COLUMN IF NOT EXISTS document_types_supported jsonb NOT NULL DEFAULT '["carte_electeur","passeport","permis_conduire"]'::jsonb;

ALTER TABLE safefind_cases
  ADD COLUMN IF NOT EXISTS restitution_mode varchar(40),
  ADD COLUMN IF NOT EXISTS storage_location_id uuid,
  ADD COLUMN IF NOT EXISTS held_by_finder boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sleeve_qr_token varchar(64);

CREATE TABLE IF NOT EXISTS safefind_storage_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES safefind_partners(id) ON DELETE CASCADE,
  code varchar(32) NOT NULL,
  name varchar(120) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS safefind_storage_zones_partner_code_uidx
  ON safefind_storage_zones (partner_id, code);

CREATE TABLE IF NOT EXISTS safefind_storage_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES safefind_partners(id) ON DELETE CASCADE,
  zone_id uuid NOT NULL REFERENCES safefind_storage_zones(id) ON DELETE CASCADE,
  rack_code varchar(32) NOT NULL,
  bin_code varchar(32) NOT NULL,
  position_code varchar(32),
  label varchar(120),
  occupied boolean NOT NULL DEFAULT false,
  case_id uuid REFERENCES safefind_cases(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS safefind_storage_loc_partner_slot_uidx
  ON safefind_storage_locations (partner_id, zone_id, rack_code, bin_code, position_code);
CREATE INDEX IF NOT EXISTS safefind_storage_loc_case_idx ON safefind_storage_locations (case_id);

CREATE TABLE IF NOT EXISTS safefind_storage_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES safefind_cases(id) ON DELETE RESTRICT,
  partner_id uuid NOT NULL REFERENCES safefind_partners(id) ON DELETE RESTRICT,
  from_location_id uuid,
  to_location_id uuid,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reason varchar(64) NOT NULL DEFAULT 'relocate',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS safefind_storage_movements_case_idx
  ON safefind_storage_movements (case_id, created_at);

CREATE TABLE IF NOT EXISTS safefind_pickup_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES safefind_cases(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES safefind_partners(id) ON DELETE RESTRICT,
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  slot_date date NOT NULL,
  slot_start varchar(8) NOT NULL,
  slot_end varchar(8) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'reserved',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS safefind_pickup_res_case_active_uidx ON safefind_pickup_reservations (case_id);
CREATE INDEX IF NOT EXISTS safefind_pickup_res_partner_date_idx
  ON safefind_pickup_reservations (partner_id, slot_date, slot_start);

CREATE TABLE IF NOT EXISTS safefind_delivery_fee_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  fee_amount numeric(18, 2) NOT NULL,
  currency varchar(8) NOT NULL DEFAULT 'CDF',
  commune varchar(120),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS safefind_couriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  display_name varchar(120) NOT NULL,
  phone varchar(32),
  provider varchar(64) NOT NULL DEFAULT 'internal',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS safefind_delivery_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES safefind_cases(id) ON DELETE RESTRICT,
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  partner_id uuid REFERENCES safefind_partners(id) ON DELETE SET NULL,
  courier_id uuid REFERENCES safefind_couriers(id) ON DELETE SET NULL,
  status varchar(40) NOT NULL DEFAULT 'requested',
  destination_commune varchar(120),
  destination_quartier varchar(120),
  destination_address_hash varchar(128),
  destination_address_enc text,
  delivery_fee numeric(18, 2) NOT NULL,
  reward_amount numeric(18, 2),
  currency varchar(8) NOT NULL DEFAULT 'CDF',
  delivery_otp_hash varchar(128),
  delivery_otp_expires_at timestamptz,
  only_verified_owner boolean NOT NULL DEFAULT true,
  provider varchar(64) NOT NULL DEFAULT 'internal',
  failure_reason text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS safefind_delivery_requests_case_uidx ON safefind_delivery_requests (case_id);

CREATE TABLE IF NOT EXISTS safefind_delivery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES safefind_delivery_requests(id) ON DELETE CASCADE,
  event_type varchar(64) NOT NULL,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_role varchar(40) NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS safefind_delivery_events_delivery_idx
  ON safefind_delivery_events (delivery_id, created_at);

INSERT INTO safefind_delivery_fee_policies (name, fee_amount, currency, active)
SELECT 'Kinshasa default', 8000, 'CDF', true
WHERE NOT EXISTS (SELECT 1 FROM safefind_delivery_fee_policies WHERE active = true);

INSERT INTO safefind_config (key, value) VALUES
  ('PICKUP_SLOT_MINUTES', '15'::jsonb),
  ('PICKUP_SLOT_MAX_RESERVATIONS', '2'::jsonb),
  ('CAPACITY_NEAR_PCT', '70'::jsonb),
  ('CAPACITY_FULL_PCT', '90'::jsonb),
  ('SCORE_WEIGHT_DISTANCE', '35'::jsonb),
  ('SCORE_WEIGHT_CAPACITY', '30'::jsonb),
  ('SCORE_WEIGHT_SECURITY', '25'::jsonb),
  ('SCORE_WEIGHT_HOURS', '10'::jsonb),
  ('DEFAULT_DELIVERY_FEE_CDF', '"8000"'::jsonb)
ON CONFLICT (key) DO NOTHING;

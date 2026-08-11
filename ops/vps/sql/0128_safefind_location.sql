-- SafeFind Location Intelligence + logistics polish (orphans/express/zones)

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS safefind_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country varchar(64) NOT NULL DEFAULT 'RDC',
  province varchar(120) NOT NULL DEFAULT 'Kinshasa',
  city varchar(120) NOT NULL DEFAULT 'Kinshasa',
  commune varchar(120),
  quartier varchar(120),
  landmark varchar(200),
  place_id varchar(256),
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  accuracy_meters numeric(12, 2),
  precision varchar(32) NOT NULL DEFAULT 'APPROXIMATE',
  source varchar(32) NOT NULL DEFAULT 'manual_hierarchy',
  label text,
  raw_query text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS safefind_locations_commune_idx ON safefind_locations (commune);
CREATE INDEX IF NOT EXISTS safefind_locations_place_id_idx ON safefind_locations (place_id);
CREATE INDEX IF NOT EXISTS safefind_locations_latlng_idx ON safefind_locations (latitude, longitude);

CREATE TABLE IF NOT EXISTS safefind_geo_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level varchar(32) NOT NULL,
  code varchar(64) NOT NULL,
  name varchar(160) NOT NULL,
  parent_code varchar(64),
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS safefind_geo_areas_level_idx ON safefind_geo_areas (level);
CREATE INDEX IF NOT EXISTS safefind_geo_areas_parent_idx ON safefind_geo_areas (parent_code);

ALTER TABLE safefind_partners
  ADD COLUMN IF NOT EXISTS place_id varchar(256);

ALTER TABLE safefind_cases
  ADD COLUMN IF NOT EXISTS found_location_id uuid,
  ADD COLUMN IF NOT EXISTS lost_location_id uuid;

ALTER TABLE safefind_declarations
  ADD COLUMN IF NOT EXISTS location_id uuid;

ALTER TABLE safefind_storage_zones
  ADD COLUMN IF NOT EXISTS preferred_document_types jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE safefind_pickup_reservations
  ADD COLUMN IF NOT EXISTS express boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prepare_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS prepared_at timestamptz;

-- Seed Kinshasa communes (idempotent by code)
INSERT INTO safefind_geo_areas (level, code, name, parent_code, latitude, longitude)
SELECT v.level, v.code, v.name, v.parent_code, v.lat, v.lng
FROM (VALUES
  ('city', 'KIN', 'Kinshasa', 'CD', -4.325::numeric, 15.312::numeric),
  ('commune', 'KIN-GOMBE', 'Gombe', 'KIN', -4.305::numeric, 15.313::numeric),
  ('commune', 'KIN-NGALIEME', 'Ngaliema', 'KIN', -4.327::numeric, 15.266::numeric),
  ('commune', 'KIN-SELEMBAO', 'Selembao', 'KIN', -4.370::numeric, 15.280::numeric),
  ('commune', 'KIN-LIMETE', 'Limete', 'KIN', -4.350::numeric, 15.350::numeric),
  ('commune', 'KIN-LINGWALA', 'Lingwala', 'KIN', -4.320::numeric, 15.300::numeric),
  ('commune', 'KIN-KALAMU', 'Kalamu', 'KIN', -4.340::numeric, 15.310::numeric),
  ('commune', 'KIN-LEMBA', 'Lemba', 'KIN', -4.390::numeric, 15.320::numeric),
  ('commune', 'KIN-MASINA', 'Masina', 'KIN', -4.370::numeric, 15.400::numeric),
  ('commune', 'KIN-NDJILI', 'Ndjili', 'KIN', -4.400::numeric, 15.380::numeric),
  ('commune', 'KIN-NGABA', 'Ngaba', 'KIN', -4.360::numeric, 15.310::numeric),
  ('commune', 'KIN-KINTAMBO', 'Kintambo', 'KIN', -4.320::numeric, 15.270::numeric),
  ('commune', 'KIN-BANDALUNGWA', 'Bandalungwa', 'KIN', -4.340::numeric, 15.280::numeric)
) AS v(level, code, name, parent_code, lat, lng)
WHERE NOT EXISTS (
  SELECT 1 FROM safefind_geo_areas g WHERE g.code = v.code
);

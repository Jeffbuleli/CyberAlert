CREATE TABLE IF NOT EXISTS safefind_known_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(200) NOT NULL,
  aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
  commune varchar(120),
  quartier varchar(120),
  landmark varchar(200),
  external_place_id varchar(256),
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  label text,
  source varchar(32) NOT NULL DEFAULT 'local_cache',
  verified boolean NOT NULL DEFAULT false,
  hit_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS safefind_known_places_name_idx ON safefind_known_places (name);
CREATE INDEX IF NOT EXISTS safefind_known_places_commune_idx ON safefind_known_places (commune);

-- Seed common Kinshasa landmarks (approx)
INSERT INTO safefind_known_places (name, aliases, commune, landmark, latitude, longitude, label, source, verified, hit_count)
SELECT v.name, v.aliases::jsonb, v.commune, v.landmark, v.lat, v.lng, v.label, 'local_cache', true, 1
FROM (VALUES
  ('Rond-point Ngaba', '["RP Ngaba","Rond Point Ngaba","Ngaba Rond-point"]', 'Ngaba', 'Rond-point Ngaba', -4.360::numeric, 15.310::numeric, 'Rond-point Ngaba, Kinshasa'),
  ('Marché de Selembao', '["Marche Selembao","Selembao marche"]', 'Selembao', 'Marché de Selembao', -4.370::numeric, 15.280::numeric, 'Marché de Selembao, Kinshasa'),
  ('Gombe centre', '["Centre-ville Gombe","Gombe downtown"]', 'Gombe', 'Gombe', -4.305::numeric, 15.313::numeric, 'Gombe, Kinshasa')
) AS v(name, aliases, commune, landmark, lat, lng, label)
WHERE NOT EXISTS (
  SELECT 1 FROM safefind_known_places k WHERE lower(k.name) = lower(v.name)
);

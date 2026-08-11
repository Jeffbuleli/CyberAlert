-- SafeFind operational seed: 3 Kinshasa partner points + storage + agent link
-- Idempotent by partner name.

-- ========== Partners ==========
INSERT INTO safefind_partners (
  name, type, address, commune, quartier,
  latitude, longitude, status, verification_status,
  security_score, storage_capacity, current_storage_count, capacity_status,
  document_types_supported, phone, opening_hours, meta
)
SELECT v.*
FROM (VALUES
  (
    'Point SafeFind Gombe'::varchar,
    'agence'::varchar,
    'Avenue du Commerce, près de la BIC, Gombe'::text,
    'Gombe'::varchar,
    'Centre'::varchar,
    -4.3050000::numeric,
    15.3130000::numeric,
    'active'::varchar,
    'verified'::varchar,
    80::integer,
    200::integer,
    0::integer,
    'AVAILABLE'::varchar,
    '["carte_electeur","passeport","permis_conduire"]'::jsonb,
    '+243810000001'::varchar,
    '{"mon":"08:00-17:00","tue":"08:00-17:00","wed":"08:00-17:00","thu":"08:00-17:00","fri":"08:00-17:00","sat":"09:00-13:00"}'::jsonb,
    '{"seed":true,"code":"SF-GOMBE"}'::jsonb
  ),
  (
    'Point SafeFind Ngaliema',
    'commerce',
    'Avenue de la Libération, Binza, Ngaliema',
    'Ngaliema',
    'Binza',
    -4.3270000,
    15.2660000,
    'active',
    'verified',
    72,
    150,
    0,
    'AVAILABLE',
    '["carte_electeur","passeport","permis_conduire"]'::jsonb,
    '+243810000002',
    '{"mon":"08:00-17:00","tue":"08:00-17:00","wed":"08:00-17:00","thu":"08:00-17:00","fri":"08:00-17:00","sat":"09:00-13:00"}'::jsonb,
    '{"seed":true,"code":"SF-NGALIEME"}'::jsonb
  ),
  (
    'Point SafeFind Selembao',
    'boutique',
    'Marché de Selembao, entrée principale',
    'Selembao',
    'Selembao',
    -4.3700000,
    15.2800000,
    'active',
    'verified',
    65,
    120,
    0,
    'AVAILABLE',
    '["carte_electeur","passeport","permis_conduire"]'::jsonb,
    '+243810000003',
    '{"mon":"08:00-17:00","tue":"08:00-17:00","wed":"08:00-17:00","thu":"08:00-17:00","fri":"08:00-17:00","sat":"08:00-14:00"}'::jsonb,
    '{"seed":true,"code":"SF-SELEMBAO"}'::jsonb
  )
) AS v(
  name, type, address, commune, quartier,
  latitude, longitude, status, verification_status,
  security_score, storage_capacity, current_storage_count, capacity_status,
  document_types_supported, phone, opening_hours, meta
)
WHERE NOT EXISTS (
  SELECT 1 FROM safefind_partners p WHERE p.name = v.name
);

-- ========== Zones A/B/C per partner ==========
INSERT INTO safefind_storage_zones (partner_id, code, name, preferred_document_types, active)
SELECT p.id, z.code, z.name, z.prefs::jsonb, true
FROM safefind_partners p
CROSS JOIN (VALUES
  ('A', 'Zone Cartes electeur', '["carte_electeur"]'),
  ('B', 'Zone Permis', '["permis_conduire"]'),
  ('C', 'Zone Passeports', '["passeport"]')
) AS z(code, name, prefs)
WHERE p.meta->>'seed' = 'true'
  AND NOT EXISTS (
    SELECT 1 FROM safefind_storage_zones s
    WHERE s.partner_id = p.id AND s.code = z.code
  );

-- ========== Storage slots (4 racks x 3 bins x 2 pos = 24 per zone) ==========
INSERT INTO safefind_storage_locations (
  partner_id, zone_id, rack_code, bin_code, position_code, label, occupied
)
SELECT
  z.partner_id,
  z.id,
  r.rack,
  b.bin,
  pos.pos,
  z.code || '-' || r.rack || '-' || b.bin || '-' || pos.pos,
  false
FROM safefind_storage_zones z
JOIN safefind_partners p ON p.id = z.partner_id AND p.meta->>'seed' = 'true'
CROSS JOIN (VALUES ('01'), ('02')) AS r(rack)
CROSS JOIN (VALUES ('01'), ('02'), ('03')) AS b(bin)
CROSS JOIN (VALUES ('01'), ('02')) AS pos(pos)
WHERE NOT EXISTS (
  SELECT 1 FROM safefind_storage_locations l
  WHERE l.partner_id = z.partner_id
    AND l.zone_id = z.id
    AND l.rack_code = r.rack
    AND l.bin_code = b.bin
    AND l.position_code = pos.pos
);

-- ========== Link first admin/developer user as partner_admin on Gombe ==========
INSERT INTO safefind_partner_agents (partner_id, user_id, role, active)
SELECT p.id, u.id, 'partner_admin', true
FROM safefind_partners p
CROSS JOIN LATERAL (
  SELECT id FROM users
  WHERE role IN ('admin', 'developer')
  ORDER BY created_at ASC
  LIMIT 1
) u
WHERE p.name = 'Point SafeFind Gombe'
  AND NOT EXISTS (
    SELECT 1 FROM safefind_partner_agents a
    WHERE a.partner_id = p.id AND a.user_id = u.id
  );

-- Sanity counts
SELECT 'partners' AS kind, count(*)::text AS n FROM safefind_partners WHERE meta->>'seed' = 'true'
UNION ALL
SELECT 'zones', count(*)::text FROM safefind_storage_zones z
  JOIN safefind_partners p ON p.id = z.partner_id WHERE p.meta->>'seed' = 'true'
UNION ALL
SELECT 'slots', count(*)::text FROM safefind_storage_locations l
  JOIN safefind_partners p ON p.id = l.partner_id WHERE p.meta->>'seed' = 'true'
UNION ALL
SELECT 'agents', count(*)::text FROM safefind_partner_agents a
  JOIN safefind_partners p ON p.id = a.partner_id WHERE p.meta->>'seed' = 'true';

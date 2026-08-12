-- SafeFind specimen marketplace listings (Wikipedia samples, privacy-safe public view).
-- Idempotent by public_id.

INSERT INTO safefind_cases (
  public_id, document_type, status,
  holder_first_name, holder_last_name,
  document_number_last4,
  visual_notes, appearance_meta, media_refs,
  found_commune, found_quartier, found_approx_date,
  current_partner_id,
  reward_amount, reward_currency, reward_status,
  held_by_finder, meta
)
SELECT
  v.public_id,
  v.document_type,
  'DEPOSITED_AT_PARTNER',
  v.first_name,
  v.last_name,
  v.last4,
  v.visual_notes,
  v.appearance_meta::jsonb,
  v.media_refs::jsonb,
  v.commune,
  v.quartier,
  v.found_at::timestamptz,
  p.id,
  v.reward_amount::numeric,
  'CDF',
  'PENDING',
  false,
  v.meta::jsonb
FROM (VALUES
  (
    'SF-2026-900001',
    'permis_conduire',
    'Martin',
    'Specimen',
    '6789',
    'Permis RDC (spécimen) - catégories A B C D DE - dépôt Point Gombe',
    '{"birthYear":"1985","categories":"A B C D DE","authority":"MINISTERE DES TRANSPORTS","placeOfBirth":"Kinshasa","color":"jaune"}',
    '[{"kind":"preview","key":"/safefind/specimens/permis-conduire.png","redacted":true}]',
    'Gombe',
    'Centre',
    '2026-08-10T10:00:00Z',
    '25000',
    '{"specimen":true,"previewUrl":"/safefind/specimens/permis-conduire.png","listingSummary":"Permis de conduire retrouvé - titulaire M****** S****** - né(e) 1985 - Point Gombe","source":"wikipedia_specimen"}'
  ),
  (
    'SF-2026-900002',
    'passeport',
    'Anzor',
    'Rashidi',
    'P9X2',
    'Passeport COD (spécimen) - profession artiste - dépôt Point Ngaliema',
    '{"authority":"MINAFFET","placeOfBirth":"Kisangani","cover":"bordeaux"}',
    '[{"kind":"preview","key":"/safefind/specimens/passeport.png","redacted":true}]',
    'Ngaliema',
    'Binza',
    '2026-08-09T15:30:00Z',
    '75000',
    '{"specimen":true,"previewUrl":"/safefind/specimens/passeport.png","listingSummary":"Passeport retrouvé - titulaire A**** R****** - Point Ngaliema","source":"wikipedia_specimen"}'
  ),
  (
    'SF-2026-900003',
    'carte_electeur',
    'Yannick',
    'Ilunga',
    '1856',
    'Carte d''électeur CENI (spécimen) - QR présent - dépôt Point Selembao',
    '{"birthYear":"1995","placeOfBirth":"Mbuji-Mayi","authority":"CENI","color":"bleu"}',
    '[{"kind":"preview","key":"/safefind/specimens/carte-electeur.png","redacted":true}]',
    'Selembao',
    'Selembao',
    '2026-08-08T09:15:00Z',
    '15000',
    '{"specimen":true,"previewUrl":"/safefind/specimens/carte-electeur.png","listingSummary":"Carte d''électeur retrouvée - titulaire Y****** I***** - né(e) 1995 - Point Selembao","source":"wikipedia_specimen"}'
  )
) AS v(
  public_id, document_type, first_name, last_name, last4,
  visual_notes, appearance_meta, media_refs,
  commune, quartier, found_at, reward_amount, meta
)
JOIN safefind_partners p ON (
  (v.public_id = 'SF-2026-900001' AND p.name = 'Point SafeFind Gombe')
  OR (v.public_id = 'SF-2026-900002' AND p.name = 'Point SafeFind Ngaliema')
  OR (v.public_id = 'SF-2026-900003' AND p.name = 'Point SafeFind Selembao')
)
WHERE NOT EXISTS (
  SELECT 1 FROM safefind_cases c WHERE c.public_id = v.public_id
);

-- Bump storage counts lightly for seeded deposits
UPDATE safefind_partners
SET current_storage_count = LEAST(storage_capacity, current_storage_count + 1),
    updated_at = NOW()
WHERE name IN (
  'Point SafeFind Gombe',
  'Point SafeFind Ngaliema',
  'Point SafeFind Selembao'
)
AND EXISTS (SELECT 1 FROM safefind_cases WHERE public_id LIKE 'SF-2026-90000%');

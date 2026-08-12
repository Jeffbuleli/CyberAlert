-- Add classic ZRE-style permis specimen listing (varied AI training model).
-- Run after scripts/seed-safefind-specimen-previews.ts uploads permis-conduire-zre.jpg.

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
    'SF-2026-900004',
    'permis_conduire',
    'Martin',
    'Specimen',
    '6789',
    'Permis RDC modèle ZRE (échantillon) - n° 0123456789 - catégories A B C D DE - MRZ D1COD - Point Ngaliema',
    '{"birthYear":"1985","categories":"A B C D DE","authority":"MINISTERE DES TRANSPORTS","placeOfBirth":"Kinshasa","model":"zre_classic","mrz":"D1COD"}',
    '[{"kind":"preview","key":"https://media.cyberalert-rdc.org/safefind/specimens/permis-conduire-zre.jpg","redacted":true}]',
    'Ngaliema',
    'Binza',
    '2026-08-11T14:00:00Z',
    '25000',
    '{"specimen":true,"previewUrl":"https://media.cyberalert-rdc.org/safefind/specimens/permis-conduire-zre.jpg","listingSummary":"Permis de conduire retrouvé (modèle ZRE) - titulaire M****** S****** - né(e) 1985 - Point Ngaliema","source":"safefind_specimen_r2","documentNumber":"0123456789","permisModel":"zre_classic"}'
  )
) AS v(
  public_id, document_type, first_name, last_name, last4,
  visual_notes, appearance_meta, media_refs,
  commune, quartier, found_at, reward_amount, meta
)
JOIN safefind_partners p ON p.name = 'Point SafeFind Ngaliema'
WHERE NOT EXISTS (
  SELECT 1 FROM safefind_cases c WHERE c.public_id = v.public_id
);

UPDATE safefind_cases
SET
  holder_first_name = 'Martin',
  holder_last_name = 'Specimen',
  document_number_last4 = '6789',
  visual_notes = 'Permis RDC modèle ZRE (échantillon) - n° 0123456789 - catégories A B C D DE - MRZ D1COD - Point Ngaliema',
  appearance_meta = '{"birthYear":"1985","categories":"A B C D DE","authority":"MINISTERE DES TRANSPORTS","placeOfBirth":"Kinshasa","model":"zre_classic","mrz":"D1COD"}'::jsonb,
  media_refs = '[{"kind":"preview","key":"https://media.cyberalert-rdc.org/safefind/specimens/permis-conduire-zre.jpg","redacted":true}]'::jsonb,
  meta = jsonb_build_object(
    'specimen', true,
    'previewUrl', 'https://media.cyberalert-rdc.org/safefind/specimens/permis-conduire-zre.jpg',
    'listingSummary', 'Permis de conduire retrouvé (modèle ZRE) - titulaire M****** S****** - né(e) 1985 - Point Ngaliema',
    'source', 'safefind_specimen_r2',
    'documentNumber', '0123456789',
    'permisModel', 'zre_classic'
  ),
  updated_at = NOW()
WHERE public_id = 'SF-2026-900004';

UPDATE safefind_partners
SET current_storage_count = LEAST(storage_capacity, current_storage_count + 1),
    updated_at = NOW()
WHERE name = 'Point SafeFind Ngaliema'
  AND EXISTS (SELECT 1 FROM safefind_cases WHERE public_id = 'SF-2026-900004');

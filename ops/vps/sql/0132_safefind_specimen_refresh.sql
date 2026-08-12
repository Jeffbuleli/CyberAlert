-- Refresh SafeFind specimen marketplace listings with R2 redacted previews.
-- Run after scripts/seed-safefind-specimen-previews.ts uploads images.

UPDATE safefind_cases
SET
  holder_first_name = 'Patrick',
  holder_last_name = 'Daudi Faraja',
  document_number_last4 = '5356',
  visual_notes = 'Permis biométrique RDC (spécimen) - N° ABC125356 - catégorie B - Point Gombe',
  appearance_meta = '{"birthYear":"1995","categories":"B","authority":"MINISTERE DES TRANSPORTS","placeOfBirth":"Kinshasa","address":"Gombe","color":"jaune"}'::jsonb,
  media_refs = '[{"kind":"preview","key":"https://media.cyberalert-rdc.org/safefind/specimens/permis-conduire.jpg","redacted":true}]'::jsonb,
  meta = jsonb_build_object(
    'specimen', true,
    'previewUrl', 'https://media.cyberalert-rdc.org/safefind/specimens/permis-conduire.jpg',
    'listingSummary', 'Permis de conduire retrouvé - titulaire P****** D**** F***** - né(e) 1995 - Point Gombe',
    'source', 'safefind_specimen_r2',
    'documentNumber', 'ABC125356'
  ),
  updated_at = NOW()
WHERE public_id = 'SF-2026-900001';

UPDATE safefind_cases
SET
  holder_first_name = 'Anzor',
  holder_last_name = 'Rashidi',
  document_number_last4 = '2026',
  visual_notes = 'Passeport biométrique RDC (spécimen) - profession artiste - dépôt Point Ngaliema',
  appearance_meta = '{"birthYear":"1990","authority":"MINAFFET","placeOfBirth":"Kisangani","profession":"ARTISTE","nationality":"CONGOLAISE"}'::jsonb,
  media_refs = '[{"kind":"preview","key":"https://media.cyberalert-rdc.org/safefind/specimens/passeport.jpg","redacted":true}]'::jsonb,
  meta = jsonb_build_object(
    'specimen', true,
    'previewUrl', 'https://media.cyberalert-rdc.org/safefind/specimens/passeport.jpg',
    'listingSummary', 'Passeport retrouvé - titulaire A**** R****** A**** - né(e) 1990 - Point Ngaliema',
    'source', 'safefind_specimen_r2',
    'holderPostName', 'Alema'
  ),
  updated_at = NOW()
WHERE public_id = 'SF-2026-900002';

UPDATE safefind_cases
SET
  holder_first_name = 'Yannick',
  holder_last_name = 'Ilunga',
  document_number_last4 = '4233',
  visual_notes = 'Carte d''électeur CENI (spécimen) - NN 34348154233 - QR présent - Point Selembao',
  appearance_meta = '{"birthYear":"1995","placeOfBirth":"Mbuji-Mayi","authority":"CENI","nn":"34348154233","photoCardNumber":"A28451856","color":"bleu"}'::jsonb,
  media_refs = '[{"kind":"preview","key":"https://media.cyberalert-rdc.org/safefind/specimens/carte-electeur.jpg","redacted":true}]'::jsonb,
  meta = jsonb_build_object(
    'specimen', true,
    'previewUrl', 'https://media.cyberalert-rdc.org/safefind/specimens/carte-electeur.jpg',
    'listingSummary', 'Carte d''électeur retrouvée - titulaire Y****** I***** - NN …4233 - Point Selembao',
    'source', 'safefind_specimen_r2',
    'documentNumber', '34348154233',
    'photoCardNumber', 'A28451856'
  ),
  updated_at = NOW()
WHERE public_id = 'SF-2026-900003';

-- Repair SF-2026-000002: false PARTNER_INCIDENT from same-user re-declaration bug.
-- Cancel orphan empty duplicate SF-2026-000001 (no document hash).

UPDATE safefind_cases
SET
  status = 'DEPOSIT_PENDING',
  held_by_finder = true,
  reward_frozen = false,
  reward_status = 'PENDING',
  meta = meta
    - 'recoveryFinderUserId'
    - 'antifraud'
    - 'aiAnomaly'
    || jsonb_build_object('selfIncidentRepairedAt', to_jsonb(NOW()::text)),
  updated_at = NOW()
WHERE public_id = 'SF-2026-000002'
  AND status = 'PARTNER_INCIDENT'
  AND current_partner_id IS NULL;

UPDATE safefind_cases
SET
  status = 'CANCELLED',
  updated_at = NOW(),
  meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
    'cancelReason', 'orphan_duplicate_no_document_hash',
    'cancelledAt', to_jsonb(NOW()::text)
  )
WHERE public_id = 'SF-2026-000001'
  AND document_number_hash IS NULL
  AND status = 'HELD_BY_FINDER';

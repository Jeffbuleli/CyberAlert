-- Update SafeFind standard reward amounts (CDF).
UPDATE safefind_reward_policies
SET
  base_reward = v.base_reward,
  updated_at = NOW()
FROM (VALUES
  ('carte_electeur', 10000::numeric),
  ('permis_conduire', 20000::numeric),
  ('passeport', 30000::numeric)
) AS v(document_type, base_reward)
WHERE safefind_reward_policies.document_type = v.document_type
  AND safefind_reward_policies.active = true;

-- Align specimen marketplace reward hints with standard policy.
UPDATE safefind_cases
SET reward_amount = 20000, updated_at = NOW()
WHERE public_id = 'SF-2026-900001';

UPDATE safefind_cases
SET reward_amount = 30000, updated_at = NOW()
WHERE public_id = 'SF-2026-900002';

UPDATE safefind_cases
SET reward_amount = 10000, updated_at = NOW()
WHERE public_id = 'SF-2026-900003';

UPDATE safefind_cases
SET reward_amount = 20000, updated_at = NOW()
WHERE public_id = 'SF-2026-900004';

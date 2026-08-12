-- Link all admin/developer users as partner_admin on Point SafeFind Gombe.
-- Idempotent (skips existing links).

INSERT INTO safefind_partner_agents (partner_id, user_id, role, active)
SELECT p.id, u.id, 'partner_admin', true
FROM safefind_partners p
CROSS JOIN users u
WHERE p.name = 'Point SafeFind Gombe'
  AND u.role IN ('admin', 'developer')
  AND NOT EXISTS (
    SELECT 1 FROM safefind_partner_agents a
    WHERE a.partner_id = p.id AND a.user_id = u.id
  );

SELECT 'admin_partner_agents' AS kind, count(*)::text AS n
FROM safefind_partner_agents a
JOIN safefind_partners p ON p.id = a.partner_id AND p.name = 'Point SafeFind Gombe'
JOIN users u ON u.id = a.user_id AND u.role IN ('admin', 'developer');

# Smoke Phase E — Cyber Alert RDC

Run after deploy of Module 2/3. Goal: UNKNOWN ≠ TRUSTED everywhere.

## Automated (local / CI)

```bash
cd /opt/cyberalert   # or local clone
npm test
```

Must cover architecture cas 1–9 (engine + scanner-mapping + HackerAI null).

## Manual / prod checklist

| # | Action | Attendu |
|---|--------|---------|
| 1 | `POST /api/link-checks` `{url:"https://gkffjkfdf.com"}` | `riskLevel/verdict` = unknown (pas low) |
| 2 | Lien domaine officiel seedé | trusted / low seulement avec identité |
| 3 | Lookalike marque | caution/high, pas trusted |
| 4 | HTTPS seul domaine inconnu | unknown |
| 5 | Dashboard scan sans `authorized:true` | 400 authorization_required |
| 6 | Scan URL inconnue avec authorized | `verdict` unknown ; pas badge « low » trompeur |
| 7 | `/dashboard/org` ajouter + Vérifier | lastRiskLevel renseigné ; unknown possible |
| 8 | SSRF `http://127.0.0.1` link-check | blocked / dangerous |
| 9 | HackerAI agent down | deep incomplete ≠ trusted |

## VPS schema

```bash
sudo bash /opt/cyberalert/ops/vps/sql/apply-phase-e-schema.sh
```

## Hors scope

Docker sandbox HackerAI, deep-worker external, pentest offensif.

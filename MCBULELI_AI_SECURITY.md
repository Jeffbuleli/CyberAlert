# McBuleli AI — Sécurité (Cyber Alert RDC)

Phase C : McBuleli AI = **cerveau / analyste**, pas un chatbot libre.

---

## Rôle

Entrée : sortie Evidence Engine + Risk Engine uniquement.

Sortie structurée :

| Champ | Contrainte |
|-------|------------|
| `headline` | 1 ligne |
| `why` | 2–5 puces |
| `advice` | 1 phrase |
| `summary` | 1–2 phrases |
| `needs_deep_analysis` | bool |
| `source_signal_ids` / `source_evidence_ids` | grounded |

Interdit :

- inventer des faits ou sources
- « 100 % sûr »
- conclure `trusted` / `low` sans identité officielle établie par le moteur
- transformer `unknown` en fiable

---

## Pipeline

```
EvidenceEngine → RiskEngine → McBuleliAI.analyzeLinkResult
                            → mergeAiSuggestions (règles dures)
                            → DB + UI
```

Fichiers :

- `src/lib/ai/analyst.ts` — templates, parse, merge
- `src/lib/ai/providers/index.ts` — gateway / OpenAI / fallback
- `services/ai-gateway/main.py` — `/v1/analyze-link` (+ legacy `/v1/explain-link`)

---

## Escalade (`needs_deep_analysis`)

`true` lorsque :

- verdict `unknown`
- usurpation possible (lookalike / brand-in-name)
- identité ou réputation `information_not_established`
- Risk Engine ou AI le demande

HackerAI n’est **pas** appelé en Phase C (Phase D).

---

## Merge AI ↔ moteur

| Situation | Comportement |
|-----------|--------------|
| AI propose `low` sans `exact_official` | forcé → `unknown` |
| AI propose `caution` / `high` | escalade acceptée |
| Gateway / OpenAI down | template grounded, `incomplete=true` |
| SSRF / blocked | reste `high` |

---

## Variables

Voir `.env.example` :

- `AI_GATEWAY_URL` / `AI_GATEWAY_SECRET`
- `OPENAI_API_KEY` / `OPENAI_MODEL` / `OPENAI_EXPLAIN_MODEL`

---

## Tests

```bash
npm test
```

Couvre : unknown ≠ trusted, grounding des ids, escalade, refus d’upgrade vers low.

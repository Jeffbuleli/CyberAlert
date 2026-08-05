# Phase status — Cyber Alert RDC (post VPS organization)

Updated: 2026-08-05

## Original phases A–E

| Phase | Scope | Code (repo local) | Prod VPS app | Notes |
|-------|--------|-------------------|--------------|-------|
| **A** Verdict UNKNOWN | Fix score0→low | ✅ | ❌ not deployed | Prod git still pre–Security Core |
| **B** Security Core / Evidence | Tools + risk | ✅ | ❌ | Schema columns **prepared** on DB |
| **C** McBuleli AI analyst | Structured merge | ✅ | Partial (old AI fields) | Gateway `ai` up |
| **D** HackerAI + cache + async | Adapter + jobs | ✅ in repo | Lab org only | Tables `analysis_*` created; agent unit installed **disabled**; no API invented |
| **E** Modules 2/3 + docs + deploy | Polish + SECURITY | 🟡 partial | 🟡 org done | SECURITY.md + VPS_ORGANIZATION; modules 2/3 + full deploy remain |

## Is it time for the “next” phase?

**Not yet Phase E completion** — and **not yet activating HackerAI Docker sandbox**.

### Do now (still organization / D cutover prep)

1. Put `hsb_…` in `/etc/cyberalert/hackerai.env` → `setup-hackerai-service.sh --enable` (lab Remote control).
2. **Commit + push** Phase A–D code; `deploy.sh` so prod matches Evidence + UNKNOWN + deep fields.
3. Keep `DEEP_WORKER_MODE=inprocess`; leave compose profile `deep` **off**.
4. Keep `HACKERAI_ALLOW_DOCKER_SANDBOX=0` until **≥4 GiB RAM**.

### Then Phase E (true next product phase)

1. Modules 2/3 (app testing / org assets MVP) as scoped in architecture.
2. Security test suite cas 1–9 on **production** after deploy.
3. Final Evidence → Verdict verification.
4. Optional later: external deep-worker + operator runbook; RAM upgrade for local Docker sandbox.

### Verdict

VPS **organization phase = done enough** to enable the agent lab safely.  
**Next meaningful step = deploy Phase A–D code to this VPS** (still before finishing E).  
Phase E proper starts after that deploy is green — not before.

# SECURITY.md — Cyber Alert RDC

Operational security baseline for https://cyberalert-rdc.org (VPS `153.75.235.176`).

---

## 1. Trust model

- **HTTPS ≠ legitimacy.** TLS alone never yields `trusted`.
- **UNKNOWN ≠ SAFE.** Incomplete deep analysis never upgrades to trusted.
- McBuleli AI is grounded on Evidence / Risk Engine output only.
- HackerAI (if used) is an **investigation lab**, not the primary verdict engine.

---

## 2. Network & SSRF

- Public ingress: Nginx → `127.0.0.1:3010` (web), media on separate port.
- Postgres `5433` and AI gateway `8090` are **localhost-bound** only.
- Link checks must refuse loopback / link-local / cloud metadata targets (Security Core gateway).

---

## 3. Secrets

| Item | Rule |
|------|------|
| `ops/vps/.env` | Server only; never commit |
| `/etc/cyberalert/hackerai.env` | `hsb_…` token; mode `640` root:hackerai |
| API responses | No tokens, no raw provider keys |
| Rotation | Regenerating HackerAI Agents token disconnects all local agents |

---

## 4. HackerAI Local Agent

- Runs as system user **`hackerai`** (nologin), systemd unit `hackerai-local.service`.
- **Forbidden:** `--dangerous`, running agent as root, embedding agent in `cyberalert-web` image.
- **Docker sandbox on host:** blocked until RAM gate (≥ ~4 GiB) — see `ops/vps/VPS_ORGANIZATION.md`.
- Prefer recon-only investigations on citizen-submitted URLs (no exploitation).
- Official capability: Remote control from hackerai.co UI — **not** a standalone Cyber Alert API.

---

## 5. Isolation

| Boundary | Practice |
|----------|----------|
| App vs agent | Separate UID + MemoryMax/CPUQuota on agent |
| App vs media | Separate compose projects; monitor RAM contention |
| Deep worker | Optional compose profile `deep`; default off |
| DB | App credentials only inside Docker network |

---

## 6. Logging & incidents

- Prefer journald for `hackerai-local` (`journalctl -u hackerai-local`).
- Redact tokens from logs and support tickets.
- If agent compromised: stop unit, revoke `hsb_` token, rotate, audit `hackerai` home.

---

## 7. Related docs

- `ops/vps/VPS_ORGANIZATION.md` — layout, Fast/Deep, sizing gate  
- `HACKERAI_INTEGRATION.md` — adapter modes  
- `HACKERAI_VPS_FEASIBILITY.md` — audit  
- `MCBULELI_AI_SECURITY.md` — AI grounding  
- `SECURITY_TOOLS.md` — tool contracts  

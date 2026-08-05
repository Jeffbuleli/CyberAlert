# VPS Organization — Cyber Alert RDC + HackerAI (lab)

Date: 2026-08-05  
Host: `153.75.235.176` — Cyber Alert + media (`africa-insight`)  
Companion: `HACKERAI_VPS_FEASIBILITY.md`

This document organizes the VPS **without changing** the functional behaviour of the currently deployed app until Phase D code is deliberately deployed.

---

## 1. Principles

1. No invented HackerAI HTTP API — Local Agent = Remote control for UI Agent Mode only.
2. HackerAI = **separate systemd service** (`hackerai` user), not inside `cyberalert-web`.
3. McBuleli AI (`cyberalert-ai`) remains the product brain for analysis / decision wording.
4. Fast path ≠ Deep path (see §3).
5. HackerAI is **escalation / lab**, not every link check.
6. No `--dangerous`, no root agent, secrets only in `/etc/cyberalert/hackerai.env` or `ops/vps/.env`.
7. `UNKNOWN` / deep `INCOMPLETE` never become `TRUSTED`.
8. Respect **1 vCPU / 1.6 GiB** — Docker sandbox HackerAI gated (see §5).

---

## 2. Process layout (target)

```text
nginx → :3010 cyberalert-web     Fast path (Evidence + McBuleli)
      → media africa-insight

127.0.0.1:8090  cyberalert-ai    McBuleli / OpenAI gateway
127.0.0.1:5433  cyberalert-db    link_checks + analysis_jobs + analysis_cache

systemd (host, optional):
  hackerai-local.service         @hackerai/local — Remote control lab
  cyberalert-deep-worker.service compose profile "deep" — NOT enabled by default
```

| Component | Role | Default on 1.6 GiB |
|-----------|------|--------------------|
| web + ai + db | Product | **On** |
| africa-insight | Media | On (watch RAM) |
| hackerai-local | Lab Remote control | Installed; **enable only with token** |
| deep-worker profile | External queue | **Off** (`DEEP_WORKER_MODE=inprocess` when Phase D ships) |
| HackerAI Docker sandbox | Heavy | **Blocked** until ≥4 GiB (`HACKERAI_ALLOW_DOCKER_SANDBOX=0`) |

---

## 3. Fast Path vs Deep Path

### Fast Path (default every check)

1. Cache lookup (`analysis_cache`) when deployed  
2. SSRF gateway  
3. Evidence Engine (DNS / TLS / HTTP / identity / …)  
4. Risk Engine  
5. **McBuleli AI** (short timeout)  
6. Verdict — often `unknown` without legitimacy proof  
7. Return immediately  

HackerAI is **not** called.

### Deep Path (selective)

Trigger: `needs_deep_analysis` (ambiguous identity, strong suspicion, insufficient evidence).

1. Insert `analysis_jobs` (`queued`)  
2. Client polls — UI stays usable  
3. Worker (`inprocess` today / `external` later) runs adapter  
4. With real HackerAI: status `awaiting_local_agent` / operator lab via UI + VPS agent  
5. Optional 2nd McBuleli pass on artefacts  
6. Finalize — incomplete ≠ trusted  

---

## 4. Ops commands (organization)

```bash
# A. Prepare DB tables/columns (additive, safe for old app)
sudo bash /opt/cyberalert/ops/vps/sql/apply-prepare-schema.sh

# B. Install HackerAI as separate service (disabled until token)
sudo bash /opt/cyberalert/ops/vps/hackerai/setup-hackerai-service.sh
sudo nano /etc/cyberalert/hackerai.env   # HACKERAI_API_KEY=hsb_…
sudo bash /opt/cyberalert/ops/vps/hackerai/setup-hackerai-service.sh --enable

# C. Status
sudo bash /opt/cyberalert/ops/vps/hackerai/setup-hackerai-service.sh --status

# D. Deep-worker — DO NOT enable until Phase D app deployed + RAM plan
# docker compose --profile deep up -d deep-worker
# DEEP_WORKER_MODE=external in ops/vps/.env
```

---

## 5. RAM / Docker sandbox gate (precise)

**Measured host:** 1 vCPU, **1.6 GiB** RAM, ~775 MiB available, swap already in use; africa-insight ~280 MiB.

| Action | Allowed now? | Prerequisite |
|--------|--------------|--------------|
| `hackerai-local` CLI idle / Remote control using **cloud** sandbox in UI | Yes (tight) | Token + MemoryMax=256M unit |
| Agent commands with **local Docker sandbox** | **No** | **≥ 4 GiB RAM** (recommend 2 vCPU / 4 GiB) **or** move africa-insight off-box + still prefer ≥3.5 GiB |
| `HACKERAI_ALLOW_DOCKER_SANDBOX=1` | Blocked by setup script if MemTotal &lt; 3500 MiB | Upgrade first |
| `--dangerous` | **Forbidden** | Never |
| External deep-worker + web | Prefer after Phase D deploy | Concurrency 1; still light |

**What to improve before Docker sandbox HackerAI:**

1. Upgrade VPS to **≥ 4 GiB RAM** (primary), ideally 2 vCPU.  
2. Or migrate `africa-insight` to another host to free ~280 MiB + reduce blast radius (still insufficient alone for comfortable Kali-like sandbox).  
3. Keep Cyber Alert product path independent of HackerAI availability.

---

## 6. Secrets

| Secret | Location |
|--------|----------|
| App / DB / OpenAI / PawaPay | `/opt/cyberalert/ops/vps/.env` |
| HackerAI agent token | `/etc/cyberalert/hackerai.env` (root:hackerai 640) |
| Never | git, front-end, Africa Insight env |

---

## 7. Schema prep vs app deploy

| Step | Effect on live site |
|------|---------------------|
| `001_prepare_phase_bcd_schema.sql` | Additive columns + empty queue/cache tables — **old app keeps working** |
| Deploy Phase D+ code from GitHub | Activates Evidence / deep fields — separate deliberate deploy |
| Enable `hackerai-local` | Lab only — **no change** to link-check API contract |
| `DEEP_WORKER_MODE=external` + profile deep | Only after intentional cutover |

---

## 8. Phase A–E readiness (see also § bilan)

Organization on VPS is a **bridge** between Phase D (code) and Phase E (modules + polish + full deploy).  
Completing §4 A+B does **not** finish Phase E.

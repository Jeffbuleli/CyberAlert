# HackerAI Integration — Cyber Alert RDC

Phase D. Déploiement : **GitHub → VPS `153.75.235.176`** (pas Render).

---

## Constat officiel

Documentation HackerAI (help.hackerai.co) :

- Les plans Pro/Pro+/Ultra indiquent : **Standalone API access is not included.**
- Le mécanisme officiel pour automatiser côté machine est le **token Agents** (`hsb_…`) + client **`@hackerai/local`**.

Cyber Alert **n’invente pas** d’endpoint cloud HackerAI.

---

## Adapter

`src/lib/security-core/hackerai/`

| Mode | Condition | Comportement |
|------|-----------|--------------|
| `disabled` | pas de clé / `HACKERAI_ENABLED=false` | `NullHackerAIAdapter` → `unavailable`, **jamais trusted** |
| `agent_token` | `HACKERAI_API_KEY` (ou token extrait de `HACKERAI_QUICKSTART_TOKEN`) | Job + brief agent ; statut `awaiting_local_agent` |
| `http_bridge` | `HACKERAI_API_URL` + clé **explicitement** fournis | POST vers **votre** pont (pas une API inventée) |

---

## Variables (VPS `/opt/cyberalert/ops/vps/.env`)

```bash
HACKERAI_ENABLED=true
HACKERAI_MODE=agent_token
HACKERAI_API_KEY=hsb_…          # Settings → Agents → token
HACKERAI_QUICKSTART_TOKEN=npx @hackerai/local@latest --token hsb_…
HACKERAI_API_URL=               # laisser vide sauf pont custom
ANALYSIS_CACHE_TTL_HOURS=24
SECURITY_SCAN_PROVIDER=internal
```

Les secrets viennent du `.env` McBuleli (lignes `HACKERAI_QUICKSTART_TOKEN` / `HACKERAI_API_KEY`) — à recopier sur le VPS Cyber Alert, **jamais** committer.

---

## Agent local sur le VPS (officiel)

Organisation recommandée : **`ops/vps/VPS_ORGANIZATION.md`** + unit systemd `hackerai-local` (user `hackerai`, pas `--dangerous`).

Sur `153.75.235.176`, l’app tourne en **Docker** ; Node/`npx` sur l’hôte servent uniquement l’agent lab.

### 1. Installer le service (sans activer le sandbox Docker sur 1.6 Go)

```bash
sudo bash /opt/cyberalert/ops/vps/hackerai/setup-hackerai-service.sh
sudo nano /etc/cyberalert/hackerai.env   # HACKERAI_API_KEY=hsb_…
sudo bash /opt/cyberalert/ops/vps/hackerai/setup-hackerai-service.sh --enable
```

Équivalent manuel (foreground, déconseillé en prod) :

```bash
# Préférer Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
npx --yes @hackerai/local@latest --token "$HACKERAI_API_KEY" --name cyberalert-vps
```

### 2. Dans l’UI HackerAI

Sélectionner la machine VPS comme environnement **Local / Remote control**.

Ne pas lancer l’agent avec `--dangerous` sur le host de prod.  
Docker sandbox local : seulement après upgrade RAM (≥4 GiB) — gate `HACKERAI_ALLOW_DOCKER_SANDBOX`.

---

## Flux async

```
POST /api/link-checks
  → fast path (Evidence + McBuleli)
  → si needs_deep_analysis : analysis_jobs + status deep_analysis
  → worker processDeepJob (fire-and-forget)
  → HackerAIAdapter
  → update link_checks (incomplete ≠ trusted)

GET /api/link-checks/:id  → poll status / hackerai / jobs
```

Cache : table `analysis_cache` (TTL configurable).

---

## Règles

- HackerAI fail / timeout / awaiting agent → **UNKNOWN / incomplete**, jamais `safe`/`trusted`
- Token présent ≠ scan cloud automatique magique
- Exploitations / tests destructifs interdits par défaut

---

## Tests

```bash
npm test
```

Couvre : null adapter, agent_token, extract quickstart token.

# HACKERAI_VPS_FEASIBILITY.md

**Cyber Alert RDC — Faisabilité HackerAI Local Agent sur VPS**  
Date d’audit : 2026-08-05  
Périmètre : exploration uniquement — **aucune modification de production** dans cette mission.  
Hôte : `153.75.235.176` (`vps3537083.trouble-free.net`) — dédié Cyber Alert + media (`africa-insight`).

---

## 0. Résumé exécutif

| Question | Verdict |
|----------|---------|
| Installer `@hackerai/local` sur le VPS comme sur un PC ? | **Oui** (Node 20 déjà présent) |
| Connecter le VPS au compte HackerAI Pro ? | **Oui** (token Agents `hsb_…` + machine visible en Remote control) |
| Faire de HackerAI un moteur d’investigation **autonome** appelé par Cyber Alert ? | **Non** — pas d’API standalone (doc Pro officielle) |
| Faire tourner HackerAI comme **lab distant** pour un analyste humain ? | **Oui**, avec garde-fous ressources |
| Queue / workers Cyber Alert autour de HackerAI ? | **Oui pour Cyber Alert** ; **non pour piloter HackerAI en API** |
| Isolation propre du reste de la stack ? | **Possible** (systemd + Docker sandbox + least privilege) — **contrainte forte : RAM** |
| Pipeline complet Cyber Alert → HackerAI → McBuleli auto ? | **Partiel seulement** : Evidence + McBuleli déjà ; HackerAI = étape humaine ou pont custom |

**Position recommandée :** traiter le VPS comme *environnement d’exécution distant HackerAI* (lab analyste), pas comme backend API. Organiser queue/workers pour le deep path Cyber Alert, avec HackerAI en *outil assisté*, puis McBuleli pour reformuler le verdict.

---

## 1. État actuel audit (faits)

### 1.1 VPS (mesuré 2026-08-05)

| Ressource | Valeur |
|-----------|--------|
| CPU | **1** vCPU |
| RAM | **1,6 GiB** total (~783 MiB available) |
| Swap | **4 GiB** (déjà ~715 MiB utilisés) |
| Disque `/` | 38 G (14 G used, ~22 G free) |
| Load | faible (~0.1–0.2) |
| OS | Ubuntu (kernel 7.0.0-28-generic) |
| Docker / Nginx | actifs |

**Conteneurs :**

| Nom | RAM observée | Rôle |
|-----|--------------|------|
| `cyberalert-web-1` | ~87 MiB | Next.js app |
| `cyberalert-ai-1` | ~8 MiB | AI gateway (McBuleli / OpenAI) |
| `cyberalert-db-1` | ~24 MiB | Postgres 16 |
| `africa-insight-web-1` | ~279 MiB | Media (co-hébergé) |

**HackerAI sur l’hôte :**

- Node `v20.20.2` + `npx` installés
- **Aucun** process `@hackerai/local` en cours
- **Aucun** unit systemd `*hacker*`
- Variables `HACKERAI_*` : **0** dans `/opt/cyberalert/ops/vps/.env`
- Script repo `ops/vps/install-hackerai-agent.sh` prévu, pas encore opérationnalisé en service

### 1.2 Projet Cyber Alert (code / docs)

Déjà en place (repo, hors déploiement complet VPS) :

- Adapter `HackerAIAdapter` : `disabled` | `agent_token` | `http_bridge`
- Mode `agent_token` → job + brief, statut `awaiting_local_agent`, **sans appel HTTP HackerAI inventé**
- `enqueueDeepAnalysis` / `processDeepJob` (fire-and-forget **dans le process web**)
- Schéma Drizzle : `analysis_jobs`, `analysis_cache`
- McBuleli AI via gateway `ai:8090` + règles de merge (jamais TRUSTED sans preuve)
- Docs : `HACKERAI_INTEGRATION.md`, `CYBER_ALERT_ARCHITECTURE.md`

**Écart prod DB :** tables listées sur Postgres VPS **ne contiennent pas** `analysis_jobs` ni `analysis_cache` (migration Phase D non poussée). Deep path async non opérationnel en base.

### 1.3 Compte HackerAI (capacités officielles vérifiées)

Sources : [What is HackerAI Pro?](https://help.hackerai.co/en/articles/12141250-what-is-hackerai-pro), [Connecting a Local Machine](https://help.hackerai.co/en/articles/12961920-connecting-a-hackerai-agent-to-your-local-machine), package `@hackerai/local`.

| Capacité | Disponible ? |
|----------|--------------|
| Chat / Agent Mode (UI) | Oui (Pro) |
| Crédits usage (~$25/mois Pro) | Oui |
| Sandbox cloud Agent | Oui (paid) |
| **Standalone API** | **Non** (« not included ») |
| Token Agents `hsb_…` | Oui |
| Client `@hackerai/local` (CLI) | Oui — Remote control |
| App Desktop Local | Oui (PC) |
| Mode Docker sandbox (CLI) | Oui (si Docker + image) |
| Mode `--dangerous` (host direct) | Oui — **déconseillé** sur VPS prod |
| Déclenchement programmatique « analyse URL X » depuis Cyber Alert | **Non documenté / non fourni** |
| Timeout inactivité client local | ~**1 h** sans activité → déconnexion |
| Exécution commandes | Orientée **session chat** ; client local exécute les commandes poussées par HackerAI |

Le PC local qui marche déjà = même mécanisme ; le VPS serait une **2ᵉ machine Remote control** du même compte.

---

## 2. Ce qui est possible

1. **Installer et laisser tourner** `@hackerai/local` sur le VPS (systemd/tmux), token Agents.
2. **Voir le VPS** dans hackerai.co → sandbox selector → Remote control.
3. Depuis l’UI Agent : lancer de la **recon non destructive** (dig, curl, openssl, whois…) **depuis le réseau du VPS**.
4. Utiliser le VPS comme **lab d’investigation distant** pour cas `needs_deep_analysis` / UNKNOWN difficiles.
5. Côté Cyber Alert : **queue jobs** (`analysis_jobs`), workers séparés, cache, poll UI — **indépendamment** de HackerAI.
6. **McBuleli / OpenAI** déjà sur le VPS (`cyberalert-ai`) : reformuler Evidence (+ notes analyste / sortie HackerAI collée) en verdict FR.
7. Pont **maison** (`HACKERAI_API_URL` → service interne) si un jour un opérateur / bot pousse résultats vers Cyber Alert — ce n’est **pas** l’API HackerAI.
8. Isolation relative : user Linux dédié, Docker mode pour commandes agent, volumes logs séparés, token hors git.

---

## 3. Ce qui n’est pas possible (sans inventer d’API)

1. Cyber Alert **n’appelle pas** HackerAI Cloud pour chaque URL (pas d’endpoint public).
2. Agent local **≠** worker job queue consommé par Next.js : flux = UI HackerAI → commandes → machine.
3. **Autonomie produit** « deep path termine seul via HackerAI » : non, sauf pont custom + intervention (humaine ou bot UI non officiel).
4. **Paralléliser massivement** des pentests HackerAI sur ce VPS 1 vCPU / 1,6 Go : irréaliste (concurrence + RAM).
5. Remplacer Evidence Engine / McBuleli par HackerAI pour le parcours citoyen.
6. Garantir agent 24/7 sans supervision : inactivity ~1 h, reconnect, token regen = déconnexions.

---

## 4. Architecture recommandée (cible, sans implémenter maintenant)

```text
[Citoyen / UI Cyber Alert]
            │
            ▼
   Security Orchestrator (web)
     • SSRF gateway
     • Evidence Engine (DNS/TLS/HTTP/identity/…)
     • Risk Engine
     • McBuleli AI (fast, timeout court)
            │
            ├─ needs_deep=false → Verdict immédiat
            │
            └─ needs_deep=true
                    │
                    ▼
            Job Queue (Postgres analysis_jobs)
                    │
                    ▼
            Deep Worker (process séparé, pas le request HTTP)
                    │
                    ├─ (A) Mode lab humain [recommandé phase 1]
                    │     job → status awaiting_operator
                    │     brief dans admin / email / Slack
                    │     analyste ouvre HackerAI UI → Remote = VPS
                    │     colle brief → recon passive
                    │     soumet notes → API interne completeJob
                    │
                    └─ (B) Mode pont custom [phase 2 optionnelle]
                          worker → HTTP bridge interne
                          (pas HackerAI API) → stocke artefacts
                    │
                    ▼
            McBuleli AI (re-analyse structurée)
                    │
                    ▼
            Risk Engine (règles dures) → Verdict / Rapport
            (incomplete ≠ trusted)
```

**Rôle de HackerAI Local Agent :** *environnement d’exécution* pour l’Agent Mode du compte Pro, pas le cœur du verdict.

**Rôle de McBuleli :** analyste produit (FR, grounded, merge sûr) — fast path + relecture deep.

---

## 5. Processus / containers recommandés

### 5.1 Stack actuelle (garder)

| Unité | Comment |
|-------|---------|
| `cyberalert-web` | App publique |
| `cyberalert-ai` | Gateway OpenAI / McBuleli |
| `cyberalert-db` | Queue + cache + link_checks |
| `africa-insight-web` | Media — **surveiller RAM** |

### 5.2 Ajouts recommandés (organisation VPS)

| Composant | Forme | Notes |
|-----------|-------|-------|
| `hackerai-local.service` | **systemd** (user `hackerai`) | `npx @hackerai/local --token … --name cyberalert-vps` ; Restart=on-failure ; **pas** `--dangerous` |
| Sandbox Docker HackerAI | Conteneur éphémère géré par le CLI | Préférer Docker mode ; image Kali-like = **lourde** |
| `cyberalert-deep-worker` | Container ou systemd Node | Consomme `analysis_jobs` ; **séparé** du web (aujourd’hui fire-and-forget in-process) |
| Logs | journald + `/var/log/cyberalert/hackerai/` | Rotation ; pas de token dans les logs |

**Ne pas** embarquer `@hackerai/local` **dans** l’image `cyberalert-web` (blast radius + secrets + cycle de vie différent).

### 5.3 Connexion compte

1. Settings → Agents → token `hsb_…` (même famille que PC).
2. Stocker **uniquement** dans `/opt/cyberalert/ops/vps/.env` (chmod 600) ou fichier `/etc/cyberalert/hackerai.env` lu par systemd.
3. Lancer l’agent → UI HackerAI : sélectionner machine `cyberalert-vps`.
4. PC local et VPS peuvent coexister ; choisir explicitement la cible dans le selector.

---

## 6. Besoins CPU / RAM / disque

### 6.1 Budget actuel (critique)

Avec ~1,6 Go et déjà ~400 MiB conteneurs + cache + swap utilisé :

| Charge | Estimation | Faisable ? |
|--------|------------|------------|
| Agent CLI idle (heartbeat) | ~50–150 MiB | Oui, serré |
| Session Agent + Docker sandbox | **souvent 500 MiB–2 Go+** | **Risqué** sur 1,6 Go |
| Scans lourds (nmap massif, browser) | CPU saturé + OOM | Non recommandé |
| Deep worker léger (Node) | ~50–100 MiB | Oui |

### 6.2 Recommandations sizing

| Scénario | Spec mini |
|----------|-----------|
| Lab occasionnel (UI HackerAI, recon légère) | **2 vCPU / 4 Go RAM** (idéal) ; 1,6 Go = essais prudents seulement |
| Queue Cyber Alert + worker sans HackerAI Docker | OK sur machine actuelle si media surveillé |
| Isolation Docker HackerAI confortable + media | **4 Go RAM** minimum recommandé |
| Disque | +5–15 Go pour images sandbox ; 22 Go free = OK court terme |

**Action infra avant scale HackerAI :** upgrader RAM (priorité) ou migrer `africa-insight` ailleurs pour libérer ~280 MiB + headroom.

---

## 7. Gestion des workers

### 7.1 Aujourd’hui (code)

- `void processDeepJob(...)` dans le process web → pas de concurrence contrôlée, pas de retry robuste, pas d’isolement crash.

### 7.2 Cible

1. Table `analysis_jobs` (déjà conçue) : `queued` → `running` → `awaiting_local_agent` | `awaiting_operator` | `completed` | `failed` | `unavailable`.
2. Worker dédié (1 instance au départ) avec :
   - `SELECT … FOR UPDATE SKIP LOCKED` (ou équivalent)
   - `attempts`, backoff, **timeout job** (ex. 15–30 min puis `incomplete`)
   - concurrency = **1** sur ce VPS
3. Ne jamais bloquer `POST /api/link-checks` : enqueue + poll.
4. HackerAI n’est **pas** le worker ; le worker orchestre états + McBuleli + finalisation.

---

## 8. Gestion de la queue

| Élément | Proposition |
|---------|-------------|
| Broker | **Postgres** (`analysis_jobs`) — déjà aligné stack ; pas besoin Redis tout de suite |
| Cache | `analysis_cache` TTL 24 h (env) |
| Priorité | simple FIFO ; plus tard : `priority` pour admin / marques watchlist |
| Multi-tâches HackerAI | **1 investigation active** guidée UI ; file Cyber Alert peut accumuler des briefs |
| Non-blocage app | Fast path synchrone court ; deep path async + UI poll (déjà amorcé) |
| Idempotence | clé cache URL normalisée ; un job deep par `link_check_id` actif |

---

## 9. Sécurité

| Sujet | Règle |
|-------|-------|
| Token `hsb_…` | Hors git ; `.env` root-only ; pas dans logs / UI publique |
| Régénération token | Déconnecte les agents — procédure documentée |
| `--dangerous` | **Interdit** sur VPS partagé prod |
| Docker sandbox | Préféré ; capabilities réseau = surface d’attaque |
| Cible d’investigation | URLs citoyennes = **recon passive seulement** ; pas d’exploit / fuzz agressif |
| Isolation user | `useradd hackerai` ; pas root ; pas accès secrets Postgres / SESSION_SECRET |
| Réseau | Agent sortant vers HackerAI cloud ; pas d’exposition port agent public |
| SSRF | Gateway Cyber Alert reste le garde-fou pour l’app ; HackerAI hors bande ne doit pas scanner RFC1918 internes sans allowlist |
| Co-hébergement media | Compromission agent Docker ≠ accès DB cyberalert (séparer volumes / users) |

---

## 10. Intégration McBuleli AI / OpenAI

Flux propre :

1. **Fast :** Evidence → McBuleli (gateway `8090`) → verdict.
2. **Deep lab :** artefacts HackerAI (notes, commandes, findings) → normalisés JSON interne → **2ᵉ passe McBuleli** (prompt « analyste grounded ») → Risk Engine.
3. McBuleli **ne doit pas** upgrader vers `trusted` sans identité officielle (règles déjà dans `mergeAiSuggestions`).
4. OpenAI reste derrière `AI_GATEWAY_SECRET` ; HackerAI crédits Pro = usage UI séparé (pas le même pipe).

HackerAI et McBuleli sont **complémentaires** : HackerAI = bras / outils ; McBuleli = cerveau produit Cyber Alert.

---

## 11. Limites HackerAI (à assumer produit)

- Pas d’API standalone.
- Pilotage par **chat Agent** + machine connectée.
- Crédits mensuels Pro consommés à chaque session.
- Client local : déconnexion inactivity ~1 h ; besoin Restart systemd + monitoring.
- Exécution plutôt **séquentielle** côté sandbox local.
- Pas conçu pour « 100 checks/min deep HackerAI ».
- Qualité dépend du modèle / crédits et de la discipline (recon only).

---

## 12. Risques

| Risque | Impact | Mitigation |
|--------|--------|------------|
| OOM / swap thrash (1,6 Go + sandbox) | App + media down | Upgrade RAM ; limiter Docker ; pas de scans lourds |
| Agent root / `--dangerous` | Compromission hôte | User dédié + Docker mode |
| Confusion « token = API » | Fausse autonomie / confiance UI | Garder `awaiting_*` + incomplete ≠ trusted |
| Pentest offensif sur URL citoyenne | Légal / réputation | Policy + prompts + allowlist |
| Token dans mauvais `.env` (McBuleli vs Cyber Alert) | Fuite / mélange projets | Secrets uniquement `ops/vps/.env` Cyber Alert |
| Tables deep non migrées | Jobs silencieux / erreurs | `db:push` contrôlé avant activation |
| africa-insight + HackerAI | Contention RAM | Monitoring ; éventuelle séparation VPS |

---

## 13. Proposition d’organisation propre du VPS

```text
/opt/cyberalert/          # app GitHub → deploy.sh
  ops/vps/.env            # secrets app + (plus tard) HACKERAI_*
/opt/africa-insight/      # media (existant)
/var/lib/hackerai/        # état local agent (si besoin)
/var/log/cyberalert/      # logs app / worker / hackerai
/etc/systemd/system/
  hackerai-local.service
  cyberalert-deep-worker.service   # phase ultérieure
```

**Ordre d’organisation suggéré (sans coder maintenant) :**

1. **Infra** — Décider upgrade RAM **ou** alléger media ; sinon HackerAI Docker reste expérimental.
2. **Secrets** — Ajouter `HACKERAI_*` uniquement sur VPS (pas commit) ; rotation documentée.
3. **systemd agent** — Service stable, logs journald, `--name cyberalert-vps`, Docker mode.
4. **DB** — Migrer `analysis_jobs` / `analysis_cache` quand on active le deep path.
5. **Worker séparé** — Extraire le fire-and-forget hors du process web.
6. **Runbook analyste** — Brief standard + Remote = VPS + recon passive + saisie résultat.
7. **McBuleli 2ᵉ passe** — Quand notes deep disponibles.
8. **Pont HTTP interne** — Seulement si le runbook manuel devient un goulot.

---

## 14. Mapping des 10 points de la mission

| # | Sujet | Conclusion |
|---|-------|------------|
| 1 | Install / run Local Agent VPS | Possible ; Node prêt ; script repo existant ; systemd à prévoir |
| 2 | Connexion compte | Token Agents + selector Remote control |
| 3 | Agent investigation distant | Oui via UI Agent sur machine VPS |
| 4 | Multi-tâches sans bloquer l’app | Queue Cyber Alert oui ; HackerAI = 1 session UI, pas N API calls |
| 5 | Workers / queue autour de HackerAI | Queue autour du **produit** oui ; autour d’une API HackerAI inexistante non |
| 6 | Isolation | systemd user + Docker ; hors image web |
| 7 | Process / logs / timeouts / longues tâches | systemd + job TTL + poll UI ; inactivity agent 1 h |
| 8 | Token sécurisé | `.env` / fichier root ; jamais front |
| 9 | McBuleli / OpenAI | Gateway déjà là ; 2ᵉ passe sur artefacts deep |
| 10 | Chaîne Orchestrator → Queue → HackerAI → McBuleli → Verdict | Cible valide si HackerAI = lab/opérateur, pas magie API |

---

## 15. Décision proposée

**Phase lab (maintenant / prochain) :** organiser le VPS pour HackerAI Remote control + runbook analyste ; ne pas promettre d’autonomie deep.

**Phase produit deep :** activer queue Postgres + worker + McBuleli ; HackerAI reste escalade humaine (ou pont custom plus tard).

**Prérequis infra :** RAM insuffisante pour un usage HackerAI Docker confortable **en parallèle** de Cyber Alert + Africa Insight — traiter ça avant d’industrialiser.

---

## 16. Sources d’audit

- VPS SSH live : hostname, `free`, `docker ps/stats`, Node 20, absence process/unit HackerAI, absence `HACKERAI_*` dans `.env`, schéma DB sans `analysis_jobs`
- Repo : `ops/vps/*`, `src/lib/security-core/hackerai/*`, `deep-worker.ts`, `HACKERAI_INTEGRATION.md`, `CYBER_ALERT_ARCHITECTURE.md`
- Doc officielle HackerAI Pro + Local Agent (help.hackerai.co) — *Standalone API access is not included*

---

*Fin du rapport d’exploration — aucune modification de code de production demandée ni effectuée dans cette mission.*

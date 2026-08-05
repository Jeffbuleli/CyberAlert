# Cyber Alert RDC — Architecture cible

> Document produit après audit du dépôt existant (`Jeffbuleli/CyberAlert`).
> **Aucune modification de code n’a encore été appliquée.** Ce fichier est le plan de migration.
>
> Repo : `/Users/mac/Documents/CyberAlert` · Prod : https://cyberalert-rdc.org · VPS dédié `153.75.235.176`

---

## 0. Résumé exécutif

Cyber Alert RDC fonctionne déjà (Next.js + Postgres + AI gateway + VPS).
Le bug critique n’est pas « HTTPS = +20 points », mais pire :

**Absence de signal négatif ⇒ `riskLevel: "low"` ⇒ UI « Risque faible » + icône verte.**

Un domaine comme `https://gkffjkfdf.com` (HTTPS OK, DNS OK, HTTP OK, identité inconnue) est donc présenté comme un pass vert.

La refonte vise :

1. Introduire **UNKNOWN ≠ SAFE** (fiabilité non établie).
2. Remplacer le score additif de risque par une évaluation **multi-dimensionnelle + Evidence Engine**.
3. Faire de **McBuleli AI** le cerveau analytique (pas un simple explainer).
4. Intégrer **HackerAI** uniquement en escalade, via un adapter officiel — sans inventer d’API.
5. Conserver la stack et les modules existants ; migrer de façon incrémentale.

Principes UX fixés pour la refonte :

- Réponses McBuleli AI : **courtes, structurées, efficaces** (pas de roman).
- **SVG internes** pour les verdicts / étapes (pas d’emojis style WhatsApp).
- Tirets typographiques cohérents (`–` / listes structurées), pas de « - » décoratifs type chat.

---

## 1. Audit — état actuel

### 1.1 Emplacement

| Élément | Valeur |
|--------|--------|
| Repo produit | `/Users/mac/Documents/CyberAlert` (GitHub `Jeffbuleli/CyberAlert`) |
| McBuleliP2P | **Non lié** au link-checker (autre produit) |
| Stack | Next.js 16 App Router, React 19, Tailwind 4, Drizzle, Postgres 16 |
| AI | `services/ai-gateway` (FastAPI) + OpenAI fallback |
| Paiements | PawaPay |
| Deploy | Docker Compose + nginx · `ops/vps/` |
| Queue / workers | **Absents** (tout synchrone dans la requête HTTP) |

### 1.2 Modules existants

| Module | Route | État |
|--------|-------|------|
| Vérifier un lien | `/`, `/check/[id]`, `POST /api/link-checks` | Live |
| Signaler un site | `/report` | Live |
| Tester mon application | `/developers` → `/dashboard`, `POST /api/scans` | Live (quota) |
| Sécuriser mon organisation | `/business` | Lead / marketing (pas de monitoring actif) |
| Auth / pricing / admin | `/login`, `/pricing`, `/admin` | Live |

### 1.3 Flux actuel (link check)

```
User → POST /api/link-checks
     → analyzeLink()          [heuristiques + DNS + HTTP]
     → scoreToRisk(score)     [0 → low | ≥35 caution | ≥70 high]
     → getAIProvider().explainLinkResult()  [explique seulement]
     → INSERT link_checks
     → redirect /check/[id]
```

Fichier central : `src/lib/link-analysis/engine.ts`

### 1.4 Bug de verdict — preuve

```ts
// engine.ts
function scoreToRisk(score: number): RiskLevel {
  if (score >= 70) return "high";
  if (score >= 35) return "caution";
  return "low"; // ← score 0 = "low"
}
```

Signaux techniques positifs (`https_ok`, `dns_ok`) sont en sévérité `info` et **ignorés** du score.
Aucun mécanisme n’exige une preuve de **légitimité**.

Donc pour `gkffjkfdf.com` :

| Preuve | Résultat | Effet score |
|--------|----------|-------------|
| HTTPS | `https_ok` (info) | 0 |
| DNS | `dns_ok` (info) | 0 |
| Identité | absente | 0 |
| Réputation | non consultée | 0 |
| Lookalike marque | non | 0 |

→ `score = 0` → `low` → **« Risque faible »** + `IconCheck` vert.

Ce n’est pas « HTTPS = fiable ». C’est **« pas de drapeau rouge = fiable »**, ce qui viole `UNKNOWN ≠ SAFE`.

### 1.5 Lacunes vs cible

| Cible | Actuel |
|-------|--------|
| Verdicts TRUSTED / LIKELY_TRUSTED / **UNKNOWN** / SUSPICIOUS / DANGEROUS | `low` / `caution` / `high` seulement |
| Evidence Engine | Absent |
| Outils (DNS, TLS, HTTP, Identity, WebSearch, Reputation…) | Heuristiques locales + stub réputation |
| McBuleli AI = analyste / orchestrateur | Explain-only |
| HackerAI adapter + escalade sélective | Stub `hackerai_not_configured` |
| risk ≠ confidence | Absent |
| Cache d’analyse | Absent |
| Jobs asynchrones | Absent |
| brand_watchlist DB | Seedée mais **non branchée** sur `analyzeLink` |
| getReputationProvider() | Jamais appelé depuis le moteur |
| UI étapes réelles | Spinner « Analyse… » uniquement |
| Monitoring organisation | Formulaire lead seulement |

### 1.6 HackerAI — constat d’intégration officielle

Avant toute implémentation, inspection de la documentation publique :

| Source | Constat |
|--------|---------|
| help.hackerai.co (Pro / Pro+ / Ultra) | **« Standalone API access is not included. »** |
| Connexion agent | Desktop app ou CLI `@hackerai/local` avec token Agents |
| GitHub `hackerai-tech/hackerai` | Produit web / agent ; pas d’API publique documentée pour Cyber Alert |
| npm `hackerai` | TUI locale (BYOK), pas un backend SaaS pour URL check |

**Décision d’architecture :**

1. Créer `HackerAIAdapter` avec contrat stable côté Cyber Alert.
2. Implémenter d’abord un mode **`unavailable` / `manual_escalation`** honnête (pas de faux appels).
3. Brancher ensuite uniquement un mécanisme **officiel** confirmé dans le compte pro (API privée si fournie, webhook, export, ou worker local isolé `@hackerai/local` sur machine de scan dédiée).
4. **Ne jamais inventer** d’endpoint `HACKERAI_API_URL`.
5. Si HackerAI est indisponible → `ANALYSIS_INCOMPLETE` / `UNKNOWN`, **jamais** `TRUSTED`.

---

## 2. Principes de décision (non négociables)

```
TECHNICALLY_VALID  ≠  TRUSTED
UNKNOWN            ≠  SAFE
NO_MALICIOUS_SIGNAL ≠  PROOF_OF_LEGITIMACY
HTTPS              ≠  LEGITIMATE
TLS valide         ≠  site légitime
DNS OK             ≠  identité établie
HTTP 200           ≠  fiabilité
```

- McBuleli AI **ne invente pas** de faits ; chaque affirmation importante doit pointer vers une preuve / source.
- Un seul signal critique peut basculer le verdict (pas de moyenne naïve).
- `risk` et `confidence` sont **séparés**.
- Surpromesses interdites : jamais « 100 % sûr », « garanti sans risque ».

---

## 3. Architecture cible

```
                         USER
                          │
                          ▼
                   Cyber Alert RDC
                          │
                   Security Gateway
                   (SSRF, rate limit,
                    normalize, authz)
                          │
                          ▼
                     Security Core
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   URL Check         App Testing      Organization
   (Module 1)        (Module 2)       (Module 3)
        │                 │                 │
        └─────────────────┼─────────────────┘
                          ▼
                   Evidence Engine
                          │
            ┌─────────────┼─────────────┐
            ▼             ▼             ▼
       Fast Checks   Web/Identity   Reputation
       (DNS/TLS/HTTP) (Company ID)  (feeds)
            │             │             │
            └─────────────┼─────────────┘
                          ▼
                     McBuleli AI
                   (analyste / juge)
                          │
              ┌───────────┴───────────┐
              │ certain               │ uncertain / complex
              │                       ▼
              │                  HackerAIAdapter
              │                  (deep path async)
              │                       │
              └───────────┬───────────┘
                          ▼
                     Risk Engine
                          │
                    Final Verdict
                          │
                          ▼
                         USER
```

Un seul **Security Core** partagé par les 3 modules.

---

## 4. Modèle de données cible

Évolution de `link_checks` (migration Drizzle, rétro-compatible autant que possible).

### 4.1 Verdict

```ts
type Verdict =
  | "trusted"          //  Fiable (selon éléments vérifiés)
  | "likely_trusted"   //  Probablement fiable
  | "unknown"          //  Fiabilité non établie  ← défaut si preuves insuffisantes
  | "suspicious"       //  Suspect
  | "dangerous";       //  Dangereux

type RiskLevel = "none" | "low" | "medium" | "high" | "critical" | "unknown";
// confidence: 0..1 — confiance dans l’évaluation (pas dans la « sûreté »)
```

Mapping UI (SVG, pas emoji WhatsApp) :

| Verdict | Label FR | Couleur | Icône SVG |
|---------|----------|---------|-----------|
| trusted | Fiable | vert | `IconShieldCheck` |
| likely_trusted | Probablement fiable | bleu | `IconShield` |
| unknown | Fiabilité non établie | ambre | `IconHelpCircle` |
| suspicious | Suspect | orange | `IconAlert` |
| dangerous | Dangereux | rouge | `IconBan` |

Compatibilité temporaire : mapper l’ancien `riskLevel` `low|caution|high` → nouveaux verdicts pour l’historique.

### 4.2 Payload d’analyse (JSON stocké)

```json
{
  "url": "...",
  "normalized_url": "...",
  "domain": "...",
  "final_url": "...",
  "status": "queued|running|analyzing|deep_analysis|completed|failed",
  "technical": {
    "https": true,
    "tls_valid": true,
    "tls_issuer": null,
    "http_status": 200,
    "redirects": [],
    "note": "TLS valide ≠ légitimité"
  },
  "identity": {
    "claimed_entity": null,
    "identified_entity": null,
    "official_domain": null,
    "identity_confidence": 0.0,
    "impersonation_risk": "unknown"
  },
  "reputation": {
    "status": "unknown",
    "sources": []
  },
  "dimensions": {
    "technical_validity": "pass|fail|unknown",
    "domain_reputation": "unknown",
    "identity_confidence": "unknown",
    "brand_consistency": "unknown",
    "web_evidence": "unknown",
    "malicious_signals": "none|present|unknown",
    "phishing_signals": "none|present|unknown",
    "content_signals": "unknown",
    "infrastructure_signals": "unknown",
    "historical_signals": "unknown"
  },
  "signals": {
    "phishing": [],
    "impersonation": [],
    "malware": [],
    "suspicious": [],
    "info": []
  },
  "evidence": [],
  "ai_analysis": {
    "risk": "unknown",
    "confidence": 0.85,
    "reasoning": [],
    "needs_deep_analysis": false,
    "structured_summary": {
      "headline": "...",
      "why": ["..."],
      "advice": "..."
    }
  },
  "hackerai": {
    "invoked": false,
    "job_id": null,
    "status": null,
    "result_summary": null
  },
  "verdict": "unknown",
  "analyzed_at": "..."
}
```

### 4.3 Nouvelles tables (incrémentales)

- `analysis_jobs` — file async (status, analysis_id, provider, attempts, errors)
- `analysis_cache` — clé = normalized_url (+ final_url), TTL, verdict, payload
- `analysis_audit_log` — traçabilité (tools_used, sources, durations, hackerai_job_id)
- `org_assets` / `org_alerts` — module 3 (phase ultérieure)
- Étendre `link_checks` : `verdict`, `confidence`, `evidence_json`, `dimensions_json`, `hackerai_json`, `cache_hit`, `duration_ms`

---

## 5. Security Core — composants

### 5.1 Security Gateway

Responsabilités :

- Normalisation URL
- Rate limiting (existant)
- **SSRF** (existant + renforcer redirections vers IP privées à chaque hop)
- Validation schéma
- Authorization (module 2 : confirmation propriété / scope)

### 5.2 Evidence Engine

Orchestrateur central :

```
EvidenceEngine.collect(url) → EvidenceBundle
```

Parallélise les outils indépendants, applique timeouts, agrège sans conclure.

### 5.3 Outils (couche indépendante)

| Tool | Rôle | Priorité |
|------|------|----------|
| `DNSResolverTool` | A/AAAA, publicité IPs | P0 |
| `TLSInspectionTool` | Certificat, issuer, expiry, hostname match | P0 |
| `HTTPInspectionTool` | Status, headers, timeouts | P0 |
| `RedirectTool` | Chaîne A→B→C, destination finale | P0 |
| `DomainInfoTool` | RDAP/WHOIS publics si dispo (âge, registrar) | P1 |
| `CompanyIdentityTool` | Entité revendiquée vs domaine officiel | P0 |
| `ReputationTool` | Feeds (stub → sources contractées) | P1 |
| `WebSearchTool` | Recherche identité / réputation (API réelle uniquement) | P1 |
| `ContentInspectTool` | Title/meta/forms — **sandbox isolée** | P2 |

Règle : si un outil n’a pas réellement consulté une source → `information_not_established`, jamais `trusted`.

### 5.4 McBuleli AI (cerveau)

Entrée : `EvidenceBundle` uniquement.
Sortie structurée :

```ts
{
  risk: RiskLevel;
  confidence: number;
  verdict_suggestion: Verdict;
  needs_deep_analysis: boolean;
  reasoning: string[];      // points courts reliés à evidence_ids
  why: string[];            // 2–5 puces max pour l’UI
  advice: string;           // 1 phrase d’action
  headline: string;         // 1 ligne
}
```

Contraintes de réponse :

- Français clair (RDC)
- **Court** : headline 1 ligne, why ≤ 5 puces, advice 1 phrase
- Structure fixe (pas de pavé)
- Interdit : inventer des sources, « 100 % sûr », conclure TRUSTED sans preuve d’identité/réputation

Décide l’escalade HackerAI si :

- preuves insuffisantes **et** besoin d’investigation
- identité ambiguë / usurpation possible
- signaux contradictoires
- domaine très suspect
- impossible d’établir la fiabilité (cas UNKNOWN fort)

### 5.5 HackerAIAdapter

```ts
interface HackerAIAdapter {
  isAvailable(): Promise<boolean>;
  startInvestigation(input: DeepInvestigationInput): Promise<{ jobId: string }>;
  getStatus(jobId: string): Promise<DeepJobStatus>;
  getResult(jobId: string): Promise<DeepInvestigationResult | null>;
}
```

Implémentations prévues :

1. `NullHackerAIAdapter` — défaut honnête (`unavailable`)
2. `OfficialHackerAIAdapter` — branché uniquement après contrat officiel confirmé
3. Option VPS isolé : worker avec `@hackerai/local` **hors** du process web (sandbox, least privilege) si le compte pro le permet

HackerAI **n’est pas** appelé pour chaque URL.

### 5.6 Risk Engine

Combine dimensions + AI + (optionnel) deep results.

Règles dures :

| Condition | Verdict |
|-----------|---------|
| SSRF / destination interne | bloqué + dangerous / blocked |
| Impersonation marque confirmée (domaine ≠ officiel) | suspicious ou dangerous |
| Identité UNKNOWN + réputation UNKNOWN + pas de preuve positive | **unknown** (même si HTTPS/DNS/HTTP OK) |
| Domaine officiel connu + identité forte + pas de signal malveillant | trusted / likely_trusted |
| HackerAI timeout / unavailable + preuves insuffisantes | unknown / analysis_incomplete |
| McBuleli AI down | verdict technique partiel honnête (souvent unknown) |

**Interdit** : `score_additif(HTTPS+DNS+HTTP) → trusted`.

---

## 6. Chemins Fast / Deep + cache + async

### 6.1 Fast path (< 2–5 s objectif)

1. Cache lookup (normalized URL)
2. Gateway SSRF
3. Outils techniques parallèles
4. Identity + reputation rapides
5. McBuleli AI (timeout court)
6. Verdict si `needs_deep_analysis === false`
7. Retour immédiat + date d’analyse

### 6.2 Deep path (non bloquant)

1. Créer `analysis_jobs` + status `deep_analysis`
2. Retourner `analysis_id` au client
3. Worker appelle HackerAIAdapter
4. McBuleli AI réinterprète
5. Update DB → `completed`
6. Frontend poll `/api/link-checks/[id]` (états réels)

### 6.3 États frontend

```
queued → running → analyzing → deep_analysis → completed | failed
```

Étapes UI (vraies, liées au backend — pas de faux %) :

1. Vérification technique
2. Vérification du domaine
3. Recherche d’identité
4. Analyse de réputation
5. Analyse des redirections
6. Vérification d’usurpation
7. Analyse de crédibilité
8. McBuleli AI interprète
9. (optionnel) Analyse approfondie en cours…

Icônes d’étapes : **SVG** (`IconCheck`, `IconSpinner`, etc.).

### 6.4 Cache

- Clé : `sha256(normalized_url)` (+ optionnellement `final_url`)
- TTL proposé : 24 h (ajustable par verdict ; dangerous peut être plus court)
- Afficher « Dernière analyse : … »

---

## 7. UX — interface résultat

### 7.1 Cas UNKNOWN (`gkffjkfdf.com`)

```
[SVG ambre]  FIABILITÉ NON ÉTABLIE

Nous n’avons pas trouvé suffisamment de preuves
pour confirmer que ce site est légitime.

Le fait que le site utilise HTTPS ne suffit pas
à établir sa fiabilité.

Conseil : évitez de fournir des informations personnelles
tant que l’identité du site n’est pas confirmée.

[ Pourquoi ? ]  [ Détails techniques ]
```

### 7.2 Cas usurpation

```
[SVG rouge]  RISQUE ÉLEVÉ

Entreprise concernée : Rawbank
Adresse analysée : rawbank-secure-login.example
Verdict : Domaine non confirmé comme officiel

Pourquoi ?
• Le domaine ne correspond pas au domaine officiel identifié.
• Le nom imite fortement la marque.
• L’identité du site n’a pas pu être confirmée.

Conseil : n’entrez aucune information bancaire ou identifiant.
```

### 7.3 Détails techniques (secondaire)

Panneau repliable : Evidence, Sources, DNS, TLS, HTTP, Redirects, Domain, Identity, Reputation, AI Analysis, HackerAI, Timeline.

### 7.4 Style McBuleli AI

- Pas d’emojis WhatsApp
- Listes à puces courtes
- Tirets typographiques cohérents
- Moins long, plus efficace

---

## 8. Modules 2 et 3 (même Security Core)

### 8.1 Tester mon application

```
App URL → Authorization Check (confirm ownership)
       → Safe Reconnaissance
       → Security Checks (non destructifs)
       → Evidence Engine → McBuleli AI → HackerAI si besoin
       → Security Report
```

Conserver quotas / dashboard existants. Tests intrusifs uniquement avec consentement explicite ; destructifs **interdits** par défaut.

### 8.2 Sécuriser mon organisation

Évolution progressive du lead `/business` :

```
Asset Inventory → Continuous Monitoring → Checks → Alerts
                → McBuleli AI → HackerAI
```

Dashboard cible :

- N actifs surveillés
- comptes par verdict (SVG)
- dernière analyse

Phase 1 de la refonte = fondations Security Core + Module 1.
Module 3 = phase ultérieure (schéma `org_assets` d’abord).

---

## 9. Sécurité VPS / runtime

Déjà partiellement en place (SSRF, rate limit, secrets `.env`, HTTPS nginx).

À renforcer :

| Contrôle | Action |
|----------|--------|
| SSRF redirects | Re-vérifier IP à **chaque** hop |
| Secrets | `.env` / secret manager ; jamais Git |
| Isolation workers | Process / container séparé pour deep scan + content |
| Timeouts réseau | DNS / TLS / HTTP / AI / HackerAI |
| Rate limiting | Conserver + renforcer deep path |
| Audit log | Chaque analyse |
| Least privilege | Comptes service séparés (web, worker, db) |
| Firewall | Ports 3010/8090/5433 localhost only (déjà noté) |
| Sandbox contenu | Ne pas exécuter HTML/JS sur le process web |

---

## 10. Observabilité

Métriques à exposer (endpoint admin ou logs structurés) :

- URL checks / hour
- Average latency / fast-path latency / HackerAI latency
- HackerAI invocation rate
- Unknown / Suspicious / Dangerous rates
- Tool failures / API failures
- Cache hit rate

Audit log par analyse : `analysis_id`, timestamp, url, tools, sources, mcbuleli, hackerai, verdict, confidence, errors, duration. Pas de PII inutile (ipHash déjà en place).

---

## 11. Plan de migration (incrémental)

### Phase A — Correctif verdict (P0, rapide)

1. ✅ Introduire `Verdict` + `unknown` comme **défaut** sans preuve de légitimité.
2. ✅ Arrêter de mapper score `0` → « Risque faible » vert.
3. ✅ Mettre à jour UI (`result-view`, headlines, badges SVG).
4. ✅ Tests : `gkffjkfdf.com` → `unknown`.

### Phase B — Security Core + Evidence Engine

1. ✅ Extraire outils depuis `engine.ts`.
2. ✅ Créer `EvidenceEngine` + dimensions.
3. ✅ Brancher `brand_watchlist` + `CompanyIdentityTool`.
4. ✅ Risk Engine multi-dimensionnel.

### Phase C — McBuleli AI analyste

1. ✅ Remplacer explain-only par analyse structurée grounded.
2. ✅ Escalade `needs_deep_analysis`.
3. ✅ Prompts courts / structurés.

### Phase D — HackerAI + async + cache

1. ✅ `HackerAIAdapter` + Null + agent_token (+ http_bridge optionnel).
2. ✅ `analysis_jobs` + worker.
3. ✅ Cache TTL.
4. ✅ Branchement token `hsb_*` / quickstart ; VPS GitHub→153.75.235.176 (pas Render).

### Phase E — Modules 2/3 + docs + deploy

1. App testing sur Security Core.
2. Org assets (MVP).
3. Docs : `SECURITY_TOOLS.md`, `MCBULELI_AI_SECURITY.md`, `HACKERAI_INTEGRATION.md`, `SECURITY.md`.
4. `.env.example` sans secrets.
5. Suite de tests (cas 1–9 mission).
6. Déploiement VPS.
7. Organisation VPS (HackerAI systemd + schema prep + deep-worker profile) — `ops/vps/VPS_ORGANIZATION.md` (sans activer sandbox Docker sur 1.6 Go).

**Règle** : ne pas casser les routes API publiques ; versionner les champs JSON ; migrations Drizzle propres.

---

## 12. Suite de tests obligatoire

| Cas | Entrée | Attendu |
|-----|--------|---------|
| 1 Domaine inconnu | `https://gkffjkfdf.com` | `unknown` (pas trusted) |
| 2 Domaine officiel | ex. `mcbuleli.org` / marque seedée | trusted ou likely_trusted selon preuves |
| 3 Typosquatting | `brand-secure-login.example` etc. | suspicious / dangerous |
| 4 HTTPS + identité inconnue | | `unknown` |
| 5 Suspect | signaux phishing path / lookalike | suspicious+ |
| 6 Redirections | A→B→C | chaîne dans evidence ; verdict sur destination |
| 7 HackerAI down | | pas safe ; unknown / incomplete |
| 8 McBuleli AI down | | résultat technique honnête |
| 9 SSRF | localhost / 127.0.0.1 / 169.254.169.254 | bloqué |

Étendre `src/lib/link-analysis/__tests__/` + nouveaux tests Security Core / Risk Engine.

---

## 13. Livrables documentation (après implémentation)

| Fichier | Contenu |
|---------|---------|
| `CYBER_ALERT_ARCHITECTURE.md` | **Ce document** (cible + audit) |
| `SECURITY_TOOLS.md` | Contrat de chaque outil |
| `MCBULELI_AI_SECURITY.md` | Rôle, prompts, grounding, limites |
| `HACKERAI_INTEGRATION.md` | Adapter, modes, limites officielles |
| `SECURITY.md` | SSRF, secrets, VPS, sandbox |
| `.env.example` | Vars sans clés réelles |

---

## 14. Ordre de travail (exécution)

1. ✅ Audit du projet existant
2. ✅ Comprendre l’architecture actuelle
3. ✅ Identifier le bug de verdict (`score 0 → low`)
4. ✅ Documenter l’architecture cible (**ce fichier**)
5. ✅ Créer Security Core
6. ✅ Créer Evidence Engine
7. ✅ Créer les outils rapides
8. ✅ Intégrer McBuleli AI (analyste)
9. ✅ Intégrer HackerAI officiellement (adapter + null puis agent_token)
10. ✅ Système d'escalade (needs_deep_analysis → jobs)
11. ✅ Cache + queue (analysis_cache + analysis_jobs)
12. ⬜ Sécurité SSRF/sandbox renforcée
13. ✅ UI verdict UNKNOWN (Phase A) + poll deep
14. ⬜ Modules 2 et 3
15. ✅ Tests Phase A/B/C/D
16. ⬜ Tests de sécurité
17. ✅ SECURITY_TOOLS / MCBULELI_AI / HACKERAI_INTEGRATION / SECURITY.md
18. ⬜ Déploiement VPS du code Phase B–D (prod encore sur commit pré–Security Core)
18b. ✅ Préparation VPS : schema SQL additive + unit HackerAI + profile deep-worker (désactivé)
19. ⬜ Vérification finale du flux Evidence → Verdict
20. ⬜ Upgrade RAM (≥4 Go) avant Docker sandbox HackerAI

---

## 15. Audit de non-conversion UNKNOWN → TRUSTED

Checklist à revalider avant chaque release :

- [ ] HTTPS seul ne produit jamais `trusted`
- [ ] DNS/HTTP 200 seuls ne produisent jamais `trusted`
- [ ] Score 0 / aucun signal négatif ⇒ `unknown` (sauf identité/réputation établies)
- [ ] HackerAI fail ⇒ jamais `trusted` par défaut
- [ ] McBuleli AI fail ⇒ jamais invention de légitimité
- [ ] Tool non exécuté ⇒ `information_not_established`
- [ ] UI n’affiche pas de pass vert pour UNKNOWN
- [ ] Textes pourcentages de progression absents

---

## 16. Prochaine action

**Phase A** : corriger le moteur de verdict + UI pour que `https://gkffjkfdf.com` affiche **Fiabilité non établie**, sans casser l’API existante.

Ensuite Phase B (Evidence Engine / outils), puis C–E selon ce plan.

---

*McBuleli · Cyber Alert DRC — Evidence → Analysis → Verification → Verdict*

# Security Tools — Cyber Alert RDC

Couche d’outils du **Security Core** (Phase B).

Principe : un outil qui n’a pas réellement consulté une source renvoie
`information_not_established`, jamais `trusted`.

---

## Inventaire

| Tool | Fichier | Réseau | Rôle |
|------|---------|--------|------|
| SecurityGateway | `security-core/gateway.ts` | Non | Normalize + SSRF admit |
| LocalHeuristicsTool | `tools/local-heuristics.ts` | Non | HTTP, userinfo, shortener, phishing path, deep subdomains |
| DNSResolverTool | `tools/dns-resolver.ts` | DNS | A/AAAA + blocage IP privées |
| TLSInspectionTool | `tools/tls-inspection.ts` | TLS | Certificat, issuer, expiry — **TLS ≠ légitimité** |
| HTTPInspectionTool + RedirectTool | `tools/http-redirect.ts` | HTTP | Status, chaîne de redirections, SSRF à chaque hop |
| DomainInfoTool | `tools/domain-info.ts` | RDAP | Registrar / date si disponibles |
| CompanyIdentityTool | `tools/company-identity.ts` | Non | Officiel / lookalike / marque-dans-le-nom |
| ReputationTool | `tools/reputation.ts` | Provider | Stub actuel → `information_not_established` |

Orchestration : `EvidenceEngine.collectEvidence()` → `RiskEngine.evaluateEvidence()`.

---

## CompanyIdentityTool — règles

1. Correspondance **exacte** (ou sous-domaine) d’un domaine de la watchlist → `exact_official`.
2. Distance de Levenshtein ≤ 2 sur le SLD → `lookalike` (usurpation probable).
3. Nom de marque contenu dans le SLD **sans** être le domaine officiel → `brand_in_name`.
   - Ex. `rawbank-secure-login.com` ≠ ownership Rawbank.
4. Sinon → `identity_not_established`.

La watchlist DB (`brand_watchlist`) est fusionnée avec `DEFAULT_BRANDS`.

---

## Dimensions

Calculées après collecte :

- `technical_validity` — pass/fail/unknown (jamais une preuve de confiance)
- `domain_reputation` — souvent `information_not_established` tant que pas de feed
- `identity_confidence` / `brand_consistency`
- `phishing_signals` / `malicious_signals`
- `infrastructure_signals` / `historical_signals`
- `web_evidence` / `content_signals` — Phase C+

---

## Risk Engine

- Score de signaux négatifs (comme Phase A)
- `low` **uniquement** si identité officielle + score bas
- Lookalike / brand-in-name → au minimum `caution`
- HTTPS / DNS / HTTP 200 **ne** produisent **pas** `trusted`
- `needs_deep_analysis` si unknown, usurpation possible, ou réputation non établie

---

## Migration DB (Phase B)

Colonnes ajoutées sur `link_checks` :

- `verdict`, `confidence`
- `evidence_json`, `dimensions_json`, `tools_used`
- `needs_deep_analysis`

```bash
npm run db:push
```

---

## Tests

```bash
npm test
```

Cas couverts : unknown, officiel, lookalike, brand-in-name, SSRF, dimensions.

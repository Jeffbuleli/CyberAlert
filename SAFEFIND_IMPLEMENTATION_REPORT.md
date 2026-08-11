# SAFEFIND_IMPLEMENTATION_REPORT

## 1. Architecture existante analysée

Monolithe **Next.js 16 (App Router) + React 19 + TypeScript + Drizzle ORM + PostgreSQL**.

| Domaine | Réutilisation |
|--------|----------------|
| Auth | JWT custom (`src/lib/session.ts`), rôles `user` / `agent` / `super_admin` |
| RBAC ops | `staff_scopes` - scope ajouté : `safefind` |
| KYC | Didit existant (`src/lib/didit/*`, `kyc_sessions`, `checkKycGate`) |
| Paiements MoMo | PawaPay (`src/lib/pawapay/*`) + tables `fiat_freshpay_*` (rename historique) |
| Audit | `platform_admin_audit_log` + `safefind_audit_events` |
| Notifications | `user_notifications` (insert best-effort SafeFind) |
| UI | Tailwind v4, tokens `--brand-green` / `--mb-*`, Poppins |

**Cyber Alert RDC** = branding / emails (`cyberalert-rdc.org`), pas un produit isolé. SafeFind est un module borné dans McBuleliP2P.

Aucun module lost/found existait avant cette V1.

---

## 2. Architecture SafeFind

Modèle :

```
Trouveur → déclaration → (KYC si sensible) → dépôt Point partenaire
→ custody_events (append-only) → matching discret → vérification propriétaire
→ OTP retrait → RETURNED → une seule reward → PawaPay (si autorisé)
```

Principes respectés :

- Une pièce = un dossier (`public_id` `SF-YYYY-NNNNNN`)
- Une seule récompense principale (`safefind_rewards` unique sur `case_id`)
- Pas de rencontre trouveur/propriétaire
- Identités croisées minimisées
- Partenaire = tiers de confiance physique

Modules code :

- `src/db/safefind-schema.ts`
- `src/lib/safefind/*` (state machine, custody, matching, reward ownership, antifraud, geo, privacy, payout, service)
- `src/app/api/safefind/*`, `src/app/api/partner/safefind/*`, `src/app/api/admin/safefind/*`
- UI : `src/app/safefind/*`, `src/app/admin/safefind/*`

---

## 3. Tables ajoutées

`safefind_partners`, `safefind_partner_agents`, `safefind_reward_policies`, `safefind_partner_commission_policies`, `safefind_config`, `safefind_case_counters`, `safefind_cases`, `safefind_declarations`, `safefind_custody_events`, `safefind_match_candidates`, `safefind_owner_verifications`, `safefind_incidents`, `safefind_rewards`, `safefind_disputes`, `safefind_match_groups`, `safefind_trust_scores`, `safefind_audit_events`, `safefind_partner_commissions`

---

## 4. Migrations

Fichier : `drizzle/0126_safefind.sql`

Inclut seed politiques de récompense :

- carte_electeur → 5 000 CDF  
- permis_conduire → 10 000 CDF  
- passeport → 20 000 CDF  

Config windows : `INITIAL_REVIEW_WINDOW_MS`, `INCIDENT_REVIEW_WINDOW_MS` (jsonb, non hardcodés dans la logique critique de transfert de droit).

Appliquer via le pipeline existant (`db:migrate:render` / migrate batched).

---

## 5. APIs

### Public / auth

| Method | Path |
|--------|------|
| POST | `/api/safefind/found` |
| POST | `/api/safefind/lost` |
| GET | `/api/safefind/cases/:id` (vue publique redactée) |
| POST | `/api/safefind/cases/:id/claim` |
| POST | `/api/safefind/cases/:id/verify-owner` |
| GET | `/api/safefind/partners/nearby` |

### Partner

| Method | Path |
|--------|------|
| POST | `/api/partner/safefind/deposits/accept` |
| GET | `/api/partner/safefind/custody` |
| POST | `/api/partner/safefind/release` |
| POST | `/api/partner/safefind/incidents` |

### Admin (scope `safefind`)

| Method | Path |
|--------|------|
| GET/POST | `/api/admin/safefind/cases` (liste, freeze, custody, incidents, rewards) |
| POST | `/api/admin/safefind/rewards/authorize` |

Rate limits ajoutés dans `src/lib/api-rate-limit.ts`.

---

## 6. Workflows

1. **Finder** : déclaration → `FOUND`/`REGISTERED`/`DEPOSIT_PENDING` → dépôt partenaire → `DEPOSITED_AT_PARTNER`
2. **Silent refound** : si hash/similarité sur dossier déjà en garde → message neutre à K, alerte A + incident auto, **pas** de 2ᵉ reward
3. **Owner** : lost/search → claim (score band) → verify (+ KYC Didit) → OTP + point de retrait
4. **Partner** : accept dépôt / release OTP / signaler incident (geler rewards)
5. **Reward** : après `RETURNED` → row unique `AUTHORIZED` → payout PawaPay admin-triggered → webhook → `PAID` / `REWARD_RELEASED`

---

## 7. State machine

États V1 : `LOST`, `FOUND`, `REGISTERED`, `DEPOSIT_PENDING`, `DEPOSITED_AT_PARTNER`, `MATCH_CANDIDATE`, `OWNER_VERIFICATION`, `READY_FOR_COLLECTION`, `COLLECTED`, `RETURNED`, `REWARD_PENDING`, `REWARD_RELEASED`, `DISPUTED`, `PARTNER_INCIDENT`, `REPORTED_STOLEN`, `EXPIRED`, `CANCELLED`

Transitions contrôlées dans `state-machine.ts` (+ events custody append-only).

---

## 8. Reward ownership

- `reward_owner_user_id` (défaut = trouveur initial)
- Refound après custody : `createSecondReward: false`, lock, revue
- `canAuthorizeReward` bloque : frozen, disputed, stolen, incident, sans KYC, mauvais statut
- Transfert de droit = validation admin (pas un simple timer)

---

## 9. Custody chain

Table `safefind_custody_events` : type, acteur, rôle, partenaire, previous/new, meta, evidence, `event_hash` HMAC.

Répond à : qui / quand / quel point / dépôt / réception / transfert / remise.

---

## 10. Partner model

`safefind_partners` + `safefind_partner_agents` (`partner_admin` | `partner_agent`).

Geo ranking Kinshasa : distance + coût transport estimé + security score (`geo.ts`).

Commissions configurables (`safefind_partner_commission_policies`) - montants non hardcodés métier.

---

## 11. KYC integration

Réutilise Didit existant. KYC requis pour :

- restitution / verify-owner
- réception de récompense (`requireKyc: true`)
- accumulation de déclarations found sans KYC (plafond config)

Pas de duplication des données biométriques Didit.

---

## 12. PawaPay integration

- `processSafefindRewardPayout` → `pawapayPayOut`
- Idempotence : `payout_reference` unique
- Webhook branché dans `handle-callback.ts` → `applySafefindPayoutWebhook`
- Pas de seconde abstraction paiement

---

## 13. Sécurité

- Vue publique redactée serveur (`privacy.ts`) - pas de CSS-only
- Enumeration IDs : regex stricte + 404 uniforme + rate limit
- Partner IDOR : refus si `currentPartnerId` ≠ agent
- Pas de numéro complet / signature / DOB en public
- Hash document HMAC pepper (`SAFEFIND_HASH_PEPPER` ou `JWT_SECRET`)
- Audit SafeFind + platform admin audit
- Scope staff séparé `safefind`

---

## 14. Tests

`npm run test:safefind` - `src/lib/safefind/__tests__/safefind.test.ts`

Couvre (logique pure) :

1. Happy path authorize  
2. Refound → une seule reward / lock  
3. Doublon found  
4. Antifraud custody theft pattern  
5. Incident freeze path (via ownership)  
6. Dispute multi-owners  
7. Webhook applicator export (idempotence structurelle en DB unique index)  
8–9. Privacy + geo (enumeration shape via public view)  
10. KYC block reward  

Tests E2E DB complets restent à brancher sur un environnement avec migration appliquée.

---

## 15. Limites restantes

- Upload / redaction image serveur (OCR preview) non livré - refs média prévues
- SMS / WhatsApp alertes absents (canal email/in-app seulement)
- Seed partenaires Kinshasa à faire en ops
- Transfert custody partner→partner UI partielle (API events prêts)
- Scoring antifraud avancé / ML non inclus
- Notifications kinds non ajoutés au union TypeScript `NotificationKind` (insert SQL best-effort)
- `GET /api/safefind/search` multi-filtres : UI search par ID + lost matching ; endpoint listé comme page `/safefind/search`
- QR dépôt / app mobile native : hors V1

---

## 16. Décisions nécessitant validation humaine

1. Montants finaux commissions partenaires  
2. Qui paie la récompense (plateforme vs propriétaire) - V1 assume payout plateforme MoMo vers trouveur après autorisation admin  
3. Fenêtres de revue (`INITIAL_REVIEW_WINDOW_MS` / `INCIDENT_REVIEW_WINDOW`) et process légal de transfert de droit  
4. Activation partenaires (KYC business Didit workflow dédié ?)  
5. Politique conservation / purge PII dossiers clos  
6. Mapping rôles demandés (`SAFEFIND_OPERATOR`, `SUPPORT`, …) → actuellement `agent` + scope `safefind` + `super_admin` ; partenaires via `safefind_partner_agents`  
7. Appliquer migration `0126` en prod et créer les premiers Points SafeFind  

---

## UI notes

- Mobile-first, tokens Cyber Alert / McBuleli existants  
- Home actions en **SVG** (pas d’emojis)  
- Pages : `/safefind`, `/lost`, `/found`, `/search`, `/partners`, `/cases/[id]`, `/partner`, `/admin/safefind`


---

# EXTENSION V1 - Restitution flexible (2026-08-11)

## Nouveaux workflows
- Mode A: retrait partenaire + reservation creneau + preparation READY_FOR_PICKUP
- Mode B: livraison (DeliveryProvider interne) - frais separes de la recompense
- Mode C: HELD_BY_FINDER - matching discret, pas d'identite croisee

## State machine
Ajouts: HELD_BY_FINDER, STORED_AT_LOCATION, PICKUP_RESERVED, READY_FOR_PICKUP,
DELIVERY_*, IN_TRANSIT, ARRIVED, DELIVERED, DELIVERY_FAILED, RETURN_TO_PARTNER,
POTENTIAL_CHAIN_BREAK

## Storage
Tables: safefind_storage_zones, safefind_storage_locations, safefind_storage_movements
QR sur pochette (sleeve_qr_token) - pas sur le document officiel
Capacite partenaire: storage_capacity / current_storage_count / capacity_status
Routage: PARTNER_SELECTION_SCORE (poids configurables)

## Pickup
safefind_pickup_reservations - creneaux 15 min, max configurable

## Delivery
safefind_delivery_requests + events + fee policies + couriers
ONLY_VERIFIED_OWNER par defaut
Echec -> RETURN_TO_PARTNER -> READY_FOR_PICKUP

## Decisions / limites
- Pas de Didit sur Cyber Alert: gate = email verifie
- Adresse livraison V1 stockee encodee en clair cote serveur (chiffrage KMS a faire)
- Reservation UI: besoin d'un partnerId reel (seed partenaires)
- Apply SQL: `bash ops/vps/sql/apply-safefind-logistics.sh` apres deploy

## Tests
npm run test:safefind - scenarios A-E, I, J, K, M, N/O (logique)

---

# EXTENSION V2 - Location Intelligence + centre logistique (2026-08-11)

## Organisation (cohérente avec l'existant)

| Couche | Rôle | Outil |
|--------|------|-------|
| Saisie | Comprendre le lieu (autocomplete / GPS / commune locale) | Google Places (optionnel) + fallback Kinshasa |
| Normalisation | `safefind_locations` structurée + précision | Location Service |
| Proximité métier | Distance / top-N partenaires / capacité | **PostGIS si dispo**, sinon haversine `geo.ts` |
| Affichage | Points proches dans le formulaire | LocationPicker (MapLibre/Google carte full = suite) |
| Entrepôt partenaire | Emplacement physique B-17-04, file, express | logistics déjà en place + polish |

**Principe:** Google n'est pas le moteur métier. Il aide à localiser; Cyber Alert (PostGIS/haversine + routing capacité) choisit le partenaire.

## Ajouts code
- `src/lib/safefind/location/*` (types, places-google, normalize, nearby, service)
- `src/db/safefind-location-schema.ts` → `safefind_locations`, `safefind_geo_areas`
- UI `LocationPicker` sur `/safefind/found` et `/safefind/lost`
- APIs: `/api/safefind/locations/autocomplete|resolve|communes`
- Nearby: `/api/safefind/partners/nearby` passe par `findNearestPartners` si lat/lng
- Matching: signal `geoCoherence` / `geoDistanceKm` (jamais preuve seule)
- Orphelins: `listOrphanCases` + `GET /api/admin/safefind/orphans` + bandeau admin
- Express pickup: flag `express` + `prepareRequestedAt` / `preparedAt`
- Zone par type doc: `preferredZoneCodeForDocument` + `POST .../storage/suggest`

## Migration
`ops/vps/sql/0128_safefind_location.sql`
`bash ops/vps/sql/apply-safefind-location.sh`
(PostGIS: `CREATE EXTENSION` best-effort; fallback haversine si absent)

## Env
`GOOGLE_MAPS_API_KEY` (ou `GOOGLE_PLACES_API_KEY`) - optionnel

## Tests
`npm run test:safefind` - 34 pass (location + logistics + core)

---

# EXTENSION V3 - Geoapify LocationProvider (2026-08-12)

Sans budget Google Maps Platform.

| Couche | Choix |
|--------|-------|
| Autocomplete / geocode | **Geoapify** (`GEOAPIFY_API_KEY`) — free tier ~3000 credits/jour |
| Abstraction | `LocationProvider` — swap fournisseur sans réécrire SafeFind |
| Cache local | `safefind_known_places` (alias Kinshasa, hit_count) |
| Proximité | PostGIS si dispo, sinon haversine |
| Offline | commune / GPS / pin — toujours disponibles |

**Pas** SerpAPI / Google payant pour la fondation.

Privacy: seules des chaînes lieu / coords partent chez Geoapify — jamais PII identité.

SQL: `ops/vps/sql/0129_safefind_known_places.sql`

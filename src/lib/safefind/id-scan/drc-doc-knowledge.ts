/** Shared McBuleli AI vision rules for DRC identity documents (SafeFind). */
export const DRC_DOCUMENT_VISION_RULES = `
Règles RDC SafeFind:

CARTE_ELECTEUR (CENI):
- Photo à gauche (NE PAS brouiller le portrait).
- Numéro National (NN): 11 chiffres, champ "NN" en haut à droite — C'est l'identifiant principal (documentNumber).
- Numéro sous la photo: 14 caractères alphanumériques — distinct du NN (photoCardNumber), à brouiller séparément.
- QR CENI: 3 segments séparés par / → 14 car. (n° sous photo) / 11 car. (NN) / 11 car. (cartographie bureau de vote).
- Si QR lu: documentNumber = segment NN (11 chiffres), jamais le n° 14 car. sous photo.
- Brouiller valeurs seulement: NN, nom, postnom, prénom, dates/lieu naissance, adresse, QR, n° sous photo, signatures.

PASSEPORT biométrique RDC (DERMALOG):
- cropBox = page biodata (polycarbonate) uniquement, pas la couverture.
- Numéro passeport unique, MRZ 2 lignes en bas, puce RFID invisible.
- Brouiller: n° passeport, noms, dates, MRZ, signature — garder photo visible.

PERMIS DE CONDUIRE biométrique RDC:
- Format carte rigide: recto = identité + n° permis; verso = catégories A-E.
- Cadrez le recto pour scan; n° permis unique = documentNumber.
- Brouiller n° permis, identité, dates, code-barres/QR — photo visible.

JSON strict: documentType, holderFirstName, holderLastName, holderPostName, documentNumber,
photoCardNumber (carte_electeur 14 car. si visible), enrollmentBureauCode (11 car. bureau si QR),
birthDate (YYYY-MM-DD|null), birthPlace, qrPayload (texte QR brut si lu), confidence (0-1),
cropBox {x,y,w,h}, blurRegions [{x,y,w,h,field}] valeurs sensibles uniquement.
`.trim();

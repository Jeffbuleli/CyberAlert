from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="Cyber Alert DRC - McBuleli AI Gateway", version="1.1.0")

SECRET = os.getenv("AI_GATEWAY_SECRET", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
_raw_model = os.getenv("OPENAI_EXPLAIN_MODEL") or os.getenv("OPENAI_MODEL") or "gpt-4o-mini"
OPENAI_MODEL = "gpt-4o-mini" if _raw_model.lower().startswith("gpt-5") else _raw_model


class Signal(BaseModel):
    id: str
    code: str
    title: str
    severity: str
    confidence: int
    description: str
    evidence: List[str] = Field(default_factory=list)


class ExplainRequest(BaseModel):
    risk_level: str
    score: int
    domain: Optional[str] = None
    url: str
    signals: List[Signal]
    verdict: Optional[str] = None
    confidence: Optional[int] = None


class ExplainResponse(BaseModel):
    overview: str
    summary: str
    recommendation: str
    source_signal_ids: List[str]


class AnalyzeResponse(BaseModel):
    headline: str
    overview: str
    why: List[str]
    advice: str
    summary: str
    recommendation: str
    source_signal_ids: List[str]
    source_evidence_ids: List[str] = Field(default_factory=list)
    risk_suggestion: str
    verdict_suggestion: str
    confidence: int
    needs_deep_analysis: bool
    reasoning: List[str] = Field(default_factory=list)


def require_auth(authorization: Optional[str] = Header(default=None)) -> None:
    if not SECRET:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="unauthorized")
    token = authorization.removeprefix("Bearer ").strip()
    if token != SECRET:
        raise HTTPException(status_code=401, detail="unauthorized")


DISCLAIMER = "Cette analyse ne garantit pas qu'un site est sûr à 100 %. Restez prudent."

ANALYST_SYSTEM = (
    "Tu es McBuleli AI, analyste cybersécurité pour Cyber Alert DRC (RDC). "
    "Tu raisonnes UNIQUEMENT à partir des preuves/signaux fournis. "
    "JSON strict: headline, overview, why, advice, summary, recommendation, "
    "source_signal_ids, source_evidence_ids, risk_suggestion, verdict_suggestion, "
    "confidence (0-100), needs_deep_analysis (bool), reasoning. "
    "headline: 1 ligne. why: 2 à 5 puces. advice: 1 phrase. "
    "Si identity non établie / risk unknown: JAMAIS fiable. "
    "HTTPS ≠ légitimité. N'invente aucune source. Jamais 100% sûr. Français court."
)


def _overview_for(domain: Optional[str]) -> str:
    host = (domain or "ce site").lower().replace("www.", "")
    if host in ("mcbuleli.org",) or host.endswith(".mcbuleli.org"):
        return "McBuleli.org : plateforme fintech / P2P basée à Kinshasa (RDC)."
    return f"Domaine « {host} » : aperçu limité. Voir les preuves techniques."


def template_explain(req: ExplainRequest) -> ExplainResponse:
    ids = [s.id for s in req.signals]
    overview = _overview_for(req.domain)
    if req.risk_level == "unknown":
        return ExplainResponse(
            overview=overview,
            summary=(
                "Preuves insuffisantes pour confirmer que ce site est légitime. "
                "HTTPS ou DNS ne suffisent pas."
            ),
            recommendation=(
                "Évitez de fournir des informations personnelles tant que l'identité n'est pas confirmée. "
                + DISCLAIMER
            ),
            source_signal_ids=ids,
        )
    if req.risk_level == "low":
        return ExplainResponse(
            overview=overview,
            summary=(
                "Domaine associé à une identité connue. "
                "Aucun signal de fraude important dans les contrôles effectués."
            ),
            recommendation=DISCLAIMER,
            source_signal_ids=ids,
        )
    if req.risk_level == "caution":
        titles = [s.title for s in req.signals if s.severity != "info"][:3]
        extra = f" : {', '.join(titles)}." if titles else "."
        return ExplainResponse(
            overview=overview,
            summary=f"Points d'attention{extra}",
            recommendation=(
                "Ne saisissez pas d'infos sensibles avant de confirmer le site via un canal officiel. "
                + DISCLAIMER
            ),
            source_signal_ids=ids,
        )
    return ExplainResponse(
        overview=overview,
        summary="Plusieurs signaux rappellent des sites frauduleux. Prudence maximale.",
        recommendation=(
            "N'entrez ni mot de passe, ni données bancaires, ni infos personnelles. " + DISCLAIMER
        ),
        source_signal_ids=ids,
    )


def template_analyze(body: Dict[str, Any]) -> AnalyzeResponse:
    risk = str(body.get("risk_level") or "unknown")
    domain = body.get("domain")
    signals = body.get("signals") or []
    ids = [s.get("id") for s in signals if s.get("id")]
    evidence_ids = [e.get("id") for e in (body.get("evidence_ids") or []) if e.get("id")]
    identity = body.get("identity") or {}
    overview = _overview_for(domain if isinstance(domain, str) else None)

    why: List[str] = []
    match = identity.get("match_type")
    if match == "exact_official":
        why.append(f"Domaine associé à {identity.get('identified_entity') or 'une entité connue'}.")
    elif match in ("lookalike", "brand_in_name"):
        why.append(
            f"Usurpation possible de {identity.get('claimed_entity') or 'une marque'} — domaine non officiel."
        )
    else:
        why.append("Aucune identité officielle confirmée pour ce domaine.")

    if (body.get("reputation") or {}).get("status") == "information_not_established":
        why.append("Réputation non établie.")
    if (body.get("technical") or {}).get("https"):
        why.append("HTTPS/TLS présents — preuve technique uniquement, pas de légitimité.")

    for s in signals:
        if s.get("severity") != "info" and s.get("title") and len(why) < 5:
            title = str(s["title"])
            if title not in why:
                why.append(title)

    why = why[:5]
    headlines = {
        "low": "Fiable selon les éléments vérifiés",
        "caution": "Suspect",
        "high": "Dangereux",
        "unknown": "Fiabilité non établie",
    }
    advice_map = {
        "unknown": "Évitez de fournir des informations personnelles tant que l'identité n'est pas confirmée.",
        "caution": "Ne saisissez pas d'infos sensibles avant de confirmer le site via un canal officiel.",
        "high": "N'entrez ni mot de passe, ni données bancaires, ni infos personnelles.",
        "low": "Aucun signal important détecté lors de cette analyse — restez prudent.",
    }
    advice = advice_map.get(risk, advice_map["unknown"])
    verdict_map = {
        "low": "trusted",
        "caution": "suspicious",
        "high": "dangerous",
        "unknown": "unknown",
    }
    needs_deep = risk in ("unknown", "caution", "high") and match != "exact_official"
    summary = why[0] if why else headlines.get(risk, "Analyse incomplète.")

    return AnalyzeResponse(
        headline=headlines.get(risk, "Fiabilité non établie"),
        overview=overview,
        why=why or ["Preuves insuffisantes."],
        advice=advice,
        summary=summary,
        recommendation=f"{advice} {DISCLAIMER}",
        source_signal_ids=ids,
        source_evidence_ids=evidence_ids,
        risk_suggestion=risk,
        verdict_suggestion=verdict_map.get(risk, "unknown"),
        confidence=int(body.get("confidence") or 70),
        needs_deep_analysis=bool(body.get("needs_deep_analysis_hint") or needs_deep),
        reasoning=[f"risk={risk}", f"identity={match or 'n/a'}"],
    )


async def openai_explain(req: ExplainRequest) -> Optional[ExplainResponse]:
    if not OPENAI_API_KEY:
        return None
    allowed = {s.id for s in req.signals}
    system = (
        "Tu es McBuleli AI pour Cyber Alert DRC. "
        "Réponses BRÈVES et structurées. "
        "JSON: overview, summary, recommendation, source_signal_ids. "
        "Si risk_level=unknown: ne jamais dire fiable; HTTPS≠légitimité. "
        "N'invente jamais de vulnérabilité. Jamais 100% sûr. Français simple."
    )
    user = {
        "risk_level": req.risk_level,
        "verdict": req.verdict,
        "confidence": req.confidence,
        "score": req.score,
        "domain": req.domain,
        "url": req.url,
        "signals": [s.model_dump() for s in req.signals],
        "disclaimer": DISCLAIMER,
    }
    payload: Dict[str, Any] = {
        "model": OPENAI_MODEL,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": str(user)},
        ],
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        res = await client.post(
            f"{OPENAI_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if res.status_code >= 400:
            return None
        data = res.json()
        content = data["choices"][0]["message"]["content"]

    parsed = json.loads(content)
    source_ids = [i for i in parsed.get("source_signal_ids", []) if i in allowed]
    if not parsed.get("summary") or not parsed.get("recommendation"):
        return None
    overview = (parsed.get("overview") or parsed.get("site_overview") or "").strip()
    if not overview:
        overview = template_explain(req).overview
    return ExplainResponse(
        overview=overview,
        summary=parsed["summary"],
        recommendation=parsed["recommendation"],
        source_signal_ids=source_ids or list(allowed),
    )


async def openai_analyze(body: Dict[str, Any]) -> Optional[AnalyzeResponse]:
    if not OPENAI_API_KEY:
        return None
    signals = body.get("signals") or []
    allowed_signals = {s.get("id") for s in signals if s.get("id")}
    allowed_evidence = {
        e.get("id") for e in (body.get("evidence_ids") or []) if e.get("id")
    }
    payload: Dict[str, Any] = {
        "model": OPENAI_MODEL,
        "temperature": 0.15,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": ANALYST_SYSTEM},
            {"role": "user", "content": json.dumps(body, ensure_ascii=False)},
        ],
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        res = await client.post(
            f"{OPENAI_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if res.status_code >= 400:
            return None
        data = res.json()
        content = data["choices"][0]["message"]["content"]

    parsed = json.loads(content)
    why = [str(w).strip() for w in (parsed.get("why") or []) if str(w).strip()][:5]
    advice = str(parsed.get("advice") or parsed.get("recommendation") or "").strip()
    summary = str(parsed.get("summary") or "").strip()
    if not why or not advice or not summary:
        return None

    fb = template_analyze(body)
    risk = parsed.get("risk_suggestion") or fb.risk_suggestion
    if risk not in ("low", "unknown", "caution", "high"):
        risk = fb.risk_suggestion
    verdict = parsed.get("verdict_suggestion") or fb.verdict_suggestion
    if verdict not in ("trusted", "likely_trusted", "unknown", "suspicious", "dangerous"):
        verdict = fb.verdict_suggestion

    source_ids = [i for i in parsed.get("source_signal_ids", []) if i in allowed_signals]
    evidence_ids = [i for i in parsed.get("source_evidence_ids", []) if i in allowed_evidence]

    conf = parsed.get("confidence", fb.confidence)
    try:
        conf_i = max(0, min(100, int(conf)))
    except Exception:
        conf_i = fb.confidence

    return AnalyzeResponse(
        headline=str(parsed.get("headline") or fb.headline)[:120],
        overview=str(parsed.get("overview") or fb.overview)[:200],
        why=why,
        advice=advice,
        summary=summary[:400],
        recommendation=advice if "100" in advice else f"{advice} {DISCLAIMER}",
        source_signal_ids=source_ids or fb.source_signal_ids,
        source_evidence_ids=evidence_ids or fb.source_evidence_ids,
        risk_suggestion=str(risk),
        verdict_suggestion=str(verdict),
        confidence=conf_i,
        needs_deep_analysis=bool(parsed.get("needs_deep_analysis", fb.needs_deep_analysis)),
        reasoning=[str(r) for r in (parsed.get("reasoning") or fb.reasoning)][:8],
    )


@app.get("/health")
async def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/explain-link", response_model=ExplainResponse)
async def explain_link(
    req: ExplainRequest,
    _: None = Depends(require_auth),
) -> ExplainResponse:
    ai = await openai_explain(req)
    return ai or template_explain(req)


@app.post("/v1/analyze-link", response_model=AnalyzeResponse)
async def analyze_link(
    body: Dict[str, Any],
    _: None = Depends(require_auth),
) -> AnalyzeResponse:
    """Phase C — McBuleli AI analyste structuré."""
    ai = await openai_analyze(body)
    return ai or template_analyze(body)


@app.post("/v1/prioritize")
async def prioritize(body: Dict[str, Any], _: None = Depends(require_auth)) -> Dict[str, Any]:
    findings = body.get("findings") or []
    order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
    sorted_f = sorted(
        findings,
        key=lambda f: (order.get(str(f.get("severity")), 9), -int(f.get("confidence") or 0)),
    )
    return {
        "ordered_ids": [f.get("id") for f in sorted_f if f.get("id")],
        "rationale": "Priorisation par sévérité puis confiance – données sources uniquement.",
    }


@app.post("/v1/report")
async def report(body: Dict[str, Any], _: None = Depends(require_auth)) -> Dict[str, Any]:
    findings = body.get("findings") or []
    high = [f for f in findings if f.get("severity") in ("critical", "high")]
    executive = (
        "Aucun finding critique ou élevé confirmé."
        if not high
        else "Points prioritaires : " + " – ".join(str(f.get("title")) for f in high[:5])
    )
    technical = "\n".join(f"– [{f.get('severity')}] {f.get('title')}" for f in findings)
    return {
        "executive_summary": executive,
        "technical_summary": technical,
        "source_finding_ids": [f.get("id") for f in findings if f.get("id")],
    }


# --- SafeFind assist (signals only; rules engine decides) ---

SAFEFIND_PARSE_SYSTEM = (
    "Tu es McBuleli AI pour SafeFind (Cyber Alert RDC). Reformule et extrais des champs "
    "depuis une déclaration FR/Lingala (carte_electeur, passeport, permis_conduire). "
    "JSON strict: documentType, holderFirstName, holderLastName, documentNumber, "
    "birthDate (YYYY-MM-DD|null), locationText, locationPrecision "
    "(commune|quartier|landmark|gps|null), dateEstimate, timePeriod, visualHints, "
    "reformulatedSummary (1 phrase FR), intention (lost|found|null), confidence (0-1). "
    "Si nom/numéro/date cités, remplis-les. Pas de GPS inventé. Remplace — par -."
)

SAFEFIND_MATCH_SYSTEM = (
    "Tu es McBuleli AI SafeFind. Compare deux fiches DÉJÀ MASQUÉES. JSON: potentialMatch (bool), "
    "confidence (0-1), reasons (string[]), riskFlags (string[]), recommendedAction "
    "(review|verify|ignore). Jamais ownership proof."
)

SAFEFIND_ANOMALY_SYSTEM = (
    "Tu es McBuleli AI SafeFind antifraud. Analyse une chronologie SANS PII. JSON: "
    "riskFlags (string[]), recommendedAction (review|dispute|lock|continue), "
    "explanation (string courte FR). Tu signales seulement."
)

SAFEFIND_DOCUMENT_VISION_SYSTEM = (
    "Tu es McBuleli AI pour SafeFind (Cyber Alert RDC). Analyse une photo de pièce "
    "d'identité congolaise (carte_electeur, passeport, permis_conduire).\n\n"
    "Règles RDC SafeFind:\n"
    "CARTE_ELECTEUR (CENI): Photo à gauche (NE PAS brouiller). "
    "Numéro National (NN): 11 chiffres, champ NN en haut à droite = documentNumber principal. "
    "Numéro sous photo: 14 caractères alphanumériques = photoCardNumber (distinct du NN). "
    "QR CENI: 3 segments / → 14 car. / 11 car. NN / 11 car. bureau de vote. "
    "Si QR lu: documentNumber = segment NN, jamais le n° 14 car. sous photo.\n"
    "PASSEPORT biométrique RDC (DERMALOG): cropBox = page biodata uniquement. "
    "Brouiller n° passeport, noms, dates, MRZ, signature — photo visible.\n"
    "PERMIS RDC (plusieurs modèles): biométrique récent (carte CB, MRZ 3 lignes) ou classique ZRE "
    "(photo gauche, champs 1-12, MRZ 1 ligne D1COD en bas). documentNumber = n° permis; photo visible.\n\n"
    "JSON strict: documentType, holderFirstName, holderLastName, holderPostName, "
    "documentNumber, photoCardNumber, enrollmentBureauCode, birthDate (YYYY-MM-DD|null), "
    "birthPlace, qrPayload (texte QR brut si lu), confidence (0-1), "
    "cropBox {x,y,w,h}, blurRegions [{x,y,w,h,field}] valeurs sensibles uniquement. "
    "Remplace — par -."
)


async def openai_vision_json(
    system: str,
    image_b64: str,
    user_text: str,
) -> Optional[Dict[str, Any]]:
    if not OPENAI_API_KEY or not image_b64:
        return None
    vision_model = "gpt-4o-mini"
    payload: Dict[str, Any] = {
        "model": vision_model,
        "temperature": 0.05,
        "max_tokens": 1400,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_text[:1200]},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_b64[:2_000_000]}",
                            "detail": "high",
                        },
                    },
                ],
            },
        ],
    }
    async with httpx.AsyncClient(timeout=28.0) as client:
        res = await client.post(
            f"{OPENAI_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if res.status_code >= 400:
            return None
        data = res.json()
        content = data["choices"][0]["message"]["content"]
    return json.loads(content)


async def openai_json(system: str, user: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not OPENAI_API_KEY:
        return None
    payload: Dict[str, Any] = {
        "model": OPENAI_MODEL,
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(user, ensure_ascii=False)},
        ],
    }
    async with httpx.AsyncClient(timeout=18.0) as client:
        res = await client.post(
            f"{OPENAI_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if res.status_code >= 400:
            return None
        data = res.json()
        content = data["choices"][0]["message"]["content"]
    return json.loads(content)


def template_safefind_parse(text: str) -> Dict[str, Any]:
    raw = (text or "").replace("\u2014", "-").strip()
    t = raw.lower()
    doc = None
    if "passeport" in t or "passport" in t:
        doc = "passeport"
    elif "permis" in t:
        doc = "permis_conduire"
    elif "carte" in t or "electeur" in t or "électeur" in t or "ceni" in t:
        doc = "carte_electeur"
    precision = None
    if any(x in t for x in ("près", "pembeni", "chez", "arrêt", "marché", "upn")):
        precision = "landmark"
    elif "quartier" in t:
        precision = "quartier"
    elif any(x in t for x in ("gombe", "ngaliema", "limete", "kinshasa", "selembao")):
        precision = "commune"
    intention = None
    if any(x in t for x in ("trouv", "retrouv", "ramass", "na moni")):
        intention = "found"
    elif any(x in t for x in ("perdu", "nabungi", "lost")):
        intention = "lost"
    label = {
        "passeport": "passeport",
        "permis_conduire": "permis de conduire",
        "carte_electeur": "carte d'électeur",
    }.get(doc or "", "pièce d'identité")
    summary = f"{'Pièce retrouvée' if intention == 'found' else 'Pièce déclarée perdue'} - {label}"
    return {
        "documentType": doc,
        "holderFirstName": None,
        "holderLastName": None,
        "documentNumber": None,
        "birthDate": None,
        "locationText": raw[:200],
        "locationPrecision": precision,
        "dateEstimate": None,
        "timePeriod": None,
        "visualHints": {},
        "reformulatedSummary": summary[:180],
        "intention": intention,
        "confidence": 0.4 if doc else 0.2,
    }


@app.post("/v1/safefind/parse-declaration")
async def safefind_parse_declaration(
    body: Dict[str, Any],
    _: None = Depends(require_auth),
) -> Dict[str, Any]:
    text = str(body.get("text") or "")[:800]
    ai = await openai_json(SAFEFIND_PARSE_SYSTEM, {"text": text})
    return ai or template_safefind_parse(text)


@app.post("/v1/safefind/match-assist")
async def safefind_match_assist(
    body: Dict[str, Any],
    _: None = Depends(require_auth),
) -> Dict[str, Any]:
    ai = await openai_json(
        SAFEFIND_MATCH_SYSTEM,
        {"lost": body.get("lost"), "found": body.get("found")},
    )
    if ai:
        return ai
    lost = body.get("lost") or {}
    found = body.get("found") or {}
    reasons = []
    conf = 0.2
    if lost.get("documentType") == found.get("documentType"):
        reasons.append("same document type")
        conf += 0.25
    if lost.get("commune") and lost.get("commune") == found.get("commune"):
        reasons.append("same area")
        conf += 0.2
    potential = conf >= 0.55
    return {
        "potentialMatch": potential,
        "confidence": min(0.9, conf),
        "reasons": reasons,
        "riskFlags": [],
        "recommendedAction": "verify" if potential else "ignore",
    }


@app.post("/v1/safefind/anomaly-hint")
async def safefind_anomaly_hint(
    body: Dict[str, Any],
    _: None = Depends(require_auth),
) -> Dict[str, Any]:
    ai = await openai_json(SAFEFIND_ANOMALY_SYSTEM, body)
    if ai:
        return ai
    reasons = body.get("reasons") or []
    return {
        "riskFlags": reasons[:6],
        "recommendedAction": "dispute" if reasons else "continue",
        "explanation": (
            "Incohérences: " + ", ".join(map(str, reasons[:4]))
            if reasons
            else "Aucune anomalie évidente."
        ),
    }


@app.post("/v1/safefind/parse-document")
async def safefind_parse_document(
    body: Dict[str, Any],
    _: None = Depends(require_auth),
) -> Dict[str, Any]:
    image_b64 = str(body.get("imageBase64") or "").strip()
    hint = str(body.get("documentTypeHint") or "")
    qr_payload = str(body.get("qrPayload") or "").strip()
    user_text = (
        f"Type attendu: {hint or 'auto'}. "
        "Lis la pièce, extrais champs et blurRegions (valeurs seulement, photo visible)."
    )
    if qr_payload:
        user_text += f"\nQR CENI lu côté client: {qr_payload[:120]}"
    ai = await openai_vision_json(SAFEFIND_DOCUMENT_VISION_SYSTEM, image_b64, user_text)
    if ai:
        return ai
    return {
        "documentType": hint if hint in ("carte_electeur", "passeport", "permis_conduire") else None,
        "holderFirstName": None,
        "holderLastName": None,
        "holderPostName": None,
        "documentNumber": None,
        "photoCardNumber": None,
        "enrollmentBureauCode": None,
        "birthDate": None,
        "birthPlace": None,
        "confidence": 0.15,
        "cropBox": {"x": 0.04, "y": 0.06, "w": 0.92, "h": 0.88},
        "blurRegions": [],
    }

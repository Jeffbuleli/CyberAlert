from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="Cyber Alert DRC - McBuleli AI Gateway", version="1.0.0")

SECRET = os.getenv("AI_GATEWAY_SECRET", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


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


class ExplainResponse(BaseModel):
    summary: str
    recommendation: str
    source_signal_ids: List[str]


def require_auth(authorization: Optional[str] = Header(default=None)) -> None:
    if not SECRET:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="unauthorized")
    token = authorization.removeprefix("Bearer ").strip()
    if token != SECRET:
        raise HTTPException(status_code=401, detail="unauthorized")


DISCLAIMER = (
    "Cette analyse ne garantit pas qu'un site est sûr à 100 %. "
    "Restez prudent avant de fournir des informations personnelles, bancaires ou des mots de passe."
)


def template_explain(req: ExplainRequest) -> ExplainResponse:
    ids = [s.id for s in req.signals]
    if req.risk_level == "low":
        return ExplainResponse(
            summary="Aucun signal important indiquant une fraude n'a été détecté parmi les contrôles effectués.",
            recommendation=DISCLAIMER,
            source_signal_ids=ids,
        )
    if req.risk_level == "caution":
        titles = [s.title for s in req.signals if s.severity != "info"][:5]
        extra = f" : {', '.join(titles)}." if titles else "."
        return ExplainResponse(
            summary=f"Certains éléments nécessitent votre attention{extra}",
            recommendation=(
                "Ne saisissez pas vos informations sensibles tant que vous n'avez pas confirmé "
                f"l'identité du site par un canal officiel. {DISCLAIMER}"
            ),
            source_signal_ids=ids,
        )
    return ExplainResponse(
        summary=(
            "Plusieurs indicateurs correspondent à des caractéristiques fréquemment observées "
            "sur des sites frauduleux."
        ),
        recommendation=(
            "Ne saisissez pas votre mot de passe, vos informations bancaires ou vos données "
            f"personnelles sur ce site. {DISCLAIMER}"
        ),
        source_signal_ids=ids,
    )


async def openai_explain(req: ExplainRequest) -> Optional[ExplainResponse]:
    if not OPENAI_API_KEY:
        return None
    allowed = {s.id for s in req.signals}
    system = (
        "Tu es McBuleli AI pour Cyber Alert DRC. "
        "Tu EXPLIQUES uniquement les signaux fournis. "
        "Tu n'inventes JAMAIS de vulnérabilité ni de preuve. "
        "Réponds en JSON avec keys: summary, recommendation, source_signal_ids. "
        "source_signal_ids doit être un sous-ensemble des ids fournis. "
        "Langue: français simple, grand public."
    )
    user = {
        "risk_level": req.risk_level,
        "score": req.score,
        "domain": req.domain,
        "url": req.url,
        "signals": [s.model_dump() for s in req.signals],
        "disclaimer": DISCLAIMER,
    }
    payload: Dict[str, Any] = {
        "model": OPENAI_MODEL,
        "temperature": 0.1,
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
    import json

    parsed = json.loads(content)
    source_ids = [i for i in parsed.get("source_signal_ids", []) if i in allowed]
    if not parsed.get("summary") or not parsed.get("recommendation"):
        return None
    return ExplainResponse(
        summary=parsed["summary"],
        recommendation=parsed["recommendation"],
        source_signal_ids=source_ids or list(allowed),
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
        "rationale": "Priorisation par sévérité puis confiance — données sources uniquement.",
    }


@app.post("/v1/report")
async def report(body: Dict[str, Any], _: None = Depends(require_auth)) -> Dict[str, Any]:
    findings = body.get("findings") or []
    high = [f for f in findings if f.get("severity") in ("critical", "high")]
    executive = (
        "Aucun finding critique ou élevé confirmé."
        if not high
        else "Points prioritaires : " + " - ".join(str(f.get("title")) for f in high[:5])
    )
    technical = "\n".join(
        f"- [{f.get('severity')}] {f.get('title')}" for f in findings
    )
    return {
        "executive_summary": executive,
        "technical_summary": technical,
        "source_finding_ids": [f.get("id") for f in findings if f.get("id")],
    }

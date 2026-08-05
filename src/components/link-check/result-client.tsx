"use client";

import { useEffect, useState } from "react";
import { LinkCheckResultView } from "@/components/link-check/result-view";
import type { LinkSignal, RiskLevel, Verdict } from "@/types/security";
import { IconSpinner } from "@/components/icons";

type Props = {
  id: string;
  url: string;
  domain?: string | null;
  riskLevel: RiskLevel;
  score: number;
  confidence?: number | null;
  verdict?: Verdict | null;
  overview?: string | null;
  summary: string;
  recommendation: string;
  signals: LinkSignal[];
  aiProvider?: "template" | "mcbuleli-ai" | null;
  why?: string[] | null;
  headline?: string | null;
  needsDeepAnalysis?: boolean;
  incomplete?: boolean;
  initialStatus?: string;
  analyzedAt?: string | null;
  cacheHit?: boolean;
};

export function LinkCheckResultClient(props: Props) {
  const [status, setStatus] = useState(props.initialStatus || "completed");
  const [live, setLive] = useState(props);
  const deep =
    status === "deep_analysis" ||
    status === "queued" ||
    status === "running" ||
    status === "awaiting_local_agent";

  useEffect(() => {
    if (!deep) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/link-checks/${props.id}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        setStatus(data.status || "completed");
        const ai = (data.aiAnalysis || {}) as {
          headline?: string;
          why?: string[];
          incomplete?: boolean;
        };
        setLive((prev) => ({
          ...prev,
          riskLevel: data.riskLevel,
          verdict: data.verdict,
          confidence: data.confidence,
          score: data.score,
          summary: data.summary || prev.summary,
          recommendation: data.recommendation || prev.recommendation,
          overview: data.overview ?? prev.overview,
          signals: data.signals || prev.signals,
          why: Array.isArray(ai.why) ? ai.why : prev.why,
          headline: typeof ai.headline === "string" ? ai.headline : prev.headline,
          needsDeepAnalysis: data.needsDeepAnalysis,
          incomplete: Boolean(ai.incomplete ?? data.hackerai?.incomplete),
          initialStatus: data.status,
        }));
      } catch {
        /* ignore */
      }
    };
    const id = setInterval(tick, 2500);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [deep, props.id]);

  return (
    <div className="space-y-4">
      {deep ? (
        <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-[22px] border border-[var(--ca-border)] bg-white px-4 py-3 text-sm text-[var(--ca-ink)] shadow-[var(--ca-shadow-soft)]">
          <IconSpinner size={18} className="text-[var(--ca-accent)]" />
          <div>
            <p className="font-semibold">Analyse approfondie en cours…</p>
            <p className="text-[var(--ca-ink-muted)]">
              HackerAI / investigation asynchrone — l&apos;interface reste utilisable. Statut :{" "}
              {status}
            </p>
          </div>
        </div>
      ) : null}
      {props.cacheHit || live.cacheHit ? (
        <p className="mx-auto max-w-3xl text-center text-xs text-[var(--ca-ink-subtle)]">
          Résultat issu du cache
          {props.analyzedAt
            ? ` — dernière analyse : ${new Date(props.analyzedAt).toLocaleString("fr-FR")}`
            : ""}
        </p>
      ) : null}
      <LinkCheckResultView {...live} />
    </div>
  );
}

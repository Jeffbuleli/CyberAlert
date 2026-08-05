"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Input, SurfaceCard } from "@/components/ui/primitives";
import { IconSearch } from "@/components/icons";

type Asset = {
  id: string;
  label: string;
  url: string;
  domain: string | null;
  lastVerdict: string | null;
  lastRiskLevel: string | null;
  lastConfidence: number | null;
  lastCheckedAt: string | null;
  lastSummary: string | null;
};

function tone(risk: string | null) {
  if (risk === "low") return "low" as const;
  if (risk === "caution") return "caution" as const;
  if (risk === "high") return "high" as const;
  return "unknown" as const;
}

export function OrgAssetsClient({
  initialAssets,
  limit,
}: {
  initialAssets: Asset[];
  limit: number;
}) {
  const router = useRouter();
  const [assets, setAssets] = useState(initialAssets);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/org/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Ajout impossible.");
        return;
      }
      setAssets((prev) => [data.asset, ...prev]);
      setLabel("");
      setUrl("");
      router.refresh();
    } catch {
      setError("Erreur réseau.");
    } finally {
      setAdding(false);
    }
  }

  async function onCheck(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/org/assets/${id}/check`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Vérification impossible.");
        return;
      }
      setAssets((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                lastVerdict: data.verdict,
                lastRiskLevel: data.riskLevel,
                lastConfidence: data.confidence,
                lastCheckedAt: new Date().toISOString(),
              }
            : a,
        ),
      );
      router.refresh();
    } catch {
      setError("Erreur réseau.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <SurfaceCard className="p-4 sm:p-5">
        <h2 className="text-base font-bold text-[var(--ca-ink)]">Ajouter un actif</h2>
        <p className="mt-1 text-sm text-[var(--ca-ink-muted)]">
          Inventaire léger — max {limit} URLs. Vérification via Evidence Engine (pas d&apos;exploit).
        </p>
        <form onSubmit={onAdd} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.4fr_auto]">
          <Input
            placeholder="Label (ex. Site corporate)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
          />
          <Input
            placeholder="https://exemple.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
          <Button type="submit" disabled={adding}>
            {adding ? "…" : "Ajouter"}
          </Button>
        </form>
        {error ? (
          <p className="mt-3 text-sm font-medium text-[var(--ca-high)]">{error}</p>
        ) : null}
      </SurfaceCard>

      <ul className="space-y-3">
        {assets.map((a) => (
          <li key={a.id}>
            <SurfaceCard className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-[var(--ca-ink)]">{a.label}</p>
                  <Badge tone={tone(a.lastRiskLevel)}>
                    {a.lastVerdict || a.lastRiskLevel || "non vérifié"}
                  </Badge>
                </div>
                <p className="mt-1 break-all text-sm text-[var(--ca-ink-muted)]">{a.url}</p>
                {a.lastSummary ? (
                  <p className="mt-2 text-sm text-[var(--ca-ink-muted)]">{a.lastSummary}</p>
                ) : null}
                {a.lastRiskLevel === "unknown" ? (
                  <p className="mt-1 text-xs font-semibold text-[var(--ca-unknown)]">
                    UNKNOWN ≠ SAFE
                  </p>
                ) : null}
              </div>
              <Button
                variant="secondary"
                disabled={busyId === a.id}
                onClick={() => onCheck(a.id)}
              >
                <IconSearch size={16} />
                {busyId === a.id ? "Vérif…" : "Vérifier"}
              </Button>
            </SurfaceCard>
          </li>
        ))}
        {assets.length === 0 ? (
          <li className="text-sm text-[var(--ca-ink-muted)]">Aucun actif pour l&apos;instant.</li>
        ) : null}
      </ul>
    </div>
  );
}

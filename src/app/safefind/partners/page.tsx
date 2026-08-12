"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Partner = {
  id: string;
  name: string;
  commune: string;
  address?: string;
  distanceKm: number | null;
  securityScore: number;
  capacityStatus?: string | null;
};

export default function SafefindPartnersPage() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("partner");
  const [partners, setPartners] = useState<Partner[]>([]);
  const [commune, setCommune] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(c?: string, coords?: { lat: number; lng: number }) {
    setLoading(true);
    const q = new URLSearchParams();
    if (c) q.set("commune", c);
    if (coords) {
      q.set("lat", String(coords.lat));
      q.set("lng", String(coords.lng));
    }
    const res = await fetch(`/api/safefind/partners/nearby?${q}`);
    const data = await res.json();
    setPartners(data.partners ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => load(undefined, { lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => load(),
      );
    } else {
      load();
    }
  }, []);

  const highlighted = useMemo(
    () => (highlightId ? partners.find((p) => p.id === highlightId) : null),
    [highlightId, partners],
  );

  const sorted = useMemo(() => {
    if (!highlightId) return partners;
    return [...partners].sort((a, b) => {
      if (a.id === highlightId) return -1;
      if (b.id === highlightId) return 1;
      return (a.distanceKm ?? 999) - (b.distanceKm ?? 999);
    });
  }, [highlightId, partners]);

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-lg px-4 pb-16 pt-6">
      <Link href="/" className="text-sm text-[var(--ca-ink-muted)]">
        ← SafeFind
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Points SafeFind</h1>
      <p className="mt-1 text-sm text-[var(--ca-ink-muted)]">
        {highlightId
          ? "Point lié à votre dossier — dépôt gratuit pour le trouveur."
          : "Annuaire des points partenaires — Kinshasa."}
      </p>

      {highlighted ? (
        <div className="mt-4 rounded-2xl border border-emerald-600/40 bg-emerald-600/5 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
            Votre point de dépôt
          </p>
          <p className="mt-1 font-semibold text-[var(--ca-ink)]">{highlighted.name}</p>
          <p className="text-sm text-[var(--ca-ink-muted)]">
            {highlighted.commune}
            {highlighted.address ? ` · ${highlighted.address}` : ""}
          </p>
          <Link
            href="/?view=mine&mode=found"
            className="mt-3 inline-flex text-sm font-medium text-[var(--ca-accent)] underline-offset-2 hover:underline"
          >
            Retour à mon dossier
          </Link>
        </div>
      ) : null}

      <div className="mt-4 flex gap-2">
        <input
          className="flex-1 rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-3 py-2.5 text-sm"
          placeholder="Commune"
          value={commune}
          onChange={(e) => setCommune(e.target.value)}
        />
        <button
          type="button"
          onClick={() => load(commune)}
          className="rounded-xl bg-[var(--ca-surface-2)] px-4 text-sm ring-1 ring-[var(--ca-border)]"
        >
          Filtrer
        </button>
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-[var(--ca-ink-muted)]">Chargement…</p>
      ) : sorted.length === 0 ? (
        <p className="mt-8 text-sm text-[var(--ca-ink-muted)]">
          Aucun point actif pour le moment.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {sorted.map((p) => {
            const isHighlight = p.id === highlightId;
            return (
              <li
                key={p.id}
                className={`rounded-2xl border p-4 ${
                  isHighlight
                    ? "border-emerald-600/50 bg-emerald-600/5"
                    : "border-[var(--ca-border)] bg-[var(--ca-surface-raised)]/90"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {p.name}
                      {isHighlight ? (
                        <span className="ml-2 text-xs font-bold text-emerald-700">
                          · Assigné
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-[var(--ca-ink-muted)]">
                      {p.commune}
                      {p.address ? ` · ${p.address}` : ""}
                    </p>
                  </div>
                  <span className="rounded-lg bg-[var(--ca-accent)]/15 px-2 py-1 text-xs text-[var(--ca-accent)]">
                    {p.securityScore}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--ca-ink-muted)]">
                  {p.distanceKm != null ? <span>{p.distanceKm.toFixed(1)} km</span> : null}
                  {p.capacityStatus && p.capacityStatus !== "AVAILABLE" ? (
                    <span className="text-amber-500">{p.capacityStatus}</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

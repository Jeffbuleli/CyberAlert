"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Partner = {
  id: string;
  name: string;
  commune: string;
  distanceKm: number | null;
  estimatedTransportCostCdf: number | null;
  securityScore: number;
};

export default function SafefindPartnersPage() {
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

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-lg px-4 pb-16 pt-6">
      <Link href="/safefind" className="text-sm text-[var(--ca-ink-muted)]">
        ← SafeFind
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Points SafeFind</h1>
      <p className="mt-1 text-sm text-[var(--ca-ink-muted)]">
        Proximité privilégiée - Kinshasa.
      </p>

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
      ) : partners.length === 0 ? (
        <p className="mt-8 text-sm text-[var(--ca-ink-muted)]">
          Aucun point actif pour l’instant.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {partners.map((p) => (
            <li
              key={p.id}
              className="rounded-2xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)]/90 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-[var(--ca-ink-muted)]">{p.commune}</p>
                </div>
                <span className="rounded-lg bg-[var(--ca-accent)]/15 px-2 py-1 text-xs text-[var(--ca-accent)]">
                  {p.securityScore}
                </span>
              </div>
              <div className="mt-3 flex gap-4 text-xs text-[var(--ca-ink-muted)]">
                {p.distanceKm != null ? (
                  <span>{p.distanceKm.toFixed(1)} km</span>
                ) : null}
                {p.estimatedTransportCostCdf != null ? (
                  <span>~{p.estimatedTransportCostCdf} CDF</span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

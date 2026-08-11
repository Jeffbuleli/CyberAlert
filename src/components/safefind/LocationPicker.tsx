"use client";

import { useEffect, useMemo, useState } from "react";
import { KINSHASA_COMMUNES } from "@/lib/safefind/location/types";

export type PickedLocation = {
  locationId: string | null;
  commune: string;
  quartier: string;
  landmark: string;
  latitude: number | null;
  longitude: number | null;
  precision: string;
  label: string;
  partners: Array<{
    id: string;
    name: string;
    commune: string;
    distanceKm: number;
    capacityStatus: string | null;
  }>;
};

type Mode = "search" | "gps" | "manual" | "map";

type Props = {
  value: PickedLocation;
  onChange: (v: PickedLocation) => void;
  label?: string;
};

type Suggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  fullText: string;
  local?: boolean;
};

export function LocationPicker({ value, onChange, label }: Props) {
  const [mode, setMode] = useState<Mode>("search");
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sessionToken = useMemo(
    () => Math.random().toString(36).slice(2, 14),
    [],
  );

  useEffect(() => {
    if (mode !== "search" || q.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/safefind/locations/autocomplete?q=${encodeURIComponent(q)}&sessionToken=${sessionToken}`,
        );
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
      } catch {
        setSuggestions([]);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [q, mode, sessionToken]);

  async function resolve(body: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/safefind/locations/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "resolve_failed");
        return;
      }
      const loc = data.location as {
        commune?: string;
        quartier?: string;
        landmark?: string;
        latitude?: number | null;
        longitude?: number | null;
        precision?: string;
        label?: string | null;
      };
      onChange({
        locationId: data.locationId,
        commune: loc.commune ?? value.commune,
        quartier: loc.quartier ?? value.quartier,
        landmark: loc.landmark ?? value.landmark,
        latitude: loc.latitude ?? null,
        longitude: loc.longitude ?? null,
        precision: loc.precision ?? "APPROXIMATE",
        label: loc.label ?? "",
        partners: (data.partners ?? []).map(
          (p: {
            id: string;
            name: string;
            commune: string;
            distanceKm: number;
            capacityStatus: string | null;
          }) => p,
        ),
      });
    } catch {
      setErr("Erreur reseau");
    } finally {
      setBusy(false);
    }
  }

  async function useGps() {
    setMode("gps");
    if (!navigator.geolocation) {
      setErr("GPS indisponible");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await resolve({
          mode: "gps",
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          precision: "EXACT",
        });
      },
      () => {
        setBusy(false);
        setErr("Position refusee");
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] p-4">
      <p className="text-sm font-medium text-[var(--ca-ink)]">
        {label ?? "Ou avez-vous trouve / perdu la piece ?"}
      </p>
      <div className="flex flex-wrap gap-2 text-xs">
        {(
          [
            ["search", "Rechercher"],
            ["gps", "Ma position"],
            ["manual", "Commune"],
            ["map", "Approximatif"],
          ] as const
        ).map(([k, lab]) => (
          <button
            key={k}
            type="button"
            onClick={() => (k === "gps" ? useGps() : setMode(k))}
            className={`rounded-lg px-3 py-1.5 ${
              mode === k
                ? "bg-[var(--ca-accent)] text-white"
                : "bg-[var(--ca-surface)] text-[var(--ca-ink-muted)]"
            }`}
          >
            {lab}
          </button>
        ))}
      </div>

      {mode === "search" ? (
        <div>
          <input
            className="w-full rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface)] px-3 py-2.5 text-sm"
            placeholder="Marche de..., Rond-point Ngaba..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {suggestions.length > 0 ? (
            <ul className="mt-2 max-h-48 overflow-auto rounded-xl border border-[var(--ca-border)]">
              {suggestions.map((s) => (
                <li key={s.placeId}>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--ca-surface)]"
                    onClick={() =>
                      resolve(
                        s.placeId.startsWith("local:")
                          ? { mode: "manual", placeId: s.placeId }
                          : { mode: "place_id", placeId: s.placeId },
                      )
                    }
                  >
                    <span className="font-medium">{s.primaryText}</span>
                    <span className="mt-0.5 block text-xs text-[var(--ca-ink-muted)]">
                      {s.secondaryText}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {mode === "manual" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-[var(--ca-ink-muted)]">Commune</span>
            <select
              className="mt-1 w-full rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface)] px-3 py-2.5"
              value={value.commune}
              onChange={(e) =>
                onChange({ ...value, commune: e.target.value, locationId: null })
              }
            >
              <option value="">Choisir</option>
              {KINSHASA_COMMUNES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-[var(--ca-ink-muted)]">Quartier / lieu connu</span>
            <input
              className="mt-1 w-full rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface)] px-3 py-2.5"
              value={value.landmark || value.quartier}
              onChange={(e) =>
                onChange({
                  ...value,
                  landmark: e.target.value,
                  quartier: e.target.value,
                  locationId: null,
                })
              }
              placeholder="Chez Mama X, devant Rawbank..."
            />
          </label>
          <button
            type="button"
            disabled={busy || !value.commune}
            className="sm:col-span-2 rounded-xl bg-[var(--ca-accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={() =>
              resolve({
                mode: "manual",
                commune: value.commune,
                quartier: value.quartier || undefined,
                landmark: value.landmark || undefined,
                precision: value.landmark ? "LANDMARK" : "COMMUNE",
              })
            }
          >
            Valider le lieu
          </button>
        </div>
      ) : null}

      {mode === "map" ? (
        <div className="space-y-2 text-sm">
          <p className="text-xs text-[var(--ca-ink-muted)]">
            Placez approximativement (lat / lng). Utile hors couverture Google.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface)] px-3 py-2"
              placeholder="Latitude"
              value={value.latitude ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  latitude: e.target.value ? Number(e.target.value) : null,
                  locationId: null,
                })
              }
            />
            <input
              className="rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface)] px-3 py-2"
              placeholder="Longitude"
              value={value.longitude ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  longitude: e.target.value ? Number(e.target.value) : null,
                  locationId: null,
                })
              }
            />
          </div>
          <button
            type="button"
            disabled={
              busy || value.latitude == null || value.longitude == null
            }
            className="w-full rounded-xl bg-[var(--ca-accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={() =>
              resolve({
                mode: "map_pin",
                latitude: value.latitude,
                longitude: value.longitude,
                precision: "APPROXIMATE",
              })
            }
          >
            Enregistrer le pin
          </button>
        </div>
      ) : null}

      {value.label || value.locationId ? (
        <p className="text-xs text-[var(--ca-ink-muted)]">
          Lieu: {value.label || value.commune} · precision {value.precision}
        </p>
      ) : null}

      {value.partners.length > 0 ? (
        <div className="rounded-xl border border-[var(--ca-border)]/60 p-3">
          <p className="text-xs font-medium text-[var(--ca-ink)]">
            Points SafeFind les plus proches
          </p>
          <ul className="mt-2 space-y-1 text-xs text-[var(--ca-ink-muted)]">
            {value.partners.slice(0, 5).map((p) => (
              <li key={p.id}>
                {p.name} - {p.distanceKm.toFixed(1)} km
                {p.capacityStatus && p.capacityStatus !== "AVAILABLE"
                  ? ` (${p.capacityStatus})`
                  : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {err ? <p className="text-xs text-red-400">{err}</p> : null}
      {busy ? (
        <p className="text-xs text-[var(--ca-ink-muted)]">Localisation...</p>
      ) : null}
    </div>
  );
}

export const emptyPickedLocation = (): PickedLocation => ({
  locationId: null,
  commune: "",
  quartier: "",
  landmark: "",
  latitude: null,
  longitude: null,
  precision: "APPROXIMATE",
  label: "",
  partners: [],
});

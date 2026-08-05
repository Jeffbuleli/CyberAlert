"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand/logo";
import { Badge, Button, Input, MetaChip, SurfaceCard } from "@/components/ui/primitives";
import { IconSearch } from "@/components/icons";

export function NewScanForm({
  projects,
}: {
  projects: { id: string; name: string; url: string }[];
}) {
  const router = useRouter();
  const [url, setUrl] = useState(projects[0]?.url || "");
  const [name, setName] = useState(projects[0]?.name || "Mon projet");
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!authorized) {
      setError("Cochez l'autorisation pour confirmer que vous contrôlez cette URL.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, projectName: name, authorized: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error === "quota_exceeded"
            ? "Quota de scans épuisé. Passez à Developer Pro pour continuer."
            : data.error === "authorization_required"
              ? data.message
              : data.message || "Scan impossible.",
        );
        return;
      }
      router.push(`/dashboard/scans/${data.id}`);
      router.refresh();
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SurfaceCard className="overflow-hidden p-0">
      <div className="flex items-center gap-3 border-b border-[var(--ca-border)] bg-[var(--ca-accent-soft)]/40 px-4 py-3">
        <BrandLogo size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--ca-accent)]">
            Nouveau scan
          </p>
          <p className="truncate text-sm font-bold text-[var(--ca-ink)]">Analyse non intrusive</p>
        </div>
        <Badge tone="info">Free / Pro</Badge>
      </div>
      <form onSubmit={onSubmit} className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          <MetaChip label={"Pas d'exploitation"} />
          <MetaChip label="Evidence → Verdict" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[var(--ca-ink)]">
            Nom du projet
          </label>
          <Input
            placeholder="Mon application"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[var(--ca-ink)]">
            URL à scanner
          </label>
          <Input
            placeholder="https://votre-app.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
        </div>
        {projects.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {projects.slice(0, 4).map((p) => (
              <button
                key={p.id}
                type="button"
                className="rounded-full border border-[var(--ca-border)] bg-white px-2.5 py-1 text-[10px] font-bold text-[var(--ca-ink-muted)] hover:border-[var(--ca-accent)] hover:text-[var(--ca-accent)]"
                onClick={() => {
                  setName(p.name);
                  setUrl(p.url);
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        ) : null}
        <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl border border-[var(--ca-border)] bg-white/80 px-3 py-2.5 text-sm text-[var(--ca-ink-muted)]">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 shrink-0 accent-[var(--ca-accent)]"
            checked={authorized}
            onChange={(e) => setAuthorized(e.target.checked)}
            required
          />
          <span>
            J&apos;autorise un scan <strong className="text-[var(--ca-ink)]">non destructif</strong> de
            cette URL que je contrôle. Aucune exploitation / fuzz agressif.
          </span>
        </label>
        {error ? (
          <p className="rounded-2xl border border-[var(--ca-high)]/20 bg-[var(--ca-high-soft)] px-3 py-2 text-sm font-medium text-[var(--ca-high)]">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={loading || !authorized} className="w-full">
          <IconSearch size={18} />
          {loading ? "Scan en cours..." : "Lancer le scan"}
        </Button>
      </form>
    </SurfaceCard>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand/logo";
import { Badge, Button, MetaChip, SurfaceCard, TextArea } from "@/components/ui/primitives";
import {
  categoryLabel,
  domainFromUrl,
  shortReportId,
  statusMeta,
} from "@/lib/reports/labels";

export type AdminReport = {
  id: string;
  url: string;
  category: string;
  comment: string | null;
  source: string | null;
  moderationStatus: string;
  moderatorNote: string | null;
  createdAt: string | Date;
};

type Tab = "pending" | "recent";

function formatWhen(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ReportModeration({
  pending,
  recent,
}: {
  pending: AdminReport[];
  recent?: AdminReport[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const list = useMemo(
    () => (tab === "pending" ? pending : recent || []),
    [tab, pending, recent],
  );

  async function setStatus(id: string, moderationStatus: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moderationStatus,
          moderatorNote: notes[id]?.trim() || undefined,
        }),
      });
      if (!res.ok) {
        setError("Action impossible. Réessayez.");
        return;
      }
      router.refresh();
    } catch {
      setError("Erreur réseau.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BrandLogo size={44} />
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--ca-accent)]">
              File · Signalements
            </p>
            <h2 className="text-lg font-extrabold text-[var(--ca-ink)]">Modération</h2>
          </div>
        </div>
        <div className="flex rounded-2xl border border-[var(--ca-border)] bg-white/80 p-1 shadow-sm">
          {(
            [
              { id: "pending" as const, label: `En attente (${pending.length})` },
              { id: "recent" as const, label: `Récents (${recent?.length || 0})` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                tab === t.id
                  ? "bg-[var(--ca-panther)] text-white"
                  : "text-[var(--ca-ink-muted)] hover:text-[var(--ca-ink)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="mt-3 rounded-2xl border border-[var(--ca-high)]/20 bg-[var(--ca-high-soft)] px-3 py-2 text-sm text-[var(--ca-high)]">
          {error}
        </p>
      ) : null}

      {!list.length ? (
        <SurfaceCard className="mt-4 p-6 text-center">
          <BrandLogo size={52} className="mx-auto" />
          <p className="mt-3 font-bold text-[var(--ca-ink)]">
            {tab === "pending" ? "File vide" : "Aucun historique récent"}
          </p>
          <p className="mt-1 text-sm text-[var(--ca-ink-muted)]">
            {tab === "pending"
              ? "Aucun signalement en attente pour le moment."
              : "Les décisions récentes apparaîtront ici."}
          </p>
        </SurfaceCard>
      ) : (
        <ul className="mt-4 space-y-3">
          {list.map((r) => {
            const st = statusMeta(r.moderationStatus);
            const domain = domainFromUrl(r.url);
            const busy = busyId === r.id;
            return (
              <li key={r.id}>
                <SurfaceCard className="overflow-hidden p-0">
                  <div className="border-b border-[var(--ca-border)] bg-[var(--ca-surface)]/80 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="high">{categoryLabel(r.category)}</Badge>
                      <Badge tone={st.tone}>{st.label}</Badge>
                      <MetaChip label={`Réf. ${shortReportId(r.id)}`} />
                      <MetaChip label={formatWhen(r.createdAt)} />
                      {r.source ? <MetaChip label={r.source} /> : <MetaChip label="Source n/c" />}
                    </div>
                    <p className="mt-2 break-all text-sm font-semibold text-[var(--ca-ink)]">
                      {r.url}
                    </p>
                    {domain ? (
                      <p className="mt-0.5 text-[11px] font-medium text-[var(--ca-ink-subtle)]">
                        {domain}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-3 px-4 py-3">
                    {r.comment ? (
                      <p className="rounded-2xl bg-[var(--ca-surface-2)]/70 px-3 py-2 text-sm leading-relaxed text-[var(--ca-ink-muted)]">
                        {r.comment}
                      </p>
                    ) : (
                      <p className="text-xs font-medium text-[var(--ca-ink-subtle)]">
                        Pas de commentaire utilisateur.
                      </p>
                    )}

                    {r.moderatorNote && tab === "recent" ? (
                      <p className="text-xs text-[var(--ca-ink-muted)]">
                        <span className="font-bold text-[var(--ca-ink)]">Note : </span>
                        {r.moderatorNote}
                      </p>
                    ) : null}

                    {tab === "pending" ? (
                      <>
                        <TextArea
                          rows={2}
                          placeholder="Note interne (facultatif)…"
                          value={notes[r.id] || ""}
                          onChange={(e) =>
                            setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))
                          }
                          maxLength={2000}
                          disabled={busy}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            className="!px-3 !py-2 text-xs"
                            disabled={busy}
                            onClick={() => setStatus(r.id, "reviewed")}
                          >
                            Marquer vu
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="!px-3 !py-2 text-xs"
                            disabled={busy}
                            onClick={() => setStatus(r.id, "dismissed")}
                          >
                            Rejeter
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            className="!px-3 !py-2 text-xs"
                            disabled={busy}
                            onClick={() => setStatus(r.id, "actioned")}
                          >
                            Traité
                          </Button>
                          <Link
                            href={`/?url=${encodeURIComponent(r.url)}`}
                            className="ml-auto self-center text-xs font-bold text-[var(--ca-accent)] hover:underline"
                          >
                            Vérifier l&apos;URL
                          </Link>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          className="!px-3 !py-2 text-xs"
                          disabled={busy}
                          onClick={() => setStatus(r.id, "pending")}
                        >
                          Remettre en attente
                        </Button>
                        <Link
                          href={`/report?url=${encodeURIComponent(r.url)}`}
                          className="self-center text-xs font-bold text-[var(--ca-accent)] hover:underline"
                        >
                          Ouvrir formulaire public
                        </Link>
                      </div>
                    )}
                  </div>
                </SurfaceCard>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

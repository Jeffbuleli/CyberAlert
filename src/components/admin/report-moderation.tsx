"use client";

import { useRouter } from "next/navigation";
import { Badge, Button } from "@/components/ui/primitives";

type Report = {
  id: string;
  url: string;
  category: string;
  comment: string | null;
  moderationStatus: string;
};

export function ReportModeration({ reports }: { reports: Report[] }) {
  const router = useRouter();

  async function setStatus(id: string, moderationStatus: string) {
    await fetch(`/api/admin/reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moderationStatus }),
    });
    router.refresh();
  }

  if (!reports.length) {
    return <p className="mt-3 text-sm text-[var(--ca-ink-muted)]">Aucun signalement en attente.</p>;
  }

  return (
    <ul className="mt-3 space-y-3">
      {reports.map((r) => (
        <li key={r.id} className="rounded-xl border border-[var(--ca-border)] bg-white p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="caution">{r.category}</Badge>
            <span className="truncate font-medium">{r.url}</span>
          </div>
          {r.comment ? <p className="mt-1 text-[var(--ca-ink-muted)]">{r.comment}</p> : null}
          <div className="mt-2 flex gap-2">
            <Button type="button" variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setStatus(r.id, "reviewed")}>
              Marquer vu
            </Button>
            <Button type="button" variant="ghost" className="!px-3 !py-1.5 text-xs" onClick={() => setStatus(r.id, "dismissed")}>
              Rejeter
            </Button>
            <Button type="button" variant="danger" className="!px-3 !py-1.5 text-xs" onClick={() => setStatus(r.id, "actioned")}>
              Traité
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = [
  "new",
  "confirmed",
  "in_progress",
  "fixed",
  "retest_pending",
  "resolved",
  "false_positive",
] as const;

export function FindingStatusForm({
  findingId,
  status,
}: {
  findingId: string;
  status: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [saving, setSaving] = useState(false);

  return (
    <select
      className="rounded-lg border border-[var(--ca-border)] px-2 py-1.5 text-xs"
      value={value}
      disabled={saving}
      onChange={async (e) => {
        const next = e.target.value;
        setValue(next);
        setSaving(true);
        await fetch(`/api/findings/${findingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        });
        setSaving(false);
        router.refresh();
      }}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui/primitives";

type Plan = {
  id: string;
  code: string;
  name: string;
  priceUsdCents: number;
  active: boolean;
  quotas: Record<string, unknown>;
};

export function PricingEditor({ plans }: { plans: Plan[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(plans);
  const [saving, setSaving] = useState<string | null>(null);

  async function save(plan: Plan) {
    setSaving(plan.id);
    await fetch(`/api/admin/pricing/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: plan.name,
        priceUsdCents: plan.priceUsdCents,
        active: plan.active,
        quotas: plan.quotas,
      }),
    });
    setSaving(null);
    router.refresh();
  }

  return (
    <ul className="mt-3 space-y-3">
      {rows.map((p, idx) => (
        <li key={p.id} className="rounded-xl border border-[var(--ca-border)] bg-white p-3 text-sm">
          <p className="font-mono text-xs text-[var(--ca-ink-subtle)]">{p.code}</p>
          <Input
            className="mt-2"
            value={p.name}
            onChange={(e) => {
              const next = [...rows];
              next[idx] = { ...p, name: e.target.value };
              setRows(next);
            }}
          />
          <div className="mt-2 flex items-center gap-2">
            <Input
              type="number"
              value={p.priceUsdCents}
              onChange={(e) => {
                const next = [...rows];
                next[idx] = { ...p, priceUsdCents: Number(e.target.value) };
                setRows(next);
              }}
            />
            <span className="text-xs text-[var(--ca-ink-muted)]">cents USD</span>
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={p.active}
              onChange={(e) => {
                const next = [...rows];
                next[idx] = { ...p, active: e.target.checked };
                setRows(next);
              }}
            />
            Actif
          </label>
          <Button
            type="button"
            className="mt-3 !py-2 text-xs"
            disabled={saving === p.id}
            onClick={() => save(rows[idx])}
          >
            Enregistrer
          </Button>
        </li>
      ))}
    </ul>
  );
}

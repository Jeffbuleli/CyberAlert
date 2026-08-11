"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type CaseRow = {
  id: string;
  publicId: string;
  documentType: string;
  status: string;
  rewardStatus: string | null;
  rewardFrozen: boolean;
  createdAt: string;
};

export default function AdminSafefindPage() {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [custody, setCustody] = useState<unknown[]>([]);

  async function load() {
    const res = await fetch("/api/admin/safefind/cases");
    if (!res.ok) {
      setError("Accès refusé");
      return;
    }
    const data = await res.json();
    setCases(data.cases ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function freeze(caseId: string) {
    await fetch("/api/admin/safefind/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "freeze", caseId }),
    });
    load();
  }

  async function showCustody(caseId: string) {
    setSelected(caseId);
    const res = await fetch("/api/admin/safefind/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "custody", caseId }),
    });
    const data = await res.json();
    setCustody(data.events ?? []);
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-400">{error}</p>
        <Link href="/admin" className="text-sm text-[var(--ca-ink-muted)]">
          Admin
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">SafeFind</h1>
        <Link href="/admin" className="text-sm text-[var(--ca-ink-muted)]">
          Admin
        </Link>
      </div>
      <ul className="space-y-2">
        {cases.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-4 py-3 text-sm"
          >
            <div>
              <p className="font-mono">{c.publicId}</p>
              <p className="text-xs text-[var(--ca-ink-muted)]">
                {c.status} · reward {c.rewardStatus}
                {c.rewardFrozen ? " · FROZEN" : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-xs ring-1 ring-[var(--ca-border)]"
                onClick={() => showCustody(c.id)}
              >
                Chaîne
              </button>
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-xs ring-1 ring-amber-500/40"
                onClick={() => freeze(c.id)}
              >
                Geler
              </button>
            </div>
          </li>
        ))}
      </ul>

      {selected ? (
        <div className="mt-8">
          <h2 className="text-sm font-medium text-[var(--ca-ink-muted)]">Custody · {selected}</h2>
          <pre className="mt-2 max-h-80 overflow-auto rounded-xl bg-black/40 p-3 text-xs">
            {JSON.stringify(custody, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

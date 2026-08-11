"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SafefindSearchPage() {
  const router = useRouter();
  const [publicId, setPublicId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const id = publicId.trim().toUpperCase();
    if (!/^SF-\d{4}-\d{6}$/.test(id)) {
      setError("Format attendu : SF-2026-000001");
      return;
    }
    const res = await fetch(`/api/safefind/cases/${id}`);
    if (!res.ok) {
      setError("Dossier introuvable");
      return;
    }
    router.push(`/safefind/cases/${id}`);
  }

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-lg px-4 pb-16 pt-6">
      <Link href="/safefind" className="text-sm text-[var(--ca-ink-muted)]">
        ← SafeFind
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Je recherche</h1>
      <p className="mt-1 text-sm text-[var(--ca-ink-muted)]">
        Entrez un SafeFind ID, ou déclarez une perte pour le matching.
      </p>
      <form onSubmit={go} className="mt-6 space-y-3">
        <input
          className="w-full rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-3 py-3 font-mono text-sm tracking-wide"
          placeholder="SF-2026-000001"
          value={publicId}
          onChange={(e) => setPublicId(e.target.value)}
        />
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <button
          type="submit"
          className="w-full rounded-xl bg-[var(--ca-accent)] py-3 text-sm font-semibold text-white"
        >
          Ouvrir
        </button>
      </form>
      <Link
        href="/safefind/lost"
        className="mt-6 block text-center text-sm text-[var(--ca-ink-muted)] underline-offset-4 hover:underline"
      >
        Déclarer une perte
      </Link>
    </div>
  );
}

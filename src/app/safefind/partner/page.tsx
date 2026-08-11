"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type CustodyCase = {
  publicId: string;
  documentType: string;
  status: string;
  createdAt: string;
};

export default function SafefindPartnerPage() {
  const [cases, setCases] = useState<CustodyCase[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [casePublicId, setCasePublicId] = useState("");
  const [otp, setOtp] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/partner/safefind/custody");
    if (res.status === 403) {
      setError("Accès partenaire requis");
      return;
    }
    const data = await res.json();
    setCases(data.cases ?? []);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function acceptDeposit() {
    setMsg(null);
    const res = await fetch("/api/partner/safefind/deposits/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ casePublicId, documentPresent: true }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Dépôt accepté · ${data.casePublicId}` : data.error ?? "Erreur");
    if (res.ok) refresh();
  }

  async function release() {
    setMsg(null);
    const res = await fetch("/api/partner/safefind/release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ casePublicId, otp }),
    });
    const data = await res.json();
    setMsg(res.ok ? "Remise confirmée" : data.error ?? "Erreur");
    if (res.ok) refresh();
  }

  async function reportIncident() {
    setMsg(null);
    const res = await fetch("/api/partner/safefind/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        casePublicId: casePublicId || undefined,
        incidentType: "burglary",
        allUnderCustody: !casePublicId,
        description: "Incident signalé depuis l’espace partenaire",
      }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Incident · ${data.casesAffected} dossier(s)` : data.error ?? "Erreur");
    if (res.ok) refresh();
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-10">
        <p className="text-sm text-red-400">{error}</p>
        <Link href="/safefind" className="mt-4 inline-block text-sm text-[var(--ca-ink-muted)]">
          ← SafeFind
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-lg px-4 pb-16 pt-6">
      <Link href="/safefind" className="text-sm text-[var(--ca-ink-muted)]">
        ← SafeFind
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Espace partenaire</h1>
      <p className="mt-1 text-sm text-[var(--ca-ink-muted)]">
        Gardien physique - procédure Cyber Alert.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-2">
        {[
          { label: "Recevoir", action: acceptDeposit },
          { label: "Remettre", action: release },
          { label: "Incident", action: reportIncident },
          { label: "Rafraîchir", action: refresh },
        ].map((b) => (
          <button
            key={b.label}
            type="button"
            onClick={b.action}
            className="rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] py-3 text-sm font-medium"
          >
            {b.label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        <input
          className="w-full rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-3 py-2.5 font-mono text-sm"
          placeholder="SF-2026-000001"
          value={casePublicId}
          onChange={(e) => setCasePublicId(e.target.value.toUpperCase())}
        />
        <input
          className="w-full rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-3 py-2.5 font-mono text-sm"
          placeholder="OTP retrait"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
        />
      </div>
      {msg ? <p className="mt-3 text-sm text-[var(--ca-ink-muted)]">{msg}</p> : null}

      <h2 className="mt-8 text-sm font-medium text-[var(--ca-ink-muted)]">Sous ma garde</h2>
      <ul className="mt-3 space-y-2">
        {cases.map((c) => (
          <li
            key={c.publicId}
            className="flex items-center justify-between rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-3 py-3 text-sm"
          >
            <span className="font-mono">{c.publicId}</span>
            <span className="text-xs text-[var(--ca-ink-muted)]">{c.status}</span>
          </li>
        ))}
        {cases.length === 0 ? (
          <li className="text-sm text-[var(--ca-ink-muted)]">Aucun dossier</li>
        ) : null}
      </ul>
    </div>
  );
}

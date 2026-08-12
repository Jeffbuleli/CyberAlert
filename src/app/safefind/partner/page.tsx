"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SafefindDepositProcedure } from "@/components/safefind/SafefindDepositProcedure";

type DepositCase = {
  publicId: string;
  documentType: string;
  status: string;
  holderFirstName: string | null;
  holderLastName: string | null;
  previewUrl: string | null;
  updatedAt: string;
};

type CustodyCase = {
  publicId: string;
  documentType: string;
  status: string;
  holderFirstName: string | null;
  holderLastName: string | null;
  previewUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

function holderLabel(c: { holderFirstName: string | null; holderLastName: string | null }) {
  const parts = [c.holderFirstName, c.holderLastName].filter(Boolean);
  return parts.length ? parts.join(" ") : "Titulaire inconnu";
}

export default function SafefindPartnerPage() {
  const [pending, setPending] = useState<DepositCase[]>([]);
  const [custody, setCustody] = useState<CustodyCase[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [manualId, setManualId] = useState("");
  const [otp, setOtp] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"deposit" | "custody" | "release">("deposit");

  const refresh = useCallback(async () => {
    const [pendingRes, custodyRes] = await Promise.all([
      fetch("/api/partner/safefind/deposits/pending"),
      fetch("/api/partner/safefind/custody"),
    ]);
    if (pendingRes.status === 403 || custodyRes.status === 403) {
      setError("Accès partenaire requis");
      return;
    }
    const pendingData = await pendingRes.json();
    const custodyData = await custodyRes.json();
    setPending(pendingData.cases ?? []);
    setCustody(custodyData.cases ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeCaseId = selectedId ?? manualId.trim().toUpperCase() || null;

  async function acceptDeposit(casePublicId: string) {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/partner/safefind/deposits/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ casePublicId, documentPresent: true }),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg(data.message ?? `Publié · ${data.casePublicId}`);
      setSelectedId(null);
      setManualId("");
      await refresh();
      setTab("custody");
    } else {
      setMsg(data.error ?? "Erreur lors de la confirmation");
    }
    setBusy(false);
  }

  async function release() {
    if (!activeCaseId || !otp.trim()) {
      setMsg("Code dossier et OTP requis");
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/partner/safefind/release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ casePublicId: activeCaseId, otp }),
    });
    const data = await res.json();
    setMsg(res.ok ? "Remise confirmée" : data.error ?? "Erreur");
    if (res.ok) {
      setOtp("");
      await refresh();
    }
    setBusy(false);
  }

  async function reportIncident() {
    if (!activeCaseId) {
      setMsg("Sélectionnez un dossier ou saisissez un code SF");
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/partner/safefind/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        casePublicId: activeCaseId,
        incidentType: "burglary",
        allUnderCustody: false,
        description: "Incident signalé depuis l’espace partenaire",
      }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Incident signalé · ${data.casesAffected} dossier(s)` : data.error ?? "Erreur");
    if (res.ok) await refresh();
    setBusy(false);
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-10">
        <p className="text-sm text-red-400">{error}</p>
        <Link href="/" className="mt-4 inline-block text-sm text-[var(--ca-ink-muted)]">
          ← SafeFind
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-lg px-4 pb-16 pt-6">
      <Link href="/" className="text-sm text-[var(--ca-ink-muted)]">
        ← SafeFind
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Espace partenaire</h1>
      <p className="mt-1 text-sm text-[var(--ca-ink-muted)]">
        Recevoir les dépôts trouveurs → publication Marketplace.
      </p>

      <div className="mt-5 flex gap-1 rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] p-1">
        {(
          [
            ["deposit", `Dépôts (${pending.length})`],
            ["custody", `En garde (${custody.length})`],
            ["release", "Remise"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 rounded-lg py-2 text-xs font-medium transition ${
              tab === key
                ? "bg-[var(--ca-accent)] text-white"
                : "text-[var(--ca-ink-muted)] hover:text-[var(--ca-ink)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "deposit" ? (
        <section className="mt-6">
          <div className="rounded-2xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] p-4">
            <h2 className="text-sm font-semibold text-[var(--ca-ink)]">Procédure guichet</h2>
            <div className="mt-3">
              <SafefindDepositProcedure variant="partner" />
            </div>
          </div>

          <h2 className="mt-6 text-sm font-medium text-[var(--ca-ink-muted)]">
            Dépôts en attente
          </h2>
          <ul className="mt-3 space-y-2">
            {pending.map((c) => (
              <li
                key={c.publicId}
                className={`rounded-xl border px-3 py-3 text-sm transition ${
                  selectedId === c.publicId
                    ? "border-[var(--ca-accent)] bg-[var(--ca-accent)]/5"
                    : "border-[var(--ca-border)] bg-[var(--ca-surface-raised)]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono font-semibold text-[var(--ca-accent)]">{c.publicId}</p>
                    <p className="text-xs text-[var(--ca-ink-muted)]">
                      {c.documentType} · {holderLabel(c)}
                    </p>
                  </div>
                  {c.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.previewUrl}
                      alt=""
                      className="h-12 w-16 rounded object-cover"
                    />
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void acceptDeposit(c.publicId)}
                  className="mt-3 w-full rounded-lg bg-emerald-600 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Confirmer et publier sur Marketplace
                </button>
              </li>
            ))}
            {pending.length === 0 ? (
              <li className="rounded-xl border border-dashed border-[var(--ca-border)] px-3 py-6 text-center text-sm text-[var(--ca-ink-muted)]">
                Aucun dépôt en attente. Le trouveur doit d’abord déclarer et choisir votre
                point.
              </li>
            ) : null}
          </ul>

          <div className="mt-6 rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] p-4">
            <p className="text-xs font-medium text-[var(--ca-ink-muted)]">
              Saisie manuelle (code SF)
            </p>
            <input
              className="mt-2 w-full rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface)] px-3 py-2.5 font-mono text-sm"
              placeholder="SF-2026-000001"
              value={manualId}
              onChange={(e) => setManualId(e.target.value.toUpperCase())}
            />
            <button
              type="button"
              disabled={busy || !manualId.trim()}
              onClick={() => activeCaseId && void acceptDeposit(activeCaseId)}
              className="mt-2 w-full rounded-lg border border-emerald-600/40 py-2.5 text-xs font-semibold text-emerald-800 disabled:opacity-50"
            >
              Confirmer ce code
            </button>
          </div>
        </section>
      ) : null}

      {tab === "custody" ? (
        <section className="mt-6">
          <p className="text-sm text-[var(--ca-ink-muted)]">
            Dossiers confirmés — visibles sur le Marketplace (photo floutée).
          </p>
          <ul className="mt-3 space-y-2">
            {custody.map((c) => (
              <li
                key={c.publicId}
                className="flex items-center justify-between rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-3 py-3 text-sm"
              >
                <div>
                  <p className="font-mono">{c.publicId}</p>
                  <p className="text-xs text-[var(--ca-ink-muted)]">
                    {c.documentType} · {holderLabel(c)}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                  Marketplace
                </span>
              </li>
            ))}
            {custody.length === 0 ? (
              <li className="text-sm text-[var(--ca-ink-muted)]">Aucun dossier en garde</li>
            ) : null}
          </ul>
        </section>
      ) : null}

      {tab === "release" ? (
        <section className="mt-6 space-y-3">
          <p className="text-sm text-[var(--ca-ink-muted)]">
            Remise au propriétaire après paiement Mobile Money (OTP fourni au propriétaire).
          </p>
          <input
            className="w-full rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-3 py-2.5 font-mono text-sm"
            placeholder="SF-2026-000001"
            value={manualId}
            onChange={(e) => setManualId(e.target.value.toUpperCase())}
          />
          <input
            className="w-full rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-3 py-2.5 font-mono text-sm"
            placeholder="OTP retrait"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void release()}
            className="w-full rounded-xl bg-[var(--ca-accent)] py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            Confirmer remise
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void reportIncident()}
            className="w-full rounded-xl border border-red-500/30 py-3 text-sm text-red-600 disabled:opacity-50"
          >
            Signaler incident
          </button>
        </section>
      ) : null}

      {msg ? (
        <p
          className={`mt-4 rounded-xl px-3 py-2 text-sm ${
            msg.includes("publi") || msg.includes("Publié") || msg.includes("confirm")
              ? "bg-emerald-600/10 text-emerald-800"
              : "bg-[var(--ca-surface-raised)] text-[var(--ca-ink-muted)]"
          }`}
        >
          {msg}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void refresh()}
        className="mt-6 w-full rounded-xl border border-[var(--ca-border)] py-2.5 text-xs text-[var(--ca-ink-muted)]"
      >
        Rafraîchir
      </button>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type PublicCase = {
  publicId: string;
  documentType: string;
  status: string;
  holderFirstNameMasked: string | null;
  holderLastNameMasked: string | null;
  foundZone: { commune: string | null; quartier: string | null };
  foundApproxDate: string | null;
  visualNotes: string | null;
  rewardHint: { amount: string; currency: string } | null;
};

export default function SafefindCasePage() {
  const params = useParams();
  const id = String(params.id ?? "").toUpperCase();
  const [c, setC] = useState<PublicCase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [last4, setLast4] = useState("");
  const [verifyResult, setVerifyResult] = useState<{
    verified: boolean;
    collectionOtp?: string;
    partner?: { name: string; address: string; commune: string } | null;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/safefind/cases/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("not_found");
        return r.json();
      })
      .then((d) => setC(d.case))
      .catch(() => setError("Dossier introuvable"));
  }, [id]);

  async function claim() {
    setClaimBusy(true);
    setClaimMsg(null);
    const res = await fetch(`/api/safefind/cases/${id}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName }),
    });
    const data = await res.json();
    setClaimBusy(false);
    if (!res.ok) {
      setClaimMsg(data.error ?? "Erreur");
      return;
    }
    if (data.status === "DISPUTED") {
      setClaimMsg("Dossier en litige - revue Cyber Alert.");
      return;
    }
    setClaimMsg(`Correspondance ${data.scoreBand}. Poursuivez la vérification.`);
  }

  async function verify() {
    setClaimBusy(true);
    const res = await fetch(`/api/safefind/cases/${id}/verify-owner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, last4 }),
    });
    const data = await res.json();
    setClaimBusy(false);
    if (!res.ok) {
      setClaimMsg(data.error === "kyc_required" ? "KYC requis" : data.error ?? "Erreur");
      return;
    }
    setVerifyResult(data);
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

  if (!c) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-10 text-sm text-[var(--ca-ink-muted)]">
        Chargement…
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-lg px-4 pb-16 pt-6">
      <Link href="/safefind" className="text-sm text-[var(--ca-ink-muted)]">
        ← SafeFind
      </Link>
      <p className="mt-4 font-mono text-xl text-[var(--ca-accent)]">{c.publicId}</p>
      <p className="mt-1 text-sm text-[var(--ca-ink-muted)]">{c.documentType.replace("_", " ")}</p>
      <p className="mt-2 text-xs uppercase tracking-wider text-[var(--ca-ink-muted)]">{c.status}</p>

      <div className="mt-6 space-y-2 rounded-2xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] p-4 text-sm">
        <p>
          {c.holderFirstNameMasked} {c.holderLastNameMasked}
        </p>
        <p className="text-[var(--ca-ink-muted)]">
          Zone : {c.foundZone.commune ?? "-"}
          {c.foundApproxDate ? ` · ${c.foundApproxDate}` : ""}
        </p>
        {c.visualNotes ? <p className="text-[var(--ca-ink-muted)]">{c.visualNotes}</p> : null}
        {c.rewardHint ? (
          <p className="text-[var(--ca-accent)]">
            Récompense indicative : {c.rewardHint.amount} {c.rewardHint.currency}
          </p>
        ) : null}
      </div>

      {verifyResult?.verified ? (
        <div className="mt-6 rounded-2xl border border-[var(--ca-accent)]/40 bg-[var(--ca-surface-raised)] p-4">
          <p className="font-medium">Prêt pour retrait</p>
          {verifyResult.partner ? (
            <p className="mt-2 text-sm text-[var(--ca-ink-muted)]">
              {verifyResult.partner.name} - {verifyResult.partner.address},{" "}
              {verifyResult.partner.commune}
            </p>
          ) : null}
          {verifyResult.collectionOtp ? (
            <p className="mt-3 font-mono text-2xl tracking-widest text-[var(--ca-accent)]">
              {verifyResult.collectionOtp}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <p className="text-sm font-medium">Revendiquer</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-3 py-2 text-sm"
              placeholder="Prénom"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <input
              className="rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-3 py-2 text-sm"
              placeholder="Nom"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <input
            className="w-full rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-3 py-2 text-sm"
            placeholder="4 derniers chiffres (si connus)"
            value={last4}
            onChange={(e) => setLast4(e.target.value)}
          />
          {claimMsg ? <p className="text-sm text-[var(--ca-ink-muted)]">{claimMsg}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={claimBusy}
              onClick={claim}
              className="flex-1 rounded-xl bg-[var(--ca-surface-2)] py-2.5 text-sm ring-1 ring-[var(--ca-border)]"
            >
              Claim
            </button>
            <button
              type="button"
              disabled={claimBusy}
              onClick={verify}
              className="flex-1 rounded-xl bg-[var(--ca-accent)] py-2.5 text-sm font-semibold text-white"
            >
              Vérifier
            </button>
          </div>
        </div>
      )}
      <div className="mt-8 space-y-2 rounded-2xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] p-4">
        <p className="text-sm font-medium">Restitution</p>
        <p className="text-xs text-[var(--ca-ink-muted)]">
          Mode par defaut: retrait chez un Point SafeFind. Livraison = option.
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="rounded-xl py-2.5 text-sm ring-1 ring-[var(--ca-border)]"
            onClick={async () => {
              const r = await fetch(`/api/safefind/cases/${id}/request-partner-deposit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}",
              });
              const d = await r.json();
              setClaimMsg(d.error ?? "Demande de depot partenaire envoyee");
            }}
          >
            Demander depot chez un partenaire
          </button>
          <button
            type="button"
            className="rounded-xl py-2.5 text-sm ring-1 ring-[var(--ca-border)]"
            onClick={async () => {
              const r = await fetch(`/api/safefind/cases/${id}/request-secure-collection`, {
                method: "POST",
              });
              const d = await r.json();
              setClaimMsg(d.error ?? "Collecte securisee demandee");
            }}
          >
            Organiser une collecte
          </button>
          <button
            type="button"
            className="rounded-xl py-2.5 text-sm ring-1 ring-[var(--ca-border)]"
            onClick={async () => {
              const r = await fetch(`/api/safefind/cases/${id}/delivery-request`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  destinationCommune: "Kinshasa",
                  destinationAddress: "A completer apres verification",
                }),
              });
              const d = await r.json();
              setClaimMsg(
                d.error ??
                  (d.breakdown
                    ? `Livraison: recompense ${d.breakdown.finderReward} + frais ${d.breakdown.deliveryFee} = ${d.breakdown.total} ${d.breakdown.currency}`
                    : "Demande livraison envoyee"),
              );
            }}
          >
            Livraison a domicile
          </button>
        </div>
      </div>

    </div>
  );
}

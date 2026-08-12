"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SafefindDepositProcedure } from "@/components/safefind/SafefindDepositProcedure";
import { SAFEFIND_DOC_OPTIONS } from "@/components/safefind/doc-types";
import {
  safefindStatusDisplayLabel,
  type SafefindCasePhase,
} from "@/lib/safefind/status-labels";

type PublicCase = {
  publicId: string;
  documentType: string;
  status: string;
  holderFirstNameMasked: string | null;
  holderLastNameMasked: string | null;
  foundZone: { commune: string | null; quartier: string | null };
  foundApproxDate: string | null;
  visualNotes: string | null;
  listingSummary: string | null;
  previewUrl: string | null;
  rewardHint: { amount: string; currency: string } | null;
};

type DepositPartner = {
  id: string;
  name: string;
  commune: string;
  address: string;
};

type CaseDetail = {
  case: PublicCase;
  viewerRole: "finder" | "owner" | "reward" | null;
  depositPartner: DepositPartner | null;
  phase: SafefindCasePhase;
  canClaim: boolean;
};

function docLabel(type: string) {
  return SAFEFIND_DOC_OPTIONS.find((d) => d.value === type)?.label ?? type;
}

export default function SafefindCasePage() {
  const params = useParams();
  const id = String(params.id ?? "").toUpperCase();
  const [detail, setDetail] = useState<CaseDetail | null>(null);
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
    fetch(`/api/safefind/cases/${id}`, { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new Error("not_found");
        return r.json();
      })
      .then((d) => setDetail(d))
      .catch(() => setError("Dossier introuvable"));
  }, [id]);

  async function claim() {
    setClaimBusy(true);
    setClaimMsg(null);
    const res = await fetch(`/api/safefind/cases/${id}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ firstName, lastName }),
    });
    const data = await res.json();
    setClaimBusy(false);
    if (!res.ok) {
      setClaimMsg(data.error ?? "Erreur");
      return;
    }
    if (data.status === "DISPUTED") {
      setClaimMsg("Dossier en litige — revue Cyber Alert.");
      return;
    }
    setClaimMsg(`Correspondance ${data.scoreBand}. Poursuivez la vérification.`);
  }

  async function verify() {
    setClaimBusy(true);
    const res = await fetch(`/api/safefind/cases/${id}/verify-owner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
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
        <Link href="/?view=mine" className="mt-4 inline-block text-sm text-[var(--ca-ink-muted)]">
          ← Mes dossiers
        </Link>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-10 text-sm text-[var(--ca-ink-muted)]">
        Chargement…
      </div>
    );
  }

  const c = detail.case;
  const statusLabel = safefindStatusDisplayLabel(c.status);

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-lg px-4 pb-16 pt-6">
      <Link
        href={
          detail.viewerRole === "finder" ? "/?view=mine&mode=found" : "/"
        }
        className="text-sm text-[var(--ca-ink-muted)]"
      >
        ← {detail.viewerRole === "finder" ? "Mes dossiers" : "SafeFind"}
      </Link>

      {detail.phase === "finder_awaiting_deposit" ? (
        <FinderAwaitingDepositView
          c={c}
          statusLabel={statusLabel}
          depositPartner={detail.depositPartner}
        />
      ) : null}

      {detail.phase === "finder_published" ? (
        <FinderPublishedView c={c} statusLabel={statusLabel} depositPartner={detail.depositPartner} />
      ) : null}

      {detail.phase === "owner_lost" ? (
        <OwnerLostView c={c} statusLabel={statusLabel} />
      ) : null}

      {detail.phase === "owner_restitution" ? (
        <OwnerRestitutionView c={c} statusLabel={statusLabel} depositPartner={detail.depositPartner} />
      ) : null}

      {detail.canClaim ? (
        <OwnerClaimSection
          c={c}
          statusLabel={statusLabel}
          claimBusy={claimBusy}
          claimMsg={claimMsg}
          firstName={firstName}
          lastName={lastName}
          last4={last4}
          verifyResult={verifyResult}
          onFirstName={setFirstName}
          onLastName={setLastName}
          onLast4={setLast4}
          onClaim={claim}
          onVerify={verify}
        />
      ) : null}

      {detail.phase === "readonly" ? (
        <ReadonlyCaseView c={c} statusLabel={statusLabel} />
      ) : null}
    </div>
  );
}

function FinderAwaitingDepositView({
  c,
  statusLabel,
  depositPartner,
}: {
  c: PublicCase;
  statusLabel: string;
  depositPartner: DepositPartner | null;
}) {
  return (
    <>
      <p className="mt-4 text-xs font-bold uppercase tracking-wide text-amber-800">
        Mon trouvé · {statusLabel}
      </p>
      <p className="mt-1 font-mono text-2xl text-[var(--ca-accent)]">{c.publicId}</p>
      <p className="mt-1 text-sm text-[var(--ca-ink)]">{docLabel(c.documentType)}</p>

      {c.previewUrl ? (
        <div className="relative mt-4 overflow-hidden rounded-xl border border-[var(--ca-border)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.previewUrl} alt="" className="aspect-[16/10] w-full object-contain" />
        </div>
      ) : null}

      {depositPartner ? (
        <div className="mt-4 rounded-2xl border border-emerald-600/30 bg-emerald-600/5 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
            Point de dépôt assigné
          </p>
          <p className="mt-1 text-base font-semibold text-[var(--ca-ink)]">
            {depositPartner.name}
          </p>
          <p className="text-sm text-[var(--ca-ink-muted)]">
            {depositPartner.commune}
            {depositPartner.address ? ` · ${depositPartner.address}` : ""}
          </p>
          <Link
            href={`/safefind/partners?partner=${depositPartner.id}`}
            className="mt-3 inline-block text-xs font-semibold text-[var(--ca-accent)] underline-offset-2 hover:underline"
          >
            Voir le point sur la carte
          </Link>
        </div>
      ) : (
        <p className="mt-4 text-sm text-[var(--ca-ink-muted)]">
          Aucun Point SafeFind assigné — modifiez votre déclaration pour en choisir un.
        </p>
      )}

      <div className="mt-5 rounded-2xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] p-4">
        <p className="text-sm font-semibold text-[var(--ca-ink)]">
          Prochaine étape — dépôt physique
        </p>
        <div className="mt-3">
          <SafefindDepositProcedure
            casePublicId={c.publicId}
            partnerName={depositPartner?.name}
          />
        </div>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-[var(--ca-ink-muted)]">
        Le dépôt est gratuit pour vous. Une fois le partenaire confirme au guichet, votre
        fiche sera publiée sur le Marketplace (photo floutée). La récompense sera versée
        après restitution au propriétaire.
      </p>
      {c.rewardHint ? (
        <p className="mt-2 text-sm text-[var(--ca-ink)]">
          Récompense indicative après restitution :{" "}
          <span className="font-semibold">
            {Number(c.rewardHint.amount).toLocaleString("fr-CD")} {c.rewardHint.currency}
          </span>
        </p>
      ) : null}
    </>
  );
}

function FinderPublishedView({
  c,
  statusLabel,
  depositPartner,
}: {
  c: PublicCase;
  statusLabel: string;
  depositPartner: DepositPartner | null;
}) {
  return (
    <>
      <p className="mt-4 text-xs font-bold uppercase tracking-wide text-emerald-800">
        Publié sur Marketplace · {statusLabel}
      </p>
      <p className="mt-1 font-mono text-2xl text-[var(--ca-accent)]">{c.publicId}</p>
      <p className="mt-1 text-sm text-[var(--ca-ink)]">{docLabel(c.documentType)}</p>

      <div className="mt-4 rounded-2xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] p-4 text-sm">
        <p className="text-[var(--ca-ink)]">
          Votre dépôt est confirmé. Le dossier est visible sur le Marketplace (photo
          floutée) en attente qu’un propriétaire le revendique.
        </p>
        {depositPartner ? (
          <p className="mt-2 text-[var(--ca-ink-muted)]">
            Garde : {depositPartner.name} ({depositPartner.commune})
          </p>
        ) : null}
        {c.rewardHint ? (
          <p className="mt-2 font-semibold text-[var(--ca-ink)]">
            Récompense après restitution :{" "}
            {Number(c.rewardHint.amount).toLocaleString("fr-CD")} {c.rewardHint.currency}
          </p>
        ) : null}
      </div>
    </>
  );
}

function OwnerClaimSection({
  c,
  statusLabel,
  claimBusy,
  claimMsg,
  firstName,
  lastName,
  last4,
  verifyResult,
  onFirstName,
  onLastName,
  onLast4,
  onClaim,
  onVerify,
}: {
  c: PublicCase;
  statusLabel: string;
  claimBusy: boolean;
  claimMsg: string | null;
  firstName: string;
  lastName: string;
  last4: string;
  verifyResult: {
    verified: boolean;
    collectionOtp?: string;
    partner?: { name: string; address: string; commune: string } | null;
  } | null;
  onFirstName: (v: string) => void;
  onLastName: (v: string) => void;
  onLast4: (v: string) => void;
  onClaim: () => void;
  onVerify: () => void;
}) {
  return (
    <>
      <p className="mt-4 font-mono text-xl text-[var(--ca-accent)]">{c.publicId}</p>
      <p className="mt-1 text-sm text-[var(--ca-ink)]">{docLabel(c.documentType)}</p>
      <p className="mt-2 text-xs font-medium text-[var(--ca-ink-muted)]">{statusLabel}</p>

      <div className="mt-6 space-y-2 rounded-2xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] p-4 text-sm">
        <p>
          {c.holderFirstNameMasked} {c.holderLastNameMasked}
        </p>
        <p className="text-[var(--ca-ink-muted)]">
          Zone : {c.foundZone.commune ?? "—"}
          {c.foundApproxDate ? ` · ${c.foundApproxDate}` : ""}
        </p>
        {c.listingSummary || c.visualNotes ? (
          <p className="text-[var(--ca-ink-muted)]">{c.listingSummary ?? c.visualNotes}</p>
        ) : null}
      </div>

      {verifyResult?.verified ? (
        <div className="mt-6 rounded-2xl border border-[var(--ca-accent)]/40 bg-[var(--ca-surface-raised)] p-4">
          <p className="font-medium">Prêt pour retrait</p>
          {verifyResult.partner ? (
            <p className="mt-2 text-sm text-[var(--ca-ink-muted)]">
              {verifyResult.partner.name} — {verifyResult.partner.address},{" "}
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
          <p className="text-sm font-medium">C’est le mien — revendiquer</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-3 py-2 text-sm"
              placeholder="Prénom"
              value={firstName}
              onChange={(e) => onFirstName(e.target.value)}
            />
            <input
              className="rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-3 py-2 text-sm"
              placeholder="Nom"
              value={lastName}
              onChange={(e) => onLastName(e.target.value)}
            />
          </div>
          <input
            className="w-full rounded-xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)] px-3 py-2 text-sm"
            placeholder="4 derniers chiffres du document (si connus)"
            value={last4}
            onChange={(e) => onLast4(e.target.value)}
          />
          {claimMsg ? <p className="text-sm text-[var(--ca-ink-muted)]">{claimMsg}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={claimBusy}
              onClick={onClaim}
              className="flex-1 rounded-xl bg-[var(--ca-surface-2)] py-2.5 text-sm ring-1 ring-[var(--ca-border)]"
            >
              Déclarer correspondance
            </button>
            <button
              type="button"
              disabled={claimBusy}
              onClick={onVerify}
              className="flex-1 rounded-xl bg-[var(--ca-accent)] py-2.5 text-sm font-semibold text-white"
            >
              Vérifier identité
            </button>
          </div>
          <p className="text-xs text-[var(--ca-ink-muted)]">
            Retrait au Point SafeFind uniquement — pas de rencontre avec le trouveur.
          </p>
        </div>
      )}
    </>
  );
}

function OwnerLostView({
  c,
  statusLabel,
}: {
  c: PublicCase;
  statusLabel: string;
}) {
  return (
    <>
      <p className="mt-4 text-xs font-bold uppercase tracking-wide text-amber-800">
        Ma perte · {statusLabel}
      </p>
      <p className="mt-1 font-mono text-2xl text-[var(--ca-accent)]">{c.publicId}</p>
      <p className="mt-1 text-sm text-[var(--ca-ink)]">{docLabel(c.documentType)}</p>
      <p className="mt-4 text-sm text-[var(--ca-ink-muted)]">
        Votre déclaration est active. Parcourez le Marketplace ou attendez une
        correspondance automatique.
      </p>
      <Link
        href="/"
        className="mt-4 inline-flex rounded-xl bg-[var(--ca-accent)] px-4 py-2.5 text-sm font-semibold text-white"
      >
        Voir le Marketplace
      </Link>
    </>
  );
}

function OwnerRestitutionView({
  c,
  statusLabel,
  depositPartner,
}: {
  c: PublicCase;
  statusLabel: string;
  depositPartner: DepositPartner | null;
}) {
  return (
    <>
      <p className="mt-4 text-xs font-bold uppercase tracking-wide text-emerald-800">
        Restitution · {statusLabel}
      </p>
      <p className="mt-1 font-mono text-2xl text-[var(--ca-accent)]">{c.publicId}</p>
      <p className="mt-1 text-sm text-[var(--ca-ink)]">{docLabel(c.documentType)}</p>
      {depositPartner ? (
        <p className="mt-4 text-sm text-[var(--ca-ink-muted)]">
          Point SafeFind : {depositPartner.name} ({depositPartner.commune})
        </p>
      ) : null}
      <Link
        href="/?view=orders"
        className="mt-4 inline-flex rounded-xl border border-[var(--ca-border)] px-4 py-2.5 text-sm font-medium"
      >
        Voir mes restitutions
      </Link>
    </>
  );
}

function ReadonlyCaseView({
  c,
  statusLabel,
}: {
  c: PublicCase;
  statusLabel: string;
}) {
  return (
    <>
      <p className="mt-4 font-mono text-xl text-[var(--ca-accent)]">{c.publicId}</p>
      <p className="mt-1 text-sm text-[var(--ca-ink)]">{docLabel(c.documentType)}</p>
      <p className="mt-2 text-xs font-medium text-[var(--ca-ink-muted)]">{statusLabel}</p>
      <p className="mt-4 text-sm text-[var(--ca-ink-muted)]">
        Ce dossier n’est pas accessible publiquement ou est clôturé.
      </p>
    </>
  );
}

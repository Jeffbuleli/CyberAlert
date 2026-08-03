"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Input, SurfaceCard } from "@/components/ui/primitives";
import { BrandLogo } from "@/components/brand/logo";

export function ProfileForm({
  initialName,
  email,
  emailVerified,
}: {
  initialName: string;
  email: string;
  emailVerified: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOk(false);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "Mise à jour impossible.");
        return;
      }
      setOk(true);
      router.refresh();
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  async function resendVerify() {
    setResendMsg(null);
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setResendMsg(data.message || (res.ok ? "Email envoyé." : "Envoi impossible."));
    } catch {
      setResendMsg("Erreur réseau.");
    }
  }

  return (
    <SurfaceCard className="overflow-hidden p-0">
      <div className="flex items-center gap-3 border-b border-[var(--ca-border)] bg-[var(--ca-accent-soft)]/40 px-4 py-3">
        <BrandLogo size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--ca-accent)]">
            Profil
          </p>
          <p className="text-sm font-bold text-[var(--ca-ink)]">Informations du compte</p>
        </div>
        <Badge tone={emailVerified ? "low" : "caution"}>
          {emailVerified ? "Email vérifié" : "À vérifier"}
        </Badge>
      </div>
      <form onSubmit={onSubmit} className="space-y-3 p-4 sm:p-5">
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Nom affiché</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="Votre nom"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Email</label>
          <Input value={email} disabled readOnly />
        </div>
        {!emailVerified ? (
          <div className="rounded-2xl border border-[var(--ca-caution)]/25 bg-[var(--ca-caution-soft)]/40 px-3 py-2.5 text-sm">
            <p className="font-medium text-[var(--ca-ink)]">Confirmez votre email pour sécuriser le compte.</p>
            <button
              type="button"
              onClick={resendVerify}
              className="mt-1 text-[12px] font-bold text-[var(--ca-accent)] hover:underline"
            >
              Renvoyer l&apos;email de vérification
            </button>
            {resendMsg ? (
              <p className="mt-1 text-[11px] text-[var(--ca-ink-muted)]">{resendMsg}</p>
            ) : null}
          </div>
        ) : null}
        {error ? (
          <p className="rounded-2xl border border-[var(--ca-high)]/20 bg-[var(--ca-high-soft)] px-3 py-2 text-sm font-medium text-[var(--ca-high)]">
            {error}
          </p>
        ) : null}
        {ok ? (
          <p className="rounded-2xl border border-[var(--ca-low)]/20 bg-[var(--ca-low-soft)] px-3 py-2 text-sm font-medium text-[var(--ca-low)]">
            Profil mis à jour.
          </p>
        ) : null}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Enregistrement…" : "Enregistrer le profil"}
        </Button>
      </form>
    </SurfaceCard>
  );
}

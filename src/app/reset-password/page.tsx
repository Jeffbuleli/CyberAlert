"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button, Input } from "@/components/ui/primitives";
import { checkPasswordStrength } from "@/lib/auth/password-policy";

function ResetInner() {
  const sp = useSearchParams();
  const token = sp.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const strength = useMemo(() => checkPasswordStrength(password), [password]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError("Lien invalide.");
      return;
    }
    if (!strength.ok) {
      setError(strength.message || "Mot de passe trop faible.");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "Réinitialisation impossible.");
        return;
      }
      setOk(true);
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Nouveau mot de passe"
      subtitle="Choisissez un mot de passe fort pour votre compte."
      badge="Reset"
      footer={
        <Link href="/login" className="font-semibold text-[var(--ca-accent)] hover:underline">
          Connexion
        </Link>
      }
    >
      {ok ? (
        <p className="rounded-2xl border border-[var(--ca-low)]/20 bg-[var(--ca-low-soft)] px-3 py-2.5 text-sm font-medium text-[var(--ca-low)]">
          Mot de passe mis à jour.{" "}
          <Link href="/login" className="font-bold underline">
            Se connecter
          </Link>
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Nouveau mot de passe</label>
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p className="mt-1 text-[11px] text-[var(--ca-ink-subtle)]">{strength.message}</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Confirmer</label>
            <Input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          {error ? (
            <p className="rounded-2xl border border-[var(--ca-high)]/20 bg-[var(--ca-high-soft)] px-3 py-2.5 text-sm font-medium text-[var(--ca-high)]">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={loading || !token}>
            {loading ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-sm">Chargement…</div>}>
      <ResetInner />
    </Suspense>
  );
}

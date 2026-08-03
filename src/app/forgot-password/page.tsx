"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button, Input } from "@/components/ui/primitives";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "Demande impossible.");
        return;
      }
      setMessage(data.message || "Email envoyé si le compte existe.");
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Mot de passe oublié"
      subtitle="Nous vous enverrons un lien sécurisé par email (Resend)."
      badge="Récupération"
      footer={
        <>
          <Link href="/login" className="font-semibold text-[var(--ca-accent)] hover:underline">
            Retour à la connexion
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Email</label>
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        {error ? (
          <p className="rounded-2xl border border-[var(--ca-high)]/20 bg-[var(--ca-high-soft)] px-3 py-2.5 text-sm font-medium text-[var(--ca-high)]">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="rounded-2xl border border-[var(--ca-low)]/20 bg-[var(--ca-low-soft)] px-3 py-2.5 text-sm font-medium text-[var(--ca-low)]">
            {message}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Envoi…" : "Envoyer le lien"}
        </Button>
      </form>
    </AuthShell>
  );
}

"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button, Input } from "@/components/ui/primitives";
import { IconLock } from "@/components/icons";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data.message ||
            (res.status === 429
              ? "Trop de tentatives. Réessayez dans une minute."
              : "Connexion impossible."),
        );
        return;
      }
      router.push(data.role === "admin" ? "/admin" : "/dashboard");
    } catch {
      setError("Erreur réseau. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Connexion"
      subtitle="Espace développeur et administration. Votre session est protégée par cookie httpOnly."
      badge="Connexion"
      footer={
        <>
          Pas de compte ?{" "}
          <Link href="/register" className="font-semibold text-[var(--ca-accent)] hover:underline">
            Créer un compte développeur
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[var(--ca-ink)]">Email</label>
          <Input
            type="email"
            autoComplete="email"
            placeholder="vous@exemple.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label className="text-sm font-semibold text-[var(--ca-ink)]">Mot de passe</label>
            <button
              type="button"
              className="text-[11px] font-bold text-[var(--ca-accent)] hover:underline"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? "Masquer" : "Afficher"}
            </button>
          </div>
          <Input
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Votre mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error ? (
          <p className="rounded-2xl border border-[var(--ca-high)]/20 bg-[var(--ca-high-soft)] px-3 py-2.5 text-sm font-medium text-[var(--ca-high)]">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={loading}>
          <IconLock size={16} />
          {loading ? "Connexion…" : "Se connecter"}
        </Button>
      </form>
    </AuthShell>
  );
}

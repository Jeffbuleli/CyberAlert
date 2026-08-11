"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button, Input } from "@/components/ui/primitives";
import { IconCheck, IconCode } from "@/components/icons";
import { checkPasswordStrength, PASSWORD_MIN } from "@/lib/auth/password-policy";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => checkPasswordStrength(password), [password]);
  const strengthLabel =
    strength.score === 0
      ? "Trop faible"
      : strength.score === 1
        ? "Faible"
        : strength.score === 2
          ? "Correct"
          : "Solide";
  const strengthTone =
    strength.score <= 1
      ? "var(--ca-high)"
      : strength.score === 2
        ? "var(--ca-caution)"
        : "var(--ca-low)";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!strength.ok) {
      setError(strength.message || `Mot de passe invalide (${PASSWORD_MIN}+ caractères, lettre + chiffre).`);
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data.message ||
            (res.status === 429
              ? "Trop d'inscriptions. Réessayez plus tard."
              : "Inscription impossible."),
        );
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Erreur réseau. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Créer un compte"
      subtitle="Free : 1 projet - 2 scans / mois. Mot de passe hashé (bcrypt), session sécurisée."
      badge="Inscription"
      footer={
        <>
          Déjà inscrit ?{" "}
          <Link href="/login" className="font-semibold text-[var(--ca-accent)] hover:underline">
            Connexion
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[var(--ca-ink)]">Nom</label>
          <Input
            autoComplete="name"
            placeholder="Votre nom"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
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
            autoComplete="new-password"
            placeholder={`${PASSWORD_MIN}+ caractères, lettre + chiffre`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={PASSWORD_MIN}
            required
          />
          {password ? (
            <div className="mt-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold" style={{ color: strengthTone }}>
                  Force : {strengthLabel}
                </span>
              </div>
              <div className="mt-1.5 flex gap-1">
                {[1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 flex-1 rounded-full bg-[var(--ca-surface-2)]"
                    style={{
                      background: strength.score >= i ? strengthTone : undefined,
                    }}
                  />
                ))}
              </div>
              {!strength.ok ? (
                <ul className="mt-2 space-y-0.5 text-[11px] text-[var(--ca-ink-muted)]">
                  {strength.hints.map((h) => (
                    <li key={h}>- {h}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-[var(--ca-low)]">
                  <IconCheck size={12} /> Critères minimums atteints
                </p>
              )}
            </div>
          ) : null}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[var(--ca-ink)]">
            Confirmer le mot de passe
          </label>
          <Input
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Répétez le mot de passe"
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
        <Button type="submit" className="w-full" disabled={loading}>
          <IconCode size={16} />
          {loading ? "Création…" : "Créer mon compte"}
        </Button>
      </form>
    </AuthShell>
  );
}

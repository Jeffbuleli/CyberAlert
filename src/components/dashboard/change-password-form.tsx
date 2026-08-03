"use client";

import { FormEvent, useMemo, useState } from "react";
import { Badge, Button, Input, MetaChip, SurfaceCard } from "@/components/ui/primitives";
import { IconLock } from "@/components/icons";
import { BrandLogo } from "@/components/brand/logo";
import { checkPasswordStrength, PASSWORD_MIN } from "@/lib/auth/password-policy";

export function ChangePasswordForm() {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const strength = useMemo(() => checkPasswordStrength(newPassword), [newPassword]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    if (!strength.ok) {
      setError(strength.message || "Mot de passe trop faible.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "Modification impossible.");
        return;
      }
      setOk(true);
      setCurrent("");
      setNew("");
      setConfirm("");
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SurfaceCard className="overflow-hidden p-0">
      <div className="flex items-center gap-3 border-b border-[var(--ca-border)] bg-[var(--ca-accent-soft)]/40 px-4 py-3">
        <BrandLogo size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--ca-accent)]">
            Sécurité du compte
          </p>
          <p className="text-sm font-bold text-[var(--ca-ink)]">Changer le mot de passe</p>
        </div>
        <Badge tone="info">Protégé</Badge>
      </div>
      <form onSubmit={onSubmit} className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          <MetaChip label="bcrypt" />
          <MetaChip label={`${PASSWORD_MIN}+ caractères`} />
          <MetaChip label="Lettre + chiffre" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Mot de passe actuel</label>
          <Input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Nouveau mot de passe</label>
          <Input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
            minLength={PASSWORD_MIN}
            required
          />
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
          <p className="rounded-2xl border border-[var(--ca-high)]/20 bg-[var(--ca-high-soft)] px-3 py-2 text-sm text-[var(--ca-high)]">
            {error}
          </p>
        ) : null}
        {ok ? (
          <p className="rounded-2xl border border-[var(--ca-low)]/20 bg-[var(--ca-low-soft)] px-3 py-2 text-sm font-medium text-[var(--ca-low)]">
            Mot de passe mis à jour.
          </p>
        ) : null}
        <Button type="submit" variant="secondary" disabled={loading} className="w-full">
          <IconLock size={16} />
          {loading ? "Mise à jour…" : "Enregistrer le nouveau mot de passe"}
        </Button>
      </form>
    </SurfaceCard>
  );
}

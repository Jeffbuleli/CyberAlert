"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand/logo";
import { Badge, Button, Input, MetaChip, SurfaceCard } from "@/components/ui/primitives";
import { trackClient } from "@/lib/analytics/client";
import { IconLock } from "@/components/icons";

export function UpgradeCheckout({
  planCode,
  planName = "Developer Pro",
  priceLabel = "15 $ / mois",
}: {
  planCode: string;
  planName?: string;
  priceLabel?: string;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    trackClient("upgrade_viewed", { planCode });
    trackClient("payment_started", { planCode });
    try {
      const res = await fetch("/api/payments/momo/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode, phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data.message ||
            (res.status === 401
              ? "Connectez-vous pour payer Developer Pro."
              : "Paiement impossible."),
        );
        return;
      }
      router.push(`/pricing/payment/${data.paymentId}`);
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SurfaceCard className="overflow-hidden p-0">
      <div className="flex items-center gap-3 border-b border-[var(--ca-border)] bg-[var(--ca-surface)]/80 px-4 py-3">
        <BrandLogo size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--ca-accent)]">
            Paiement Mobile Money
          </p>
          <p className="text-sm font-bold text-[var(--ca-ink)]">{planName}</p>
        </div>
        <Badge tone="info">Pro</Badge>
      </div>
      <form onSubmit={onSubmit} className="space-y-3 p-4 sm:p-5">
        <dl className="rounded-2xl border border-[var(--ca-border)] bg-[var(--ca-surface)]/70 px-4 py-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--ca-ink-muted)]">Montant</dt>
            <dd className="font-bold text-[var(--ca-ink)]">{priceLabel}</dd>
          </div>
          <div className="mt-2 flex justify-between gap-3">
            <dt className="text-[var(--ca-ink-muted)]">Réseaux</dt>
            <dd className="font-semibold text-[var(--ca-ink)]">Orange · M-Pesa · Airtel</dd>
          </div>
          <div className="mt-2 flex justify-between gap-3">
            <dt className="text-[var(--ca-ink-muted)]">Devise</dt>
            <dd className="font-semibold text-[var(--ca-ink)]">USD (Mobile Money)</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <MetaChip label="Confirmation sur téléphone" />
          <MetaChip label="Pas de CB stockée" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Numéro Mobile Money</label>
          <Input
            placeholder="ex. 097xxxxxxx ou 24397xxxxxxx"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            autoComplete="tel"
            required
          />
        </div>
        {error ? (
          <p className="rounded-2xl border border-[var(--ca-high)]/20 bg-[var(--ca-high-soft)] px-3 py-2 text-sm font-medium text-[var(--ca-high)]">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={loading}>
          <IconLock size={16} />
          {loading ? "Initialisation…" : "Payer maintenant"}
        </Button>
        <p className="text-center text-[11px] text-[var(--ca-ink-subtle)]">
          Validez le prompt sur votre téléphone. L&apos;activation Pro suit la confirmation serveur.
        </p>
      </form>
    </SurfaceCard>
  );
}

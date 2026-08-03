"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand/logo";
import { Badge, Button, Input, MetaChip, SurfaceCard } from "@/components/ui/primitives";
import { trackClient } from "@/lib/analytics/client";
import { IconLock } from "@/components/icons";

export function UpgradeCheckout({ planCode }: { planCode: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    trackClient("upgrade_viewed", { planCode });
    trackClient("payment_started", { planCode });
    try {
      const res = await fetch("/api/payments/pawapay/init", {
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
      setMessage(
        `Paiement initié (${data.localAmount} ${data.localCurrency}). Validez sur votre téléphone. Réf. ${data.paymentId}`,
      );
      router.refresh();
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
            Checkout sécurisé
          </p>
          <p className="text-sm font-bold text-[var(--ca-ink)]">PawaPay Mobile Money</p>
        </div>
        <Badge tone="info">Pro</Badge>
      </div>
      <form onSubmit={onSubmit} className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          <MetaChip label="Confirmation serveur" />
          <MetaChip label="Pas de CB stockée" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Numéro Mobile Money</label>
          <Input
            placeholder="ex. 097xxxxxxx"
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
        {message ? (
          <p className="rounded-2xl border border-[var(--ca-low)]/20 bg-[var(--ca-low-soft)] px-3 py-2 text-sm font-medium text-[var(--ca-low)]">
            {message}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={loading}>
          <IconLock size={16} />
          {loading ? "Initialisation…" : "Payer avec PawaPay"}
        </Button>
      </form>
    </SurfaceCard>
  );
}

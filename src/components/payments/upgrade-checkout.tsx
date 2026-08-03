"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui/primitives";
import { trackClient } from "@/lib/analytics/client";

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
    const res = await fetch("/api/payments/pawapay/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planCode, phone }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.message || "Paiement impossible.");
      return;
    }
    setMessage(
      `Paiement initié (${data.localAmount} ${data.localCurrency}). Validez sur votre téléphone. Réf. ${data.paymentId}`,
    );
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-[var(--ca-border)] bg-white p-5">
      <Input
        placeholder="Numéro Mobile Money (ex. 097xxxxxxx)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
      />
      {error ? <p className="text-sm text-[var(--ca-high)]">{error}</p> : null}
      {message ? <p className="text-sm text-[var(--ca-low)]">{message}</p> : null}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Initialisation..." : "Payer avec PawaPay"}
      </Button>
    </form>
  );
}

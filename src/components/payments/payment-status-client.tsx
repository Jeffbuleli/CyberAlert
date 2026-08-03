"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand/logo";
import { Badge, Button, SurfaceCard } from "@/components/ui/primitives";

export function PaymentStatusClient({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState("processing");
  const [amount, setAmount] = useState<string | null>(null);
  const [currency, setCurrency] = useState("CDF");

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const res = await fetch(`/api/payments/${paymentId}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) {
          setStatus(data.status || "processing");
          if (data.localAmount) setAmount(data.localAmount);
          if (data.localCurrency) setCurrency(data.localCurrency);
          if (data.status === "completed") {
            timer = setTimeout(() => router.push("/dashboard"), 1800);
            return;
          }
          if (data.status === "failed" || data.status === "cancelled") return;
        }
      } catch {
        /* keep polling */
      }
      if (!cancelled) timer = setTimeout(poll, 4000);
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [paymentId, router]);

  const done = status === "completed";
  const failed = status === "failed" || status === "cancelled";

  return (
    <SurfaceCard className="overflow-hidden p-0">
      <div className="flex items-center gap-3 border-b border-[var(--ca-border)] bg-[var(--ca-surface)]/80 px-4 py-3">
        <BrandLogo size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--ca-accent)]">
            Statut du paiement
          </p>
          <p className="text-sm font-bold text-[var(--ca-ink)]">Mobile Money</p>
        </div>
        <Badge tone={done ? "low" : failed ? "high" : "info"}>
          {done ? "Confirmé" : failed ? "Échec" : "En cours"}
        </Badge>
      </div>
      <div className="space-y-4 p-5 text-center">
        {!done && !failed ? (
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[var(--ca-accent)] border-t-transparent" />
        ) : null}
        <p className="text-base font-semibold text-[var(--ca-ink)]">
          {done
            ? "Paiement confirmé - Pro activé."
            : failed
              ? "Le paiement n'a pas abouti."
              : "Validez le prompt sur votre téléphone."}
        </p>
        {amount ? (
          <p className="text-sm text-[var(--ca-ink-muted)]">
            Montant : {amount} {currency}
          </p>
        ) : null}
        <p className="font-mono text-[11px] text-[var(--ca-ink-subtle)]">Réf. {paymentId}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          {done ? (
            <Link href="/dashboard">
              <Button>Aller à mon espace</Button>
            </Link>
          ) : null}
          {failed ? (
            <Link href="/pricing/pay">
              <Button>Réessayer</Button>
            </Link>
          ) : null}
          <Link href="/pricing">
            <Button variant="ghost">Tarifs</Button>
          </Link>
        </div>
      </div>
    </SurfaceCard>
  );
}

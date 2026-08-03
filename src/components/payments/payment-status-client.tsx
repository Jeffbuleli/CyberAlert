"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand/logo";
import { Badge, Button, MetaChip, SurfaceCard } from "@/components/ui/primitives";
import { McBuleliPoweredFooter } from "@/components/brand/mcbuleli-powered-footer";

type PaymentPayload = {
  id: string;
  status: string;
  localAmount: string | null;
  localCurrency: string | null;
  planCode: string | null;
  providerRef: string | null;
  phone: string | null;
};

function StatusGlyph({ kind }: { kind: "wait" | "ok" | "fail" }) {
  if (kind === "ok") {
    return (
      <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[var(--ca-low-soft)] text-[var(--ca-low)] shadow-[0_12px_28px_-16px_rgba(16,140,80,0.7)]">
        <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
          <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (kind === "fail") {
    return (
      <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[var(--ca-high-soft)] text-[var(--ca-high)]">
        <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  return (
    <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[var(--ca-accent-soft)] text-[var(--ca-accent)]">
      <svg className="h-8 w-8 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.22" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 1-9 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function PaymentStatusClient({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [data, setData] = useState<PaymentPayload | null>(null);
  const [error, setError] = useState(false);
  const redirected = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const res = await fetch(`/api/payments/${paymentId}`, { cache: "no-store" });
        const json = (await res.json().catch(() => ({}))) as PaymentPayload & {
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setError(true);
          timer = setTimeout(poll, 5000);
          return;
        }
        setError(false);
        setData(json);
        if (json.status === "completed" || json.status === "failed" || json.status === "cancelled") {
          return;
        }
      } catch {
        if (!cancelled) setError(true);
      }
      if (!cancelled) timer = setTimeout(poll, 3500);
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [paymentId]);

  const status = data?.status || "processing";
  const done = status === "completed";
  const failed = status === "failed" || status === "cancelled";
  const waiting = !done && !failed;

  useEffect(() => {
    if (!done || redirected.current) return;
    redirected.current = true;
    const t = window.setTimeout(() => router.push("/dashboard"), 2200);
    return () => window.clearTimeout(t);
  }, [done, router]);

  const title = done
    ? "Paiement confirmé"
    : failed
      ? "Paiement non abouti"
      : "En attente de confirmation";
  const subtitle = done
    ? "Developer Pro est activé. Redirection vers votre espace…"
    : failed
      ? "Le débit n'a pas été confirmé. Vous pouvez réessayer avec le même numéro."
      : "Validez le prompt Mobile Money sur votre téléphone. Nous confirmons ensuite côté serveur.";

  return (
    <article className="relative mx-auto w-full max-w-md overflow-hidden rounded-[28px] border border-[var(--ca-border)] bg-[#FAFBFE] shadow-[0_24px_64px_-30px_rgba(12,24,48,0.45)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse at top right, color-mix(in srgb, var(--ca-accent) 14%, transparent), transparent 55%)",
        }}
      />

      <div className="relative z-10 flex items-center gap-3 border-b border-[var(--ca-border)]/80 bg-white/70 px-5 py-3.5 backdrop-blur">
        <BrandLogo size={44} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--ca-accent)]">
            Cyber Alert DRC · Paiement
          </p>
          <p className="text-sm font-bold text-[var(--ca-ink)]">Mobile Money</p>
        </div>
        <Badge tone={done ? "low" : failed ? "high" : "info"}>
          {done ? "Confirmé" : failed ? "Échec" : "En cours"}
        </Badge>
      </div>

      <div className="relative z-10 space-y-5 px-5 py-7 text-center sm:px-7">
        <div className="flex justify-center">
          <StatusGlyph kind={done ? "ok" : failed ? "fail" : "wait"} />
        </div>

        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-[var(--ca-ink)]">{title}</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--ca-ink-muted)]">
            {subtitle}
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <MetaChip label="Orange · M-Pesa · Airtel" />
          <MetaChip label="Confirmation serveur" />
        </div>

        <SurfaceCard variant="inset" className="px-4 py-3 text-left text-sm">
          <dl className="space-y-2">
            {data?.localAmount ? (
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--ca-ink-muted)]">Montant</dt>
                <dd className="font-bold text-[var(--ca-ink)]">
                  {data.localAmount} {data.localCurrency || "USD"}
                </dd>
              </div>
            ) : null}
            {data?.planCode ? (
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--ca-ink-muted)]">Plan</dt>
                <dd className="font-semibold text-[var(--ca-ink)]">{data.planCode}</dd>
              </div>
            ) : null}
            {data?.phone ? (
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--ca-ink-muted)]">Numéro</dt>
                <dd className="font-semibold text-[var(--ca-ink)]">{data.phone}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--ca-ink-muted)]">Référence</dt>
              <dd className="max-w-[58%] truncate font-mono text-[11px] text-[var(--ca-ink)]">
                {data?.providerRef || paymentId}
              </dd>
            </div>
          </dl>
        </SurfaceCard>

        {error && waiting ? (
          <p className="text-[12px] font-medium text-[var(--ca-caution)]">
            Vérification momentanément indisponible - nouvelle tentative…
          </p>
        ) : null}

        {waiting ? (
          <p className="text-[11px] font-medium text-[var(--ca-ink-subtle)]">
            Ne fermez pas cette page. Le statut se met à jour automatiquement.
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          {done ? (
            <Link href="/dashboard">
              <Button className="w-full sm:w-auto">Aller à mon espace</Button>
            </Link>
          ) : null}
          {failed ? (
            <Link href="/pricing/pay">
              <Button className="w-full sm:w-auto">Réessayer</Button>
            </Link>
          ) : null}
          <Link href="/pricing">
            <Button variant="ghost" className="w-full sm:w-auto">
              Tarifs
            </Button>
          </Link>
        </div>
      </div>

      <div className="relative z-10 border-t border-[var(--ca-border)] bg-white/80 px-5 py-4">
        <McBuleliPoweredFooter />
      </div>
    </article>
  );
}

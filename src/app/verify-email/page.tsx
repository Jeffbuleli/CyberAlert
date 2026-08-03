"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/primitives";

function VerifyInner() {
  const sp = useSearchParams();
  const token = sp.get("token") || "";
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("Vérification en cours…");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Lien invalide.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setStatus("error");
          setMessage(data.message || "Vérification impossible.");
          return;
        }
        setStatus("ok");
        setMessage(data.message || "Email confirmé.");
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("Erreur réseau.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <AuthShell
      title="Vérification email"
      subtitle="Confirmation de votre adresse pour sécuriser le compte."
      badge="Email"
      footer={
        <Link href="/dashboard" className="font-semibold text-[var(--ca-accent)] hover:underline">
          Mon espace
        </Link>
      }
    >
      <p
        className={`rounded-2xl px-3 py-2.5 text-sm font-medium ${
          status === "ok"
            ? "border border-[var(--ca-low)]/20 bg-[var(--ca-low-soft)] text-[var(--ca-low)]"
            : status === "error"
              ? "border border-[var(--ca-high)]/20 bg-[var(--ca-high-soft)] text-[var(--ca-high)]"
              : "border border-[var(--ca-border)] bg-[var(--ca-surface)] text-[var(--ca-ink-muted)]"
        }`}
      >
        {message}
      </p>
      <div className="mt-4">
        <Link href="/dashboard">
          <Button className="w-full">Continuer</Button>
        </Link>
      </div>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-sm">Chargement…</div>}>
      <VerifyInner />
    </Suspense>
  );
}

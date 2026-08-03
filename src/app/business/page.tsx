"use client";

import { FormEvent, useState } from "react";
import { Section, Button, Input } from "@/components/ui/primitives";
import { IconBuilding } from "@/components/icons";

export default function BusinessPage() {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/audit-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organization: fd.get("organization"),
        contactName: fd.get("contactName"),
        contactEmail: fd.get("contactEmail"),
        contactPhone: fd.get("contactPhone"),
        serviceType: fd.get("serviceType"),
        message: fd.get("message"),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("Envoi impossible. Réessayez.");
      return;
    }
    setDone(true);
  }

  return (
    <Section className="py-14 sm:py-20">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--ca-surface-2)]">
            <IconBuilding />
          </span>
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Vous représentez une entreprise ?</h1>
            <p className="text-sm text-[var(--ca-ink-muted)]">
              Protégez votre présence numérique - audits à partir de 100 USD (configurable).
            </p>
          </div>
        </div>

        <ul className="mt-8 grid gap-2 text-sm text-[var(--ca-ink-muted)] sm:grid-cols-2">
          <li>- Security Audit</li>
          <li>- Web application audit</li>
          <li>- API audit</li>
          <li>- Rapport exécutif et technique</li>
          <li>- Accompagnement et retest</li>
          <li>- Monitoring (dès 50 USD / mois)</li>
        </ul>

        {done ? (
          <div className="mt-8 rounded-2xl border border-[var(--ca-border)] bg-white p-6">
            <p className="font-semibold">Demande reçue</p>
            <p className="mt-1 text-sm text-[var(--ca-ink-muted)]">
              Nous vous recontacterons pour préciser le périmètre et le devis.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-3 rounded-2xl border border-[var(--ca-border)] bg-white p-5">
            <h2 className="font-semibold">Demander un audit</h2>
            <Input name="organization" placeholder="Organisation" required />
            <Input name="contactName" placeholder="Nom du contact" required />
            <Input name="contactEmail" type="email" placeholder="Email" required />
            <Input name="contactPhone" placeholder="Téléphone (Mobile Money)" />
            <select
              name="serviceType"
              className="w-full rounded-xl border border-[var(--ca-border)] px-4 py-3.5"
              defaultValue="security_audit"
            >
              <option value="security_audit">Security Audit</option>
              <option value="web_audit">Web application audit</option>
              <option value="api_audit">API audit</option>
              <option value="monitoring">Monitoring</option>
              <option value="custom">Sur devis</option>
            </select>
            <textarea
              name="message"
              className="min-h-[90px] w-full rounded-xl border border-[var(--ca-border)] px-4 py-3"
              placeholder="Contexte (facultatif)"
            />
            {error ? <p className="text-sm text-[var(--ca-high)]">{error}</p> : null}
            <Button type="submit" disabled={loading} className="w-full">
              Envoyer la demande
            </Button>
          </form>
        )}
      </div>
    </Section>
  );
}

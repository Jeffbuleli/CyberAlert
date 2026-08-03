"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Input, Section } from "@/components/ui/primitives";
import { IconFlag } from "@/components/icons";

const CATEGORIES = [
  { value: "phishing", label: "Phishing" },
  { value: "brand_impersonation", label: "Usurpation de marque" },
  { value: "fake_contest", label: "Faux concours" },
  { value: "fake_promo", label: "Fausse promotion" },
  { value: "financial_scam", label: "Arnaque financière" },
  { value: "fake_service", label: "Faux service" },
  { value: "suspected_malware", label: "Malware suspecté" },
  { value: "other", label: "Autre" },
];

export default function ReportClient() {
  const sp = useSearchParams();
  const [url, setUrl] = useState(sp.get("url") || "");
  const [category, setCategory] = useState("phishing");
  const [comment, setComment] = useState("");
  const [source, setSource] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fromCheck = useMemo(() => sp.get("from"), [sp]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, category, comment, source, linkCheckId: fromCheck }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Envoi impossible.");
        setLoading(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Section className="py-12 sm:py-16">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--ca-high-soft)] text-[var(--ca-high)]">
            <IconFlag />
          </span>
          <div>
            <h1 className="text-2xl font-bold">Signaler un site</h1>
            <p className="text-sm text-[var(--ca-ink-muted)]">
              Sans compte - file de modération - pas de publication automatique.
            </p>
          </div>
        </div>

        {done ? (
          <div className="mt-8 rounded-2xl border border-[var(--ca-border)] bg-white p-6">
            <h2 className="font-semibold text-[var(--ca-ink)]">Merci pour votre signalement</h2>
            <p className="mt-2 text-sm text-[var(--ca-ink-muted)]">
              Notre équipe examinera ce signal avant toute action. Aucune accusation n&apos;est
              publiée automatiquement.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">URL</label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Catégorie</label>
              <select
                className="w-full rounded-xl border border-[var(--ca-border)] bg-white px-4 py-3.5"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Commentaire (facultatif)</label>
              <textarea
                className="min-h-[100px] w-full rounded-xl border border-[var(--ca-border)] bg-white px-4 py-3"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={2000}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Source (facultatif)</label>
              <Input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="WhatsApp, SMS, email..."
              />
            </div>
            {error ? <p className="text-sm text-[var(--ca-high)]">{error}</p> : null}
            <Button type="submit" disabled={loading} className="w-full">
              Envoyer le signalement
            </Button>
          </form>
        )}
      </div>
    </Section>
  );
}
